import { render, screen } from '@testing-library/react-native';
import { ReasonLine } from './ReasonLine';

describe('ReasonLine', () => {
  it('pinta el texto de una razón', async () => {
    await render(<ReasonLine reason={{ kind: 'liked', text: 'Porque te gustó Past Lives' }} />);
    expect(screen.getByText('Porque te gustó Past Lives')).toBeTruthy();
  });

  it('acepta un texto suelto', async () => {
    await render(<ReasonLine reason="Porque te gusta el drama" />);
    expect(screen.getByText('Porque te gusta el drama')).toBeTruthy();
  });

  it('sin razón no pinta nada', async () => {
    await render(<ReasonLine />);
    expect(screen.queryByTestId('reason-line')).toBeNull();
  });

  it('con texto en blanco no pinta nada', async () => {
    await render(<ReasonLine reason="   " />);
    expect(screen.queryByTestId('reason-line')).toBeNull();
  });
});
