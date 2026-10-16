import { create } from 'zustand';
import type { FeedCategory, FeedItem, FeedRow, Media, MediaWithAffinity } from '@/types/media';
import { affinity, bucketFromScore } from '@/recommender/affinity';
import { eraPreference, pickExploreGenre, topGenres } from '@/recommender/reasons';
import { pickHiddenGems } from '@/recommender/hiddenGems';
import { catalogRepository } from '@/services';
import { activeRecommender, contentRecommend, type ContentRecommendation } from '@/services/recommender';
import { getRankingContext } from './rankingContext';
import { useProfileStore } from './useProfileStore';
import { useHistoryStore } from './useHistoryStore';
import { composeFeed } from '@/features/feed/composeFeed';
import { ROW_CATALOG, genreExploreRow, type RowDefinition } from '@/features/feed/rowCatalog';
import { postgrestCatalogSource } from '@/services/supabase/catalog/postgrest.repository';
import { mediaKeyOf } from '@/utils/media';

export type { FeedCategory, MediaWithAffinity } from '@/types/media';

export interface FeedState {
  // Estado original (se mantiene para backward compat con useFeedData)
  featured: MediaWithAffinity | null;
  categories: FeedCategory[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  page: number;
  hasMore: boolean;
  loadFirstPage: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  /** Vuelve a idle; llamar al cambiar el filtro global de plataformas o el historial. */
  reset: () => void;

  // P7: nuevo estado del feed personalizado
  hero: FeedItem[];
  top10: FeedItem[];
  rows: FeedRow[];
  rowsStatus: 'idle' | 'loading' | 'ready';
  rowsError: boolean;
  rowCursor: number;
  rowTotal: number;
  /** Pool interno de TODAS las filas compuestas (personalizadas + variadas). */
  _rowsPool: FeedRow[];
  /** P11: desplazamiento del siguiente tramo de recomendaciones del RPC (null = sin RPC). */
  _recOffset: number | null;
  /** P11: el RPC ya no tiene más recomendaciones. */
  _recsDone: boolean;
  loadNextRows: () => Promise<void>;
}

const INITIAL = {
  featured: null,
  categories: [] as FeedCategory[],
  status: 'idle' as const,
  page: 0,
  hasMore: false,
};

const INITIAL_ROWS = {
  hero: [] as FeedItem[],
  top10: [] as FeedItem[],
  rows: [] as FeedRow[],
  rowsStatus: 'idle' as const,
  rowsError: false,
  rowCursor: 0,
  rowTotal: 0,
  _rowsPool: [] as FeedRow[],
  _recOffset: null as number | null,
  _recsDone: false,
};

/** Recomendaciones que pide la primera carga y cada tramo siguiente (P11). */
const REC_FIRST = 80;
const REC_PAGE = 40;
/** Títulos por fila «Más para ti». */
const MORE_ROW_SIZE = 20;

// Contador para loadFirstPage / loadNextPage (descarta cargas obsoletas)
let loadId = 0;

// Contador INDEPENDIENTE para loadNextRows (evita invalidar carga inicial)
let rowsLoadId = 0;

// Cache de eraPreference: una vez por sesión, invalidado al cambiar historial.
let eraPrefCache: { entryCount: number; value: number | null } | null = null;

/**
 * F3: Calcula eraPreference con byIds del historial para obtener años reales.
 * Cacheada por session; invalidada en reset() o al cambiar longitud de entries.
 */
async function getEraPreference(): Promise<number | null> {
  const history = useHistoryStore.getState();
  const entries = history.entries;
  if (eraPrefCache && eraPrefCache.entryCount === entries.length) {
    return eraPrefCache.value;
  }
  if (entries.length === 0) {
    eraPrefCache = { entryCount: 0, value: null };
    return null;
  }

  // Construir mapa key → año haciendo byIds para cada tipo
  const yearsMap = new Map<string, number>();
  const movieIds = new Set<number>();
  const tvIds = new Set<number>();
  for (const e of entries) {
    const mt = e.ref.mediaType;
    if (mt === 'movie') movieIds.add(e.ref.mediaId);
    else tvIds.add(e.ref.mediaId);
  }

  try {
    const p: Promise<Media[]>[] = [];
    if (movieIds.size > 0) p.push(postgrestCatalogSource.byIds('movie', [...movieIds]));
    if (tvIds.size > 0) p.push(postgrestCatalogSource.byIds('tv', [...tvIds]));
    const results = await Promise.all(p);
    for (const batch of results) {
      for (const m of batch) {
        const key = `${m.media_type}:${m.id}`;
        let year: number | null = null;
        if (m.media_type === 'movie' && 'release_date' in m && m.release_date) {
          year = Number(m.release_date.slice(0, 4)) || null;
        } else if (m.media_type === 'tv' && 'first_air_date' in m && m.first_air_date) {
          year = Number(m.first_air_date.slice(0, 4)) || null;
        }
        if (year) yearsMap.set(key, year);
      }
    }
  } catch {
    // byIds falla → usamos mapa vacío (eraPreference devolverá null)
  }

  const value = eraPreference(entries, yearsMap);
  eraPrefCache = { entryCount: entries.length, value };
  return value;
}

function mergeCategories(current: FeedCategory[], incoming: FeedCategory[]): FeedCategory[] {
  const merged = current.map((c) => ({ ...c }));
  for (const cat of incoming) {
    const target = merged.find((c) => c.id === cat.id);
    if (!target) {
      merged.push(cat);
      continue;
    }
    const keys = new Set(target.media.map((m) => `${m.media.media_type}:${m.media.id}`));
    target.media = [
      ...target.media,
      ...cat.media.filter((m) => !keys.has(`${m.media.media_type}:${m.media.id}`)),
    ];
    target.hasSeeAll = cat.hasSeeAll;
  }
  return merged;
}

/**
 * Respaldo cuando no hay feed personalizado (RPC sin respuesta): hero y Top 10
 * salen del feed clásico (destacado + categorías), sin razón textual.
 */
export function fallbackHeroTop10(
  featured: MediaWithAffinity | null,
  categories: FeedCategory[],
): { hero: FeedItem[]; top10: FeedItem[] } {
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const it of [...(featured ? [featured] : []), ...categories.flatMap((c) => c.media)]) {
    const key = dedupKey(it.media);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ media: it.media, bucket: it.bucket, explanation: it.explanation });
  }
  return { hero: items.slice(0, 5), top10: items.slice(5, 15) };
}

