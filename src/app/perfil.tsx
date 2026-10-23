import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppMark from '../components/AppMark';
import { theme } from '../lib/theme';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';

export default function Perfil() {
  const { user, logout } = useAuth();
  const { jornada, queue, delivered, iniciarJornada, finalizarJornada, refreshing, refresh } = useOrders();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const initials = String(user?.name ?? '??').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const iniciada = !!jornada?.inicio_en;
  const enCurso = iniciada && !jornada?.fin_en;

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
  version: { color: theme.muted, fontSize: 11, textAlign: 'center' },
});
