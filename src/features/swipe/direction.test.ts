import { SWIPE_THRESHOLDS } from '@/constants/onboarding';
import { resolveDirection } from './direction';

const D = SWIPE_THRESHOLDS.distance;
const V = SWIPE_THRESHOLDS.velocity;

describe('resolveDirection', () => {
  it('devuelve like al superar la distancia a la derecha', () => {
    expect(resolveDirection(D + 1, 0, 0, 0)).toBe('like');
  });

  it('devuelve skip al superar la distancia a la izquierda', () => {
    expect(resolveDirection(-D - 1, 10, 0, 0)).toBe('skip');
  });

  it('exactamente en el umbral no decide', () => {
    expect(resolveDirection(D, 0, 0, 0)).toBeNull();
    expect(resolveDirection(-D, 0, 0, 0)).toBeNull();
    expect(resolveDirection(0, -D, 0, 0)).toBeNull();
  });

  it('decide por velocidad aunque la distancia sea corta', () => {
    expect(resolveDirection(30, 0, V + 1, 0)).toBe('like');
    expect(resolveDirection(-30, 0, -V - 1, 0)).toBe('skip');
    expect(resolveDirection(0, -30, 0, -V - 1)).toBe('unseen');
  });

  it('devuelve unseen hacia arriba por distancia', () => {
    expect(resolveDirection(10, -D - 1, 0, 0)).toBe('unseen');
  });

  it('hacia abajo nunca decide', () => {
    expect(resolveDirection(0, D * 3, 0, V * 3)).toBeNull();
  });

  it('el eje dominante gana: arrastre diagonal mas horizontal', () => {
    expect(resolveDirection(D + 50, -D - 10, 0, 0)).toBe('like');
  });

  it('el eje dominante gana: arrastre diagonal mas vertical', () => {
    expect(resolveDirection(D + 1, -(D + 60), 0, 0)).toBe('unseen');
  });

  it('con allowUnseen=false el gesto vertical vuelve (null)', () => {
    expect(resolveDirection(0, -D - 50, 0, -V - 50, false)).toBeNull();
  });

  it('allowUnseen=false no afecta al eje horizontal', () => {
    expect(resolveDirection(D + 1, 0, 0, 0, false)).toBe('like');
    expect(resolveDirection(-D - 1, 0, 0, 0, false)).toBe('skip');
  });

  it('sin movimiento devuelve null', () => {
    expect(resolveDirection(0, 0, 0, 0)).toBeNull();
  });
});
