/**
 * C.1 · Rediseño de la pestaña Mood (VERTICE-PLAN-2):
 *  - tarjetas de afinidad SIEMPRE visibles (solo y grupo)
 *  - modo grupo: acciones de sala aquí mismo (antes en Match):
 *    «Unirme con código» y, si hay sala activa, «Volver a mi sala».
 *  - «Generar código» crea la sala con la afinidad seleccionada (0012).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => '/mood',
}));

// Perfil fijo. En zustand real getState/setState cuelgan de la función
// useProfileStore (no son exportos hermanos), así que el mock lo replica.
// displayName lo usa el repo mock al nombrar al anfitrión de la sala.
jest.mock('@/store/useProfileStore', () => {
  const profileState = { profile: { id: 'u1', displayName: 'Ana', favoritePlatforms: [] } };
  const useProfileStore = (
    sel?: (s: typeof profileState) => unknown,
  ): unknown => (sel ? sel(profileState) : profileState);
  useProfileStore.getState = () => profileState;
  useProfileStore.setState = (patch: Partial<typeof profileState>) =>
    Object.assign(profileState, patch);
  return { useProfileStore };
});

import MoodScreen from '../../app/(tabs)/mood';
import { useMoodStore } from '@/store/useMoodStore';
import { useRoomStore } from '@/store/useRoomStore';

/** Espera (sondeo) a que el predicado se cumpla, con tope de 2 s. */
async function waitFor(cond: () => boolean, ms = 2000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor: timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('Pantalla Mood (C.1: afinidad siempre + acciones de sala)', () => {
  beforeEach(() => {
    useMoodStore.setState({ mode: 'solo', complexity: 'intermedio' });
    mockPush.mockClear();
  });

  afterEach(async () => {
    // Limpieza de sala: el repo mock llama a leaveRoom y libera temporizadores.
    await act(async () => {
      useRoomStore.getState().leaveRoom();
    });
  });

  it('modo solo: tarjetas de afinidad visibles y boton "Empezar"', async () => {
    await render(<MoodScreen />);
    expect(screen.getByRole('radio', { name: /Exprés/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Intermedio/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Cinéfilo/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeTruthy();
  });

  it('modo grupo: las tarjetas de afinidad siguen siendo visibles', async () => {
    useMoodStore.setState({ mode: 'group' });
    await render(<MoodScreen />);
    expect(screen.getByRole('radio', { name: /Exprés/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Intermedio/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Cinéfilo/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Generar código' })).toBeTruthy();
  });

  it('modo grupo: accion "Unirme con codigo" (antes en Match)', async () => {
    useMoodStore.setState({ mode: 'group' });
    await render(<MoodScreen />);
    expect(screen.getByRole('button', { name: /Unirme con código/ })).toBeTruthy();
  });

  it('modo grupo con sala activa: "Volver a mi sala" con el codigo de la sala', async () => {
    useMoodStore.setState({ mode: 'group' });
    let code = '';
    await act(async () => {
      code = await useRoomStore.getState().createRoom();
    });
    expect(code).toHaveLength(4);
    await render(<MoodScreen />);
    const back = screen.getByRole('button', { name: new RegExp(`Volver a mi sala.*${code}`) });
    expect(back).toBeTruthy();
    fireEvent.press(back);
    expect(mockPush).toHaveBeenCalledWith(`/room/${code}`);
  });

  it('modo grupo: "Generar codigo" crea la sala con la afinidad seleccionada (0012)', async () => {
    useMoodStore.setState({ mode: 'group', complexity: 'cinefilo' });
    await render(<MoodScreen />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Generar código' }));
    });
    // createRoom es async (fakeDelay + joinRoom); esperamos a que la sala quede activa.
    await act(async () => {
      await waitFor(() => useRoomStore.getState().status === 'active' && !!useRoomStore.getState().code);
    });
    expect(useRoomStore.getState().affinity).toBe('cinefilo');
    const code = useRoomStore.getState().code;
    expect(code).toHaveLength(4);
    expect(mockPush).toHaveBeenCalledWith(`/room/${code}`);
  });

  it('modo solo: no hay acciones de sala (nada de unirse ni volver)', async () => {
    useMoodStore.setState({ mode: 'solo' });
    await render(<MoodScreen />);
    expect(screen.queryByRole('button', { name: /Unirme con código/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Volver a mi sala/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Generar código' })).toBeNull();
  });
});
