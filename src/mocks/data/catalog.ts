import type { Media, Movie, TVEpisode, TVSeason, TVSeries, MediaType } from '@/types/media';
import type { MediaKey, MediaRef } from '@/types/rating';
import { buildMediaKey } from '@/utils/mediaKey';
import { genresFromIds } from './genres';

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

// Orden: ids 1-8 son los titulos de los wireframes; el resto se agrupa por genero principal.
const MOVIE_ROWS: MovieRow[] = [
  // Drama (genero principal 18)
  [1, 'Aftersun', '2022-10-21', 101, [18], [PV], 2900, 7.6, 62, 'Una joven recuerda unas vacaciones con su padre en un resort turco de los noventa.'],
  [2, 'Past Lives', '2023-06-02', 106, [18, 10749], [MX], 4300, 7.8, 70, 'Dos amigos de infancia se reencuentran décadas después en Nueva York y se preguntan qué pudo ser.', ['Vidas pasadas']],
  [3, 'Burning', '2018-05-17', 148, [18, 9648, 53], [NF], 3600, 7.5, 48, 'Un joven mensajero se obsesiona con un misterioso rival que confiesa quemar invernaderos.', ['Beoning']],
  [4, 'Perfect Days', '2023-12-22', 124, [18], [PV], 2400, 7.9, 44, 'Un limpiador de baños públicos en Tokio disfruta de una rutina sencilla hasta que el pasado llama a su puerta.'],
  [5, 'Columbus', '2017-08-04', 104, [18], [MX], 1100, 7.2, 25, 'Una joven aficionada a la arquitectura traba amistad con un hombre que cuida de su padre enfermo.'],
  [9, 'Moonlight', '2016-10-21', 111, [18], [PV, MX], 9400, 7.4, 55, 'Tres etapas en la vida de un joven de Miami que busca su lugar en el mundo.'],
  [10, 'Whiplash', '2014-10-10', 106, [18, 10402], [NF, PV], 15500, 8.3, 78, 'Un joven baterista se enfrenta a un profesor despiadado en un conservatorio de élite.'],
  [11, 'Lost in Translation', '2003-09-12', 102, [18, 10749], [MX], 6800, 7.3, 52, 'Dos desconocidos insomnes conectan en un hotel de Tokio.', ['Perdidos en Tokio']],
  // Suspense (53)
  [6, 'Parásitos', '2019-05-30', 132, [53, 35, 18], [NF, MX], 17800, 8.5, 95, 'Una familia sin recursos se infiltra poco a poco en la vida de una familia adinerada.', ['Parasite', 'Gisaengchung']],
  [7, 'Fall', '2022-08-12', 107, [53], [PV, NF], 4700, 6.6, 58, 'Dos escaladoras quedan atrapadas en lo alto de una torre de televisión abandonada.', ['Fall: Miedo a bajar']],
  [12, 'Gone Girl', '2014-10-03', 149, [53, 18, 9648], [NF, MX], 17200, 7.9, 84, 'La desaparición de una mujer convierte a su marido en el principal sospechoso.', ['Perdida']],
  [13, 'Prisoners', '2013-09-20', 153, [53, 80, 18], [PV], 11700, 8.1, 66, 'Un padre toma la justicia por su mano cuando su hija desaparece.', ['Los secuestrados']],
  // Romance (10749)
  [14, 'Before Sunrise', '1995-01-27', 101, [10749, 18], [MX], 4800, 7.9, 40, 'Un estadounidense y una francesa pasan una noche caminando por Viena.', ['Antes del amanecer']],
  [15, 'Eternal Sunshine of the Spotless Mind', '2004-03-19', 108, [10749, 878, 18], [NF, PV], 14800, 8.1, 70, 'Una pareja decide borrar de su memoria el recuerdo de la relación.', ['Olvídate de mí']],
  [16, 'In the Mood for Love', '2000-09-29', 98, [10749, 18], [MX], 3200, 8.1, 38, 'Dos vecinos en el Hong Kong de 1962 descubren que sus parejas los engañan.', ['Deseando amar']],
  [17, 'Call Me by Your Name', '2017-11-24', 132, [10749, 18], [PV], 7900, 7.9, 60, 'Un verano en el norte de Italia despierta el primer amor de un adolescente.', ['Llámame por tu nombre']],
  // Comedia (35)
  [18, 'Amélie', '2001-04-25', 122, [35, 10749], [NF], 12400, 7.8, 60, 'Una camarera parisina decide mejorar en secreto la vida de quienes la rodean.', ['Amelie', 'Le fabuleux destin d\'Amélie Poulain']],
  [19, 'The Grand Budapest Hotel', '2014-03-28', 99, [35, 12], [DP, PV], 16000, 8.0, 75, 'Las aventuras de un conserje legendario y su joven protegido en un hotel de Europa del Este.', ['El gran hotel Budapest']],
  [20, 'Some Like It Hot', '1959-03-29', 121, [35, 10749], [PV], 4500, 8.2, 30, 'Dos músicos huyen de la mafia disfrazados de mujeres en una orquesta femenina.', ['Con faldas y a lo loco']],
  [21, 'Palm Springs', '2020-07-10', 90, [35, 10749, 878], [NF, PV], 3900, 7.4, 46, 'Dos invitados a una boda quedan atrapados en un bucle temporal.'],
  // Accion (28)
  [22, 'Mad Max: Fury Road', '2015-05-15', 120, [28, 12, 878], [MX, NF], 21000, 7.6, 90, 'Una huida a toda velocidad por el desierto liderada por la emperatriz Furiosa.', ['Mad Max: Furia en la carretera']],
  [23, 'John Wick', '2014-10-24', 101, [28, 53], [NF, PV], 17500, 7.4, 82, 'Un asesino retirado vuelve a la acción para vengar la muerte de su perro.', ['Otro día para matar']],
  [24, 'Die Hard', '1988-07-22', 132, [28, 53], [DP, PV], 11800, 7.8, 64, 'Un policía de Nueva York se enfrenta a un grupo de terroristas en un rascacielos.', ['La jungla de cristal']],
  [25, 'RRR', '2022-03-24', 182, [28, 18], [NF], 3100, 7.8, 72, 'Dos revolucionarios indios forman una amistad improbable bajo el dominio británico.'],
  [26, 'Top Gun: Maverick', '2022-05-27', 130, [28, 18], [PV], 8900, 8.2, 88, 'Un veterano piloto entrena a una nueva generación para una misión imposible.'],
  // Terror (27)
  [27, 'Hereditary', '2018-06-08', 127, [27, 9648, 53], [MX, PV], 8800, 7.3, 57, 'La muerte de la matriarca destapa secretos oscuros en una familia.', ['Hereditary: El legado del diablo']],
  [28, 'Get Out', '2017-02-24', 104, [27, 9648, 53], [PV, NF], 14500, 7.6, 70, 'Un fotógrafo visita a la familia de su novia y descubre algo inquietante.', ['Déjame salir']],
  [29, 'The Shining', '1980-06-13', 146, [27, 53], [MX], 15200, 8.2, 66, 'Un escritor y su familia pasan el invierno como cuidadores de un hotel aislado.', ['El resplandor']],
  [30, 'A Quiet Place', '2018-04-06', 90, [27, 878, 18], [PV, NF], 13000, 7.4, 68, 'Una familia sobrevive en silencio frente a criaturas que cazan por el sonido.', ['Un lugar tranquilo']],
  // Documental (99)
  [31, 'Free Solo', '2018-09-28', 100, [99, 12], [DP], 2500, 8.0, 36, 'Alex Honnold intenta escalar El Capitán sin cuerdas ni protección.'],
  [32, "Won't You Be My Neighbor?", '2018-06-08', 94, [99], [MX], 1500, 8.0, 28, 'Retrato del presentador infantil Fred Rogers y su mensaje de bondad.'],
  [33, 'My Octopus Teacher', '2020-09-07', 85, [99], [NF], 3800, 7.8, 40, 'Un buzo entabla una relación singular con un pulpo en un bosque de algas.', ['Lo que el pulpo me enseñó']],
  [34, 'Jiro Dreams of Sushi', '2011-06-11', 81, [99], [PV], 2200, 7.9, 26, 'El maestro de sushi Jiro Ono y su búsqueda de la perfección.', ['Jiro y el arte del sushi']],
  // Animacion (16)
  [35, 'Spirited Away', '2001-07-20', 125, [16, 10751, 14], [NF, MX], 15800, 8.5, 80, 'Una niña queda atrapada en un mundo de espíritus y debe salvar a sus padres.', ['El viaje de Chihiro', 'Sen to Chihiro no kamikakushi']],
  [36, 'Coco', '2017-11-22', 105, [16, 10751, 10402], [DP], 17500, 8.2, 85, 'Un niño viaja a la Tierra de los Muertos para descubrir la historia de su familia.'],
  [37, 'Spider-Man: Into the Spider-Verse', '2018-12-14', 117, [16, 28, 878], [NF, PV], 15000, 8.4, 86, 'Miles Morales conoce a otros héroes arácnidos de distintas dimensiones.', ['Spider-Man: Un nuevo universo']],
  [38, 'Toy Story', '1995-11-22', 81, [16, 10751, 35], [DP], 18000, 8.0, 77, 'Los juguetes de un niño cobran vida cuando nadie los ve.'],
  [39, 'WALL-E', '2008-06-27', 98, [16, 878, 10751], [DP], 18500, 8.1, 74, 'Un pequeño robot limpiador descubre su propósito en un planeta abandonado.'],
  // Ciencia ficcion (878)
  [40, 'Blade Runner 2049', '2017-10-06', 164, [878, 18], [PV, NF], 13500, 7.6, 70, 'Un nuevo blade runner descubre un secreto que podría cambiar el orden social.'],
  [41, 'Arrival', '2016-11-11', 116, [878, 18], [PV, MX], 16000, 7.6, 69, 'Una lingüista intenta comunicarse con visitantes extraterrestres.', ['La llegada']],
  [42, '2001: A Space Odyssey', '1968-04-06', 149, [878, 12], [MX], 10500, 8.1, 50, 'Una misión a Júpiter se complica cuando la computadora de la nave toma sus propias decisiones.', ['2001: Una odisea del espacio']],
  [43, 'Dune', '2021-10-22', 155, [878, 12], [MX], 12800, 7.8, 92, 'Un joven noble debe proteger el planeta desértico del que depende el futuro de su casa.', ['Dune: Parte uno']],
  // Aventura (12)
  [44, 'Interstellar', '2014-11-07', 169, [12, 18, 878], [PV, NF], 34000, 8.4, 100, 'Un grupo de astronautas viaja por un agujero de gusano en busca de un nuevo hogar para la humanidad.'],
  [45, 'Raiders of the Lost Ark', '1981-06-12', 115, [12, 28], [PV], 12000, 7.9, 62, 'El arqueólogo Indiana Jones compite con los nazis por encontrar el Arca de la Alianza.', ['En busca del arca perdida']],
  [46, 'The Lord of the Rings: The Fellowship of the Ring', '2001-12-19', 178, [12, 14, 28], [MX, NF], 24500, 8.4, 91, 'Un hobbit emprende un viaje para destruir un anillo poderoso.', ['El Señor de los Anillos: La Comunidad del Anillo']],
  [47, 'Life of Pi', '2012-11-21', 127, [12, 18, 14], [DP], 14000, 7.0, 54, 'Un joven sobrevive a un naufragio en un bote con un tigre de Bengala.', ['La vida de Pi']],
  // Crimen (80)
  [48, 'Se7en', '1995-09-22', 127, [80, 9648, 53], [NF, MX], 20000, 8.4, 79, 'Dos detectives persiguen a un asesino que se inspira en los siete pecados capitales.', ['Seven']],
  [49, 'The Godfather', '1972-03-24', 175, [80, 18], [PV, MX], 21000, 8.7, 88, 'El patriarca de una familia mafiosa transfiere el control a su reacio hijo menor.', ['El padrino']],
  [50, 'Nightcrawler', '2014-10-31', 117, [80, 18, 53], [NF], 11200, 7.6, 58, 'Un ladrón se adentra en el mundo del periodismo de sucesos nocturno.', ['Primicia mortal']],
  [51, 'Pulp Fiction', '1994-10-14', 154, [80, 53], [MX, PV], 27000, 8.5, 83, 'Varias historias de criminales de Los Ángeles se entrecruzan.', ['Tiempos violentos']],
  [61, 'Heat', '1995-12-15', 170, [80, 28, 18], [PV], 7800, 7.9, 56, 'Un policía obsesivo persigue a un ladrón profesional en Los Ángeles.', ['Fuego contra fuego']],
  // Ampliacion (ids 62-107): titulos de nicho para el feed tras el onboarding
  [62, 'Paris, Texas', '1984-05-19', 145, [18], [PV], 2100, 8.0, 24, 'Un hombre errante reaparece tras años desaparecido e intenta reconstruir su relación con su hijo.'],
  [63, 'Poor Things', '2023-12-08', 141, [878, 35, 10749], [DP], 4800, 7.8, 34, 'Una joven resucitada por un científico excéntrico descubre el mundo a su manera.', ['Pobres criaturas']],
  [64, 'The Zone of Interest', '2023-12-15', 105, [18, 36], [PV], 2400, 7.3, 26, 'El comandante de Auschwitz y su familia llevan una vida idílica junto al muro del campo.', ['La zona de interés']],
  [65, "Anatomie d'une chute", '2023-08-23', 151, [80, 18, 9648], [NF], 4200, 7.6, 33, 'Una escritora es juzgada por la muerte de su marido mientras su hijo ciego es el único testigo.', ['Anatomía de una caída']],
  [66, 'The Lighthouse', '2019-10-18', 109, [27, 18, 14], [PV], 4500, 7.4, 30, 'Dos fareros se hunden en la locura en una isla remota de Nueva Inglaterra.', ['El faro']],
  [67, 'Portrait of a Lady on Fire', '2019-09-18', 122, [10749, 18], [NF], 2800, 8.1, 28, 'Una pintora retrata en secreto a una joven que se niega a casarse, y entre ambas nace el amor.', ['Retrato de una mujer en llamas']],
  [68, 'Drive My Car', '2021-08-18', 179, [18], [MX], 1500, 7.6, 22, 'Un actor y director viudo entabla amistad con su joven conductora durante un festival en Hiroshima.'],
  [69, 'The Worst Person in the World', '2021-10-13', 128, [10749, 18, 35], [NF], 1900, 7.7, 25, 'Una treintañera de Oslo busca su camino entre relaciones y vocaciones cambiantes.', ['La peor persona del mundo']],
  [70, 'Minari', '2020-12-11', 115, [18], [MX], 2800, 7.4, 26, 'Una familia coreana se muda a una granja en Arkansas en busca del sueño americano.'],
  [71, 'The Souvenir', '2019-05-17', 120, [18, 10749], [PV], 480, 6.9, 14, 'Una joven estudiante de cine se enamora de un hombre misterioso y manipulador.', ['El recuerdo']],
  [72, 'Paterson', '2016-05-18', 118, [18, 35], [PV], 1600, 7.3, 21, 'Un conductor de autobús y poeta aficionado vive rutinas serenas en Nueva Jersey.'],
  [73, 'First Reformed', '2017-09-01', 113, [18, 53], [MX], 1500, 7.0, 20, 'Un pastor atormentado entra en crisis de fe al conocer a una activista medioambiental.', ['El reformado']],
  [74, 'Lady Bird', '2017-11-03', 94, [35, 18], [PV, MX], 4900, 7.4, 36, 'Una adolescente de Sacramento sueña con escapar a la universidad lejos de su madre.'],
  [75, 'Frances Ha', '2013-05-17', 86, [35, 18], [NF], 1400, 7.1, 20, 'Una bailarina de Nueva York sin dinero ni rumbo intenta madurar sin perder su espíritu.'],
  [76, 'The Farewell', '2019-07-12', 100, [35, 18], [PV], 1800, 7.4, 22, 'Una familia china decide ocultar a la abuela su diagnóstico terminal con una boda falsa.', ['La despedida']],
  [77, 'Before Sunset', '2004-07-02', 80, [10749, 18], [MX], 3300, 7.8, 24, 'Nueve años después, dos amantes de una noche se reencuentran en París durante unas horas.', ['Antes del atardecer']],
  [78, 'Weekend', '2011-09-23', 97, [18, 10749], [NF], 460, 7.4, 13, 'Un fin de semana intenso entre dos hombres que se conocen tras una noche de fiesta.'],
  [79, 'Brooklyn', '2015-11-04', 112, [18, 10749], [DP], 3300, 7.4, 28, 'Una joven irlandesa emigra a Nueva York y se debate entre dos amores y dos mundos.'],
  [80, 'Cold War', '2018-06-08', 88, [10749, 18, 10402], [MX], 1500, 7.5, 21, 'Una turbulenta historia de amor en la Polonia y la Europa de la posguerra.', ['Guerra fría']],
  [81, 'Shoplifters', '2018-06-08', 121, [18, 80], [NF], 1900, 7.9, 24, 'Una familia pobre de Tokio sobrevive a base de pequeños hurtos y acoge a una niña desamparada.', ['Un asunto de familia']],
  [82, 'Decision to Leave', '2022-06-29', 138, [53, 9648, 10749], [MX], 1500, 7.3, 27, 'Un detective se obsesiona con la viuda del hombre cuya muerte investiga.', ['Decisión de partir']],
  [83, 'Memories of Murder', '2003-05-02', 131, [80, 18, 53], [PV], 2800, 8.1, 27, 'Dos policías rurales investigan una serie de asesinatos en la Corea de los ochenta.', ['Memorias de un asesino']],
  [84, 'Mommy', '2014-09-19', 139, [18], [MX], 2100, 8.0, 22, 'Una madre viuda y su hijo con TDAH intentan salir adelante con ayuda de una vecina.'],
  [85, 'Leave No Trace', '2018-06-29', 109, [18], [PV, MX], 800, 7.1, 15, 'Un padre veterano y su hija viven ocultos en un bosque hasta que los servicios sociales los encuentran.'],
  [86, 'The Florida Project', '2017-10-06', 111, [18], [PV], 2700, 7.5, 23, 'Una niña de seis años vive un verano de aventuras en un motel junto a Disney World.'],
  [87, 'Nomadland', '2020-09-11', 108, [18], [DP], 4400, 7.3, 33, 'Una mujer recorre el oeste americano en furgoneta tras perder su hogar en la crisis.'],
  [88, 'Dig!', '2004-04-16', 107, [99, 10402], [MX], 150, 7.3, 9, 'Documental sobre la rivalidad y la amistad de dos bandas de rock independiente durante siete años.'],
  [89, 'Searching for Sugar Man', '2012-07-27', 86, [99, 10402], [NF], 2600, 8.1, 24, 'Dos fans investigan el destino de un cantautor de Detroit olvidado en su país y venerado en Sudáfrica.', ['Sugar Man']],
  [90, 'Honeyland', '2019-07-26', 85, [99], [MX], 330, 7.5, 13, 'Una apicultora de Macedonia del Norte ve alterado su modo de vida por unos vecinos ruidosos.'],
  [91, 'Fire of Love', '2022-07-15', 93, [99, 10749], [DP], 420, 7.6, 14, 'Dos vulcanólogos franceses dedican su vida y su amor a perseguir erupciones.', ['Fuego de amor']],
  [92, 'Moon', '2009-06-12', 97, [878, 18, 53], [PV], 4900, 7.6, 32, 'Un astronauta solitario en una base lunar empieza a dudar de su propia identidad.', ['Moon: la cara oculta']],
  [93, 'Ex Machina', '2015-01-21', 108, [878, 18, 53], [NF, MX], 9800, 7.6, 40, 'Un programador evalúa la conciencia de una androide creada por su excéntrico jefe.'],
  [94, 'Her', '2013-12-18', 126, [10749, 878, 18], [MX, PV], 11500, 7.9, 46, 'Un escritor solitario se enamora del sistema operativo de su ordenador.', ['Ella']],
  [95, 'Primer', '2004-10-08', 77, [878, 53, 18], [PV], 1100, 6.8, 12, 'Dos ingenieros descubren por accidente un modo de viajar en el tiempo y pierden el control.'],
  [96, 'Annihilation', '2018-02-23', 115, [878, 27, 18], [NF], 5100, 6.8, 33, 'Una bióloga entra en una zona alterada por un fenómeno extraterrestre.', ['Aniquilación']],
  [97, 'Coherence', '2013-08-02', 89, [878, 53, 9648], [NF], 1900, 7.2, 17, 'Durante una cena, el paso de un cometa desencadena sucesos imposibles entre amigos.'],
  [98, 'The Handmaiden', '2016-06-01', 145, [18, 10749, 53], [PV], 2800, 8.1, 27, 'Una estafadora se infiltra como criada de una heredera japonesa en la Corea de los años treinta.', ['La doncella']],
  [99, 'Oldboy', '2003-11-21', 120, [53, 9648, 28], [PV], 4900, 8.3, 38, 'Un hombre es liberado tras quince años de encierro y busca vengarse de su captor.'],
  [100, 'Blue Ruin', '2013-04-26', 90, [80, 53, 18], [NF], 1100, 6.9, 14, 'Un vagabundo regresa a casa para vengar el asesinato de sus padres y desata una espiral.'],
  [101, 'A Prophet', '2009-08-26', 155, [80, 18], [MX], 1900, 7.8, 20, 'Un joven condenado a prisión se abre paso en el crimen organizado de una cárcel francesa.', ['Un profeta']],
  [102, 'The Killing of a Sacred Deer', '2017-10-27', 121, [53, 27, 18], [PV], 3500, 7.0, 27, 'Un cirujano debe elegir a quién sacrificar de su familia tras ayudar a un joven inquietante.', ['El sacrificio de un ciervo sagrado']],
  [103, 'The Babadook', '2014-05-22', 94, [27, 18, 9648], [MX], 4500, 6.8, 31, 'Una viuda y su hijo son acechados por un siniestro libro infantil.'],
  [104, 'The Wind Rises', '2013-07-20', 126, [16, 18, 10749], [MX], 2300, 7.8, 28, 'La vida del ingeniero que diseñó cazas durante la Segunda Guerra Mundial, entre sueños y amor.', ['El viento se levanta']],
  [105, 'A Silent Voice', '2016-09-17', 130, [16, 18, 10749], [NF], 1900, 8.2, 30, 'Un joven intenta redimirse ante la compañera sorda a la que acosó en la infancia.', ['Koe no Katachi']],
  [106, 'Persepolis', '2007-06-27', 96, [16, 18, 36], [PV], 1700, 7.7, 21, 'Una niña iraní crece entre la revolución islámica y su exilio en Europa.', ['Persépolis']],
  [107, 'Princess Mononoke', '1997-07-12', 134, [16, 14, 12], [MX, NF], 6900, 8.3, 45, 'Un joven guerrero se ve en medio de la guerra entre los dioses del bosque y una ciudad minera.', ['La princesa Mononoke']],
  [111, 'The Raid', '2011-09-08', 101, [28], [NF, PV], 4800, 7.6, 35, 'Un equipo de élite asalta un edificio controlado por un capo y debe abrirse paso piso a piso.', ['Redada asesina']],
  [112, 'Kung Fu Hustle', '2004-12-23', 99, [28, 35], [PV], 3600, 7.2, 30, 'Un aspirante a delincuente se cruza con maestros de artes marciales en un barrio de Shanghái.', ['Kung Fusion']],
  [113, 'Ip Man', '2008-12-12', 106, [28], [NF], 2900, 7.6, 26, 'La vida del maestro de wing chun durante la ocupación japonesa de China.'],
  [114, 'Edge of Tomorrow', '2014-05-30', 113, [28, 878], [MX, PV], 4900, 7.6, 40, 'Un soldado novato revive una y otra vez la misma batalla contra una invasión alienígena.', ['Al filo del mañana']],
  [115, 'The Princess Bride', '1987-09-25', 98, [12, 10751, 14], [DP], 4200, 7.8, 32, 'Un granjero se lanza a rescatar a su amada en un cuento de espadachines y gigantes.', ['La princesa prometida']],
  [116, "Kiki's Delivery Service", '1989-07-29', 103, [16, 10751, 12], [MX], 3400, 7.8, 31, 'Una joven bruja se instala en una ciudad costera y abre un servicio de reparto volador.', ['Nicky, la aprendiz de bruja']],
  [117, 'Big Hero 6', '2014-11-07', 102, [16, 10751, 28], [DP], 4700, 7.8, 38, 'Un adolescente prodigio y un robot sanitario forman un equipo de superhéroes.'],
  [118, 'The Secret of Kells', '2009-02-10', 75, [16, 10751, 12], [MX], 1100, 7.6, 14, 'Un joven monje irlandés ayuda a completar un libro iluminado legendario.', ['El secreto de Kells']],
  [119, 'Train to Busan', '2016-07-20', 118, [28, 27, 53], [NF, PV], 4600, 7.6, 39, 'Los pasajeros de un tren de alta velocidad luchan por sobrevivir a un brote zombi.', ['Estación Zombie']],
  [120, 'Hunt for the Wilderpeople', '2016-03-31', 101, [12, 35], [NF], 1900, 7.8, 24, 'Un niño rebelde y su tutor huraño huyen por el monte neozelandés perseguidos por la policía.'],
  [121, 'Tenet', '2020-08-26', 150, [28, 878, 53], [MX], 4900, 7.2, 44, 'Un agente secreto manipula el flujo del tiempo para evitar una guerra mundial.'],
  [122, 'Searching', '2018-08-24', 102, [28, 878], [PV], 3100, 7.4, 22, 'Un padre investiga la desaparición de su hija a través de su vida digital.', ['Searching: Desaparecida']],
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
    episodes: [
      'The End',
      'The Target',
      'The Head',
      'The Ghouls',
      'The Past',
      'The Trap',
      'The Radio',
      'The Beginning',
    ],
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
    id: 56,
    name: 'The Last of Us',
    firstAirDate: '2023-01-15',
    runtime: 56,
    genreIds: [18, 878, 27],
    platforms: [MX],
    voteCount: 5600,
    voteAverage: 8.6,
    popularity: 94,
    overview: 'Un superviviente escolta a una adolescente por unos Estados Unidos devastados por una infección.',
    episodes: ['Cuando estés perdido en la oscuridad', 'Infectados', 'Mucho, mucho tiempo', 'Agárrate a mi mano'],
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
  {
    id: 58,
    name: 'Black Mirror',
    firstAirDate: '2011-12-04',
    runtime: 55,
    genreIds: [878, 18, 53],
    platforms: [NF],
    voteCount: 5400,
    voteAverage: 8.3,
    popularity: 78,
    overview: 'Antología de historias que exploran el lado oscuro de la tecnología.',
    episodes: ['El himno nacional', 'Quince millones de méritos', 'Toda tu historia'],
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
    id: 60,
    name: 'Arcane',
    firstAirDate: '2021-11-06',
    runtime: 42,
    genreIds: [16, 878, 28],
    platforms: [NF],
    voteCount: 3900,
    voteAverage: 8.7,
    popularity: 82,
    overview: 'Dos hermanas quedan en bandos opuestos de un conflicto entre dos ciudades.',
    episodes: ['Bienvenidos al patio de juegos', 'Algunos misterios es mejor dejarlos sin resolver', 'El monstruo en el que te has convertido', 'Cuando estos muros caigan'],
  },
  {
    id: 108,
    name: 'Normal People',
    firstAirDate: '2020-04-26',
    runtime: 30,
    genreIds: [18, 10749],
    platforms: [PV],
    voteCount: 1500,
    voteAverage: 7.9,
    popularity: 30,
    overview: 'La relación intermitente de dos jóvenes irlandeses desde el instituto hasta la universidad.',
    alt: ['Gente normal'],
    episodes: ['Episodio 1', 'Episodio 2', 'Episodio 3'],
  },
  {
    id: 109,
    name: 'Mindhunter',
    firstAirDate: '2017-10-13',
    runtime: 55,
    genreIds: [80, 18, 53],
    platforms: [NF],
    voteCount: 3300,
    voteAverage: 8.6,
    popularity: 38,
    overview: 'Dos agentes del FBI entrevistan a asesinos en serie para entender su mente en los años setenta.',
    episodes: ['Episodio 1', 'Episodio 2', 'Episodio 3'],
  },
  {
    id: 110,
    name: 'The Leftovers',
    firstAirDate: '2014-06-29',
    runtime: 60,
    genreIds: [18, 9648, 14],
    platforms: [MX],
    voteCount: 1300,
    voteAverage: 8.1,
    popularity: 25,
    overview: 'Tres años después de la desaparición del dos por ciento de la humanidad, un pueblo trata de seguir adelante.',
    alt: ['Los que se quedan'],
    episodes: ['Episodio 1', 'Episodio 2', 'Episodio 3'],
  },
];

