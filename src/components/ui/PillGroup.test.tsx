import { fireEvent, render, screen } from '@testing-library/react-native';
import { PillGroup } from './PillGroup';

const items = [
  { label: 'A', value: 'a' },
  { label: 'B', value: 'b' },
];

describe('PillGroup', () => {
  it('seleccion unica', async () => {
    const onChange = jest.fn();
    await render(<PillGroup items={items} selected={['a']} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('B'));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });
  it('seleccion multiple', async () => {
    const onChange = jest.fn();
    await render(<PillGroup multiple items={items} selected={['a']} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('B'));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    await fireEvent.press(screen.getByLabelText('A'));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
