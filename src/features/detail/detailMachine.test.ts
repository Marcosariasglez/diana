import {
  detailReducer,
  detailView,
  initialDetailState,
  type DetailEntry,
  type DetailState,
} from './detailMachine';

const unseenEntry: DetailEntry = { userRating: 3.5, aiPrediction: 4.3, predictionSeen: false };
const seenEntry: DetailEntry = { userRating: 4, aiPrediction: 4.3, predictionSeen: true };

describe('initialDetailState', () => {
  it('sin entrada: locked, borrador vacio y "Guardar nota" deshabilitado', () => {
    const s = initialDetailState(null);
    expect(s.phase).toBe('locked');
    expect(s.draft).toBeNull();
    const v = detailView(s);
    expect(v.buttonLabel).toBe('Guardar nota');
    expect(v.buttonDisabled).toBe(true);
    expect(v.action).toBeNull();
    expect(v.slotValue).toBeNull();
    expect(v.lockedHint).toBe('Guarda tu nota para ver la predicción');
  });

  it('entrada con predictionSeen=false: locked, nota cargada y "Revelar predicción"', () => {
    const s = initialDetailState(unseenEntry);
    expect(s.phase).toBe('locked');
    expect(s.draft).toBe(3.5);
    const v = detailView(s);
    expect(v.buttonLabel).toBe('Revelar predicción');
    expect(v.buttonDisabled).toBe(false);
    expect(v.action).toBe('reveal');
    expect(v.slotValue).toBeNull();
    expect(v.lockedHint).toBe('Revela tu predicción');
  });

  it('entrada con predictionSeen=true: revealed sin animar y "Nota guardada"', () => {
    const s = initialDetailState(seenEntry);
    expect(s.phase).toBe('revealed');
    expect(s.animated).toBe(false);
    expect(s.prediction).toBe(4.3);
    const v = detailView(s);
    expect(v.buttonLabel).toBe('Nota guardada');
    expect(v.buttonDisabled).toBe(true);
    expect(v.slotValue).toBe(4.3);
  });
});

