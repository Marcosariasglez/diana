import Svg, { Circle, Rect } from 'react-native-svg';

export interface BrandMarkProps {
  size?: number;
  background: string;
  foreground: string;
}

/** Glifo de Diana (carrete: 12 marcas + anillo + punto) sobre cuadrado redondeado.
 *  Mismo formato que el logotipo de Norte: cuadrado con radio ~30 % y glifo `onAcc`. */
export function BrandMark({ size = 72, background, foreground }: BrandMarkProps) {
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityElementsHidden>
      <Rect width={1024} height={1024} rx={300} fill={background} />
      {ticks.map((deg) => (
        <Rect
          key={deg}
          x={-26}
          y={-352}
          width={52}
          height={46}
          rx={12}
          fill={foreground}
          transform={`translate(512 512) rotate(${deg})`}
        />
      ))}
      <Circle cx={512} cy={512} r={236} fill="none" stroke={foreground} strokeWidth={30} />
      <Circle cx={512} cy={512} r={86} fill={foreground} />
    </Svg>
  );
}
