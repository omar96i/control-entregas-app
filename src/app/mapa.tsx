import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import CompleteOrderSheet from '../components/CompleteOrderSheet';
import PriorityCircles from '../components/PriorityCircles';
import { cop } from '../lib/geo';
import { fechaCorta, fechaLarga, hora } from '../lib/fecha';
import { isTrackingActive } from '../lib/tracking';
import { priorityColor, theme } from '../lib/theme';
import type { Order } from '../lib/types';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';

const fechaHoy = () => fechaLarga().toUpperCase();

export default function Mapa() {
  const { user } = useAuth();
  const {
    queue, delivered, selected, selectOrder,
    reorderQueue, promoteToPrincipal, completeOrder, voyOrder,
    jornada, iniciarJornada, refreshing, refresh,
  } = useOrders();
  const [jBusy, setJBusy] = useState(false);
  const [jWarn, setJWarn] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [voyBusy, setVoyBusy] = useState(false);
  const [voyErr, setVoyErr] = useState<string | null>(null);
  const [completing, setCompleting] = useState<Order | null>(null);

  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] });
  const beat = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const blink = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.15] });
  const insets = useSafeAreaInsets();
  const navigation_user = user?.name?.split(' ')[0] ?? 'repartidor';

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      isTrackingActive()
        .then((v) => { if (alive) setSharing(v); })
        .catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  const efectivo = delivered.filter((o) => o.metodo_pago_final === 'efectivo').reduce((a, o) => a + Number(o.total || 0), 0);
  const transferencia = delivered.filter((o) => o.metodo_pago_final === 'transferencia').reduce((a, o) => a + Number(o.total || 0), 0);
  const totalDia = queue.length + delivered.length;
  const pct = totalDia > 0 ? Math.round((delivered.length / totalDia) * 100) : 0;

  const focusOrder = queue.find((o) => o.en_ruta_en) ?? selected ?? queue[0] ?? null;
  const focusPos = focusOrder ? queue.findIndex((o) => o.id === focusOrder.id) + 1 : 0;
  const selIdx = focusOrder ? queue.findIndex((o) => o.id === focusOrder.id) : -1;

  const iniciada = !!jornada?.inicio_en;
  const enCurso = iniciada && !jornada?.fin_en;

  const navigateAddr = (addr?: string | null) => {
    if (!addr) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}&travelmode=driving`);
  };

  const doVoy = async (id: number) => {
    setVoyBusy(true);
    setVoyErr(null);
    try {
      const r = await voyOrder(id);
      if (!r.ok) setVoyErr(r.error ?? 'No se pudo registrar.');
    } finally {
      setVoyBusy(false);
    }
  };

  const totalCola = queue.reduce((a, o) => a + Number(o.total || 0), 0);
  const pagoHero = focusOrder ? (focusOrder.metodo_pago_final ?? focusOrder.metodo_pago_esperado ?? '') : '';

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{fechaHoy()}</Text>
          <Text style={styles.h1}>Pedido en curso</Text>
          <Text style={styles.muted}>Tu pedido activo y la cola del día.</Text>
        </View>
        <View style={styles.headRight}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryNum}>{queue.length}</Text>
            <Text style={styles.summaryLbl}>paradas</Text>
          </View>
        </View>
      </View>

      {enCurso ? (
        <View style={styles.jbar}>
          <View style={styles.dot} />
          <Text style={styles.jbarTxt}>
            Jornada en curso{ jornada.inicio_en ? ` desde ${hora(jornada.inicio_en)}` : ''} · {queue.length} en ruta{sharing ? ' · 📡 compartiendo ubicación' : ''}
          </Text>
        </View>
      ) : !iniciada ? (
        <View style={{ gap: 6 }}>
          <Pressable
            style={styles.jstart} disabled={jBusy}
            onPress={async () => {
              setJBusy(true);
              setJWarn(null);
              try {
                const r = await iniciarJornada();
                if (r && r.tracking !== 'ok') {
                  setJWarn('Jornada iniciada, pero no se pudo activar el envío de ubicación. Revisa los permisos de ubicación.');
                }
              } finally {
                setJBusy(false);
              }
            }}
          >
            <Text style={styles.jstartTxt}>{jBusy ? 'Iniciando…' : '▶ Iniciar jornada de hoy'}</Text>
          </Pressable>
          {jWarn && <Text style={styles.warn}>{jWarn}</Text>}
        </View>
      ) : null}

      {focusOrder ? (
        <View>
          <Animated.View pointerEvents="none" style={[styles.halo, { opacity: glow }]} />
          <View style={styles.hero}>
            <View style={styles.liveRow}>
              <Animated.View style={[styles.liveDot, { opacity: blink }]} />
              <Text style={styles.liveTxt}>{focusOrder.en_ruta_en ? 'EN CURSO · EN VIVO' : 'SIGUIENTE EN LA COLA'}</Text>
            </View>
            <View style={styles.heroTop}>
              <Animated.View style={[styles.heroPos, { backgroundColor: priorityColor(focusPos), transform: [{ scale: beat }] }]}>
                <Text style={styles.heroPosTxt}>{focusPos}</Text>
              </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroCode}>
                {focusOrder.code} · {focusOrder.en_ruta_en ? '🛵 En curso' : 'Siguiente'}
              </Text>
              <Text style={styles.heroName}>{focusOrder.customer?.nombre} {focusOrder.customer?.apellidos ?? ''}</Text>
            </View>
            <Text style={styles.heroTotal}>{cop(focusOrder.total)}</Text>
          </View>
          <Text style={styles.heroAddr}>📍 {focusOrder.address_snapshot}</Text>
          <Text style={styles.heroItems}>📦 {(focusOrder.items ?? []).map((it) => `${it.qty}× ${it.nombre}`).join(', ')}</Text>
          <Text style={styles.mutedSm}>
            {pagoHero ? `💳 ${pagoHero}` : '💳 por confirmar'}{focusOrder.ventana_entrega ? ` · 🕐 ${focusOrder.ventana_entrega}` : ''}
          </Text>
          {focusOrder.notas ? <Text style={styles.heroNotes}>📝 {focusOrder.notas}</Text> : null}
          {focusOrder.en_ruta_en ? (
            <Text style={styles.voyOk}>🛵 En camino desde {hora(focusOrder.en_ruta_en)} · la central ve tu ruta</Text>
          ) : (focusOrder.estado === 'asignado' || focusOrder.estado === 'en_ruta') ? (
            <Pressable style={styles.voy} onPress={() => doVoy(focusOrder.id)} disabled={voyBusy}>
              <Text style={styles.voyTxt}>{voyBusy ? 'Registrando…' : '🛵 Voy a este pedido'}</Text>
            </Pressable>
          ) : null}
          {voyErr && <Text style={styles.voyErr}>{voyErr}</Text>}
          <View style={styles.heroActions}>
            <Pressable style={styles.nav} onPress={() => navigateAddr(focusOrder.address_snapshot)}>
              <Text style={styles.navTxt}>🧭 Cómo llegar</Text>
            </Pressable>
            <Pressable style={styles.call} onPress={() => Linking.openURL(`tel:${focusOrder.customer?.telefono}`)}>
              <Text style={styles.callTxt}>📞</Text>
            </Pressable>
            <Pressable style={styles.done} onPress={() => setCompleting(focusOrder)}>
              <Text style={styles.doneTxt}>✓ Completar</Text>
            </Pressable>
          </View>
        </View>
        </View>
      ) : (
        <View style={styles.hero}>
          <Text style={styles.doneAll}>✅ ¡Sin pendientes! {enCurso ? 'Buen trabajo.' : 'Inicia jornada para recibir pedidos.'}</Text>
        </View>
      )}

      {queue.length > 1 && (
        <View>
          <View style={p.secRow}>
            <Text style={p.secTitle}>Cola del día · toca para enfocar</Text>
            {selIdx > 0 && (
              <Pressable style={p.promote} onPress={() => focusOrder && promoteToPrincipal(focusOrder.id)}>
                <Text style={p.promoteTxt}>↑ Subir a 1</Text>
              </Pressable>
            )}
          </View>
          <PriorityCircles queue={queue} selectedId={focusOrder?.id ?? null} onSelect={(id) => selectOrder(id)} />
          <DraggableFlatList
            data={queue}
            keyExtractor={(o) => String(o.id)}
            scrollEnabled={false}
            onDragEnd={({ data }) => reorderQueue(data.map((o) => o.id))}
            renderItem={({ item: o, getIndex, drag, isActive }) => {
              const gi = (getIndex() ?? 0) + 1;
              const color = priorityColor(gi);
              const isSel = focusOrder?.id === o.id;
              return (
                <ScaleDecorator>
                  <Pressable
                    onPress={() => selectOrder(o.id)}
                    style={[p.qCard, isSel && p.cardSel, isActive && p.cardDrag]}
                  >
                    <Pressable onLongPress={drag} hitSlop={12} style={p.gripBtn}>
                      <Text style={p.gripTxt}>⋮⋮</Text>
                    </Pressable>
                    <View style={[p.badge, { backgroundColor: color }]}>
                      <Text style={p.badgeTxt}>{gi}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={p.cName}>{o.customer?.nombre} <Text style={p.cCode}>{o.code}</Text></Text>
                      <Text style={p.cAddr} numberOfLines={1}>{o.address_snapshot}</Text>
                    </View>
                    <Text style={p.cTotal}>{cop(o.total)}</Text>
                  </Pressable>
                </ScaleDecorator>
              );
            }}
          />
        </View>
      )}

      <View style={styles.summary}>
        <View style={styles.sumHead}>
          <View>
            <Text style={styles.eyebrow}>Estado del día</Text>
            <Text style={styles.h2}>Tu jornada en números</Text>
          </View>
          <Text style={styles.dateBadge}>{fechaCorta().toUpperCase()}</Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>✓</Text>
            <Text style={styles.statNum}>{delivered.length}</Text>
            <Text style={styles.mutedSm}>Entregados</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>🕐</Text>
            <Text style={styles.statNum}>{queue.length}</Text>
            <Text style={styles.mutedSm}>Pendientes</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statNum}>${Math.round((efectivo + transferencia) / 1000)}k</Text>
            <Text style={styles.mutedSm}>Recaudado</Text>
          </View>
        </View>
        <View style={styles.prog}>
          <View style={styles.progRow}>
            <Text style={styles.mutedSm}>Progreso de entregas</Text>
            <Text style={styles.progTxt}>{delivered.length} de {totalDia} completadas</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
        </View>
        <View style={styles.note}>
          <Text>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.noteTitle}>Vas muy bien, {navigation_user}</Text>
            <Text style={styles.mutedSm}>
              {queue.length === 0 ? 'Ruta completada. Buen trabajo.' : `Te quedan ${queue.length} pedidos · cobro total ${cop(totalCola)}.`}
            </Text>
          </View>
          <Text style={styles.more}>›</Text>
        </View>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14, flexGrow: 1, backgroundColor: theme.bg },
  eyebrow: { color: theme.muted, fontSize: 10, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase' },
  h1: { color: theme.text, fontSize: 26, fontWeight: '800', marginTop: 4 },
  h2: { color: theme.text, fontSize: 19, fontWeight: '800', marginTop: 2 },
  muted: { color: theme.muted, fontSize: 12, marginTop: 6 },
  mutedSm: { color: theme.muted, fontSize: 10 },
  head: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  headRight: { alignItems: 'flex-end', gap: 8 },
  summaryBox: { width: 56, height: 56, borderRadius: 15, backgroundColor: '#e1f5f1', alignItems: 'center', justifyContent: 'center' },
  summaryNum: { color: theme.primary, fontSize: 19, fontWeight: '800' },
  summaryLbl: { color: theme.primary, fontSize: 9 },
  jbar: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#e1f6ee', borderWidth: 1, borderColor: '#bfe8d8', borderRadius: 12, padding: 11 },
  jbarTxt: { color: '#147a5b', fontSize: 12, fontWeight: '800', flexShrink: 1 },
  jstart: { backgroundColor: theme.navy, borderRadius: 12, padding: 14, alignItems: 'center' },
  jstartTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  warn: { color: '#9a651f', backgroundColor: '#fff0d8', fontSize: 11, fontWeight: '700', borderRadius: 10, padding: 10 },
  hero: { backgroundColor: '#fff', borderWidth: 2, borderColor: theme.primary, borderRadius: 20, padding: 16, gap: 8 },
  halo: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderWidth: 3, borderColor: theme.primary, borderRadius: 24 },
  liveRow: { flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: '#0f2439', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, alignSelf: 'flex-start' },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#4ade80' },
  liveTxt: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  heroTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  heroPos: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroPosTxt: { color: '#fff', fontWeight: '800', fontSize: 18 },
  heroCode: { color: theme.muted, fontSize: 11, fontWeight: '800' },
  heroName: { color: theme.text, fontSize: 18, fontWeight: '800' },
  heroTotal: { color: theme.text, fontSize: 18, fontWeight: '900' },
  heroAddr: { color: '#304f54', fontSize: 14 },
  heroItems: { color: theme.faint, fontSize: 12 },
  heroNotes: { color: theme.muted, fontSize: 12, fontStyle: 'italic' },
  voy: { backgroundColor: theme.navy, borderRadius: 12, padding: 14, alignItems: 'center' },
  voyTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  voyOk: { color: '#147a5b', backgroundColor: '#e1f6ee', fontSize: 11, fontWeight: '800', borderRadius: 8, padding: 8 },
  voyErr: { color: '#b4232a', fontSize: 11, fontWeight: '700' },
  heroActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  nav: { flex: 1, backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  navTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  call: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  callTxt: { fontSize: 16 },
  done: { flex: 1, backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  doneTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  doneAll: { color: theme.emerald, fontWeight: '700', textAlign: 'center', fontSize: 14 },
  summary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#deebea', borderRadius: 24, padding: 18, gap: 14 },
  sumHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dateBadge: { backgroundColor: '#edf6f5', color: '#6c8588', fontSize: 10, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#f5f9f8', borderRadius: 15, padding: 12, gap: 3, alignItems: 'flex-start' },
  statIcon: { fontSize: 16 },
  statNum: { color: theme.text, fontSize: 20, fontWeight: '800' },
  prog: { gap: 8 },
  progRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progTxt: { color: '#24444a', fontSize: 11, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, backgroundColor: '#e5efed' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: theme.primary },
  note: { flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: '#eef8f5', borderRadius: 14, padding: 12 },
  noteTitle: { color: '#2b5557', fontSize: 12, fontWeight: '800' },
  more: { color: theme.muted, fontSize: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#35c29c' },
});

const p = StyleSheet.create({
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: 4 },
  secTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: theme.muted },
  promote: { backgroundColor: '#fff0dc', borderWidth: 1, borderColor: '#e9c88f', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  promoteTxt: { color: '#9a651f', fontWeight: '700', fontSize: 11 },
  qCard: { flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center', marginBottom: 8 },
  cardSel: { borderWidth: 2, borderColor: theme.primary },
  cardDrag: { backgroundColor: '#d9efeb' },
  gripBtn: { paddingHorizontal: 2, paddingVertical: 8 },
  gripTxt: { fontSize: 14, color: '#86a3a3', fontWeight: '800' },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cName: { color: theme.text, fontSize: 13, fontWeight: '700' },
  cCode: { color: theme.muted, fontSize: 10 },
  cAddr: { color: theme.muted, fontSize: 11 },
  cTotal: { color: theme.text, fontSize: 13, fontWeight: '800' },
});