function dedupKey(media: Media): string {
  return `${media.media_type}:${media.id}`;
}

/**
 * Construye la lista completa de definiciones de filas variadas
 * (ROW_CATALOG + género exploratorio).
 */
function buildAllVariedDefs(ctx: ReturnType<typeof getRankingContext>): RowDefinition[] {
  const defs: RowDefinition[] = [...ROW_CATALOG];
  const favGenres = topGenres(ctx.taste, 5);
  const explore = pickExploreGenre(favGenres);
  if (explore) {
    defs.push(genreExploreRow(explore.id, explore.name));
  }
  return defs;
}

/**
 * Rellena una fila variada con datos del catálogo, excluyendo ya mostrados.
 * Usa affinity() para bucket real, no valores fijos.
 * Para joyas ocultas usa pickHiddenGems real.
 */
async function fillRow(
  rowDef: RowDefinition,
  platforms: string[],
  excludeKeys: Set<string>,
  ctx: ReturnType<typeof getRankingContext>,
): Promise<FeedItem[]> {
  if (rowDef.id === 'hidden-gems') {
    // F5: Joyas ocultas usa pickHiddenGems real
    const result = await postgrestCatalogSource.browse({
      platforms,
      ...rowDef.params,
      limit: 30,
      cursor: 0,
    });
    const catalog = result.items.filter((m) => !excludeKeys.has(dedupKey(m)));
    const gems = pickHiddenGems(platforms, ctx, 0, catalog);
    return gems.items.map((m) => ({ media: m.media, bucket: m.bucket, explanation: m.explanation }));
  }

  // F4: Filas variadas con bucket real vía affinity()
  const result = await postgrestCatalogSource.browse({
    platforms,
    ...rowDef.params,
    limit: 15,
    cursor: 0,
  });
  return result.items
    .filter((m) => !excludeKeys.has(dedupKey(m)))
    .map((m) => ({
      media: m,
      bucket: affinity(ctx.taste, m, mediaKeyOf(m)),
    }));
}

/** Rellena las filas del feed compuesto, consultando catálogo para variadas. */
async function fillVariedRows(
  platforms: string[],
  rows: FeedRow[],
  excludeKeys: Set<string>,
  ctx: ReturnType<typeof getRankingContext>,
): Promise<{ filledRows: FeedRow[]; hadError: boolean }> {
  const filled: FeedRow[] = [];
  let hadError = false;

  for (const row of rows) {
    // Las filas personalizadas ya tienen items de composeFeed
    if (row.id.startsWith('personalized:')) {
      filled.push(row);
      continue;
    }

    // Filas variadas: consultar catálogo
    const rowDef = ROW_CATALOG.find((r) => r.id === row.id);
    if (!rowDef) continue;
    try {
      const items = await fillRow(rowDef, platforms, excludeKeys, ctx);
      // Una fila sin títulos no se muestra (cabecera con carrusel en blanco).
      if (items.length > 0) filled.push({ ...row, items });
    } catch {
      hadError = true;
    }
  }

  return { filledRows: filled, hadError };
}

