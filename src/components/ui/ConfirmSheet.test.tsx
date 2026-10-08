import { fireEvent, render, screen } from '@testing-library/react-native';
import { ConfirmSheet } from './ConfirmSheet';

describe('ConfirmSheet', () => {
  it('renderiza titulo, mensaje y botones', async () => {
    await render(
      <ConfirmSheet
        visible
        title="Cerrar en todos los dispositivos"
        message="Se cerrará la sesión en todos los dispositivos."
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('Cerrar en todos los dispositivos')).toBeTruthy();
    expect(screen.getByText('Se cerrará la sesión en todos los dispositivos.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
  });

  it('cancelar llama a onCancel', async () => {
    const onCancel = jest.fn();
    await render(
      <ConfirmSheet visible title="T" message="M" onConfirm={jest.fn()} onCancel={onCancel} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('sin frase escrita: confirmar llama a onConfirm', async () => {
    const onConfirm = jest.fn();
    await render(<ConfirmSheet visible title="T" message="M" onConfirm={onConfirm} onCancel={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('con frase: solo confirma cuando la frase es exacta', async () => {
    const onConfirm = jest.fn();
    await render(
      <ConfirmSheet
        visible
        title="Borrar mi cuenta"
        message="Acción irreversible."
        requirePhrase="BORRAR MI CUENTA"
        phraseHint="Escribe BORRAR MI CUENTA para confirmar"
        confirmLabel="Borrar"
        destructive
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    const input = screen.getByTestId('confirm-phrase-input');
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar' }));
    expect(onConfirm).not.toHaveBeenCalled();

    await fireEvent.changeText(input, 'BORRAR MI');
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar' }));
    expect(onConfirm).not.toHaveBeenCalled();

    await fireEvent.changeText(input, 'BORRAR MI CUENTA');
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
