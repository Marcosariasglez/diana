# DECISIONS

Decision log for the Diana project.

## H1 - Project scaffolding

### D1 - Node.js version
- Node.js v24.13.0, npm 11.6.2.

### D2 - Expo SDK version
- Expo ~57.0.27 (SDK 57), satisfies >= 57.0.17.
- Resolved by `npx create-expo-app` + `npx expo install`.

### D3 - TypeScript
- TypeScript ~6.0.3 (template default), strict mode enabled.

### D4 - NativeWind version
- nativewind ^4.2.7, tailwindcss ^3.4.19.

### D5 - Zustand
- zustand ^5.0.15.

### D6 - Lucide icons
- lucide-react-native ^1.52.0.

### D7 - FlashList
- @shopify/flash-list 2.0.2.

### D8 - Jest + testing library
- jest-expo ~57.0.5, @testing-library/react-native ^14.0.1.

### D9 - PapaParse + JSZip
- papaparse ^5.7.0, jszip ^3.10.2.

### D10 - Expo modules installed
- expo-clipboard ~57.0.2, expo-file-system ~57.0.7, expo-document-picker ~57.0.3, expo-haptics ~57.0.3, expo-font ~57.0.4, expo-splash-screen ~57.0.9, expo-image ~57.0.5.

### D11 - React Native Reanimated
- react-native-reanimated 4.5.1 (SDK 57 default).
- `runOnJS` used in `src/utils/worklets.ts` (section 2.3 of architecture doc).

### D12 - ESLint anti-emoji rule
- Implemented via `no-restricted-syntax` in `.eslintrc.js`.

### D13 - Metro config
- Using default metro config from Expo template (no custom metro.config.js needed for now).

## H4 datos - catalogo, mock-ai y datos mock

### D-H4-1 - Catalogo
- 61 titulos con ids secuenciales 1-61 compartidos entre peliculas y series (ids 1-8 son los de los wireframes; Fallout es tv:8). 10 generos principales de pelicula con >= 2 titulos (11 en total). Solo temporada 1 en las series; nombres reales de capitulo para Fallout (en ingles).
- Se anade el genero Historia (36) a `genres.ts` para Chernobyl.

### D-H4-2 - Firmas inyectables
- `buildTasteProfile(userId, initialRatings, entries, lookup = getMedia)`, `deriveGenrePreferences(initialRatings, entries, lookup)`; `noise` (NoiseFn `(userId, key) => bp`) como parametro opcional en `tasteScoreBp`, `predictTenths`, `bucketOf`, `affinity` y los pick*. Los tests usan un catalogo sintetico via `lookup`.
- `initialRatings` solo resuelve peliculas (`lookup('movie', id)`); las entradas de historial usan `ref.mediaType/mediaId` (capitulos y temporadas usan los generos de la serie).
- `deriveGenrePreferences`: generos con peso > 0, orden por peso desc e id asc, maximo 5 (`FAVORITE_GENRES_COUNT`).
- `bucketOf(profile, media, key, noise?)` calcula el bucket sobre decimos enteros; `bucketOfTenths(t)` es la version sobre decimos.

### D-H4-3 - Feed
- Paginas de `pickFeedPage`, `pickHiddenGems`, `pickRecommendations` empiezan en 0 `[DECISIÓN]`. Joyas ocultas no excluye el destacado (la especificacion solo lo excluye de Recomendaciones). `hasSeeAll` = la categoria tiene mas paginas. Una categoria vacia se omite.

### D-H4-4 - Mood
- Filtros de runtime y era inclusivos en ambos extremos (lt90 = max 90; h2 = 90 a 150). Una lista vacia de plataformas (fallback vacio y sin respuesta) no restringe. `applyMoodFilters` devuelve los candidatos ordenados por `boostMatches` desc (estable). Plataformas multiples se leen de `answers.platforms` separadas por coma.
- Iconos Lucide verificados en lucide-react-native instalado: Moon, Coffee, Zap, Sparkles, House, Calendar, History, Shuffle, Hourglass, Gauge, Clock, Film, Sofa, Tv, User, Users, Heart existen todos (sin alternativas).
- `buildGroupDeckMedia` (solo peliculas) en moodFilters.ts implementa el orden `boostMatches` desc y `hash32(code|key)` asc.

### D-H4-5 - Onboarding deck
- Aftersun primero; grupos por `genres[0]` ordenados por tamano desc (empate por id de genero asc); reparto por turnos con maximo 4 por genero; si el primero de una vuelta repite el genero de la ultima carta, pasa al final de la vuelta (sin consecutivas del mismo genero).

### D-H4-6 - Seen y grupo
- `buildSeenKeys` vive en `src/store/seenKeys.ts` (el otro agente puede re-exportarla desde `src/store/seen.ts`). `computeGroupRanking` ignora decisiones de no miembros y toma la ultima decision por (miembro, carta); se anaden `isGroupComplete` y `formatGroupLikes`.

### D-H4-7 - Amigos mock
- `FAKE_HISTORY = {}` y `MOCK_HISTORY = []`. Con los datos actuales cada amigo da like a 36-62% del catalogo (F5) y los pares difieren en 17-48 titulos de 61.

## Backend

## H4 stores, servicios y fakeSocket

### D-H4-8 - Stores y servicios
- `useHistoryStore.addEntry` antepone la entrada (nueva o actualizada) y elimina la anterior con la misma key. `matched` del ImportResult = entradas nuevas; `totalRows = matched + unmatched + alreadyPresent` (ratings.csv). Mas de MAX_IMPORT_ROWS filas lanza `too-large`.
- `getGroupDeck` usa la semilla fija `GROUP_DECK_SEED` (el contrato no lleva codigo de sala).
- `RoomRepository` anade `leaveRoom?` y `backToLobby?` (opcionales) para liberar temporizadores y "Volver a la sala". Errores de sala: `RoomError.code` = `not-found | full | not-host | wrong-phase`; el store lanza ademas `mood-incomplete`.
- `useMoodStore.reset()` conserva `mode` y `complexity`; `answerQuestion` avanza `currentQuestionIndex` hasta N (numero de preguntas).
- Tipado minimo de papaparse en `src/types/papaparse.d.ts` (sin instalar @types/papaparse).