type StoreSet = (partial: Partial<FeedState> | ((s: FeedState) => Partial<FeedState>)) => void;

/**
 * P11: cuando se acaban las filas, pide el siguiente tramo al RPC (`p_offset`) y lo
 * añade como fila «Más para ti». Sin RPC, o con el RPC agotado, no hace nada.
 */
async function loadMoreRecommendations(set: StoreSet, get: () => FeedState): Promise<void> {
  const { _recOffset: offset, _recsDone: done } = get();
  if (done || offset === null || activeRecommender() !== 'content') return;
  const rid = ++rowsLoadId;
  set({ rowsStatus: 'loading' });
  try {
    const platforms = useProfileStore.getState().profile.favoritePlatforms;
    const ctx = getRankingContext();
    const recs = await contentRecommend({ platforms, limit: REC_PAGE, offset });
    if (rid !== rowsLoadId) return;
    if (!recs) {
      set({ rowsStatus: 'ready', _recsDone: true });
      return;
    }
    const s = get();
    const shown = new Set<string>(ctx.seenKeys);
    for (const it of [...s.hero, ...s.top10]) shown.add(dedupKey(it.media));
    for (const r of s.rows) for (const it of r.items) shown.add(dedupKey(it.media));
    const items: FeedItem[] = [];
    for (const r of recs) {
      const key = dedupKey(r.media);
      if (shown.has(key)) continue;
      shown.add(key);
      items.push({ media: r.media, bucket: bucketFromScore(r.score), explanation: r.explanation });
      if (items.length >= MORE_ROW_SIZE) break;
    }
    const progress = { _recOffset: offset + recs.length, _recsDone: recs.length < REC_PAGE };
    if (items.length === 0) {
      set({ rowsStatus: 'ready', ...progress });
      return;
    }
    set((cur) => ({
      rows: [
        ...cur.rows,
        { id: `more-${offset}`, title: 'Más para ti', subtitle: 'Por tu gusto personal', items, seeAll: null },
      ],
      rowTotal: cur.rowTotal + 1,
      rowCursor: cur.rowCursor + 1,
      rowsStatus: 'ready',
      rowsError: false,
      ...progress,
    }));
  } catch {
    if (rid === rowsLoadId) set({ rowsStatus: 'ready', rowsError: true, _recsDone: true });
  }
}

