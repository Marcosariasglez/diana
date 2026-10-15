// P8 (F4-1): datos de test de salas PROPIOS, independientes de
// `src/mocks/fakeSocket` (que muere en P12). Copia los valores que el test del
// mood de grupo asienta: la línea de tiempo de la sala sembrada y las
// respuestas del anfitrión simulado. (El fakeSocket conserva sus propios
// exports hasta P12; los valores son los mismos y no deben divergir.)
export const MOCK_TIMELINE = {
  joinMaria: 2000,
  joinCarlos: 5000,
  readyCarlos: 8000,
  joinAna: 12000,
  readyAna: 15000,
  seededHostStartDelay: 2000,
  hostMoodFirstAnswer: 1000,
  hostMoodStep: 1500,
  hostMoodConfirmDelay: 1500,
  friendPaceMs: 2500,
} as const;

export const MOCK_HOST_MOOD_ANSWERS = {
  time: 'h2',
  energy: 'calm',
  company: 'friends',
  platforms: 'netflix,max',
} as const;
