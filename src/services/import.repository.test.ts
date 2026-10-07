import JSZip from 'jszip';
import type { ImportErrorCode, ImportProgress } from '@/types/import';
import type { HistoryEntry } from '@/types/rating';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from '@/constants/import';
import { getMedia } from '@/mocks/data/catalog';
import { predict } from '@/mocks/mock-ai/predict';
import { buildTasteProfile } from '@/mocks/mock-ai/taste';
import { useHistoryStore } from '@/store/useHistoryStore';
import { createDefaultProfile, useProfileStore } from '@/store/useProfileStore';
import { IMPORT_ERROR_MESSAGES, importRepository } from './import.repository';

interface MockFile {
  text?: string;
  bytes?: Uint8Array;
  size?: number;
}
const mockFiles = new Map<string, MockFile>();

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    private get file(): MockFile {
      const f = mockFiles.get(this.uri);
      if (!f) throw new Error('no existe');
      return f;
    }
    get size(): number {
      const f = this.file;
      return f.size ?? (f.bytes ? f.bytes.length : Buffer.byteLength(f.text ?? '', 'utf8'));
    }
    async text(): Promise<string> {
      return this.file.text ?? '';
    }
    async bytes(): Promise<Uint8Array> {
      return this.file.bytes ?? new Uint8Array();
    }
  },
}));

const RATINGS_HEADER = 'Date,Name,Year,Letterboxd URI,Rating';
const WATCHED_HEADER = 'Date,Name,Year,Letterboxd URI';
const ratingsCsv = (...rows: string[]) => [RATINGS_HEADER, ...rows].join('\n');
const watchedCsv = (...rows: string[]) => [WATCHED_HEADER, ...rows].join('\n');
const row = (name: string, year: number, rating: number | string) =>
  `2024-03-01,${name},${year},https://boxd.it/x,${rating}`;

async function zipOf(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'uint8array' });
}

async function codeOf(p: Promise<unknown>): Promise<ImportErrorCode | undefined> {
  try {
    await p;
  } catch (e) {
    return (e as { code?: ImportErrorCode }).code;
  }
  return undefined;
}

const csv = (uri: string, text: string, name = 'ratings.csv') => {
  mockFiles.set(uri, { text });
  return { uri, name };
};

beforeEach(() => {
  mockFiles.clear();
  useProfileStore.setState({ profile: createDefaultProfile() });
  useHistoryStore.setState({ entries: [], watched: [] });
});

