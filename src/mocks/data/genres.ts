import type { Genre } from '@/types/media';

/** Ids de genero compatibles con TMDB. */
export const GENRE_IDS = {
  drama: 18,
  romance: 10749,
  comedia: 35,
  accion: 28,
  suspense: 53,
  terror: 27,
  documental: 99,
  animacion: 16,
  familia: 10751,
  cienciaFiccion: 878,
  aventura: 12,
  crimen: 80,
  misterio: 9648,
  fantasia: 14,
  musica: 10402,
} as const;

export const GENRES: ReadonlyArray<Genre> = [
  { id: 18, name: 'Drama' },
  { id: 10749, name: 'Romance' },
  { id: 35, name: 'Comedia' },
  { id: 28, name: 'Acción' },
  { id: 53, name: 'Suspense' },
  { id: 27, name: 'Terror' },
  { id: 99, name: 'Documental' },
  { id: 16, name: 'Animación' },
  { id: 10751, name: 'Familia' },
  { id: 878, name: 'Ciencia ficción' },
  { id: 12, name: 'Aventura' },
  { id: 80, name: 'Crimen' },
  { id: 9648, name: 'Misterio' },
  { id: 14, name: 'Fantasía' },
  { id: 10402, name: 'Música' },
  { id: 36, name: 'Historia' },
];

const BY_ID = new Map<number, Genre>(GENRES.map((g) => [g.id, g]));

export function genreName(id: number): string {
  return BY_ID.get(id)?.name ?? String(id);
}

export function genresFromIds(ids: ReadonlyArray<number>): Genre[] {
  return ids.map((id) => ({ id, name: genreName(id) }));
}
