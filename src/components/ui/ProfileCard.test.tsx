import { render, screen } from '@testing-library/react-native';
import { ProfileCard } from './ProfileCard';

describe('ProfileCard', () => {
  it('renderiza nombre, subtitulo e inicial del avatar', async () => {
    await render(<ProfileCard name="Marcos" subtitle="marco@vertice.app" initial="M" />);
    expect(screen.getByText('Marcos')).toBeTruthy();
    expect(screen.getByText('marco@vertice.app')).toBeTruthy();
    expect(screen.getByText('M')).toBeTruthy();
  });

  it('sin inicial, usa la primera letra del nombre', async () => {
    await render(<ProfileCard name="diana" />);
    expect(screen.getByText('D')).toBeTruthy();
  });

  it('sin subtitulo no pinta linea secundaria', async () => {
    await render(<ProfileCard name="Diana" initial="D" />);
    expect(screen.queryByText('')).toBeNull();
  });
});
