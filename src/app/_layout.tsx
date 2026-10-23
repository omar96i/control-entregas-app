import { Tabs } from 'expo-router';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AppMark from '../components/AppMark';
import { BoxIcon, CashIcon, RouteIcon, UserIcon } from '../components/TabBarIcon';
import { hoy } from '../lib/fecha';
import { theme } from '../lib/theme';
import { AuthProvider, useAuth } from '../store/auth';
import { OrdersProvider, useOrders } from '../store/orders';

const today = () => hoy();

function TabsWithInsets() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);
  const { orders } = useOrders();
  const entrantes = orders.filter((o) => (o.created_at ?? '').slice(0, 10) === today() && o.estado !== 'entregado').length;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarStyle: {
          backgroundColor: theme.tabBg,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 64 + bottom,
          paddingBottom: bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="mapa" options={{ title: 'En curso', tabBarLabel: 'En curso', tabBarIcon: ({ color }) => <RouteIcon color={color} /> }} />
      <Tabs.Screen name="pedidos" options={{ title: 'Mis pedidos', tabBarLabel: 'Pedidos', tabBarIcon: ({ color }) => <BoxIcon color={color} />, tabBarBadge: entrantes > 0 ? entrantes : undefined, tabBarBadgeStyle: { backgroundColor: '#f29b76' } }} />
      <Tabs.Screen name="caja" options={{ title: 'Mi caja', tabBarLabel: 'Mi caja', tabBarIcon: ({ color }) => <CashIcon color={color} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <UserIcon color={color} /> }} />
    </Tabs>
  );
}

function Gate() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('julian@controlentregas.co');
  const [password, setPassword] = useState('repartidor123');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <View style={styles.center}>
        <AppMark size={72} />
        <Text style={styles.sub}>Cargando…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <AppMark size={84} />
        <Text style={styles.h1}>CONTROL DE ENTREGAS</Text>
        <Text style={styles.sub}>Ingresa con tu cuenta de repartidor</Text>
        <Text style={styles.label}>Correo</Text>
        <TextInput
          style={styles.input}
          placeholder="julian@controlentregas.co"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.label}>Contraseña</Text>
        <View style={styles.passWrap}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="••••••••"
            placeholderTextColor={theme.muted}
            secureTextEntry={!showPass}
            value={password}
            onChangeText={setPassword}
          />
          <Pressable style={styles.eye} onPress={() => setShowPass((v) => !v)}>
            <Text style={styles.eyeTxt}>{showPass ? '🙈' : '👁️'}</Text>
          </Pressable>
        </View>
        {err && <Text style={styles.err}>{err}</Text>}
        <Pressable
          style={[styles.btn, busy && styles.btnBusy]}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setErr(null);
            const e = await login(email, password);
            setBusy(false);
            setErr(e);
          }}
        >
          <Text style={styles.btnTxt}>{busy ? 'Ingresando…' : 'Entrar →'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <OrdersProvider>
      <TabsWithInsets />
    </OrdersProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, backgroundColor: theme.bg, padding: 28, gap: 8, justifyContent: 'center', alignItems: 'center' },
  h1: { color: theme.navy, fontSize: 26, fontWeight: '900', letterSpacing: 3, marginTop: 14 },
  sub: { color: theme.muted, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  label: { color: theme.text, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'stretch', marginTop: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, color: theme.text, borderWidth: 1.5, borderColor: theme.border, fontSize: 15, alignSelf: 'stretch' },
  passWrap: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', alignItems: 'center' },
  eye: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  eyeTxt: { fontSize: 20 },
  btn: { backgroundColor: theme.navy, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10, alignSelf: 'stretch' },
  btnBusy: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  err: { color: '#fff', fontSize: 12, fontWeight: '700', backgroundColor: '#e11d48', padding: 10, borderRadius: 8, alignSelf: 'stretch', textAlign: 'center' },
});
