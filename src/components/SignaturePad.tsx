import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { theme } from '../lib/theme';

export type Stroke = { x: number; y: number }[];

export function strokesToData(strokes: Stroke[]): string {
  return JSON.stringify(strokes);
}

export function hasInk(strokes: Stroke[]): boolean {
  return strokes.reduce((a, s) => a + s.length, 0) >= 8;
}

export function emptyStrokes(): Stroke[] {
  return [];
}

type Props = {
  onChange?: (strokes: Stroke[]) => void;
  style?: StyleProp<ViewStyle>;
};

/** Lienzo de firma simple: dibuja con el dedo, sin dependencias nativas extra. */
export default function SignaturePad({ onChange, style }: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  const emit = (next: Stroke[]) => {
    setStrokes(next);
    onChange?.(next);
  };

  const pt = (e: GestureResponderEvent) => ({
    x: e.nativeEvent.locationX ?? 0,
    y: e.nativeEvent.locationY ?? 0,
  });

  return (
    <View
      style={[styles.box, style]}
      onTouchStart={(e) => emit([...strokes, [pt(e)]])}
      onTouchMove={(e) => {
        if (strokes.length === 0) {
          emit([[pt(e)]]);
          return;
        }
        const next = strokes.map((s, i) => (i === strokes.length - 1 ? [...s, pt(e)] : s));
        emit(next);
      }}
    >
      <Svg style={StyleSheet.absoluteFill}>
        {strokes.map((s, i) =>
          s.length > 1 ? (
            <Polyline
              key={i}
              points={s.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#0f2439"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null,
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 150,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: theme.border,
    overflow: 'hidden',
  },
});
