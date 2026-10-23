import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { cop } from '../lib/geo';
import { priorityColor, theme } from '../lib/theme';
import type { Order } from '../lib/types';

type Props = {
  order: Order;
  position: number;
  eta?: number | null;
  selected?: boolean;
  onPress?: () => void;
  onComplete?: () => void;
  onNavigate?: () => void;
};

/** Tarjeta de detalle reutilizable: igual para el principal (1) y para el seleccionado. */
export default function OrderDetailCard({ order, position, eta, selected, onPress, onComplete, onNavigate }: Props) {
  const color = priorityColor(position);
  return (
    <Pressable onPress={onPress} style={[styles.card, { borderColor: `${color}59` }, selected && styles.sel]}>
      <View style={styles.top}>
        <View style={[styles.circle, { backgroundColor: color }]}>
          <Text style={styles.circleTxt}>{position}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {order.customer?.nombre} {order.customer?.apellidos ?? ''} <Text style={styles.code}>{order.code}</Text>
          </Text>
          <Text style={styles.addr}>📍 {order.address_snapshot}</Text>
        </View>
        {eta != null && position === 1 && (
          <View style={styles.eta}>
            <Text style={styles.etaTxt}>~{eta} min</Text>
          </View>
        )}
      </View>

      <Text style={styles.items}>📦 {order.items.map((i) => `${i.qty}× ${i.nombre}`).join(', ')}</Text>
      <Text style={styles.meta}>
        📞 {order.customer?.telefono} · {cop(order.total)}
        {order.ventana_entrega ? ` · 🕐 ${order.ventana_entrega}` : ''}
      </Text>
      {order.notas ? <Text style={styles.notes}>📝 {order.notas}</Text> : null}

      <View style={styles.actions}>
        <Pressable style={styles.nav} onPress={onNavigate}>
          <Text style={styles.navTxt}>🧭 Cómo llegar</Text>
        </Pressable>
        <Pressable style={styles.call} onPress={() => Linking.openURL(`tel:${order.customer?.telefono}`)}>
          <Text style={styles.callTxt}>📞</Text>
        </Pressable>
        <Pressable style={styles.done} onPress={onComplete}>
          <Text style={styles.doneTxt}>✓ Completar</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.surface, borderRadius: 14, padding: 12, borderWidth: 1 },
  sel: { borderWidth: 2, borderColor: theme.primary },
  top: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  circleTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  name: { color: theme.text, fontSize: 15, fontWeight: '800' },
  code: { color: theme.muted, fontSize: 11, fontWeight: '400' },
  addr: { color: theme.faint, fontSize: 12, marginTop: 2 },
  items: { color: theme.faint, fontSize: 12, marginTop: 8 },
  meta: { color: theme.muted, fontSize: 12, marginTop: 2 },
  notes: { color: theme.muted, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  eta: { backgroundColor: 'rgba(244,63,94,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  etaTxt: { color: theme.rose, fontWeight: '800', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  nav: { flex: 1, backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  navTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  call: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  callTxt: { fontSize: 16 },
  done: { flex: 1, backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  doneTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
