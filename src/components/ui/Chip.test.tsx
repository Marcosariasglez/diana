import { render, screen } from '@testing-library/react-native';
import { Film } from 'lucide-react-native';
import { Chip } from './Chip';

describe('Chip', () => {
  it.each(['default', 'accent', 'white', 'outline'] as const)('variante %s', async (variant) => {
    await render(<Chip label="Drama" variant={variant} icon={Film} />);
    expect(screen.getByText('Drama')).toBeTruthy();
  });
});