describe('importRepository.parseLetterboxd: lectura de ratings.csv', () => {
  it('cruza por titulo y anio, crea entradas con source letterboxd y predictionSeen false', async () => {
    const file = csv(
      'f1',
      ratingsCsv(row('Aftersun', 2022, 4.5), row('Past Lives', 2023, '3.5'), row('Pelicula inventada', 2020, 4)),
    );
    const r = await importRepository.parseLetterboxd(file);
    expect(r.totalRows).toBe(3);
    expect(r.matched).toBe(2);
    expect(r.unmatched).toBe(1);
    expect(r.alreadyPresent).toBe(0);
    expect(r.watched).toEqual([]);
    expect(r.entries.map((e) => [e.key, e.userRating])).toEqual([
      ['movie:1', 4.5],
      ['movie:2', 3.5],
    ]);
    for (const e of r.entries) {
      expect(e.source).toBe('letterboxd');
      expect(e.predictionSeen).toBe(false);
      expect(e.aiPrediction).toBeGreaterThanOrEqual(1);
      expect(e.aiPrediction).toBeLessThanOrEqual(5);
      expect(e.ratedAt).toBe('2024-03-01T00:00:00.000Z');
    }
    expect(r.entries[0].title).toBe('Aftersun');
  });

  it('no escribe en el historial (lo aplica importResult)', async () => {
    await importRepository.parseLetterboxd(csv('f', ratingsCsv(row('Aftersun', 2022, 4))));
    expect(useHistoryStore.getState().entries).toEqual([]);
  });

  it('tolerancia de anio +-1: 2023 y 2021 casan con Aftersun (2022), 2024 y 2020 no', async () => {
    const file = csv(
      'f',
      ratingsCsv(row('Aftersun', 2021, 4), row('Past Lives', 2024, 3), row('Burning', 2020, 3), row('Columbus', 2019, 3)),
    );
    const r = await importRepository.parseLetterboxd(file);
    expect(r.entries.map((e) => e.key)).toEqual(['movie:1', 'movie:2']);
    expect(r.unmatched).toBe(2);
  });

  it('cruza por alt_titles y sin tildes ni mayusculas', async () => {
    const file = csv('f', ratingsCsv(row('Parasite', 2019, 5), row('PARÁSITOS', 2019, 4), row('vidas pasadas', 2023, 3)));
    const r = await importRepository.parseLetterboxd(file);
    expect(r.entries.map((e) => e.key)).toEqual(['movie:6', 'movie:2']);
    // Parasite y PARASITOS son la misma pelicula: la segunda cuenta como ya presente.
    expect(r.alreadyPresent).toBe(1);
  });

  it('nombres entre comillas con comas y BOM al inicio', async () => {
    const text = '﻿' + ratingsCsv('2024-01-01,"Fall: Miedo a bajar",2022,https://boxd.it/y,2.5');
    const r = await importRepository.parseLetterboxd(csv('f', text));
    expect(r.entries.map((e) => [e.key, e.userRating])).toEqual([['movie:7', 2.5]]);
  });

  it('no sobrescribe lo que ya esta en el historial y lo cuenta como alreadyPresent', async () => {
    const existing: HistoryEntry = {
      key: 'movie:1',
      ref: { mediaType: 'movie', mediaId: 1 },
      title: 'Aftersun',
      posterColor: '#000000',
      userRating: 2,
      aiPrediction: 3,
      predictionSeen: true,
      ratedAt: '2025-01-01T00:00:00.000Z',
      source: 'app',
    };
    useHistoryStore.setState({ entries: [existing] });
    const r = await importRepository.parseLetterboxd(
      csv('f', ratingsCsv(row('Aftersun', 2022, 5), row('Past Lives', 2023, 4))),
    );
    expect(r.alreadyPresent).toBe(1);
    expect(r.matched).toBe(1);
    expect(r.entries.map((e) => e.key)).toEqual(['movie:2']);
  });

  it('aiPrediction usa el perfil previo a la importacion', async () => {
    useProfileStore.setState({ profile: { ...createDefaultProfile(), initialRatings: { 3: 'like', 4: 'like' } } });
    const r = await importRepository.parseLetterboxd(csv('f', ratingsCsv(row('Aftersun', 2022, 1))));
    const taste = buildTasteProfile('user-me', { 3: 'like', 4: 'like' }, []);
    expect(r.entries[0].aiPrediction).toBe(predict(taste, getMedia('movie', 1)!, 'movie:1'));
  });

  it('una nota invalida cuenta como sin coincidencia', async () => {
    const r = await importRepository.parseLetterboxd(
      csv('f', ratingsCsv(row('Aftersun', 2022, 'abc'), row('Past Lives', 2023, 4))),
    );
    expect(r.unmatched).toBe(1);
    expect(r.entries).toHaveLength(1);
  });

  it('solo cruza peliculas (una serie del catalogo no casa)', async () => {
    const code = await codeOf(
      importRepository.parseLetterboxd(csv('f', ratingsCsv(row('Fallout', 2024, 5), row('Breaking Bad', 2008, 5)))),
    );
    expect(code).toBe('no-matches');
  });
});

describe('importRepository.parseLetterboxd: watched.csv y zip', () => {
  it('un watched.csv suelto alimenta watched y cuenta watchedOnlyMatched', async () => {
    const r = await importRepository.parseLetterboxd(
      csv('f', watchedCsv('2024-01-01,Aftersun,2022,u', '2024-01-01,Nada,2000,u'), 'watched.csv'),
    );
    expect(r.entries).toEqual([]);
    expect(r.watched).toEqual(['movie:1']);
    expect(r.watchedOnlyMatched).toBe(1);
    expect(r.totalRows).toBe(0);
  });

  it('zip con ratings.csv y watched.csv en la raiz; los vistos con nota no entran en watched', async () => {
    mockFiles.set('z', {
      bytes: await zipOf({
        'ratings.csv': ratingsCsv(row('Aftersun', 2022, 4)),
        'watched.csv': watchedCsv('2024-01-01,Aftersun,2022,u', '2024-01-01,Past Lives,2023,u'),
        'diary.csv': 'ignorado',
      }),
    });
    const r = await importRepository.parseLetterboxd({ uri: 'z', name: 'letterboxd-export.zip' });
    expect(r.entries.map((e) => e.key)).toEqual(['movie:1']);
    expect(r.watched).toEqual(['movie:2']);
    expect(r.watchedOnlyMatched).toBe(1);
  });

  it('zip con los archivos en una unica subcarpeta', async () => {
    mockFiles.set('z', {
      bytes: await zipOf({ 'letterboxd-user-2024/ratings.csv': ratingsCsv(row('Burning', 2018, 3.5)) }),
    });
    const r = await importRepository.parseLetterboxd({ uri: 'z', name: 'export.ZIP' });
    expect(r.entries.map((e) => e.key)).toEqual(['movie:3']);
  });

  it('zip sin ratings.csv ni watched.csv: zip-without-data', async () => {
    mockFiles.set('z', { bytes: await zipOf({ 'diary.csv': 'x', 'a/b/ratings.csv': 'profundo' }) });
    expect(await codeOf(importRepository.parseLetterboxd({ uri: 'z', name: 'e.zip' }))).toBe('zip-without-data');
  });

  it('zip corrupto: read-failed', async () => {
    mockFiles.set('z', { bytes: new Uint8Array([1, 2, 3, 4, 5]) });
    expect(await codeOf(importRepository.parseLetterboxd({ uri: 'z', name: 'e.zip' }))).toBe('read-failed');
  });
});

