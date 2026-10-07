import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { catalogRepository } from '@/services';
import { selectEntryByKey, useHistoryStore } from '@/store/useHistoryStore';
import type { Media } from '@/types/media';
import type { HistoryEntry, MediaRef, Rating } from '@/types/rating';
import { buildMediaKey } from '@/utils/mediaKey';
import {
  detailReducer,
  detailView,
  initialDetailState,
  type DetailEntry,
  type DetailState,
  type DetailView,
} from './detailMachine';
import { selectionRef, type DetailParams } from './detailParams';

export const SAVE_ERROR_MESSAGE = 'No se pudo guardar. Inténtalo de nuevo.';

export type DetailLoad =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'ready'; media: Media };

const toDetailEntry = (e: HistoryEntry | undefined): DetailEntry | null =>
  e ? { userRating: e.userRating, aiPrediction: e.aiPrediction, predictionSeen: e.predictionSeen } : null;

/** Carga el titulo del catalogo. Se llama con la ficha ya montada por clave tipo-id. */
export function useDetailMedia(params: DetailParams): DetailLoad & { reload: () => void } {
  const { id, type } = params;
  const [state, setState] = useState<DetailLoad>(id === null ? { status: 'notFound' } : { status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (id === null) {
      setState({ status: 'notFound' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    catalogRepository
      .getMediaById(type, id)
      .then((media) => {
        if (!cancelled) setState(media ? { status: 'ready', media } : { status: 'notFound' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'notFound' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, type, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

export interface DetailData {
  season: number | null;
  episode: number | null;
  setSelection: (sel: { season: number | null; episode: number | null }) => void;
  state: DetailState;
  view: DetailView;
  /** Valor para SlotReveal (null mientras el guardado no ha terminado). */
  slotValue: number | null;
  setRating: (rating: Rating) => void;
  onPrimaryPress: () => void;
  onRevealed: () => void;
}

/** Conecta la maquina de la Ficha con el store de historial. Montar con key tipo-id. */
export function useDetailData(media: Media, params: DetailParams): DetailData {
  const toast = useToast();
  const addEntry = useHistoryStore((s) => s.addEntry);
  const [selection, setSelectionState] = useState({ season: params.season, episode: params.episode });

  const ref: MediaRef = useMemo(
    () => selectionRef(media.media_type, media.id, selection.season, selection.episode),
    [media.media_type, media.id, selection.season, selection.episode],
  );
  const key = buildMediaKey(ref);
  const keyRef = useRef(key);
  keyRef.current = key;

  const [state, dispatch] = useReducer(detailReducer, undefined, () =>
    initialDetailState(toDetailEntry(selectEntryByKey(key)(useHistoryStore.getState()))),
  );
  // true mientras addEntry no ha respondido: SlotReveal no recibe valor y no frena antes de guardar.
  const [saving, setSaving] = useState(false);

  const setSelection = useCallback(
    (sel: { season: number | null; episode: number | null }) => {
      const season = sel.season;
      const episode = season === null ? null : sel.episode;
      const nextKey = buildMediaKey(selectionRef(media.media_type, media.id, season, episode));
      setSelectionState({ season, episode });
      setSaving(false);
      dispatch({
        type: 'selectionChanged',
        entry: toDetailEntry(selectEntryByKey(nextKey)(useHistoryStore.getState())),
      });
    },
    [media.media_type, media.id],
  );

  const setRating = useCallback((rating: Rating) => dispatch({ type: 'setRating', rating }), []);

  const view = detailView(state);

  const onPrimaryPress = useCallback(() => {
    const action = view.action;
    const draft = state.draft;
    if (action === null || draft === null) return;
    const startedKey = keyRef.current;
    const previous = state.entry;
    dispatch({ type: 'save' });
    setSaving(true);
    addEntry({ mediaRef: ref, userRating: draft, origin: 'detail' })
      .then((saved) => {
        if (keyRef.current !== startedKey) return;
        setSaving(false);
        if (action !== 'update') dispatch({ type: 'predictionReady', prediction: saved.aiPrediction });
      })
      .catch(() => {
        toast.show(SAVE_ERROR_MESSAGE);
        if (keyRef.current !== startedKey) return;
        setSaving(false);
        if (action === 'update') {
          // Deshace la actualizacion optimista conservando el borrador.
          dispatch({ type: 'selectionChanged', entry: previous });
          dispatch({ type: 'setRating', rating: draft });
        } else {
          dispatch({ type: 'saveFailed' });
        }
      });
  }, [view.action, state.draft, state.entry, addEntry, ref, toast]);

  const onRevealed = useCallback(() => dispatch({ type: 'revealDone' }), []);

  const slotValue = state.phase === 'rolling' && saving ? null : view.slotValue;

  return {
    season: selection.season,
    episode: selection.episode,
    setSelection,
    state,
    view,
    slotValue,
    setRating,
    onPrimaryPress,
    onRevealed,
  };
}
