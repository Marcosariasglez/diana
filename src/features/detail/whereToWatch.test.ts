import { groupAvailability } from './whereToWatch';

describe('groupAvailability', () => {
  const raw = { flatrate: ['prime-video'], rent: ['prime-video', 'apple-tv'], buy: ['prime-video'] };

  it('datos reales: se respetan tal cual', () => {
    expect(groupAvailability(raw, true)).toEqual(raw);
  });

  it('datos del catálogo: solo suscripción (alquiler y compra no son fiables)', () => {
    expect(groupAvailability(raw, false)).toEqual({ flatrate: ['prime-video'], rent: [], buy: [] });
  });

  it('quita duplicados dentro de una misma fila', () => {
    expect(groupAvailability({ flatrate: ['a', 'a'], rent: [], buy: [] }, true).flatrate).toEqual(['a']);
  });

  it('sin datos devuelve todo vacío', () => {
    expect(groupAvailability({ flatrate: [], rent: [], buy: [] }, false)).toEqual({ flatrate: [], rent: [], buy: [] });
  });
});