describe('importRepository.parseLetterboxd: errores de 7.2', () => {
  it('unsupported-type', async () => {
    mockFiles.set('f', { text: 'x' });
    expect(await codeOf(importRepository.parseLetterboxd({ uri: 'f', name: 'datos.txt' }))).toBe('unsupported-type');
  });

  it('too-large por tamano del archivo', async () => {
    mockFiles.set('f', { text: 'x', size: MAX_IMPORT_BYTES + 1 });
    expect(await codeOf(importRepository.parseLetterboxd({ uri: 'f', name: 'ratings.csv' }))).toBe('too-large');
  });

  it('too-large por mas de MAX_IMPORT_ROWS filas', async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => row('Aftersun', 2022, 4));
    expect(await codeOf(importRepository.parseLetterboxd(csv('f', ratingsCsv(...rows))))).toBe('too-large');
  });

  it('exactamente MAX_IMPORT_ROWS filas se acepta', async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS }, () => row('Aftersun', 2022, 4));
    const r = await importRepository.parseLetterboxd(csv('f', ratingsCsv(...rows)));
    expect(r.totalRows).toBe(MAX_IMPORT_ROWS);
    expect(r.matched).toBe(1);
    expect(r.alreadyPresent).toBe(MAX_IMPORT_ROWS - 1);
  });

  it('empty: tamano 0 o solo espacios', async () => {
    mockFiles.set('a', { text: '', size: 0 });
    expect(await codeOf(importRepository.parseLetterboxd({ uri: 'a', name: 'ratings.csv' }))).toBe('empty');
    expect(await codeOf(importRepository.parseLetterboxd(csv('b', '  \n  ')))).toBe('empty');
  });

  it('missing-columns', async () => {
    expect(await codeOf(importRepository.parseLetterboxd(csv('f', 'Titulo,Nota\nAftersun,4')))).toBe('missing-columns');
    mockFiles.set('z', { bytes: await zipOf({ 'ratings.csv': 'Date,Name,Year\n2024-01-01,Aftersun,2022' }) });
    expect(await codeOf(importRepository.parseLetterboxd({ uri: 'z', name: 'e.zip' }))).toBe('missing-columns');
  });

  it('read-failed: el archivo no se puede abrir', async () => {
    expect(await codeOf(importRepository.parseLetterboxd({ uri: 'no-existe', name: 'ratings.csv' }))).toBe('read-failed');
  });

  it('no-matches: ninguna pelicula del archivo esta en el catalogo', async () => {
    expect(await codeOf(importRepository.parseLetterboxd(csv('f', ratingsCsv(row('Desconocida', 1999, 4)))))).toBe(
      'no-matches',
    );
  });

  it('cada error trae el mensaje en espanol de 7.2', async () => {
    mockFiles.set('f', { text: 'x' });
    await expect(importRepository.parseLetterboxd({ uri: 'f', name: 'x.pdf' })).rejects.toThrow(
      'Solo se admiten archivos .csv o .zip de Letterboxd.',
    );
    expect(IMPORT_ERROR_MESSAGES['no-matches']).toBe(
      'No encontramos ninguna película de tu archivo en nuestro catálogo de prueba.',
    );
    expect(Object.keys(IMPORT_ERROR_MESSAGES)).toHaveLength(7);
  });
});

describe('importRepository.parseLetterboxd: progreso', () => {
  it('emite las fases en orden y termina en done con processed = total', async () => {
    const seen: ImportProgress[] = [];
    mockFiles.set('z', { bytes: await zipOf({ 'ratings.csv': ratingsCsv(row('Aftersun', 2022, 4)) }) });
    await importRepository.parseLetterboxd({ uri: 'z', name: 'e.zip' }, { onProgress: (p) => seen.push(p) });
    expect(seen.map((p) => p.phase)).toEqual(['reading', 'unzipping', 'parsing', 'matching', 'done']);
    expect(seen[seen.length - 1]).toEqual({ phase: 'done', processed: 1, total: 1 });
  });

  it('un csv suelto no pasa por unzipping y avisa por lotes de 500 filas', async () => {
    const seen: ImportProgress[] = [];
    const rows = Array.from({ length: 1200 }, () => row('Aftersun', 2022, 4));
    await importRepository.parseLetterboxd(csv('f', ratingsCsv(...rows)), { onProgress: (p) => seen.push(p) });
    expect(seen.map((p) => p.phase)).not.toContain('unzipping');
    const matching = seen.filter((p) => p.phase === 'matching').map((p) => p.processed);
    expect(matching).toEqual([0, 500, 1000]);
  });
});
