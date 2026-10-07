import { render, screen } from '@testing-library/react-native';
import { FeaturedMatchCard } from '@/components/features/FeaturedMatchCard';
import { MetricCard } from '@/components/features/MetricCard';
import { MOVIES } from '@/mocks/data/catalog';
import { COLORS } from '@/theme/colors';

describe('Detalles de wireframe (parte Inicio)', () => {
  it('FeaturedMatchCard muestra "MEJOR MATCH ESTA NOCHE" y el badge "Recomendación Top"', async () => {
    await render(<FeaturedMatchCard item={{ media: MOVIES[1], bucket: 'alto' }} />);
    expect(screen.getByText('MEJOR MATCH ESTA NOCHE')).toBeTruthy();
    expect(screen.getByText('Recomendación Top', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Match alto')).toBeTruthy();
    expect(screen.getByText('Nota IA oculta')).toBeTruthy();
  });

  it('el badge de la tarjeta destacada usa el icono Flame', async () => {
    await render(<FeaturedMatchCard item={{ media: MOVIES[1], bucket: 'alto' }} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('lucide-flame');
    expect(tree).not.toContain('lucide-star');
  });

  it('MetricCard no pinta subrayado y respeta el color del valor', async () => {
    await render(<MetricCard title="Nota media" value="—" valueColor={COLORS.accent} />);
    expect(screen.queryByTestId('metric-underline')).toBeNull();
    const value = screen.getByText('—');
    const style = Array.isArray(value.props.style) ? Object.assign({}, ...value.props.style.flat()) : value.props.style;
    expect(style.color).toBe(COLORS.accent);
  });
});
