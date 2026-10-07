import type { Rating } from '@/types/rating';

export type DetailPhase = 'locked' | 'rolling' | 'revealed';

/** Subconjunto de HistoryEntry que necesita la maquina. */
export interface DetailEntry {
  userRating: Rating;
  aiPrediction: number;
  predictionSeen: boolean;
}

export interface DetailState {
  phase: DetailPhase;
  /** Entrada guardada para la clave seleccionada (null si no existe). */
  entry: DetailEntry | null;
  /** Nota elegida pero no necesariamente guardada. */
  draft: Rating | null;
  /** Prediccion conocida (de la entrada o llegada tras guardar). */
  prediction: number | null;
  /** false al reabrir un elemento ya revelado: SlotReveal pinta el final sin animar. */
  animated: boolean;
}

export type DetailEvent =
  | { type: 'setRating'; rating: Rating }
  | { type: 'save' }
  | { type: 'predictionReady'; prediction: number }
  | { type: 'revealDone' }
  | { type: 'saveFailed' }
  | { type: 'selectionChanged'; entry: DetailEntry | null };

export type DetailAction = 'save' | 'reveal' | 'update';

export function initialDetailState(entry: DetailEntry | null): DetailState {
  if (entry === null) {
    return { phase: 'locked', entry: null, draft: null, prediction: null, animated: true };
  }
  if (!entry.predictionSeen) {
    return {
      phase: 'locked',
      entry,
      draft: entry.userRating,
      prediction: entry.aiPrediction,
      animated: true,
    };
  }
  return {
    phase: 'revealed',
    entry,
    draft: entry.userRating,
    prediction: entry.aiPrediction,
    animated: false,
  };
}

export function detailReducer(state: DetailState, event: DetailEvent): DetailState {
  switch (event.type) {
    case 'setRating':
      if (state.phase === 'rolling') return state;
      return { ...state, draft: event.rating };

    case 'save': {
      if (state.phase === 'rolling') return state;
      if (state.phase === 'locked') {
        // Sin entrada hace falta un borrador; con entrada sin revelar siempre se puede.
        if (state.entry === null && state.draft === null) return state;
        return { ...state, phase: 'rolling', animated: true };
      }
      // revealed: actualizar nota, sin animacion y sin tocar la prediccion
      if (state.draft === null || state.entry === null || state.draft === state.entry.userRating) {
        return state;
      }
      return {
        ...state,
        entry: { ...state.entry, userRating: state.draft },
        animated: false,
      };
    }

    case 'predictionReady':
      if (state.phase !== 'rolling') return state;
      return { ...state, prediction: event.prediction };

    case 'revealDone': {
      if (state.phase !== 'rolling' || state.draft === null || state.prediction === null) {
        return state;
      }
      return {
        ...state,
        phase: 'revealed',
        entry: {
          userRating: state.draft,
          aiPrediction: state.prediction,
          predictionSeen: true,
        },
      };
    }

    case 'saveFailed':
      if (state.phase !== 'rolling') return state;
      return {
        ...state,
        phase: 'locked',
        prediction: state.entry ? state.entry.aiPrediction : null,
      };

    case 'selectionChanged':
      return initialDetailState(event.entry);
  }
}

export interface DetailView {
  buttonLabel: string;
  buttonDisabled: boolean;
  /** Que debe ejecutar la pantalla al pulsar el boton (null si no hace nada). */
  action: DetailAction | null;
  /** Valor para SlotReveal: solo se muestra fuera de `locked`. */
  slotValue: number | null;
  /** Hint del estado locked de la tarjeta de IA. */
  lockedHint: string;
}

export function detailView(state: DetailState): DetailView {
  const slotValue = state.phase === 'locked' ? null : state.prediction;
  const lockedHint =
    state.entry !== null && !state.entry.predictionSeen
      ? 'Revela tu predicción'
      : 'Guarda tu nota para ver la predicción';

  if (state.phase === 'rolling') {
    return { buttonLabel: 'Guardando...', buttonDisabled: true, action: null, slotValue, lockedHint };
  }
  if (state.phase === 'locked') {
    if (state.entry !== null) {
      return {
        buttonLabel: 'Revelar predicción',
        buttonDisabled: false,
        action: 'reveal',
        slotValue,
        lockedHint,
      };
    }
    const enabled = state.draft !== null;
    return {
      buttonLabel: 'Guardar nota',
      buttonDisabled: !enabled,
      action: enabled ? 'save' : null,
      slotValue,
      lockedHint,
    };
  }
  const dirty = state.entry !== null && state.draft !== null && state.draft !== state.entry.userRating;
  return {
    buttonLabel: dirty ? 'Actualizar nota' : 'Nota guardada',
    buttonDisabled: !dirty,
    action: dirty ? 'update' : null,
    slotValue,
    lockedHint,
  };
}
