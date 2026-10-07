import { fireEvent, render, screen } from '@testing-library/react-native';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  it('cambia de opcion', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        options={[
          { label: 'Peliculas', value: 'movie' },
          { label: 'Series', value: 'tv' },
        ]}
        selected="movie"
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText('Peliculas').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByLabelText('Series'));
    expect(onChange).toHaveBeenCalledWith('tv');
  });
});
