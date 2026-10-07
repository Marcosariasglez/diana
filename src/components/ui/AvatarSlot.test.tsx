import { render, screen } from '@testing-library/react-native';
import { AvatarSlot } from './AvatarSlot';

describe('AvatarSlot', () => {
  it('ocupado muestra inicial', async () => {
    await render(<AvatarSlot occupied initial="m" name="Marta" />);
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.getByLabelText('Participante Marta')).toBeTruthy();
  });
  it('libre', async () => {
    await render(<AvatarSlot tone="dark" />);
    expect(screen.getByLabelText('Lugar libre')).toBeTruthy();
  });
});
