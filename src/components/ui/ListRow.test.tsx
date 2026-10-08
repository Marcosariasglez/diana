import { fireEvent, render, screen } from '@testing-library/react-native';
import { Bell } from 'lucide-react-native';
import { ListRow } from './ListRow';

describe('ListRow', () => {
  it('renderiza titulo, subtitulo y valor', async () => {
    await render(
      <ListRow title="Correo" subtitle="Entras con Google" value="marco@vertice.app" />,
    );
    expect(screen.getByText('Correo')).toBeTruthy();
    expect(screen.getByText('Entras con Google')).toBeTruthy();
    expect(screen.getByText('marco@vertice.app')).toBeTruthy();
  });

  it('con onPress es boton y dispara al pulsar', async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Apariencia" icon={Bell} onPress={onPress} />);
    const row = screen.getByRole('button', { name: 'Apariencia' });
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sin onPress no es boton', async () => {
    await render(<ListRow title="Correo" value="marco@vertice.app" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('la primera fila se marca con first', async () => {
    await render(<ListRow first title="Primera" />);
    expect(screen.getByLabelText('Primera')).toBeTruthy();
  });
});
