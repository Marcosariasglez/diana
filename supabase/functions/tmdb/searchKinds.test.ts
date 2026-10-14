/// <reference types="jest" />
/**
 * Pruebas de searchKinds.ts (lógica pura de cortos y documentales).
 * Sin dependencias de Deno: se importa directamente.
 */

import { filterDocumentaries, filterShorts, isDocumentary, tagDocumentaryInResults } from './searchKinds';

// --- isDocumentary ---

describe('isDocumentary', () => {
  it('detecta género 99', () => {
    expect(isDocumentary({ genre_ids: [28, 99] })).toBe(true);
  });

  it('rechaza sin género 99', () => {
    expect(isDocumentary({ genre_ids: [28, 35] })).toBe(false);
  });

  it('soporta genre_ids vacía', () => {
    expect(isDocumentary({ genre_ids: [] })).toBe(false);
  });

  it('soporta genre_ids undefined', () => {
    expect(isDocumentary({})).toBe(false);
  });
});

// --- filterDocumentaries ---

describe('filterDocumentaries', () => {
  const doc = { id: 1, media_type: 'movie', genre_ids: [99] };
  const movie = { id: 2, media_type: 'movie', genre_ids: [28] };
  const docTv = { id: 3, media_type: 'tv', genre_ids: [99, 18] };
  const tv = { id: 4, media_type: 'tv', genre_ids: [18] };

  it('filtra solo documentales', () => {
    expect(filterDocumentaries([doc, movie, docTv, tv])).toEqual([doc, docTv]);
  });

  it('devuelve vacía sin documentales', () => {
    expect(filterDocumentaries([movie, tv])).toEqual([]);
  });

  it('filtra por media_type', () => {
    const noType = { id: 5, genre_ids: [99] };
    expect(filterDocumentaries([noType])).toEqual([]);
  });
});

// --- filterShorts ---

describe('filterShorts', () => {
  const short1 = { id: 1, media_type: 'movie' };
  const short2 = { id: 2, media_type: 'movie' };
  const normal = { id: 3, media_type: 'movie' };
  const zero = { id: 4, media_type: 'movie' };

  const runtimeMap = new Map([
    [1, 30],   // corto
    [2, 40],   // corto (límite)
    [3, 120],  // normal
    [4, 0],    // duración desconocida
  ]);

  it('filtra solo cortos (0 < runtime ≤ 40)', () => {
    expect(filterShorts([short1, short2, normal, zero], runtimeMap)).toEqual([short1, short2]);
  });

  it('ignora ids sin runtime en el mapa', () => {
    const missing = { id: 99, media_type: 'movie' };
    expect(filterShorts([missing], runtimeMap)).toEqual([]);
  });
});

// --- tagDocumentaryInResults ---

describe('tagDocumentaryInResults', () => {
  it('añade tag Documental si genre_ids incluye 99', () => {
    const results: Record<string, unknown>[] = [
      { id: 1, genre_ids: [99, 28] },
      { id: 2, genre_ids: [28] },
    ];
    tagDocumentaryInResults(results);
    expect(results[0].tag).toBe('Documental');
    expect(results[1].tag).toBeUndefined();
  });

  it('soporta genre_ids vacía', () => {
    const results: Record<string, unknown>[] = [{ id: 1, genre_ids: [] }];
    tagDocumentaryInResults(results);
    expect(results[0].tag).toBeUndefined();
  });
});
