import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { fechaLarga, hora } from '../lib/fecha';
import { cop } from '../lib/geo';
import { theme } from '../lib/theme';
import type { Jornada } from '../lib/types';
import { useOrders } from '../store/orders';

export default function Caja() {
  const { delivered, queue, jornada, historial, refreshing, refresh, iniciarJornada, finalizarJornada } = useOrders();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [fq, setFq] = useState('');
  const [histId, setHistId] = useState<number | null>(null);

  const efectivo = useMemo(
    () => delivered.filter((o) => o.metodo_pago_final === 'efectivo'),
    [delivered],
  );
  const transferencia = useMemo(
    () => delivered.filter((o) => o.metodo_pago_final === 'transferencia'),
    [delivered],
  );
  const total = useMemo(
    () => delivered.reduce((a, o) => a + Number(o.total || 0), 0),
    [delivered],
  );
  const movs = useMemo(() => {
    const s = fq.toLowerCase();
    const all = [...delivered].reverse();
    if (!s) return all;
    return all.filter((o) => `${o.code} ${o.customer?.nombre ?? ''}`.toLowerCase().includes(s));
  }, [delivered, fq]);

  const totalDia = queue.length + delivered.length;
  const pct = totalDia > 0 ? Math.round((delivered.length / totalDia) * 100) : 0;
  const iniciada = !!jornada?.inicio_en;
  const enCurso = iniciada && !jornada?.fin_en;
  const fecha = fechaLarga();

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>Cierre diario</Text>
          <Text style={styles.h1}>Mi caja</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={refresh}>
          <Text style={styles.iconTxt}>⟳</Text>
        </Pressable>
      </View>

      <View style={styles.total}>
        <View style={styles.totalTop}>
          <Text style={styles.totalLabel}>Total recaudado</Text>
          <View style={styles.live}>
            <View style={styles.dot} />
            <Text style={styles.liveTxt}>{enCurso ? 'En curso' : jornada?.estado === 'cerrada' ? 'Cerrada' : !iniciada ? 'Sin iniciar' : jornada?.estado}</Text>
          </View>
        </View>
        <Text style={styles.totalVal}>{cop(total)}</Text>
        <Text style={styles.totalSub}>{delivered.length} entregas completadas · {fecha}</Text>
        <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
        <View style={styles.metaRow}>
          <Text style={styles.metaTxt}>Progreso <Text style={styles.metaBold}>{pct}%</Text></Text>
          <Text style={styles.metaTxt}>{delivered.length} de {totalDia}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.money}>
          <Text style={styles.moneyIcon}>💵</Text>
          <Text style={styles.muted}>Efectivo</Text>
          <Text style={styles.moneyVal}>{cop(efectivo.reduce((a, o) => a + Number(o.total || 0), 0))}</Text>
          <Text style={styles.muted}>{efectivo.length} pagos</Text>
        </View>
        <View style={styles.money}>
          <Text style={styles.moneyIcon}>📲</Text>
          <Text style={styles.muted}>Transferencias</Text>
          <Text style={styles.moneyVal}>{cop(transferencia.reduce((a, o) => a + Number(o.total || 0), 0))}</Text>
          <Text style={styles.muted}>{transferencia.length} pagos</Text>
        </View>
      </View>

      <View style={styles.secHead}>
        <View>
          <Text style={styles.h2}>Movimientos de hoy</Text>
          <Text style={styles.muted}>{fecha}</Text>
        </View>
      </View>
      <TextInput
        style={styles.search} placeholder="Filtrar movimientos…" placeholderTextColor={theme.muted}
        value={fq} onChangeText={setFq}
      />
      {movs.map((o) => (
        <View key={o.id} style={styles.mov}>
          <View style={[styles.movIcon, o.metodo_pago_final === 'efectivo' ? styles.cashBg : styles.trBg]}>
            <Text style={styles.movEmoji}>{o.metodo_pago_final === 'efectivo' ? '💵' : '📲'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.movTitle}>Pedido {o.code}</Text>
            <Text style={styles.muted}>{hora(o.entregado_en)} · {o.metodo_pago_final === 'efectivo' ? 'Efectivo' : 'Transferencia'}</Text>
          </View>
          <Text style={styles.movVal}>+{cop(o.total)}</Text>
        </View>
      ))}
      {movs.length === 0 && <Text style={styles.muted}>Sin movimientos.</Text>}

      {!iniciada ? (
        <Pressable style={styles.ghost} disabled={busy} onPress={async () => { setBusy(true); await iniciarJornada(); setBusy(false); }}>
          <Text style={styles.ghostTxt}>{busy ? '…' : '▶ Iniciar jornada'}</Text>
        </Pressable>
      ) : enCurso ? (
        <Pressable style={styles.close} disabled={busy} onPress={async () => { setBusy(true); await finalizarJornada(); setBusy(false); }}>
          <Text style={styles.closeTxt}>{busy ? '…' : '✓ Hacer cierre de caja'}</Text>
        </Pressable>
      ) : (
        <View style={styles.ghost}>
          <Text style={styles.ghostTxt}>✓ Jornada {jornada?.estado}</Text>
        </View>
      )}

      <Text style={styles.sec}>Historial de cierres</Text>
      <Text style={styles.muted}>Audita tus jornadas pasadas.</Text>
      {historial.map((h) => (
        <Pressable key={h.id} style={styles.mov} onPress={() => setHistId(h.id)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.movTitle}>{String(h.fecha).slice(0, 10)}</Text>
            <Text style={styles.muted}>
              {h.total_pedidos} pedidos · Ef {cop(h.total_efectivo)} · Tr {cop(h.total_transferencia)}
            </Text>
          </View>
          <Text style={[styles.pill, h.estado === 'validada' ? styles.pillOk : h.estado === 'cerrada' ? styles.pillWarn : styles.pillInfo]}>
            {h.estado}
          </Text>
          <Text style={styles.more}>›</Text>
        </Pressable>
      ))}
      {historial.length === 0 && <Text style={styles.muted}>Sin historial todavía.</Text>}

      <HistModal id={histId} onClose={() => setHistId(null)} />
    </ScrollView>
  );
}

function HistModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (id == null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setErr(null);
    api.jornadaDetalle(id).then(setData).catch((e: any) => setErr(e.message ?? 'No se pudo cargar'));
  }, [id ]);

  if (id == null) return null;
  const j: Jornada | undefined = data?.jornada;
  const resumen = data?.resumen;
  const envios: any[] = data?.envios ?? [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <View>
              <Text style={styles.eyebrow}>Cierre de caja</Text>
              <Text style={styles.sheetTitle}>{j ? String(j.fecha).slice(0, 10) : '…'}</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>
          {err && <Text style={styles.err}>{err}</Text>}
          {!j && !err && <Text style={styles.muted}>Cargando…</Text>}
          {j && (
            <>
              <View style={styles.sumBox}>
                <View style={styles.sumRow}>
                  <Text style={styles.muted}>Estado</Text>
                  <Text style={[styles.pill, j.estado === 'validada' ? styles.pillOk : j.estado === 'cerrada' ? styles.pillWarn : styles.pillInfo]}>{j.estado}</Text>
                </View>
                <View style={styles.sumRow}>
                  <Text style={styles.muted}>Jornada</Text>
                  <Text style={styles.sumVal}>{j.inicio_en ? String(j.inicio_en).slice(11, 16) : '—'} → {j.fin_en ? String(j.fin_en).slice(11, 16) : '—'}</Text>
                </View>
                <View style={styles.sumRow}>
                  <Text style={styles.muted}>Entregados</Text>
                  <Text style={styles.sumVal}>{resumen?.entregados ?? j.total_pedidos} · pendientes {resumen?.pendientes ?? 0}</Text>
                </View>
                <View style={styles.sumRow}>
                  <Text style={styles.muted}>Efectivo</Text>
                  <Text style={styles.sumVal}>{cop(resumen?.efectivo ?? j.total_efectivo)}</Text>
                </View>
                <View style={styles.sumRow}>
                  <Text style={styles.muted}>Transferencias</Text>
                  <Text style={styles.sumVal}>{cop(resumen?.transferencia ?? j.total_transferencia)}</Text>
                </View>
                <View style={styles.sumRow}>
                  <Text style={styles.muted}>Total caja</Text>
                  <Text style={styles.grand}>{cop(resumen?.total ?? (Number(j.total_efectivo) + Number(j.total_transferencia)))}</Text>
                </View>
              </View>
              <Text style={styles.sec}>Envíos ({envios.length})</Text>
              {envios.map((o: any) => (
                <View key={o.id} style={styles.mov}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.movTitle}>{o.code}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{o.customer?.nombre} · {o.address_snapshot}</Text>
                  </View>
                  <Text style={styles.movVal}>{cop(o.total)}</Text>
                  <Text style={[styles.pill, styles.pillOk]}>{o.metodo_pago_final}</Text>
                </View>
              ))}
              {envios.length === 0 && <Text style={styles.muted}>Sin entregas registradas.</Text>}
            </>
          )}
          <Pressable style={styles.ghost} onPress={onClose}>
            <Text style={styles.ghostTxt}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14, flexGrow: 1 },
  eyebrow: { color: theme.muted, fontSize: 10, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase' },
  h1: { color: theme.text, fontSize: 26, fontWeight: '800' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconBtn: { padding: 8, borderRadius: 10 },
  iconTxt: { color: '#617277', fontSize: 20, fontWeight: '800' },
  total: { backgroundColor: '#0b7e7f', borderRadius: 20, padding: 19 },
  totalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  live: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#35c29c' },
  liveTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  totalVal: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 8 },
  totalSub: { color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 4 },
  track: { backgroundColor: 'rgba(255,255,255,0.23)', height: 6, borderRadius: 4, marginTop: 14, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#b8f0e5', borderRadius: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  metaTxt: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  metaBold: { color: '#fff', fontWeight: '800' },
  grid: { flexDirection: 'row', gap: 10 },
  money: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, gap: 3 },
  moneyIcon: { fontSize: 24 },
  muted: { color: theme.muted, fontSize: 11 },
  moneyVal: { color: theme.text, fontSize: 17, fontWeight: '800' },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 2 },
  h2: { color: theme.text, fontSize: 17, fontWeight: '800' },
  sec: { color: theme.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
  search: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, color: theme.text, fontSize: 14 },
  mov: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 12 },
  movIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cashBg: { backgroundColor: '#fff0dd' },
  trBg: { backgroundColor: '#e9edff' },
  movEmoji: { fontSize: 17 },
  movTitle: { color: theme.text, fontSize: 14, fontWeight: '800' },
  movVal: { color: theme.text, fontSize: 14, fontWeight: '800' },
  ghost: { borderWidth: 1.5, borderColor: theme.border, backgroundColor: '#fff', borderRadius: 12, padding: 15, alignItems: 'center' },
  ghostTxt: { color: theme.navy, fontWeight: '800' },
  close: { backgroundColor: theme.navy, borderRadius: 12, padding: 15, alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
  closeTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  more: { color: theme.muted, fontSize: 22 },
  pill: { fontSize: 11, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', textTransform: 'capitalize' },
  pillOk: { color: '#147a5b', backgroundColor: '#dcf5e9' },
  pillWarn: { color: '#9a651f', backgroundColor: '#fff0d5' },
  pillInfo: { color: '#0f2439', backgroundColor: '#e4e9f5' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,45,50,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fbfdfd', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 10, gap: 14, maxHeight: '92%' },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#d6e2e1', alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: theme.text },
  closeBtn: { backgroundColor: '#edf5f4', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  err: { color: '#b4232a', fontSize: 12, fontWeight: '700', backgroundColor: '#fdecec', padding: 10, borderRadius: 8 },
  sumBox: { backgroundColor: '#f2f8f7', borderRadius: 14, padding: 14, gap: 8 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumVal: { color: theme.text, fontSize: 14, fontWeight: '800' },
  grand: { color: theme.navy, fontSize: 20, fontWeight: '900' },
});
