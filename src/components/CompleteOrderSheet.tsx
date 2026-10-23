import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { cop } from '../lib/geo';
import { theme } from '../lib/theme';
import type { Order } from '../lib/types';
import SignaturePad, { hasInk, strokesToData, type Stroke } from './SignaturePad';

type Props = {
  visible: boolean;
  order: Order | null;
  position: number;
  onClose: () => void;
  onConfirm: (payload: { firma: string; firmado_por: string; foto: string; metodo_pago_final: string }) => Promise<string | null> | string | null;
};

const STEPS = ['Recibe', 'Firma', 'Foto'];

/**
 * Cierre de entrega en 3 pasos: datos de quien recibe, firma a
 * pantalla amplia y foto comprobante, con resumen antes de confirmar.
 */
export default function CompleteOrderSheet({ visible, order, position, onClose, onConfirm }: Props) {
  const [step, setStep] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [nombre, setNombre] = useState('');
  const [pago, setPago] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [landscape, setLandscape] = useState(false);
  const [sending, setSending] = useState(false);
  const [tomando, setTomando] = useState(false);
  const wasVisible = useRef(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const horizontal = width > height;

  // Al abrir, siempre empieza en el paso 1 limpio.
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setStep(0);
      setStrokes([]);
      setNombre('');
      setFoto(null);
      setError(null);
      setSending(false);
      setTomando(false);
      setKey((k) => k + 1);
    }
    wasVisible.current = visible;
    if (!visible) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  }, [visible]);

  const toggleOrientation = async () => {
    try {
      if (landscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setLandscape(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setLandscape(true);
      }
    } catch {
      setError('No se pudo girar la pantalla en este dispositivo.');
    }
  };

  const close = () => {
    setLandscape(false);
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    onClose();
  };

  const nextFromDatos = () => {
    if (!nombre.trim()) {
      setError('Escribe el nombre de quien recibe el pedido.');
      return;
    }
    setError(null);
    setStep(1);
  };

  const nextFromFirma = () => {
    if (!hasInk(strokes)) {
      setError('La firma del cliente es obligatoria. Pídele que firme con el dedo.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const tomarFoto = async (camara: boolean) => {
    setTomando(true);
    setError(null);
    try {
      const perm = camara
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Sin permiso de cámara/galería.');
        return;
      }
      const r = camara
        ? await ImagePicker.launchCameraAsync({ quality: 0.4, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.4, base64: true });
      if (r.canceled || !r.assets?.[0]?.base64) return;
      const mime = r.assets[0].mimeType ?? 'image/jpeg';
      setFoto(`data:${mime};base64,${r.assets[0].base64}`);
    } catch (e: any) {
      setError(e.message ?? 'No se pudo tomar la foto.');
    } finally {
      setTomando(false);
    }
  };

  const confirm = async () => {
    if (!order) return;
    if (!foto) {
      setError('La foto comprobante es obligatoria. Tómala con la cámara.');
      return;
    }
    setSending(true);
    const err = await onConfirm({ firma: strokesToData(strokes), firmado_por: nombre.trim(), foto, metodo_pago_final: pago });
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    close();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Confirmar entrega</Text>
            {order && (
              <Text style={styles.sub}>
                Círculo {position} · {order.code} · {order.customer?.nombre} · {cop(order.total)}
              </Text>
            )}
          </View>
          <Pressable style={styles.iconBtn} onPress={close} hitSlop={10}>
            <Text style={styles.iconTxt}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.stepSeg}>
              <View style={[styles.stepBar, i <= step && styles.stepBarOn]} />
              <Text style={[styles.stepTxt, i <= step && styles.stepTxtOn]}>{i + 1} · {s}</Text>
            </View>
          ))}
        </View>

        {step === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👤 ¿Quién recibe?</Text>
            <Text style={styles.label}>Nombre de quien recibe *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre de quien firma"
              placeholderTextColor={theme.muted}
              value={nombre}
              onChangeText={(t) => { setNombre(t); setError(null); }}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>
              ¿Cómo pagó? * {order?.metodo_pago_esperado && order.metodo_pago_esperado !== 'por_confirmar' ? `(esperado: ${order.metodo_pago_esperado})` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              {(['efectivo', 'transferencia'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setPago(m)}
                  style={[styles.pay, pago === m && styles.payOn]}
                >
                  <Text style={styles.payTxt}>{m === 'efectivo' ? '💵 Efectivo' : '📲 Transferencia'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={[styles.card, { flex: 1 }]}>
            <View style={styles.padHead}>
              <Text style={styles.cardTitle}>✍️ Firma del cliente</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={styles.mini} onPress={toggleOrientation}>
                  <Text style={styles.miniTxt}>{landscape ? '📱 Vertical' : '🔄 Horizontal'}</Text>
                </Pressable>
                <Pressable
                  style={styles.mini}
                  onPress={() => { setStrokes([]); setKey((k) => k + 1); }}
                >
                  <Text style={styles.miniTxt}>↺ Limpiar</Text>
                </Pressable>
              </View>
            </View>
            {!horizontal && (
              <Text style={styles.hint}>Para más espacio, gira a horizontal con el botón 🔄.</Text>
            )}
            <View style={styles.padWrap}>
              <SignaturePad
                key={key}
                style={styles.pad}
                onChange={(s) => { setStrokes(s); setError(null); }}
              />
              {!hasInk(strokes) && (
                <Text pointerEvents="none" style={styles.padHint}>
                  Firme aquí con el dedo
                </Text>
              )}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📷 Foto comprobante</Text>
            <Text style={styles.hint}>Foto del pedido entregado o del comprobante. Obligatoria para cerrar.</Text>
            {foto ? (
              <View style={{ gap: 8, marginTop: 8 }}>
                <Image source={{ uri: foto }} style={styles.preview} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={[styles.mini, { flex: 1, alignItems: 'center' }]} onPress={() => tomarFoto(true)} disabled={tomando}>
                    <Text style={styles.miniTxt}>↺ Tomar otra</Text>
                  </Pressable>
                  <Pressable style={[styles.mini, { flex: 1, alignItems: 'center' }]} onPress={() => setFoto(null)}>
                    <Text style={styles.miniTxt}>✕ Quitar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[styles.pay, { flex: 1, alignItems: 'center' }]} onPress={() => tomarFoto(true)} disabled={tomando}>
                  <Text style={styles.payTxt}>{tomando ? 'Abriendo…' : '📷 Cámara'}</Text>
                </Pressable>
                <Pressable style={[styles.pay, { flex: 1, alignItems: 'center' }]} onPress={() => tomarFoto(false)} disabled={tomando}>
                  <Text style={styles.payTxt}>🖼️ Galería</Text>
                </Pressable>
              </View>
            )}
            <View style={styles.summary}>
              <Text style={styles.sumTxt}>Recibe: <Text style={styles.sumStrong}>{nombre}</Text></Text>
              <Text style={styles.sumTxt}>Pago: <Text style={styles.sumStrong}>{pago}</Text> · Firma: <Text style={styles.sumStrong}>{hasInk(strokes) ? '✓' : '—'}</Text></Text>
            </View>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.row}>
          {step > 0 ? (
            <Pressable style={styles.back} onPress={() => { setError(null); setStep(step - 1); }}>
              <Text style={styles.backTxt}>‹ Atrás</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.cancel} onPress={close}>
              <Text style={styles.cancelTxt}>Cancelar</Text>
            </Pressable>
          )}
          {step === 0 && (
            <Pressable style={styles.ok} onPress={nextFromDatos}>
              <Text style={styles.okTxt}>Continuar ›</Text>
            </Pressable>
          )}
          {step === 1 && (
            <Pressable style={styles.ok} onPress={nextFromFirma}>
              <Text style={styles.okTxt}>Continuar ›</Text>
            </Pressable>
          )}
          {step === 2 && (
            <Pressable style={styles.ok} onPress={confirm} disabled={sending}>
              <Text style={styles.okTxt}>{sending ? 'Guardando…' : `✓ Confirmar · ${order ? cop(order.total) : ''}`}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: theme.text, fontSize: 20, fontWeight: '800' },
  sub: { color: theme.muted, fontSize: 12, marginTop: 2 },
  iconBtn: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { color: theme.text, fontSize: 16, fontWeight: '800' },
  steps: { flexDirection: 'row', gap: 8 },
  stepSeg: { flex: 1, gap: 4 },
  stepBar: { height: 5, borderRadius: 3, backgroundColor: '#d9e7e5' },
  stepBarOn: { backgroundColor: theme.primary },
  stepTxt: { color: theme.muted, fontSize: 10, fontWeight: '700' },
  stepTxtOn: { color: theme.primary, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.border, borderRadius: 18, padding: 16, gap: 4 },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '800' },
  label: { color: theme.text, fontSize: 13, fontWeight: '700' },
  input: { backgroundColor: '#fbfdfd', borderRadius: 12, padding: 13, color: theme.text, borderWidth: 1.5, borderColor: theme.border, marginTop: 6, fontSize: 16 },
  pay: { flex: 1, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, padding: 13 },
  payOn: { borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.12)' },
  payTxt: { color: theme.text, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  padHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mini: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  miniTxt: { color: theme.text, fontSize: 12, fontWeight: '700' },
  hint: { color: theme.muted, fontSize: 11, marginTop: 6 },
  padWrap: { flex: 1, minHeight: 260, justifyContent: 'center', marginTop: 8, backgroundColor: '#fbfdfd', borderWidth: 1.5, borderColor: theme.border, borderRadius: 14, overflow: 'hidden' },
  pad: { flex: 1 },
  padHint: { position: 'absolute', alignSelf: 'center', color: '#475569', fontSize: 15, fontStyle: 'italic' },
  preview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#e8efee' },
  summary: { marginTop: 10, backgroundColor: '#f2f8f7', borderRadius: 12, padding: 12, gap: 2 },
  sumTxt: { color: theme.muted, fontSize: 12 },
  sumStrong: { color: theme.text, fontWeight: '800' },
  error: { color: '#b4232a', fontSize: 12, fontWeight: '700', backgroundColor: '#fdecec', padding: 10, borderRadius: 8 },
  row: { flexDirection: 'row', gap: 8 },
  cancel: { flex: 1, backgroundColor: '#edf2f1', borderRadius: 12, padding: 15, alignItems: 'center' },
  cancelTxt: { color: theme.faint, fontWeight: '700', fontSize: 15 },
  back: { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, padding: 15, alignItems: 'center' },
  backTxt: { color: theme.navy, fontWeight: '700', fontSize: 15 },
  ok: { flex: 2, backgroundColor: theme.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  okTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
