// P8 (F4-1): fixture de catálogo PROPIO de los tests, independiente de
// `src/mocks/` (que muere en P12). Estable y autocontenido: copia los títulos
// que los tests de producto asientan (wireframes "Aftersun"/"Parásitos", los
// ids de los usuarios de `users.ts`) y añade los casos límite del mood:
// runtime 0 (stub) / 89-90-150-151 (tramos lt90/h2/maratón), año 0, corto,
// sin plataformas. Los géneros de los ids conservados son idénticos a los del
// catálogo mock para que el gusto/afinidad de los tests no cambie.
import type { Media, MediaType, Movie, TVEpisode, TVSeason, TVSeries } from '@/types/media';
import type { MediaRef } from '@/types/rating';
import { genresFromIds } from '@/constants/genres';

type MovieRow = [
  id: number,
  title: string,
  releaseDate: string,
  runtime: number,
  genreIds: number[],
  platforms: string[],
  voteCount: number,
  voteAverage: number,
  popularity: number,
  overview: string,
  altTitles?: string[],
];

function movie(row: MovieRow): Movie {
  const [id, title, release_date, runtime, genreIds, platforms, vote_count, vote_average, popularity, overview, alt] =
    row;
  return {
    id,
    media_type: 'movie',
    title,
    release_date,
    runtime,
    poster_path: null,
    backdrop_path: null,
    genres: genresFromIds(genreIds),
    overview,
    vote_average,
    vote_count,
    popularity,
    platforms,
    alt_titles: alt ?? [],
  };
}

const NF = 'netflix';
const PV = 'prime-video';
const MX = 'max';
const DP = 'disney-plus';

