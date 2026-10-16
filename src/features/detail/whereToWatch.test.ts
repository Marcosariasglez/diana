import { groupAvailability } from './whereToWatch';

describe('groupAvailability', () => {
  const raw = { flatrate: ['prime-video'], rent: ['prime-video', 'apple-tv'], buy: ['prime-video'] };

  it('datos reales: se respetan tal cual (una plataforma puede estar en varias modalidades)', () => {
    expect(groupAvailability(raw, true)).toEqual({ ...raw, rentOrBuy: [] });
  });

  it('datos del catálogo: lo que está en alquiler y compra sale una vez como «alquiler o compra»', () => {
    expect(groupAvailability(raw, false)).toEqual({
      flatrate: ['prime-video'],
      rent: ['apple-tv'],
      buy: [],
      rentOrBuy: ['prime-video'],
    });
  });

  it('quita duplicados dentro de una misma fila', () => {
    expect(groupAvailability({ flatrate: ['a', 'a'], rent: [], buy: [] }, true).flatrate).toEqual(['a']);
  });

  it('sin datos devuelve todo vacío', () => {
    expect(groupAvailability({ flatrate: [], rent: [], buy: [] }, false)).toEqual({
      flatrate: [],
      rent: [],
      buy: [],
      rentOrBuy: [],
    });
  });
});
