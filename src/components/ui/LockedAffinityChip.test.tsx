import { render, screen } from '@testing-library/react-native';
import { LockedAffinityChip } from './LockedAffinityChip';

describe('LockedAffinityChip', () => {
  it('bloqueado muestra candado', async () => {
    await render(<LockedAffinityChip bucket="alto" />);
    expect(screen.getByTestId('affinity-lock', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Match alto, bloqueada')).toBeTruthy();
  });
  it('desbloqueado sin candado', async () => {
    await render(<LockedAffinityChip bucket="medio" locked={false} />);
    expect(screen.queryByTestId('affinity-lock', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByLabelText('Match medio')).toBeTruthy();
  });
});
