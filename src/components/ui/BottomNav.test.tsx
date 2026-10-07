import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BottomNav, type BottomNavProps } from './BottomNav';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function makeProps(index: number, names: string[]) {
  const emit = jest.fn(() => ({ defaultPrevented: false }));
  const navigate = jest.fn();
  const props = {
    state: { index, routes: names.map((name) => ({ key: `${name}-k`, name })) },
    navigation: { emit, navigate },
  } as unknown as BottomNavProps;
  return { props, emit, navigate };
}

const TABS = ['index', 'mood', 'match', 'profile', 'detail/[id]'];

describe('BottomNav', () => {
  it('pinta 4 pestanas fijas y resalta la enfocada', async () => {
    const { props } = makeProps(1, TABS);
    await render(<BottomNav {...props} />);
    for (const l of ['Inicio', 'Mood', 'Match', 'Perfil']) {
      expect(screen.getByLabelText(l)).toBeTruthy();
    }
    expect(screen.getByLabelText('Mood').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Inicio').props.accessibilityState.selected).toBe(false);
  });
  it('en la ficha mantiene resaltada la ultima pestana visible', async () => {
    const first = makeProps(3, TABS);
    const { rerender } = await render(<BottomNav {...first.props} />);
    const second = makeProps(4, TABS);
    await rerender(<BottomNav {...second.props} />);
    expect(screen.getByLabelText('Perfil').props.accessibilityState.selected).toBe(true);
  });
  it('pulsar pestana emite tabPress y navega', async () => {
    const { props, emit, navigate } = makeProps(0, TABS);
    await render(<BottomNav {...props} />);
    await fireEvent.press(screen.getByLabelText('Match'));
    expect(emit).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('match');
  });
  it('FAB navega a /daily-log', async () => {
    const { props } = makeProps(0, TABS);
    await render(<BottomNav {...props} />);
    await fireEvent.press(screen.getByLabelText('Registrar en el diario'));
    expect(router.push).toHaveBeenCalledWith('/daily-log');
  });
});
