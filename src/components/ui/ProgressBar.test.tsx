import { render, screen } from '@testing-library/react-native';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('expone valor accesible', async () => {
    await render(<ProgressBar value={5} max={20} />);
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 0,
      max: 20,
      now: 5,
    });
  });
  it('pinta segmentos', async () => {
    await render(<ProgressBar value={2} max={4} segments={4} />);
    expect(screen.getAllByTestId('progress-segment')).toHaveLength(4);
  });
});
