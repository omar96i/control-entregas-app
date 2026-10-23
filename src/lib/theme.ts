export const theme = {
  bg: '#fbfdfd',
  surface: '#ffffff',
  surfaceSoft: '#eef5f5',
  card: '#ffffff',
  border: '#e6eeee',
  text: '#163d44',
  muted: '#7c9093',
  faint: '#476064',
  primary: '#087f80',
  primaryDark: '#0b6e6f',
  navy: '#0f2439',
  rose: '#e11d48',
  amber: '#d97706',
  emerald: '#168a74',
  blue: '#1d4ed8',
  tabBg: 'rgba(255,255,255,0.96)',
} as const;

export const priorityColor = (i: number): string => {
  if (i === 1) return theme.primary;
  if (i === 2) return theme.amber;
  return theme.blue;
};