// Ids 1-48: mismos títulos y datos del catálogo mock (los asientan
// wireframeFacts, mock-ai.coherence, seen, useHistoryStore e import).
// 201+: casos límite del mood (nuevos, sin colisiones de id).
const MOVIE_ROWS: MovieRow[] = [
  // Drama (18)
  [1, 'Aftersun', '2022-10-21', 101, [18], [PV], 2900, 7.6, 62, 'Una joven recuerda unas vacaciones con su padre en un resort turco de los noventa.'],
  [2, 'Past Lives', '2023-06-02', 106, [18, 10749], [MX], 4300, 7.8, 70, 'Dos amigos de infancia se reencuentran décadas después en Nueva York y se preguntan qué pudo ser.', ['Vidas pasadas']],
  [3, 'Burning', '2018-05-17', 148, [18, 9648, 53], [NF], 3600, 7.5, 48, 'Un joven mensajero se obsesiona con un misterioso rival que confiesa quemar invernaderos.', ['Beoning']],
  [4, 'Perfect Days', '2023-12-22', 124, [18], [PV], 2400, 7.9, 44, 'Un limpiador de baños públicos en Tokio disfruta de una rutina sencilla hasta que el pasado llama a su puerta.'],
  [5, 'Columbus', '2017-08-04', 104, [18], [MX], 1100, 7.2, 25, 'Una joven aficionada a la arquitectura traba amistad con un hombre que cuida de su padre enfermo.'],
  [9, 'Moonlight', '2016-10-21', 111, [18], [PV, MX], 9400, 7.4, 55, 'Tres etapas en la vida de un joven de Miami que busca su lugar en el mundo.'],
  [10, 'Whiplash', '2014-10-10', 106, [18, 10402], [NF, PV], 15500, 8.3, 78, 'Un joven baterista se enfrenta a un profesor despiadado en un conservatorio de élite.'],
  [14, 'Before Sunrise', '1995-01-27', 101, [10749, 18], [MX], 4800, 7.9, 40, 'Un estadounidense y una francesa pasan una noche caminando por Viena.', ['Antes del amanecer']],
  [16, 'In the Mood for Love', '2000-09-29', 98, [10749, 18], [MX], 3200, 8.1, 38, 'Dos vecinos en el Hong Kong de 1962 descubren que sus parejas los engañan.', ['Deseando amar']],
  [17, 'Call Me by Your Name', '2017-11-24', 132, [10749, 18], [PV], 7900, 7.9, 60, 'Un verano en el norte de Italia despierta el primer amor de un adolescente.', ['Llámame por tu nombre']],
  // Suspense (53)
  [6, 'Parásitos', '2019-05-30', 132, [53, 35, 18], [NF, MX], 17800, 8.5, 95, 'Una familia sin recursos se infiltra poco a poco en la vida de una familia adinerada.', ['Parasite', 'Gisaengchung']],
  [7, 'Fall', '2022-08-12', 107, [53], [PV, NF], 4700, 6.6, 58, 'Dos escaladoras quedan atrapadas en lo alto de una torre de televisión abandonada.', ['Fall: Miedo a bajar']],
  [12, 'Gone Girl', '2014-10-03', 149, [53, 18, 9648], [NF, MX], 17200, 7.9, 84, 'La desaparición de una mujer convierte a su marido en el principal sospechoso.', ['Perdida']],
  [13, 'Prisoners', '2013-09-20', 153, [53, 80, 18], [PV], 11700, 8.1, 66, 'Un padre toma la justicia por su mano cuando su hija desaparece.', ['Los secuestrados']],
  // Comedia (35)
  [18, 'Amélie', '2001-04-25', 122, [35, 10749], [NF], 12400, 7.8, 60, 'Una camarera parisina decide mejorar en secreto la vida de quienes la rodean.', ['Amelie', 'Le fabuleux destin d\'Amélie Poulain']],
  [19, 'The Grand Budapest Hotel', '2014-03-28', 99, [35, 12], [DP, PV], 16000, 8.0, 75, 'Las aventuras de un conserje legendario y su joven protegido en un hotel de Europa del Este.', ['El gran hotel Budapest']],
  [21, 'Palm Springs', '2020-07-10', 90, [35, 10749, 878], [NF, PV], 3900, 7.4, 46, 'Dos invitados a una boda quedan atrapados en un bucle temporal.'],
  // Accion (28)
  [22, 'Mad Max: Fury Road', '2015-05-15', 120, [28, 12, 878], [MX, NF], 21000, 7.6, 90, 'Una huida a toda velocidad por el desierto liderada por la emperatriz Furiosa.', ['Mad Max: Furia en la carretera']],
  [23, 'John Wick', '2014-10-24', 101, [28, 53], [NF, PV], 17500, 7.4, 82, 'Un asesino retirado vuelve a la acción para vengar la muerte de su perro.', ['Otro día para matar']],
  [24, 'Die Hard', '1988-07-22', 132, [28, 53], [DP, PV], 11800, 7.8, 64, 'Un policía de Nueva York se enfrenta a un grupo de terroristas en un rascacielos.', ['La jungla de cristal']],
  [25, 'RRR', '2022-03-24', 182, [28, 18], [NF], 3100, 7.8, 72, 'Dos revolucionarios indios forman una amistad improbable bajo el dominio británico.'],
  [26, 'Top Gun: Maverick', '2022-05-27', 130, [28, 18], [PV], 8900, 8.2, 88, 'Un veterano piloto entrena a una nueva generación para una misión imposible.'],
  // Terror (27)
  [27, 'Hereditary', '2018-06-08', 127, [27, 9648, 53], [MX, PV], 8800, 7.3, 57, 'La muerte de la matriarca destapa secretos oscuros en una familia.', ['Hereditary: El legado del diablo']],
  [29, 'The Shining', '1980-06-13', 146, [27, 53], [MX], 15200, 8.2, 66, 'Un escritor y su familia pasan el invierno como cuidadores de un hotel aislado.', ['El resplandor']],
  // Documental (99)
  [31, 'Free Solo', '2018-09-28', 100, [99, 12], [DP], 2500, 8.0, 36, 'Alex Honnold intenta escalar El Capitán sin cuerdas ni protección.'],
  [32, "Won't You Be My Neighbor?", '2018-06-08', 94, [99], [MX], 1500, 8.0, 28, 'Retrato del presentador infantil Fred Rogers y su mensaje de bondad.'],
  [33, 'My Octopus Teacher', '2020-09-07', 85, [99], [NF], 3800, 7.8, 40, 'Un buzo entabla una relación singular con un pulpo en un bosque de algas.', ['Lo que el pulpo me enseñó']],
  [34, 'Jiro Dreams of Sushi', '2011-06-11', 81, [99], [PV], 2200, 7.9, 26, 'El maestro de sushi Jiro Ono y su búsqueda de la perfección.', ['Jiro y el arte del sushi']],
  // Animacion (16)
  [35, 'Spirited Away', '2001-07-20', 125, [16, 10751, 14], [NF, MX], 15800, 8.5, 80, 'Una niña queda atrapada en un mundo de espíritus y debe salvar a sus padres.', ['El viaje de Chihiro']],
  [36, 'Coco', '2017-11-22', 105, [16, 10751, 10402], [DP], 17500, 8.2, 85, 'Un niño viaja a la Tierra de los Muertos para descubrir la historia de su familia.'],
  [38, 'Toy Story', '1995-11-22', 81, [16, 10751, 35], [DP], 18000, 8.0, 77, 'Los juguetes de un niño cobran vida cuando nadie los ve.'],
  [39, 'WALL-E', '2008-06-27', 98, [16, 878, 10751], [DP], 18500, 8.1, 74, 'Un pequeño robot limpiador descubre su propósito en un planeta abandonado.'],
  // Ciencia ficcion (878)
  [40, 'Blade Runner 2049', '2017-10-06', 164, [878, 18], [PV, NF], 13500, 7.6, 70, 'Un nuevo blade runner descubre un secreto que podría cambiar el orden social.'],
  [41, 'Arrival', '2016-11-11', 116, [878, 18], [PV, MX], 16000, 7.6, 69, 'Una lingüista intenta comunicarse con visitantes extraterrestres.', ['La llegada']],
  [42, '2001: A Space Odyssey', '1968-04-06', 149, [878, 12], [MX], 10500, 8.1, 50, 'Una misión a Júpiter se complica cuando la computadora de la nave toma sus propias decisiones.', ['2001: Una odisea del espacio']],
  [43, 'Dune', '2021-10-22', 155, [878, 12], [MX], 12800, 7.8, 92, 'Un joven noble debe proteger el planeta desértico del que depende el futuro de su casa.', ['Dune: Parte uno']],
  // Aventura (12)
  [44, 'Interstellar', '2014-11-07', 169, [12, 18, 878], [PV, NF], 34000, 8.4, 100, 'Un grupo de astronautas viaja por un agujero de gusano en busca de un nuevo hogar para la humanidad.'],
  [47, 'Life of Pi', '2012-11-21', 127, [12, 18, 14], [DP], 14000, 7.0, 54, 'Un joven sobrevive a un naufragio en un bote con un tigre de Bengala.', ['La vida de Pi']],
  [115, 'The Princess Bride', '1987-09-25', 98, [12, 10751, 14], [DP], 4200, 7.8, 32, 'Un granjero se lanza a rescatar a su amada en un cuento de espadachines y gigantes.', ['La princesa prometida']],
  // Crimen (80)
  [48, 'Se7en', '1995-09-22', 127, [80, 9648, 53], [NF, MX], 20000, 8.4, 79, 'Dos detectives persiguen a un asesino que se inspira en los siete pecados capitales.', ['Seven']],
  // Ciencia ficcion / drama / documental (ids del mock que asienta el conteo
  // de 13 peliculas en disney-plus del coldstart de onboarding).
  [63, 'Poor Things', '2023-12-08', 141, [878, 35, 10749], [DP], 4800, 7.8, 34, 'Una joven resucitada por un científico excéntrico descubre el mundo a su manera.', ['Pobres criaturas']],
  [79, 'Brooklyn', '2015-11-04', 112, [18, 10749], [DP], 3300, 7.4, 28, 'Una joven irlandesa emigra a Nueva York y se debate entre dos amores y dos mundos.'],
  [87, 'Nomadland', '2020-09-11', 108, [18], [DP], 4400, 7.3, 33, 'Una mujer recorre el oeste americano en furgoneta tras perder su hogar en la crisis.'],
  [91, 'Fire of Love', '2022-07-15', 93, [99, 10749], [DP], 420, 7.6, 14, 'Dos vulcanólogos franceses dedican su vida y su amor a perseguir erupciones.', ['Fuego de amor']],
  [117, 'Big Hero 6', '2014-11-07', 102, [16, 10751, 28], [DP], 4700, 7.8, 38, 'Un adolescente prodigio y un robot sanitario forman un equipo de superhéroes.'],
  // Cortos (runtime ≤ 40) para el filtro «Cortos» de la búsqueda (A2).
  [123, 'The Lunchbox', '2013-05-18', 38, [18, 10749], [NF], 900, 7.4, 18, 'Dos desconocidos se conectan a través de un servicio de reparto de comidas en Mumbai.'],
  [124, 'Waltz with Bashir', '2008-03-27', 35, [99, 18], [PV], 1200, 7.8, 20, 'Un soldado israelí busca sus recuerdos perdidos de la guerra del Líbano.'],
  // --- Casos límite del mood (nuevos, ids sin colisión) ---
  // Stub sin duración (runtime 0): el motor mood lo descarta con respuestas de duración (B2).
  [201, 'Stub Sin Duracion', '2024-01-01', 0, [18], [PV], 10, 6.0, 1, 'Título pendiente de backfill de duración.'],
  // Borde lt90 (≤ 89).
  [202, 'Corta Ochenta y Nueve', '2023-01-01', 89, [18], [NF], 500, 7.0, 5, 'Corta en el borde de "Menos de 90 min".'],
  // Borde h2 inferior (90).
  [203, 'Ninety', '2022-01-01', 90, [53], [PV], 600, 7.0, 6, 'En el borde inferior de "Unas 2 horas".'],
  // Borde h2 superior (150).
  [204, 'Ciento Cincuenta', '2021-01-01', 150, [10749], [MX], 700, 7.0, 7, 'En el borde superior de "Unas 2 horas".'],
  // Borde maratón (≥ 151).
  [205, 'Ciento Cincuenta y Uno', '2020-01-01', 151, [28], [NF], 800, 7.0, 8, 'En el borde inferior de "Maratón".'],
  // Año desconocido (fecha vacía → releaseYearOf 0): el motor mood lo descarta con filtro de época (B3).
  [206, 'Sin Fecha', '', 100, [18], [PV], 100, 6.5, 2, 'Título sin año conocido.'],
  // Sin plataformas: nunca pasa un filtro de plataforma.
  [207, 'Sin Plataforma', '2019-01-01', 95, [35], [], 200, 6.5, 3, 'No está en ninguna plataforma.'],
  // Corto (runtime ≤ 40) con tag de búsqueda.
  [208, 'Corto de Treinta y Cinco', '2015-01-01', 35, [99, 18], [PV], 300, 7.2, 4, 'Un corto documental de drama.'],
];