const movies: Movie[] = MOVIE_ROWS.map(movie);
const tvs: TVSeries[] = TV_ROWS.map(series);

/** Catalogo completo ordenado por id ascendente (ids secuenciales 1-122). */
export const CATALOG: ReadonlyArray<Media> = [...movies, ...tvs].sort((a, b) => a.id - b.id);

export const MOVIES: ReadonlyArray<Movie> = CATALOG.filter((m): m is Movie => m.media_type === 'movie');
export const SERIES: ReadonlyArray<TVSeries> = CATALOG.filter((m): m is TVSeries => m.media_type === 'tv');

const INDEX = new Map<string, Media>(CATALOG.map((m) => [`${m.media_type}:${m.id}`, m]));

export function getMedia(type: MediaType, id: number): Media | undefined {
  return INDEX.get(`${type}:${id}`);
}

export function getMovie(id: number): Movie | undefined {
  const m = getMedia('movie', id);
  return m && m.media_type === 'movie' ? m : undefined;
}

export function getSeries(id: number): TVSeries | undefined {
  const m = getMedia('tv', id);
  return m && m.media_type === 'tv' ? m : undefined;
}

export function getMediaByRef(ref: Pick<MediaRef, 'mediaType' | 'mediaId'>): Media | undefined {
  return getMedia(ref.mediaType, ref.mediaId);
}

export function getTvSeason(id: number, seasonNumber: number): TVSeason | undefined {
  return getSeries(id)?.seasons.find((s) => s.season_number === seasonNumber);
}

/** Clave de historial del titulo completo (pelicula o serie). */
export function mediaKeyOf(media: Media): MediaKey {
  return buildMediaKey({ mediaType: media.media_type, mediaId: media.id });
}

export function titleOf(media: Media): string {
  return media.media_type === 'movie' ? media.title : media.name;
}

export function releaseDateOf(media: Media): string {
  return media.media_type === 'movie' ? media.release_date : media.first_air_date;
}

export function releaseYearOf(media: Media): number {
  return Number(releaseDateOf(media).slice(0, 4));
}

/** Duracion en minutos: runtime en peliculas, episode_run_time[0] en series. */
export function runtimeOf(media: Media): number {
  return media.media_type === 'movie' ? media.runtime : (media.episode_run_time[0] ?? 0);
}

export function mainGenreId(media: Media): number | undefined {
  return media.genres[0]?.id;
}
