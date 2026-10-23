import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { priorityColor, theme } from '../lib/theme';
import type { Order } from '../lib/types';

type Props = {
  queue: Order[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

/** Fila de círculos 1,2,3,4… para saltar de prioridad. */
export default function PriorityCircles({ queue, selectedId, onSelect }: Props) {
  return (
    <View>
      <Text style={styles.label}>Círculos por prioridad</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {queue.map((o, i) => {
          const n = i + 1;
          const color = priorityColor(n);
          const sel = o.id === selectedId;
          return (
            <Pressable
              key={o.id}
              onPress={() => onSelect(o.id)}
              style={[styles.circle, { borderColor: color, backgroundColor: sel ? color : 'transparent' }]}
            >
              <Text style={[styles.num, sel && styles.numSel]}>{n}</Text>
              <Text style={[styles.code, sel && styles.numSel]} numberOfLines={1}>
                {o.code.replace('PED-', '')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: theme.muted, marginBottom: 8 },
  row: { gap: 10, paddingRight: 8 },
  circle: {
    width: 58, height: 58, borderRadius: 29, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  num: { color: theme.text, fontWeight: '800', fontSize: 17 },
  numSel: { color: '#fff' },
  code: { color: theme.muted, fontSize: 9, fontWeight: '700' },
});
