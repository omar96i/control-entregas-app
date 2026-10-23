import * as Location from 'expo-location';
import { useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import CompleteOrderSheet from '../components/CompleteOrderSheet';
import OrderDetailCard from '../components/OrderDetailCard';
import AppMark from '../components/AppMark';
import PriorityCircles from '../components/PriorityCircles';
import { PEREIRA_CENTER } from '../data/mock';
import { fetchRoute, type RouteInfo } from '../lib/directions';
import { cop, haversineKm } from '../lib/geo';
import { fechaCorta, fechaLarga, hora } from '../lib/fecha';
import { isTrackingActive } from '../lib/tracking';
import { priorityColor, theme } from '../lib/theme';
import type { Order } from '../lib/types';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';

type LatLng = { latitude: number; longitude: number };

const fechaHoy = () => fechaLarga().toUpperCase();

export default function Mapa() {
  const { user } = useAuth();
  const {
    queue, delivered, selectedId, selected, selectOrder,
    reorderQueue, promoteToPrincipal, completeOrder,
    jornada, iniciarJornada, refreshing, refresh,
  } = useOrders();
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [jBusy, setJBusy] = useState(false);
  const [jWarn, setJWarn] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeKey, setRouteKey] = useState('');
  const [tracing, setTracing] = useState(false);
  const [driver, setDriver] = useState<LatLng | null>(null);
  const [completing, setCompleting] = useState<Order | null>(null);
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const nombre = user?.name?.split(' ')[0] ?? 'repartidor';

  useEffect(() => {
    let alive = true;
    isTrackingActive()
      .then((v) => { if (alive) setSharing(v); })
      .catch(() => {});
    return () => { alive = false; };
  }, [jornada, refreshing]);

  // Fullscreen: oculta la navegacion de abajo mientras se organiza la ruta.
  const bottom = Math.max(insets.bottom, 8);
  useEffect(() => {
    const shown = {
      backgroundColor: theme.tabBg,
      borderTopColor: theme.border,
      borderTopWidth: 1,
      height: 64 + bottom,
      paddingBottom: bottom,
      paddingTop: 8,
    };
    navigation.setOptions({ tabBarStyle: plannerOpen ? { display: 'none' } : shown });
    return () => {
      navigation.setOptions({ tabBarStyle: shown });
    };
  }, [plannerOpen, navigation, bottom]);

  const geoPoints = useMemo(
    () => queue.filter((o) => o.lat != null).map((o) => ({ lat: o.lat!, lng: o.lng! })),
    [queue],
  );
  const straight: LatLng[] = useMemo(
    () => geoPoints.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [geoPoints],
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      setDriver({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    })();
  }, []);

  const routeSig = useMemo(() => {
    const d = driver ? `${driver.latitude.toFixed(5)},${driver.longitude.toFixed(5)}|` : '';
    return d + queue.map((o) => o.id).join(',');
  }, [queue, driver]);

  const routeSigRef = useRef(routeSig);
  useEffect(() => {
    routeSigRef.current = routeSig;
  }, [routeSig]);

  useEffect(() => {
    let alive = true;
    const key = routeSig;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTracing(true);
    const pts = driver ? [{ lat: driver.latitude, lng: driver.longitude }, ...geoPoints] : geoPoints;
    fetchRoute(pts).then((info) => {
      if (alive && key === routeSigRef.current) {
        setRouteInfo(info);
        setRouteKey(key);
        setTracing(false);
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSig]);

  const inSync = routeInfo != null && routeKey === routeSig;
  const basePath = inSync ? routeInfo.path : straight;
  const kmFallback = geoPoints.reduce((a, _, i, arr) => (i === 0 ? 0 : a + haversineKm(arr[i - 1].lat, arr[i - 1].lng, arr[i].lat, arr[i].lng)), 0);
  const km = inSync ? routeInfo.km : kmFallback;
  const mins = inSync ? routeInfo.mins : Math.round(kmFallback * 4 + queue.length * 5);

  const efectivo = delivered.filter((o) => o.metodo_pago_final === 'efectivo').reduce((a, o) => a + Number(o.total || 0), 0);
  const transferencia = delivered.filter((o) => o.metodo_pago_final === 'transferencia').reduce((a, o) => a + Number(o.total || 0), 0);
  const totalDia = queue.length + delivered.length;
  const pct = totalDia > 0 ? Math.round((delivered.length / totalDia) * 100) : 0;

  const selIdx = queue.findIndex((o) => o.id === selectedId);
  const focusOrder = selected ?? queue[0] ?? null;
  const focusPos = selIdx >= 0 ? selIdx + 1 : 1;

  const iniciada = !!jornada?.inicio_en;
  const enCurso = iniciada && !jornada?.fin_en;

  const focus = (lat: number, lng: number, zoom = 0.02) => {
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: zoom, longitudeDelta: zoom }, 500);
  };

  const goMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    setDriver(c);
    focus(c.latitude, c.longitude, 0.05);
  };

  const navigate = (lat: number, lng: number) => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
  };

  const totalCola = queue.reduce((a, o) => a + Number(o.total || 0), 0);

  // ============ FULLSCREEN: mapa total sin navegacion ============
  if (plannerOpen) {
    return (
      <View style={p.wrap}>
        {Platform.OS === 'web' ? (
          <View style={p.webBox}><Text style={{ color: theme.muted }}>El mapa nativo solo renderiza en Android/iOS.</Text></View>
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={PEREIRA_CENTER}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {driver && (
              <Marker coordinate={driver} title="Mi camión" tracksViewChanges={false}>
                <View style={p.driverPin}><Text style={{ fontSize: 22 }}>🚚</Text></View>
              </Marker>
            )}
            {queue.map((o, i) => {
              if (o.lat == null) return null;
              const n = i + 1;
              const color = priorityColor(n);
              const isSel = o.id === (selectedId ?? queue[0]?.id);
              return (
                <Marker
                  key={`${o.id}-${i}`}
                  coordinate={{ latitude: o.lat, longitude: o.lng! }}
                  tracksViewChanges={isSel || i === 0}
                  onPress={() => selectOrder(o.id)}
                >
                  <View style={p.destWrap}>
                    <View style={[p.destLabel, { borderColor: color }]}>
                      <Text style={p.destName} numberOfLines={1}>{n} · {o.customer?.nombre} · {o.code}</Text>
                      <Text style={p.destAddr} numberOfLines={1}>📍 {o.address_snapshot}</Text>
                    </View>
                    <View style={[p.pin, { backgroundColor: color }]}>
                      <Text style={p.pinTxt}>{n}</Text>
                    </View>
                  </View>
                </Marker>
              );
            })}
            {basePath.length > 1 && <Polyline coordinates={basePath} strokeWidth={4} strokeColor={theme.primary} />}
          </MapView>
        )}

        <View style={[p.top, { top: insets.top + 10 }]} pointerEvents="box-none">
          <Pressable style={p.back} onPress={() => setPlannerOpen(false)} pointerEvents="auto">
            <Text style={p.backTxt}>‹ Volver</Text>
          </Pressable>
          <View style={p.metrics} pointerEvents="auto">
            <View><Text style={p.mLabel}>Cola</Text><Text style={p.mVal}>{queue.length}</Text></View>
            <View style={p.mDiv} />
            <View><Text style={p.mLabel}>Distancia</Text><Text style={p.mVal}>{km.toFixed(1)} km</Text></View>
            <View style={p.mDiv} />
            <View><Text style={p.mLabel}>Tiempo</Text><Text style={[p.mVal, { color: '#b45309' }]}>{mins} min</Text></View>
            <View style={p.mDiv} />
            <View><Text style={p.mLabel}>Cobro</Text><Text style={p.mVal}>{cop(totalCola)}</Text></View>
          </View>
        </View>

        <View style={[p.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <Text style={p.sheetTitle}>
            {focusOrder ? `Círculo ${focusPos} de ${queue.length} · ${focusOrder.code}` : 'Sin pedidos'}
            {tracing ? ' · trazando…' : ''}
          </Text>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
            {queue.length === 0 && <Text style={p.done}>✅ ¡Todos los pedidos entregados!</Text>}
            {focusOrder && (
              <OrderDetailCard
                order={focusOrder}
                position={focusPos}
                selected
                onPress={() => focusOrder.lat != null && focus(focusOrder.lat, focusOrder.lng!)}
                onComplete={() => setCompleting(focusOrder)}
                onNavigate={() => focusOrder.lat != null && navigate(focusOrder.lat, focusOrder.lng!)}
              />
            )}
            {queue.length > 1 && (
              <PriorityCircles queue={queue} selectedId={selectedId ?? queue[0]?.id ?? null} onSelect={(id) => {
                selectOrder(id);
                const o = queue.find((x) => x.id === id);
                if (o?.lat != null) focus(o.lat, o.lng!);
              }} />
            )}
            {queue.length > 1 && (
              <View>
                <View style={p.secRow}>
                  <Text style={p.secTitle}>Orden de entrega</Text>
                  {selIdx > 0 && (
                    <Pressable style={p.promote} onPress={() => selectedId != null && promoteToPrincipal(selectedId)}>
                      <Text style={p.promoteTxt}>↑ Subir a 1</Text>
                    </Pressable>
                  )}
                </View>
                <DraggableFlatList
                  data={queue}
                  keyExtractor={(o) => String(o.id)}
                  scrollEnabled={false}
                  onDragEnd={({ data }) => reorderQueue(data.map((o) => o.id))}
                  renderItem={({ item: o, getIndex, drag, isActive }) => {
                    const gi = (getIndex() ?? 0) + 1;
                    const color = priorityColor(gi);
                    const isSel = o.id === selectedId;
                    return (
                      <ScaleDecorator>
                        <Pressable
                          onPress={() => {
                            selectOrder(o.id);
                            if (o.lat != null) focus(o.lat, o.lng!);
                          }}
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
                <Text style={p.hint}>Mantén ⋮⋮ para arrastrar y reordenar.</Text>
              </View>
            )}
          </ScrollView>
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
      </View>
    );
  }

  // ============ RESUMEN (con navegacion) ============
  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{fechaHoy()}</Text>
          <Text style={styles.h1}>Tu ruta de hoy</Text>
          <Text style={styles.muted}>Resumen de tus entregas y recorrido del día.</Text>
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

      <View style={styles.shell}>
        {Platform.OS === 'web' ? (
          <View style={styles.webBox}><Text style={{ color: theme.muted }}>El mapa nativo solo renderiza en Android/iOS.</Text></View>
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={PEREIRA_CENTER}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {driver && (
              <Marker coordinate={driver} title="Mi camión" tracksViewChanges={false}>
                <View style={styles.driverPin}><Text style={{ fontSize: 20 }}>🚚</Text></View>
              </Marker>
            )}
            {queue.map((o, i) => {
              if (o.lat == null) return null;
              return (
                <Marker
                  key={`${o.id}-${i}`}
                  coordinate={{ latitude: o.lat, longitude: o.lng! }}
                  tracksViewChanges={false}
                >
                  <View style={[styles.pin, { backgroundColor: priorityColor(i + 1) }]}>
                    <Text style={styles.pinTxt}>{String.fromCharCode(65 + (i % 26))}</Text>
                  </View>
                </Marker>
              );
            })}
            {basePath.length > 1 && <Polyline coordinates={basePath} strokeWidth={4} strokeColor={theme.primary} />}
          </MapView>
        )}
        <View style={styles.toolbar} pointerEvents="box-none">
          <View style={styles.mapLabel} pointerEvents="auto">
            <View style={styles.dot} />
            <Text style={styles.mapLabelTxt}>Ruta activa · {queue.length} paradas{tracing ? '…' : ''}</Text>
          </View>
          <Pressable style={styles.locBtn} onPress={goMyLocation} pointerEvents="auto">
            <Text style={styles.locTxt}>◎ Mi ubicación</Text>
          </Pressable>
        </View>
        <Pressable style={styles.fullBtn} onPress={() => setPlannerOpen(true)}>
          <Text style={styles.fullTxt}>⛶ Pantalla completa</Text>
        </Pressable>
      </View>

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
            <Text style={styles.noteTitle}>Vas muy bien, {nombre}</Text>
            <Text style={styles.mutedSm}>
              {queue.length === 0 ? 'Ruta completada. Buen trabajo.' : `Te quedan ${queue.length} pedidos · ~${km.toFixed(1)} km · ~${mins} min.`}
            </Text>
          </View>
          <Text style={styles.more}>›</Text>
        </View>
        <View style={styles.brandRow}>
          <AppMark size={22} />
          <Text style={styles.brandTxt}>CONTROL DE ENTREGAS</Text>
        </View>
      </View>
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
  jbarTxt: { color: '#147a5b', fontSize: 12, fontWeight: '800' },
  jstart: { backgroundColor: theme.navy, borderRadius: 12, padding: 14, alignItems: 'center' },
  jstartTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  warn: { color: '#9a651f', backgroundColor: '#fff0d8', fontSize: 11, fontWeight: '700', borderRadius: 10, padding: 10 },
  shell: { position: 'relative', minHeight: 380, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#d9e9e7', backgroundColor: '#e5f0ee' },
  webBox: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  toolbar: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mapLabel: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  mapLabelTxt: { fontSize: 10, fontWeight: '800', color: '#207172' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#35c29c' },
  locBtn: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  locTxt: { color: theme.primary, fontSize: 12, fontWeight: '800' },
  fullBtn: { position: 'absolute', right: 12, bottom: 12, backgroundColor: theme.navy, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  fullTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  driverPin: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.navy, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pin: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  pinTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
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
  brandRow: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  brandTxt: { color: theme.muted, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
});

const p = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  webBox: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 12, left: 12, right: 12, gap: 10 },
  back: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  backTxt: { color: theme.navy, fontSize: 14, fontWeight: '800' },
  metrics: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12 },
  mLabel: { color: theme.muted, fontSize: 9, textTransform: 'uppercase', fontWeight: '700' },
  mVal: { color: theme.text, fontSize: 14, fontWeight: '800' },
  mDiv: { width: 1, height: 26, backgroundColor: theme.border },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '52%', backgroundColor: '#fbfdfd', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: theme.border, padding: 14 },
  sheetTitle: { fontSize: 12, color: theme.muted, fontWeight: '800', marginBottom: 2 },
  done: { color: theme.emerald, textAlign: 'center', marginTop: 16, fontWeight: '700' },
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
  cName: { color: theme.text, fontSize: 14, fontWeight: '800' },
  cCode: { color: theme.muted, fontSize: 11, fontWeight: '400' },
  cAddr: { color: theme.muted, fontSize: 12, marginTop: 1 },
  cTotal: { color: theme.text, fontSize: 12, fontWeight: '800' },
  hint: { color: theme.muted, fontSize: 11, textAlign: 'center', marginTop: 2 },
  pin: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  pinTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  driverPin: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.navy, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  destWrap: { alignItems: 'center', width: 230 },
  destLabel: { backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 4, width: '100%' },
  destName: { color: theme.text, fontSize: 12, fontWeight: '800' },
  destAddr: { color: theme.muted, fontSize: 11, marginTop: 1 },
});
