import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';

type P = { color: ColorValue; size?: number };

function Base({ color, size = 24, children }: P & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

/** Geolocalización — Mi ruta */
export function RouteIcon({ color, size }: P) {
  return (
    <Base color={color} size={size}>
      <Path d="M12 21s-7-5.1-7-11a7 7 0 0 1 14 0c0 5.9-7 11-7 11z" />
      <Circle cx={12} cy={10} r={2.6} />
    </Base>
  );
}

/** Caja — Pedidos */
export function BoxIcon({ color, size }: P) {
  return (
    <Base color={color} size={size}>
      <Path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <Path d="M3 8l9 5 9-5" />
      <Path d="M12 13v8" />
    </Base>
  );
}

/** Billete — Mi caja */
export function CashIcon({ color, size }: P) {
  return (
    <Base color={color} size={size}>
      <Rect x={2} y={6} width={20} height={12} rx={2} />
      <Circle cx={12} cy={12} r={2.6} />
      <Path d="M6 12h.01M18 12h.01" />
    </Base>
  );
}

/** Usuario — Perfil */
export function UserIcon({ color, size }: P) {
  return (
    <Base color={color} size={size}>
      <Circle cx={12} cy={8} r={3.6} />
      <Path d="M5 20c1.4-3.4 3.9-5 7-5s5.6 1.6 7 5" />
    </Base>
  );
}
