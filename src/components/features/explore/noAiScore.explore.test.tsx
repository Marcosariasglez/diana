// Regla de privacidad de nota: Explorar con resultados no muestra notas de IA.
import { render, screen } from '@testing-library/react-native';
import { FIXTURE_MOVIES } from '@/test/fixtures/catalog';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/features/explore/useUnifiedSearch', () => ({
  useUnifiedSearch: jest.fn(() => ({
    items: require('@/test/fixtures/catalog').FIXTURE_MOVIES.slice(0, 6),
    status: 'ready' as const,
    hasMore: false,
    loadingMore: false,
    pageError: false,
    loadMore: jest.fn(),
    reload: jest.fn(),
    total: 6,
  })),
}));

import Explore from '../../../../app/(tabs)/explore';

function userFacingText(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => userFacingText(n, out));
  else if (node && typeof node === 'object') {
    const n = node as { props?: Record<string, unknown>; children?: unknown };
    const label = n.props?.accessibilityLabel;
    if (typeof label === 'string') out.push(label);
    userFacingText(n.children, out);
  }
  return out;
}

describe('Explorar · noAiScore', () => {
  it('no hay notas estimadas ni porcentajes en lo que lee el usuario', async () => {
    await render(<Explore />);
    expect(FIXTURE_MOVIES.length).toBeGreaterThan(0);
    const text = userFacingText(screen.toJSON()).join(' | ');
    expect(text).not.toMatch(/\b[1-5],\d\b/);
    expect(text).not.toMatch(/\d+ ?%/);
    expect(text.toLowerCase()).not.toContain('nota estimada');
  });
});