export const useFeedStore = create<FeedState>()((set, get) => ({
  ...INITIAL,
  ...INITIAL_ROWS,

  loadFirstPage: async () => {
    const id = ++loadId;
    set({ ...INITIAL, ...INITIAL_ROWS, status: 'loading' });
    try {
      const platforms = useProfileStore.getState().profile.favoritePlatforms;
      const ctx = getRankingContext();

      // F8: RPC call conditional - solo si activeRecommender es 'content'
      let rpcRecs: ContentRecommendation[] | null = null;
      if (activeRecommender() === 'content') {
        rpcRecs = await contentRecommend({ platforms, limit: REC_FIRST });
        if (id !== loadId) return;
      }

      // D2-2.6: si el recomendador es 'content' y responde, usa sus
      // candidatos (orden por afinidad real); si no (null) decae a la
      // heurística actual sin que el usuario note nada.
      let content: { featured: MediaWithAffinity | null; categories: FeedCategory[]; hasMore: boolean } | null = null;
      if (activeRecommender() === 'content' && rpcRecs && rpcRecs.length > 0) {
        content = {
          featured: {
            media: rpcRecs[0].media,
            bucket: bucketFromScore(rpcRecs[0].score),
            explanation: rpcRecs[0].explanation,
          },
          categories: [
            {
              id: 'recommendations',
              title: 'Recomendaciones',
              media: rpcRecs.slice(1, 6).map((r) => ({ media: r.media, bucket: bucketFromScore(r.score), explanation: r.explanation })),
              hasSeeAll: false,
            },
          ],
          hasMore: rpcRecs.length > 6,
        };
      }
      if (id !== loadId) return;

      // P7: feed personalizado con composeFeed
      let personalized = {
        hero: [] as FeedItem[],
        top10: [] as FeedItem[],
        rows: [] as FeedRow[],
      };

      if (rpcRecs && rpcRecs.length > 0) {
        try {
          // F1: Enriquece con byIds (2 consultas paralelas: movie + tv)
          const movieIds = rpcRecs.filter((r) => r.media.media_type === 'movie').map((r) => r.media.id);
          const tvIds = rpcRecs.filter((r) => r.media.media_type === 'tv').map((r) => r.media.id);
          const enriched = new Map<string, Media>();
          try {
            const [movies, tvs] = await Promise.all([
              movieIds.length > 0 ? postgrestCatalogSource.byIds('movie', movieIds) : Promise.resolve([]),
              tvIds.length > 0 ? postgrestCatalogSource.byIds('tv', tvIds) : Promise.resolve([]),
            ]);
            // CORREGIDO: enriquecer cuando la petición NO es obsoleta (id === loadId)
            if (id === loadId) {
              for (const m of [...movies, ...tvs]) {
                enriched.set(dedupKey(m), m);
              }
            }
          } catch {
            // byIds falla → seguimos con datos del RPC
          }

          // F3: eraPreference con byIds del historial (async)
          const eraPref = await getEraPreference();
          if (id !== loadId) return;

          // 4. composeFeed con enriched REAL
          personalized = composeFeed({
            recs: rpcRecs,
            enriched,
            taste: ctx.taste,
            eraPref,
            seenKeys: ctx.seenKeys,
          });
        } catch {
          // Fallo en composeFeed → vacíos
        }
      }

      if (id !== loadId) return;

      // 5. Rellena filas (con try-catch para degradación graciosa)
      let finalRows: FeedRow[] = [];
      let poolRows: FeedRow[] = [];
      let rowsErr = false;

      try {
        const shownKeys = new Set<string>();
        for (const item of personalized.hero) shownKeys.add(dedupKey(item.media));
        for (const item of personalized.top10) shownKeys.add(dedupKey(item.media));
        for (const key of ctx.seenKeys) shownKeys.add(key);

        // Construir lista de definiciones de filas variadas disponibles
        const allVariedDefs = buildAllVariedDefs(ctx);
        if (id !== loadId) return;

        if (personalized.rows.length > 0) {
          try {
            const { filledRows, hadError } = await fillVariedRows(
              platforms,
              personalized.rows,
              shownKeys,
              ctx,
            );
            if (id !== loadId) return;
            finalRows = filledRows;
            rowsErr = hadError;
            // Pool: filas personalizadas + definiciones variadas no usadas
            const usedIds = new Set(personalized.rows.map((r) => r.id));
            const variedNotUsed = allVariedDefs.filter((d) => !usedIds.has(d.id));
            poolRows = [
              ...filledRows,
              ...variedNotUsed.map((d) => ({
                id: d.id,
                title: d.title,
                items: [] as FeedItem[],
                seeAll: d.seeAll ?? null,
              })),
            ];
          } catch {
            rowsErr = true;
          }
        } else {
          // F7: Sin recomendaciones → filas variadas de fallback (3 filas)
          const fallbackDefs = allVariedDefs.slice(0, 3);
          for (const rowDef of fallbackDefs) {
            try {
              const items = await fillRow(rowDef, platforms, shownKeys, ctx);
              if (id !== loadId) return;
              if (items.length > 0) {
                finalRows.push({
                  id: rowDef.id,
                  title: rowDef.title,
                  items,
                  seeAll: rowDef.seeAll ?? null,
                });
              }
            } catch {
              rowsErr = true;
            }
          }

          // Pool: las 3 filas de fallback + el resto de variadas
          poolRows = [
            ...finalRows,
            ...allVariedDefs.slice(3).map((d) => ({
              id: d.id,
              title: d.title,
              items: [] as FeedItem[],
              seeAll: d.seeAll ?? null,
            })),
          ];
        }
      } catch {
        // Fallo en filas variadas → continuar con rows vacíos
        rowsErr = true;
      }

      // Primera carga: hero + top10 + 3 filas como máximo
      const initialRowCount = Math.min(3, finalRows.length);
      const rowTotal = poolRows.length;

      const noPersonal = personalized.hero.length === 0 && personalized.top10.length === 0;
      if (content) {
        const fb = noPersonal ? fallbackHeroTop10(content.featured, content.categories) : null;
        set({
          featured: content.featured,
          categories: content.categories,
          hasMore: false,
          page: 0,
          status: 'ready',
          hero: fb ? fb.hero : personalized.hero,
          top10: fb ? fb.top10 : personalized.top10,
          rows: finalRows.slice(0, initialRowCount),
          _rowsPool: poolRows,
          rowCursor: initialRowCount,
          rowTotal,
          rowsStatus: 'ready',
          rowsError: rowsErr,
          _recOffset: rpcRecs && rpcRecs.length > 0 ? rpcRecs.length : null,
          _recsDone: !rpcRecs || rpcRecs.length < REC_FIRST,
        });
      } else {
        // Heurística
        const [featured, first] = await Promise.all([
          catalogRepository.getFeatured(platforms, ctx),
          catalogRepository.getFeedCategories(platforms, ctx, 0),
        ]);
        if (id !== loadId) return;
        const fb = noPersonal ? fallbackHeroTop10(featured, first.categories) : null;
        set({
          featured,
          categories: first.categories,
          hasMore: first.hasMore,
          page: 0,
          status: 'ready',
          hero: fb ? fb.hero : personalized.hero,
          top10: fb ? fb.top10 : personalized.top10,
          rows: finalRows.slice(0, initialRowCount),
          _rowsPool: poolRows,
          rowCursor: initialRowCount,
          rowTotal,
          rowsStatus: 'ready',
          rowsError: rowsErr,
          _recOffset: rpcRecs && rpcRecs.length > 0 ? rpcRecs.length : null,
          _recsDone: !rpcRecs || rpcRecs.length < REC_FIRST,
        });
      }
    } catch {
      if (id === loadId) set({ status: 'error' });
    }
  },

  loadNextPage: async () => {
    const { status, hasMore, page } = get();
    if (status !== 'ready' || !hasMore) return;
    const id = ++loadId;
    try {
      const platforms = useProfileStore.getState().profile.favoritePlatforms;
      const next = await catalogRepository.getFeedCategories(platforms, getRankingContext(), page + 1);
      if (id !== loadId) return;
      set((s) => ({
        categories: mergeCategories(s.categories, next.categories),
        hasMore: next.hasMore,
        page: page + 1,
      }));
    } catch {
      if (id === loadId) set({ status: 'error' });
    }
  },

  loadNextRows: async () => {
    // F2: Contador independiente — no invalida loadFirstPage
    // Early guard: return BEFORE incrementing counter to prevent
    // concurrent calls from bumping rid and invalidating each other.
    const { rowsStatus, rowCursor, rowTotal, _rowsPool } = get();
    if (rowsStatus === 'loading') return;
    if (rowCursor >= rowTotal) {
      // P11: filas agotadas → siguiente tramo de recomendaciones del RPC.
      await loadMoreRecommendations(set, get);
      return;
    }
    if (_rowsPool.length === 0) return;
    const rid = ++rowsLoadId;
    set({ rowsStatus: 'loading' });
    try {
      const platforms = useProfileStore.getState().profile.favoritePlatforms;
      const ctx = getRankingContext();

      // Recolecta keys ya mostradas
      const shownKeys = new Set<string>();
      const s = get();
      for (const item of s.hero) shownKeys.add(dedupKey(item.media));
      for (const item of s.top10) shownKeys.add(dedupKey(item.media));
      for (const row of s.rows) {
        for (const item of row.items) shownKeys.add(dedupKey(item.media));
      }

      // Servir desde _rowsPool a partir de rowCursor
      const newRows: FeedRow[] = [];
      let added = 0;
      const maxAdd = Math.min(2, _rowsPool.length - rowCursor);

      for (let i = rowCursor; i < _rowsPool.length && added < maxAdd; i++) {
        const poolEntry = _rowsPool[i];
        if (poolEntry.items.length > 0) {
          // Fila ya rellena (personalizada de composeFeed)
          newRows.push(poolEntry);
          added++;
        } else {
          // Fila vacía → rellenar con catálogo
          try {
            const rowDef = ROW_CATALOG.find((r) => r.id === poolEntry.id)
              || genreExploreRow(0, poolEntry.title);
            const items = await fillRow(rowDef, platforms, shownKeys, ctx);
            for (const item of items) shownKeys.add(dedupKey(item.media));
            // Fila vacía: se oculta, pero cuenta como consumida.
            if (items.length > 0) {
              newRows.push({
                id: poolEntry.id,
                title: poolEntry.title,
                items,
                seeAll: poolEntry.seeAll,
              });
            }
            added++;
          } catch {
            // Fila falla → omite pero cuenta como consumida
            added++;
          }
        }
      }

      if (rid !== rowsLoadId) return;
      set((s) => ({
        rows: [...s.rows, ...newRows],
        rowCursor: s.rowCursor + added,
        rowsStatus: 'ready',
        rowsError: false,
      }));
    } catch {
      if (rid === rowsLoadId) set({ rowsStatus: 'ready', rowsError: true });
    }
  },

  reset: () => {
    // Incrementa AMBOS contadores para descartar todo
    loadId++;
    rowsLoadId++;
    eraPrefCache = null;
    set({ ...INITIAL, ...INITIAL_ROWS });
  },
}));
