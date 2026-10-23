import { useMemo, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CompleteOrderSheet from '../components/CompleteOrderSheet';
import AppMark from '../components/AppMark';
import { cop } from '../lib/geo';
import { hoy, hora } from '../lib/fecha';
import { theme } from '../lib/theme';
import type { Order } from '../lib/types';
import { useOrders } from '../store/orders';

const PIN_BG = ['#d8f6f1', '#e1eafc', '#fff0d8', '#f3e8ff', '#ffe4e6'];
const PIN_TX = ['#267170', '#5b6cb3', '#9a651f', '#6d28d9', '#b4232a'];

const today = () => hoy();

export default function Pedidos() {
  const { orders, queue, refreshing, refresh, reorderQueue, completeOrder } = useOrders();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'asignados' | 'entrantes'>('asignados');
  const [estadoF, setEstadoF] = useState('todos');
  const [detail, setDetail] = useState<Order | null>(null);
  const [completing, setCompleting] = useState<Order | null>(null);

  const entrantes = useMemo(
    () => orders.filter((o) => (o.created_at ?? '').slice(0, 10) === today() && o.estado !== 'entregado'),
    [orders],
  );
  const base = filter === 'asignados' ? queue : entrantes;
  const data = estadoF === 'todos' ? base : orders.filter((o) => o.estado === estadoF);
  const canReorder = filter === 'asignados' && estadoF === 'todos';

  const move = (index: number, dir: -1 | 1) => {
    const ids = data.map((o) => o.id);
    const t = index + dir;
    if (t < 0 || t >= ids.length) return;
    [ids[index], ids[t]] = [ids[t], ids[index]];
    reorderQueue(ids);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.titleRow}>
        <AppMark size={30} />
        <View>
          <Text style={styles.eyebrow}>Gestión de entregas</Text>
          <Text style={styles.h1}>Mis pedidos</Text>
        </View>
        <View style={styles.dateBtn}>
          <Text style={styles.dateTxt}>📅 Hoy</Text>
        </View>
      </View>

      <View style={styles.seg}>
        <Pressable style={[styles.segBtn, filter === 'asignados' && styles.segOn]} onPress={() => setFilter('asignados')}>
          <Text style={[styles.segTxt, filter === 'asignados' && styles.segTxtOn]}>
            Asignados <Text style={styles.segCount}>{queue.length}</Text>
          </Text>
        </Pressable>
        <Pressable style={[styles.segBtn, filter === 'entrantes' && styles.segOn]} onPress={() => setFilter('entrantes')}>
          <Text style={[styles.segTxt, filter === 'entrantes' && styles.segTxtOn]}>
            Entrantes <Text style={styles.segCount}>{entrantes.length}</Text>
          </Text>
        </Pressable>
      </View>
      <View style={styles.tip}>
        <Text style={styles.tipTxt}>⇅ {filter === 'asignados' ? 'Define el orden de entrega con las flechas de cada pedido.' : 'Pedidos que entraron hoy.'}</Text>
      </View>
      <View style={styles.chips}>
        {([['todos', 'Todos'], ['en_ruta', 'En ruta'], ['entregado', 'Entregados'], ['cancelado', 'Cancelados'], ['reprogramado', 'Reprog.']] as const).map(([v, l]) => (
          <Pressable key={v} style={[styles.chip, estadoF === v && styles.chipOn]} onPress={() => setEstadoF(v)}>
            <Text style={[styles.chipTxt, estadoF === v && styles.chipTxtOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={(o) => String(o.id)}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 9, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>No hay pedidos aquí.</Text>}
        renderItem={({ item: o, index }) => {
          const pago = o.metodo_pago_final ?? o.metodo_pago_esperado ?? '';
          const isCash = pago === 'efectivo';
          const letter = String.fromCharCode(65 + (index % 26));
          return (
            <View style={styles.card}>
              {canReorder ? (
                <View style={styles.prio}>
                  <Pressable onPress={() => move(index, -1)} disabled={index === 0} hitSlop={8}>
                    <Text style={[styles.arrow, index === 0 && styles.off]}>▲</Text>
                  </Pressable>
                  <Text style={styles.prioNum}>{index + 1}</Text>
                  <Pressable onPress={() => move(index, 1)} disabled={index === data.length - 1} hitSlop={8}>
                    <Text style={[styles.arrow, index === data.length - 1 && styles.off]}>▼</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={[styles.pin, { backgroundColor: PIN_BG[index % PIN_BG.length] }]}>
                <Text style={[styles.pinTxt, { color: PIN_TX[index % PIN_TX.length] }]}>{filter === 'asignados' ? letter : 'N'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.top}>
                  <Text style={styles.name} numberOfLines={1}>{o.customer?.nombre} {o.customer?.apellidos ?? ''}</Text>
                  <Text style={styles.code}>{o.code}</Text>
                </View>
                <Text style={styles.addr} numberOfLines={1}>📍 {o.address_snapshot}</Text>
                <View style={styles.meta}>
                  <Text style={styles.time}>🕐 {o.ventana_entrega ?? o.estado}</Text>
                  <Text style={isCash ? styles.cash : styles.transfer}>{pago}</Text>
                  <Text style={styles.total}>{cop(o.total)}</Text>
                </View>
              </View>
              <Pressable style={styles.more} onPress={() => setDetail(o)} hitSlop={10}>
                <Text style={styles.moreTxt}>›</Text>
              </Pressable>
            </View>
          );
        }}
      />

      <OrderSheet
        order={detail ? (orders.find((x) => x.id === detail.id) ?? detail) : null}
        onClose={() => setDetail(null)}
        onComplete={(o) => { setDetail(null); setCompleting(o); }}
      />
      <CompleteOrderSheet
        visible={completing != null}
        order={completing}
        position={completing ? queue.findIndex((o) => o.id === completing.id) + 1 : 1}
        onClose={() => setCompleting(null)}
        onConfirm={async ({ firma, firmado_por, foto, metodo_pago_final }) => {
          if (!completing) return 'Sin pedido.';
          const r = await completeOrder(completing.id, { firma, firmado_por, foto, metodo_pago_final });
          return r.ok ? null : (r.error ?? 'No se pudo completar.');
        }}
      />
    </View>
  );
}

function OrderSheet({ order, onClose, onComplete }: { order: Order | null; onClose: () => void; onComplete: (o: Order) => void }) {
  const { requestReassign, voyOrder } = useOrders();
  const [motivo, setMotivo] = useState('');
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);
  const [reprog, setReprog] = useState(false);
  const [fechaRp, setFechaRp] = useState('');
  const [motivoRp, setMotivoRp] = useState('');
  const [sentRp, setSentRp] = useState(false);
  const [voyBusy, setVoyBusy] = useState(false);
  const [voyErr, setVoyErr] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  if (!order) return null;

  const located = order.lat != null;
  const initials = `${order.customer?.nombre?.[0] ?? ''}${order.customer?.apellidos?.[0] ?? ''}`.toUpperCase();
  const pago = order.metodo_pago_final ?? order.metodo_pago_esperado ?? '';
  const isCash = pago === 'efectivo';
  const delivered = order.estado === 'entregado';
  const enCamino = order.en_ruta_en != null;

  const doVoy = async () => {
    setVoyBusy(true);
    setVoyErr(null);
    try {
      const r = await voyOrder(order.id);
      if (!r.ok) setVoyErr(r.error ?? 'No se pudo registrar.');
    } finally {
      setVoyBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 22 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <View>
              <Text style={styles.eyebrow}>Detalle del pedido · {order.estado}</Text>
              <Text style={styles.sheetTitle}>{order.code}</Text>
            </View>
            <Pressable style={styles.close} onPress={onClose}>
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.customer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cName}>{order.customer?.nombre} {order.customer?.apellidos ?? ''}</Text>
              <Text style={styles.muted}>📱 {order.customer?.telefono}</Text>
            </View>
            <Pressable style={styles.call} onPress={() => Linking.openURL(`tel:${order.customer?.telefono}`)}>
              <Text style={styles.callTxt}>📱</Text>
            </Pressable>
          </View>

          <View style={styles.sec}>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>📍 Dirección de entrega</Text>
              {located ? <Text style={styles.ok}>Ubicada</Text> : <Text style={styles.warn}>Sin ubicación</Text>}
            </View>
            <Text style={styles.addrFull}>{order.address_snapshot}</Text>
            {located && (
              <Pressable
                style={styles.routeBtn}
                onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}&travelmode=driving`)}
              >
                <Text style={styles.routeTxt}>🧭 Abrir ruta en Maps o Waze ↗</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.sec}>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>📦 Productos</Text>
              <Text style={styles.count}>{order.items?.length ?? 0} producto{(order.items?.length ?? 0) === 1 ? '' : 's'}</Text>
            </View>
            {order.items?.map((it, i) => (
              <View key={i} style={styles.prodRow}>
                <View>
                  <Text style={styles.pName}>{it.nombre}</Text>
                  <Text style={styles.muted}>Cantidad: {it.qty}</Text>
                </View>
                <Text style={styles.pPrice}>{cop(it.precio * it.qty)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.muted}>Total del pedido</Text>
            <Text style={styles.grand}>{cop(order.total)}</Text>
          </View>
          <View style={[styles.payBox, isCash ? styles.cashBox : styles.transferBox]}>
            <Text style={styles.payIcon}>{isCash ? '💵' : '📲'}</Text>
            <View>
              <Text style={styles.payTitle}>Medio de pago: {pago || 'por confirmar'}</Text>
              <Text style={styles.muted}>{isCash ? 'Se sumará a tu cierre de caja' : 'Pago registrado en transferencia'}</Text>
            </View>
          </View>

          {!delivered && enCamino && (
            <Text style={styles.sentOk}>🛵 En camino desde {hora(order.en_ruta_en)}</Text>
          )}
          {!delivered && !enCamino && (order.estado === 'asignado' || order.estado === 'en_ruta') && (
            <Pressable style={styles.primary} onPress={doVoy} disabled={voyBusy}>
              <Text style={styles.primaryTxt}>{voyBusy ? 'Registrando…' : '🛵 Voy a este pedido'}</Text>
            </Pressable>
          )}
          {voyErr && <Text style={styles.locErr}>{voyErr}</Text>}
          {!delivered && (
            <Pressable style={styles.primary} onPress={() => onComplete(order)}>
              <Text style={styles.primaryTxt}>Marcar como entregado ✓</Text>
            </Pressable>
          )}
          {delivered && order.firmado_por && (
            <Text style={styles.signed}>✍️ Firmado por {order.firmado_por} · {order.metodo_pago_final}</Text>
          )}

          {order.motivo_estado ? (
            <Text style={styles.sentOk}>💬 Solicitud enviada: {order.motivo_estado}</Text>
          ) : null}

          {!asking && !sent && !delivered && (
            <Pressable style={styles.ghost} onPress={() => setAsking(true)}>
              <Text style={styles.ghostTxt}>⚠ No es mi zona · pedir reasignación</Text>
            </Pressable>
          )}
          {asking && !sent && (
            <View style={{ gap: 8 }}>
              <TextInput
                style={styles.input} placeholder="Motivo: no es mi zona…" placeholderTextColor={theme.muted}
                value={motivo} onChangeText={setMotivo}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={[styles.ghost, { flex: 1 }]} onPress={() => setAsking(false)}>
                  <Text style={styles.ghostTxt}>Atrás</Text>
                </Pressable>
                <Pressable
                  style={[styles.primary, { flex: 2 }]}
                  onPress={async () => {
                    if (!motivo.trim()) return;
                    const r = await requestReassign(order.id, motivo.trim());
                    if (r.ok) { setSent(true); setAsking(false); }
                  }}
                >
                  <Text style={styles.primaryTxt}>Enviar solicitud</Text>
                </Pressable>
              </View>
            </View>
          )}
          {sent && <Text style={styles.sentOk}>✓ Solicitud enviada al administrador.</Text>}

          {!reprog && !sentRp && !delivered && (
            <Pressable style={styles.ghost} onPress={() => setReprog(true)}>
              <Text style={styles.ghostTxt}>📅 Solicitar reprogramación</Text>
            </Pressable>
          )}
          {reprog && !sentRp && (
            <View style={{ gap: 8 }}>
              <TextInput
                style={styles.input} placeholder="Nueva fecha YYYY-MM-DD" placeholderTextColor={theme.muted}
                value={fechaRp} onChangeText={setFechaRp}
              />
              <TextInput
                style={styles.input} placeholder="Motivo: cliente no estaba…" placeholderTextColor={theme.muted}
                value={motivoRp} onChangeText={setMotivoRp}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={[styles.ghost, { flex: 1 }]} onPress={() => setReprog(false)}>
                  <Text style={styles.ghostTxt}>Atrás</Text>
                </Pressable>
                <Pressable
                  style={[styles.primary, { flex: 2 }]}
                  onPress={async () => {
                    if (!fechaRp.trim() || !motivoRp.trim()) return;
                    const r = await requestReassign(order.id, `Reprogramar ${fechaRp.trim()}: ${motivoRp.trim()}`);
                    if (r.ok) { setSentRp(true); setReprog(false); }
                  }}
                >
                  <Text style={styles.primaryTxt}>Enviar solicitud</Text>
                </Pressable>
              </View>
            </View>
          )}
          {sentRp && <Text style={styles.sentOk}>✓ Reprogramación solicitada.</Text>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20, backgroundColor: theme.bg },
  eyebrow: { color: theme.muted, fontSize: 10, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase' },
  h1: { color: theme.text, fontSize: 26, fontWeight: '800' },
  titleRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  dateBtn: { marginLeft: 'auto', borderWidth: 1, borderColor: theme.border, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  dateTxt: { color: '#477074', fontSize: 11, fontWeight: '700' },
  seg: { flexDirection: 'row', backgroundColor: '#eef5f4', borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, padding: 10, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  segTxt: { color: theme.muted, fontSize: 13 },
  segTxtOn: { color: '#176d6d', fontWeight: '800' },
  segCount: { backgroundColor: '#d8efeb', borderRadius: 8, fontSize: 10, fontWeight: '800', color: '#176d6d' },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  chip: { borderWidth: 1.5, borderColor: theme.border, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: theme.navy, borderColor: theme.navy },
  chipTxt: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  chipTxtOn: { color: '#fff' },
  tip: { backgroundColor: '#eaf8f5', borderColor: '#d8f0eb', borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 10, marginBottom: 10, flexDirection: 'row', gap: 8, alignItems: 'center' },
  tipTxt: { color: '#21807c', fontSize: 11 },
  empty: { color: theme.muted, textAlign: 'center', marginTop: 30 },
  card: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 15, padding: 11 },
  prio: { alignItems: 'center', width: 26 },
  arrow: { color: '#86a3a3', fontSize: 11, lineHeight: 16 },
  off: { opacity: 0.25 },
  prioNum: { fontSize: 10, fontWeight: '800', color: '#547275' },
  pin: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pinTxt: { fontWeight: '800', fontSize: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  name: { color: theme.text, fontSize: 13, fontWeight: '800', flex: 1 },
  code: { color: theme.muted, fontSize: 10 },
  addr: { color: theme.muted, fontSize: 11, marginTop: 3 },
  meta: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 5 },
  time: { color: theme.muted, fontSize: 11 },
  cash: { backgroundColor: '#fff0dc', color: '#b47743', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  transfer: { backgroundColor: '#e9edff', color: '#5b6cb3', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  total: { color: theme.text, fontSize: 13, fontWeight: '800', marginLeft: 'auto' },
  more: { paddingHorizontal: 6, paddingVertical: 10 },
  moreTxt: { fontSize: 26, color: theme.muted, fontWeight: '300' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,45,50,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fbfdfd', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 10, gap: 14, maxHeight: '92%' },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#d6e2e1', alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: theme.text },
  close: { backgroundColor: '#edf5f4', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: '#658083', fontWeight: '800' },
  customer: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#f2f8f7', borderRadius: 14, padding: 13 },
  avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#d4f1eb', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: theme.primary, fontWeight: '800' },
  cName: { color: theme.text, fontSize: 15, fontWeight: '800' },
  muted: { color: theme.muted, fontSize: 11 },
  call: { backgroundColor: '#fff', borderRadius: 10, padding: 10 },
  callTxt: { fontSize: 18 },
  sec: { borderBottomWidth: 1, borderBottomColor: '#edf2f1', paddingBottom: 14, gap: 8 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secTitle: { color: '#587174', fontSize: 12, fontWeight: '800' },
  ok: { color: '#25826f', backgroundColor: '#e1f6ee', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  warn: { color: '#b27648', backgroundColor: '#fff0df', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  count: { color: theme.muted, backgroundColor: '#eef4f3', fontSize: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  addrFull: { color: '#304f54', fontSize: 14 },
  locBtn: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#d3a16f', backgroundColor: '#fff9ef', borderRadius: 10, padding: 11, alignItems: 'center' },
  locTxt: { color: '#a36b3d', fontSize: 12, fontWeight: '800' },
  locErr: { color: '#b4232a', fontSize: 11, fontWeight: '700' },
  routeBtn: { borderWidth: 1, borderColor: '#cfe9e4', backgroundColor: '#effaf8', borderRadius: 10, padding: 11, alignItems: 'center' },
  routeTxt: { color: theme.primary, fontSize: 12, fontWeight: '800' },
  prodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e8efee', borderRadius: 12, padding: 11 },
  pName: { color: theme.text, fontSize: 13, fontWeight: '700' },
  pPrice: { color: '#1b5658', fontSize: 13, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grand: { color: theme.text, fontSize: 22, fontWeight: '900' },
  payBox: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 13, alignItems: 'center' },
  cashBox: { backgroundColor: '#fff6e9' },
  transferBox: { backgroundColor: '#eef1ff' },
  payIcon: { fontSize: 24 },
  payTitle: { color: theme.text, fontSize: 12, fontWeight: '800' },
  primary: { backgroundColor: theme.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ghost: { borderWidth: 1.5, borderColor: theme.border, backgroundColor: '#fff', borderRadius: 12, padding: 13, alignItems: 'center' },
  ghostTxt: { color: theme.navy, fontWeight: '700', fontSize: 13 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, padding: 13, color: theme.text, fontSize: 14 },
  signed: { color: theme.emerald, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  sentOk: { color: theme.emerald, fontWeight: '700', textAlign: 'center' },
});
