import { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppMark from '../components/AppMark';
import { getTrackingLog, getTrackingStatus, type TrackEvent } from '../lib/tracking';
import { theme } from '../lib/theme';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';

const hora = (iso: string | null) => (iso ? iso.slice(11, 19) : '—');

const KIND_TXT: Record<TrackEvent['kind'], string> = {
  'send-ok': 'Enviado',
  'send-error': 'Error',
  start: 'Inicio',
  stop: 'Fin',
  perm: 'Permiso',
  voy: 'Voy',
};

export default function Perfil() {
  const { user, logout } = useAuth();
  const { jornada, queue, delivered, iniciarJornada, finalizarJornada, refreshing, refresh } = useOrders();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const initials = String(user?.name ?? '??').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const iniciada = !!jornada?.inicio_en;
  const enCurso = iniciada && !jornada?.fin_en;
  const [track, setTrack] = useState(() => getTrackingStatus());
  const [tlog, setTlog] = useState<TrackEvent[]>(() => getTrackingLog());
  const [logOpen, setLogOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const snap = () => {
        setTrack(getTrackingStatus());
        setTlog(getTrackingLog());
      };
      snap();
      const t = setInterval(snap, 5000);
      return () => clearInterval(t);
    }, []),
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
    >
      <View style={styles.head}>
        <AppMark size={34} />
        <Text style={styles.h1}>Perfil</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.muted}>{user?.email}</Text>
        <View style={styles.tags}>
          <Text style={styles.tag}>{user?.role === 'admin' ? 'Admin' : 'Repartidor activo'}</Text>
          {user?.zona?.nombre ? <Text style={styles.tag}>Zona {user.zona.nombre}</Text> : null}
          {user?.telefono ? <Text style={styles.tag}>📞 {user.telefono}</Text> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sec}>Jornada de hoy</Text>
        <Text style={styles.muted}>
          {jornada ? `Estado: ${jornada.estado}${jornada.inicio_en ? ` · inicio ${String(jornada.inicio_en).slice(11, 16)}` : ''}` : 'Sin jornada registrada'}
        </Text>
        <Text style={styles.muted}>{queue.length} en cola · {delivered.length} entregados</Text>
        {!iniciada ? (
          <Pressable style={styles.primary} disabled={busy} onPress={async () => { setBusy(true); await iniciarJornada(); setBusy(false); }}>
            <Text style={styles.primaryTxt}>{busy ? '…' : '▶ Iniciar jornada'}</Text>
          </Pressable>
        ) : enCurso ? (
          <Pressable style={[styles.primary, styles.close]} disabled={busy} onPress={async () => { setBusy(true); await finalizarJornada(); setBusy(false); }}>
            <Text style={styles.primaryTxt}>{busy ? '…' : '■ Finalizar jornada'}</Text>
          </Pressable>
        ) : (
          <Text style={styles.muted}>✓ Jornada {jornada?.estado}.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sec}>📡 Ubicación compartida</Text>
        <View style={styles.trow}>
          <View style={[styles.dot, { backgroundColor: track.running ? '#35c29c' : '#c3d4d2' }]} />
          <Text style={styles.tstate}>{track.running ? 'Activa · cada 30 s' : 'Detenida'}</Text>
          <Text style={styles.tctx}>{track.orderId ? `Pedido ${track.orderId}` : 'Tiempo libre'}</Text>
        </View>
        <Text style={styles.muted}>
          Último envío: {hora(track.lastSendAt)} · Enviados: {track.sentTotal} · En cola: {track.queued}
        </Text>
        {track.lastError ? <Text style={styles.err}>⚠ {track.lastError}</Text> : null}
        <Pressable style={styles.ghostSm} onPress={() => setLogOpen(true)}>
          <Text style={styles.ghostTxt}>Ver registro de envíos</Text>
        </Pressable>
      </View>

      <Modal visible={logOpen} transparent animationType="slide" onRequestClose={() => setLogOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLogOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 22 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHead}>
              <Text style={styles.sec}>Registro de envíos</Text>
              <Pressable style={styles.xclose} onPress={() => setLogOpen(false)}>
                <Text style={styles.xcloseTxt}>✕</Text>
              </Pressable>
            </View>
            <FlatList
              data={tlog}
              keyExtractor={(_, i) => `${i}`}
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ gap: 6 }}
              ListEmptyComponent={<Text style={styles.muted}>Sin eventos aún. Inicia jornada para empezar.</Text>}
              renderItem={({ item }) => (
                <View style={styles.logRow}>
                  <Text style={styles.logTime}>{hora(item.at)}</Text>
                  <Text style={[styles.logKind, item.kind === 'send-error' ? styles.logBad : null]}>{KIND_TXT[item.kind]}</Text>
                  <Text style={styles.logDetail} numberOfLines={2}>{item.detail}</Text>
                </View>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Pressable style={styles.ghost} onPress={logout}>
        <Text style={styles.ghostTxt}>Cerrar sesión</Text>
      </Pressable>
      <Text style={styles.version}>Control de Entregas v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14, flexGrow: 1 },
  head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  h1: { color: theme.text, fontSize: 26, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 18, gap: 6, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.navy, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 20 },
  name: { color: theme.text, fontSize: 18, fontWeight: '800' },
  muted: { color: theme.muted, fontSize: 12, textAlign: 'center' },
  tags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 },
  tag: { backgroundColor: theme.surfaceSoft, color: theme.faint, fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  sec: { color: theme.text, fontSize: 15, fontWeight: '800' },
  primary: { backgroundColor: theme.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, alignSelf: 'stretch' },
  close: { backgroundColor: theme.emerald },
  primaryTxt: { color: '#fff', fontWeight: '800' },
  ghost: { borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#fff' },
  ghostTxt: { color: theme.navy, fontWeight: '800' },
  ghostSm: { borderWidth: 1.5, borderColor: theme.border, borderRadius: 10, padding: 10, alignItems: 'center', backgroundColor: '#fff', alignSelf: 'stretch', marginTop: 6 },
  version: { color: theme.muted, fontSize: 11, textAlign: 'center' },
  trow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  tstate: { color: theme.text, fontSize: 13, fontWeight: '800' },
  tctx: { color: theme.primary, fontSize: 11, fontWeight: '800', marginLeft: 'auto' },
  err: { color: '#b4232a', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,45,50,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fbfdfd', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 14, gap: 12, maxHeight: '80%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xclose: { backgroundColor: '#edf5f4', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  xcloseTxt: { color: '#658083', fontWeight: '800' },
  logRow: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#f2f8f7', borderRadius: 10, padding: 9 },
  logTime: { color: theme.muted, fontSize: 11, fontWeight: '700' },
  logKind: { color: theme.primary, fontSize: 10, fontWeight: '800', minWidth: 52 },
  logBad: { color: '#b4232a' },
  logDetail: { color: theme.text, fontSize: 11, flex: 1 },
});
