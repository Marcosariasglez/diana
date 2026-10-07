import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BottomSheet } from './BottomSheet';

describe('BottomSheet', () => {
  it('visible renderiza hijos y cierra desde el overlay', async () => {
    const onClose = jest.fn();
    await render(
      <BottomSheet visible onClose={onClose}>
        <Text>Diario</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('Diario')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cerrar panel'));
    expect(onClose).toHaveBeenCalled();
  });
  it('no visible no renderiza', async () => {
    await render(
      <BottomSheet visible={false} onClose={jest.fn()}>
        <Text>Oculto</Text>
      </BottomSheet>,
    );
    expect(screen.queryByText('Oculto')).toBeNull();
  });
});
