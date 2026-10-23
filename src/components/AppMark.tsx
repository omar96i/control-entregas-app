import Svg, { Circle, Rect } from 'react-native-svg';

/** Marca Control de Entregas: anillos concentricos sobre navy, como el icono de la plataforma. */
export default function AppMark({ size = 40, radius = 0.24 }: { size?: number; radius?: number }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} rx={size * radius} fill="#0f2439" />
      <Circle cx={c} cy={c} r={size * 0.392} fill="none" stroke="#33465e" strokeWidth={size * 0.028} />
      <Circle cx={c} cy={c} r={size * 0.293} fill="none" stroke="#8b94a5" strokeWidth={size * 0.066} />
      <Circle cx={c} cy={c} r={size * 0.172} fill="none" stroke="#ffffff" strokeWidth={size * 0.066} />
    </Svg>
  );
}