describe('detailReducer', () => {
  it('elegir estrellas sin entrada habilita "Guardar nota"', () => {
    const s = detailReducer(initialDetailState(null), { type: 'setRating', rating: 4 });
    expect(s.phase).toBe('locked');
    expect(s.draft).toBe(4);
    const v = detailView(s);
    expect(v.buttonLabel).toBe('Guardar nota');
    expect(v.buttonDisabled).toBe(false);
    expect(v.action).toBe('save');
  });

  it('cambiar estrellas con entrada sin revelar conserva "Revelar predicción"', () => {
    const s = detailReducer(initialDetailState(unseenEntry), { type: 'setRating', rating: 5 });
    expect(s.draft).toBe(5);
    expect(detailView(s).buttonLabel).toBe('Revelar predicción');
  });

  it('guardar sin borrador no hace nada', () => {
    const s0 = initialDetailState(null);
    expect(detailReducer(s0, { type: 'save' })).toBe(s0);
  });

  it('guardar nota: locked -> rolling -> revealed con la prediccion recibida', () => {
    let s = detailReducer(initialDetailState(null), { type: 'setRating', rating: 4 });
    s = detailReducer(s, { type: 'save' });
    expect(s.phase).toBe('rolling');
    expect(s.animated).toBe(true);
    const rolling = detailView(s);
    expect(rolling.buttonLabel).toBe('Guardando...');
    expect(rolling.buttonDisabled).toBe(true);

    s = detailReducer(s, { type: 'predictionReady', prediction: 4.3 });
    expect(s.prediction).toBe(4.3);
    s = detailReducer(s, { type: 'revealDone' });
    expect(s.phase).toBe('revealed');
    expect(s.entry).toEqual({ userRating: 4, aiPrediction: 4.3, predictionSeen: true });
    const v = detailView(s);
    expect(v.buttonLabel).toBe('Nota guardada');
    expect(v.buttonDisabled).toBe(true);
    expect(v.slotValue).toBe(4.3);
  });

  it('revelar prediccion existente: usa el aiPrediction guardado, sin recalcular', () => {
    let s = initialDetailState(unseenEntry);
    s = detailReducer(s, { type: 'setRating', rating: 4.5 });
    s = detailReducer(s, { type: 'save' });
    expect(s.phase).toBe('rolling');
    expect(s.prediction).toBe(4.3);
    expect(detailView(s).slotValue).toBe(4.3);
    s = detailReducer(s, { type: 'revealDone' });
    expect(s.phase).toBe('revealed');
    expect(s.entry).toEqual({ userRating: 4.5, aiPrediction: 4.3, predictionSeen: true });
  });

  it('fallo al guardar sin entrada: vuelve a locked con el borrador intacto', () => {
    let s = detailReducer(initialDetailState(null), { type: 'setRating', rating: 3 });
    s = detailReducer(s, { type: 'save' });
    s = detailReducer(s, { type: 'saveFailed' });
    expect(s.phase).toBe('locked');
    expect(s.draft).toBe(3);
    expect(s.entry).toBeNull();
    expect(s.prediction).toBeNull();
    expect(detailView(s).buttonLabel).toBe('Guardar nota');
  });

  it('fallo al revelar una entrada sin ver: vuelve a locked y conserva entrada y borrador', () => {
    let s = detailReducer(initialDetailState(unseenEntry), { type: 'setRating', rating: 2 });
    s = detailReducer(s, { type: 'save' });
    s = detailReducer(s, { type: 'saveFailed' });
    expect(s.phase).toBe('locked');
    expect(s.draft).toBe(2);
    expect(s.entry).toEqual(unseenEntry);
    expect(detailView(s).buttonLabel).toBe('Revelar predicción');
  });

  it('durante rolling ignora cambios de estrellas', () => {
    let s = detailReducer(initialDetailState(null), { type: 'setRating', rating: 3 });
    s = detailReducer(s, { type: 'save' });
    const after = detailReducer(s, { type: 'setRating', rating: 5 });
    expect(after.draft).toBe(3);
  });

  it('editar la nota en revealed muestra "Actualizar nota" y no cambia la prediccion', () => {
    let s = initialDetailState(seenEntry);
    s = detailReducer(s, { type: 'setRating', rating: 2.5 });
    expect(s.phase).toBe('revealed');
    const v = detailView(s);
    expect(v.buttonLabel).toBe('Actualizar nota');
    expect(v.buttonDisabled).toBe(false);
    expect(v.action).toBe('update');
    expect(v.slotValue).toBe(4.3);

    s = detailReducer(s, { type: 'save' });
    expect(s.phase).toBe('revealed');
    expect(s.animated).toBe(false);
    expect(s.entry).toEqual({ userRating: 2.5, aiPrediction: 4.3, predictionSeen: true });
    expect(s.prediction).toBe(4.3);
    expect(detailView(s).buttonLabel).toBe('Nota guardada');
  });

  it('volver a la nota guardada en revealed deshabilita el boton', () => {
    let s = initialDetailState(seenEntry);
    s = detailReducer(s, { type: 'setRating', rating: 1 });
    s = detailReducer(s, { type: 'setRating', rating: 4 });
    expect(detailView(s).buttonDisabled).toBe(true);
  });

  it('cambiar de seleccion reinicia con el estado inicial de la nueva clave', () => {
    let s: DetailState = initialDetailState(seenEntry);
    s = detailReducer(s, { type: 'setRating', rating: 1 });
    s = detailReducer(s, { type: 'selectionChanged', entry: null });
    expect(s).toEqual(initialDetailState(null));
    s = detailReducer(s, { type: 'selectionChanged', entry: unseenEntry });
    expect(s).toEqual(initialDetailState(unseenEntry));
  });

  it('eventos fuera de fase no cambian el estado', () => {
    const locked = initialDetailState(null);
    expect(detailReducer(locked, { type: 'revealDone' })).toBe(locked);
    expect(detailReducer(locked, { type: 'saveFailed' })).toBe(locked);
    expect(detailReducer(locked, { type: 'predictionReady', prediction: 4 })).toBe(locked);
  });
});
