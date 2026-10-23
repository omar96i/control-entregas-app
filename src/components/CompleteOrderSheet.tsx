import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  onConfirm: (payload: { firma: string; firmado_por: string; metodo_pago_final: string }) => Promise<string | null> | string | null;
};

/**
 * Firma a pantalla completa: lienzo grande y botón para girar a
 * horizontal, más cómodo para firmar con el dedo.
 */
export default function CompleteOrderSheet({ visible, order, position, onClose, onConfirm }: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [nombre, setNombre] = useState('');
  const [pago, setPago] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [landscape, setLandscape] = useState(false);
  const [sending, setSending] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const horizontal = width > height;

  // Al cerrarse, siempre se vuelve a vertical (sincroniza sistema externo).
  useEffect(() => {
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
    setStrokes([]);
    setNombre('');
    setError(null);
    setSending(false);
    setKey((k) => k + 1);
    setLandscape(false);
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    onClose();
  };

  const confirm = async () => {
    if (!order) return;
    if (!nombre.trim()) {
      setError('Escribe el nombre de quien recibe.');
      return;
    }
    if (!hasInk(strokes)) {
      setError('La firma del cliente es obligatoria. Pídele que firme con el dedo.');
      return;
    }
    setSending(true);
    const err = await onConfirm({ firma: strokesToData(strokes), firmado_por: nombre.trim(), metodo_pago_final: pago });
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
            <Text style={styles.title}>Firma de entrega ✍️</Text>
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

        <View style={[styles.body, horizontal && styles.bodyLandscape]}>
          <View style={[styles.form, horizontal && styles.formLandscape]}>
            <Text style={styles.label}>¿Quién recibe? *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre de quien firma"
              placeholderTextColor={theme.muted}
              value={nombre}
              onChangeText={(t) => { setNombre(t); setError(null); }}
            />
            <Text style={[styles.label, { marginTop: 10 }]}>
              ¿Cómo pagó? * {order?.metodo_pago_esperado && order.metodo_pago_esperado !== 'por_confirmar' ? `(esperado: ${order.metodo_pago_esperado})` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              {(['efectivo', 'transferencia'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setPago(m)}
                  style={[styles.mini, pago === m && { borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.15)' }]}
                >
                  <Text style={styles.miniTxt}>{m === 'efectivo' ? '💵 Efectivo' : '📲 Transferencia'}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.padHead}>
              <Text style={styles.label}>Firma del cliente *</Text>
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
          </View>

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

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.row}>
          <Pressable style={styles.cancel} onPress={close}>
            <Text style={styles.cancelTxt}>Cancelar</Text>
          </Pressable>
          <Pressable style={styles.ok} onPress={confirm} disabled={sending}>
            <Text style={styles.okTxt}>{sending ? 'Guardando…' : '✓ Confirmar entrega'}</Text>
          </Pressable>
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
  body: { flex: 1, gap: 10 },
  bodyLandscape: { flexDirection: 'row', gap: 12 },
  form: {},
  formLandscape: { width: 260, justifyContent: 'center' },
  label: { color: theme.text, fontSize: 13, fontWeight: '700' },
  input: { backgroundColor: '#ffffff', borderRadius: 12, padding: 13, color: theme.text, borderWidth: 1.5, borderColor: theme.border, marginTop: 6, fontSize: 15 },
  padHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  mini: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  miniTxt: { color: theme.text, fontSize: 12, fontWeight: '700' },
  hint: { color: theme.muted, fontSize: 11, marginTop: 6 },
  padWrap: { flex: 1, minHeight: 220, justifyContent: 'center' },
  pad: { flex: 1 },
  padHint: { position: 'absolute', alignSelf: 'center', color: '#475569', fontSize: 15, fontStyle: 'italic' },
  error: { color: '#b4232a', fontSize: 12, fontWeight: '700', backgroundColor: '#fdecec', padding: 10, borderRadius: 8 },
  row: { flexDirection: 'row', gap: 8 },
  cancel: { flex: 1, backgroundColor: '#edf2f1', borderRadius: 12, padding: 15, alignItems: 'center' },
  cancelTxt: { color: theme.faint, fontWeight: '700', fontSize: 15 },
  ok: { flex: 2, backgroundColor: theme.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  okTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