interface TvRow {
  id: number;
  name: string;
  firstAirDate: string;
  runtime: number;
  genreIds: number[];
  platforms: string[];
  voteCount: number;
  voteAverage: number;
  popularity: number;
  overview: string;
  alt?: string[];
  episodes: string[];
}

function episodes(names: string[], runtime: number): TVEpisode[] {
  return names.map((name, i) => ({ episode_number: i + 1, name, runtime, still_path: null }));
}

function series(row: TvRow): TVSeries {
  const season: TVSeason = {
    season_number: 1,
    episode_count: row.episodes.length,
    episodes: episodes(row.episodes, row.runtime),
  };
  return {
    id: row.id,
    media_type: 'tv',
    name: row.name,
    first_air_date: row.firstAirDate,
    episode_run_time: [row.runtime],
    seasons: [season],
    poster_path: null,
    backdrop_path: null,
    genres: genresFromIds(row.genreIds),
    overview: row.overview,
    vote_average: row.voteAverage,
    vote_count: row.voteCount,
    popularity: row.popularity,
    platforms: row.platforms,
    alt_titles: row.alt ?? [],
  };
}

const TV_ROWS: TvRow[] = [
  {
    id: 8,
    name: 'Fallout',
    firstAirDate: '2024-04-10',
    runtime: 58,
    genreIds: [878, 18, 28],
    platforms: [PV],
    voteCount: 4200,
    voteAverage: 8.2,
    popularity: 98,
    overview: 'Una joven del refugio 33 sale a la superficie tras el apocalipsis nuclear y descubre un mundo hostil.',
    episodes: ['The End', 'The Target', 'The Head', 'The Ghouls', 'The Past', 'The Trap', 'The Radio', 'The Beginning'],
  },
  {
    id: 52,
    name: 'Breaking Bad',
    firstAirDate: '2008-01-20',
    runtime: 47,
    genreIds: [18, 80],
    platforms: [NF],
    voteCount: 14500,
    voteAverage: 8.9,
    popularity: 96,
    overview: 'Un profesor de química con cáncer se asocia con un antiguo alumno para fabricar metanfetamina.',
    episodes: ['Piloto', 'Cat in the Bag', 'And the Bag in the River', 'Cancer Man'],
  },
  {
    id: 53,
    name: 'Stranger Things',
    firstAirDate: '2016-07-15',
    runtime: 50,
    genreIds: [18, 9648, 878],
    platforms: [NF],
    voteCount: 18000,
    voteAverage: 8.6,
    popularity: 99,
    overview: 'La desaparición de un niño destapa experimentos secretos y fuerzas sobrenaturales en un pueblo de Indiana.',
    episodes: [
      'Capítulo uno: La desaparición de Will Byers',
      'Capítulo dos: La rarita de Maple Street',
      'Capítulo tres: Holly, Jolly',
      'Capítulo cuatro: El cuerpo',
    ],
  },
  {
    id: 54,
    name: 'The Bear',
    firstAirDate: '2022-06-23',
    runtime: 34,
    genreIds: [18, 35],
    platforms: [DP],
    voteCount: 2300,
    voteAverage: 8.3,
    popularity: 75,
    overview: 'Un joven chef vuelve a Chicago para dirigir el restaurante familiar al borde de la ruina.',
    alt: ['El oso'],
    episodes: ['System', 'Hands', 'Brigade', 'Dogs'],
  },
  {
    id: 55,
    name: 'Chernobyl',
    firstAirDate: '2019-05-06',
    runtime: 64,
    genreIds: [18, 36],
    platforms: [MX],
    voteCount: 7600,
    voteAverage: 8.7,
    popularity: 80,
    overview: 'Recreación del desastre nuclear de 1986 y de las personas que intentaron contenerlo.',
    episodes: ['1:23:45', 'Por favor, mantengan la calma', 'Abre, oh tierra', 'La felicidad de toda la humanidad'],
  },
  {
    id: 59,
    name: 'Planet Earth II',
    firstAirDate: '2016-11-06',
    runtime: 50,
    genreIds: [99],
    platforms: [MX],
    voteCount: 1100,
    voteAverage: 9.0,
    popularity: 45,
    overview: 'Un recorrido por los hábitats más extremos del planeta y sus criaturas.',
    alt: ['Planeta Tierra II'],
    episodes: ['Islas', 'Montañas', 'Junglas', 'Desiertos'],
  },
  {
    id: 57,
    name: 'The Mandalorian',
    firstAirDate: '2019-11-12',
    runtime: 40,
    genreIds: [878, 12, 28],
    platforms: [DP],
    voteCount: 9800,
    voteAverage: 8.5,
    popularity: 90,
    overview: 'Un cazarrecompensas solitario protege a un misterioso niño en los confines de la galaxia.',
    episodes: ['Capítulo 1: El mandaloriano', 'Capítulo 2: El niño', 'Capítulo 3: El pecado', 'Capítulo 4: Santuario'],
  },
];

const movies: Movie[] = MOVIE_ROWS.map(movie);
const tvs: TVSeries[] = TV_ROWS.map(series);

/** Catálogo completo ordenado por id ascendente. */
export const FIXTURE_CATALOG: ReadonlyArray<Media> = [...movies, ...tvs].sort((a, b) => a.id - b.id);

export const FIXTURE_MOVIES: ReadonlyArray<Movie> = FIXTURE_CATALOG.filter((m): m is Movie => m.media_type === 'movie');
export const FIXTURE_SERIES: ReadonlyArray<TVSeries> = FIXTURE_CATALOG.filter((m): m is TVSeries => m.media_type === 'tv');

const INDEX = new Map<string, Media>(FIXTURE_CATALOG.map((m) => [`${m.media_type}:${m.id}`, m]));

/** Equivalente de `getMedia` del mock: busca por (tipo, id) en el fixture. */
export function fixtureMedia(type: MediaType, id: number): Media | undefined {
  return INDEX.get(`${type}:${id}`);
}

export function fixtureMovie(id: number): Movie | undefined {
  const m = fixtureMedia('movie', id);
  return m && m.media_type === 'movie' ? m : undefined;
}

export function fixtureSeries(id: number): TVSeries | undefined {
  const m = fixtureMedia('tv', id);
  return m && m.media_type === 'tv' ? m : undefined;
}

export function fixtureMediaByRef(ref: Pick<MediaRef, 'mediaType' | 'mediaId'>): Media | undefined {
  return fixtureMedia(ref.mediaType, ref.mediaId);
}

/** Equivalente de `getTvSeason` del mock (la usaba el test del historial). */
export function fixtureTvSeason(id: number, seasonNumber: number): TVSeason | undefined {
  return fixtureSeries(id)?.seasons.find((s) => s.season_number === seasonNumber);
}

/** Géneros (ids) de una película del fixture; [] si no existe (misma degradación que el mock). */
export function fixtureGenreIds(id: number): number[] {
  return fixtureMovie(id)?.genres.map((g) => g.id) ?? [];
}
