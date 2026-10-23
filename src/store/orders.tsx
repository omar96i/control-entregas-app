import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import {
  ensureTrackingPermissions,
  flushTracking,
  getTrackingOrder,
  setTrackingOrder,
  startTracking,
  stopTracking,
} from '../lib/tracking';
import type { Customer, Jornada, Order } from '../lib/types';
import { useAuth } from './auth';

export type CompletePayload = { firma: string; firmado_por: string; metodo_pago_final: string };

type Store = {
  customers: Customer[];
  orders: Order[];
  queue: Order[];
  delivered: Order[];
  jornada: Jornada | null;
  historial: Jornada[];
  loading: boolean;
  refreshing: boolean;
  selectedId: number | null;
  selected: Order | null;
  selectOrder: (id: number | null) => void;
  refresh: () => Promise<void>;
  reorderQueue: (orderedIds: number[]) => Promise<void>;
  moveOrder: (from: number, to: number) => Promise<void>;
  promoteToPrincipal: (id: number) => Promise<void>;
  completeOrder: (id: number, payload: CompletePayload) => Promise<{ ok: boolean; error?: string }>;
  requestReassign: (id: number, motivo: string) => Promise<{ ok: boolean; error?: string }>;
  voyOrder: (id: number) => Promise<{ ok: boolean; error?: string }>;
  updateOrderLocation: (id: number, lat: number, lng: number) => Promise<{ ok: boolean; error?: string }>;
  iniciarJornada: () => Promise<{ tracking: 'ok' | 'sin-permiso' | 'error' }>;
  finalizarJornada: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

async function syncTracking(j: Jornada | null) {
  const abierta = !!j && !!j.inicio_en && !j.fin_en;
  if (!abierta) {
    await stopTracking().catch(() => {});
    return;
  }
  // Solo reanuda en silencio si los permisos ya están dados (sin preguntar aquí).
  const fg = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (!fg?.granted) return;
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (!bg?.granted) return;
  await startTracking().catch(() => {});
}

function sortQueue(list: Order[]): Order[] {
  return [...list]
    .filter((o) => o.estado !== 'entregado' && o.estado !== 'cancelado')
    .sort((a, b) => {
      const pa = a.prioridad || 999;
      const pb = b.prioridad || 999;
      return pa - pb || a.id - b.id;
    });
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [historial, setHistorial] = useState<Jornada[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setCustomers([]);
      setJornada(null);
      return;
    }
    setRefreshing(true);
    try {
      const [os, cs, j, hist] = await Promise.all([
        api.myOrders(),
        api.customers().catch(() => []),
        api.jornadaMia().catch(() => null),
        api.jornadas().catch(() => []),
      ]);
      setOrders(os);
      setCustomers(cs);
      setJornada(j);
      setHistorial(hist as Jornada[]);
      // El rastreo sigue a la jornada: si está abierta, debe estar corriendo.
      syncTracking(j as Jornada | null).catch(() => {});
      setSelectedId((sel) => {
        if (sel && (os as Order[]).some((o) => o.id === sel && o.estado !== 'entregado')) return sel;
        return sortQueue(os as Order[])[0]?.id ?? null;
      });
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [user, refresh]);

  const queue = useMemo(() => sortQueue(orders), [orders]);
  const delivered = useMemo(() => orders.filter((o) => o.estado === 'entregado'), [orders]);
  const selected = useMemo(() => queue.find((o) => o.id === selectedId) ?? null, [queue, selectedId]);

  const selectOrder = useCallback((id: number | null) => setSelectedId(id), []);

  const reorderQueue = useCallback(
    async (orderedIds: number[]) => {
      await api.reorder(orderedIds);
      await refresh();
    },
    [refresh],
  );

  const moveOrder = useCallback(
    async (from: number, to: number) => {
      const q = sortQueue(orders);
      if (to < 0 || to >= q.length) return;
      const next = [...q];
      const [s] = next.splice(from, 1);
      next.splice(to, 0, s);
      await api.reorder(next.map((o) => o.id));
      await refresh();
    },
    [orders, refresh],
  );

  const promoteToPrincipal = useCallback(
    async (id: number) => {
      const q = sortQueue(orders);
      const idx = q.findIndex((o) => o.id === id);
      if (idx <= 0) return;
      const next = [q[idx], ...q.slice(0, idx), ...q.slice(idx + 1)];
      await api.reorder(next.map((o) => o.id));
      setSelectedId(id);
      await refresh();
    },
    [orders, refresh],
  );

  const completeOrder = useCallback(
    async (id: number, payload: CompletePayload): Promise<{ ok: boolean; error?: string }> => {
      if (!payload.firmado_por.trim()) return { ok: false, error: 'Escribe quién recibe el pedido.' };
      if (!payload.firma || payload.firma.length < 10)
        return { ok: false, error: 'La firma del cliente es obligatoria.' };
      if (!payload.metodo_pago_final) return { ok: false, error: 'Confirma si pagó en efectivo o transferencia.' };
      try {
        await api.complete(id, payload.firma, payload.firmado_por.trim(), payload.metodo_pago_final);
        if (getTrackingOrder() === id) setTrackingOrder(null);
        await refresh();
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    [refresh],
  );

  const requestReassign = useCallback(
    async (id: number, motivo: string) => {
      try {
        await api.requestReassign(id, motivo);
        await refresh();
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    [refresh],
  );

  const iniciarJornada = useCallback(async () => {
    const j = await api.jornadaIniciar();
    setJornada(j);
    let tracking: 'ok' | 'sin-permiso' | 'error' = 'ok';
    try {
      const p = await ensureTrackingPermissions();
      if (!p.bg) {
        tracking = 'sin-permiso';
      } else {
        await startTracking();
      }
    } catch {
      tracking = 'error';
    }
    await refresh();
    return { tracking };
  }, [refresh]);

  const finalizarJornada = useCallback(async () => {
    try {
      await flushTracking();
    } catch {
      // noop
    }
    await stopTracking().catch(() => {});
    setTrackingOrder(null);
    const j = await api.jornadaFinalizar();
    setJornada(j);
    await refresh();
  }, [refresh]);

  const voyOrder = useCallback(
    async (id: number): Promise<{ ok: boolean; error?: string }> => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return { ok: false, error: 'Sin permiso de ubicación.' };
        const pos = await Location.getCurrentPositionAsync({});
        await api.voy(id, pos.coords.latitude, pos.coords.longitude);
        setTrackingOrder(id);
        await startTracking().catch(() => {});
        await refresh();
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    [refresh],
  );

  const updateOrderLocation = useCallback(
    async (id: number, lat: number, lng: number) => {
      try {
        const order = orders.find((o) => o.id === id);
        if (!order?.customer_address_id) return { ok: false, error: 'El pedido no tiene dirección asociada.' };
        await api.updateAddress(order.customer_address_id, { lat, lng });
        await refresh();
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    [orders, refresh],
  );

  const value = useMemo(
    () => ({
      customers,
      orders,
      queue,
      delivered,
      jornada,
      historial,
      loading,
      refreshing,
      selectedId,
      selected,
      selectOrder,
      refresh,
      reorderQueue,
      moveOrder,
      promoteToPrincipal,
      completeOrder,
      requestReassign,
      updateOrderLocation,
      voyOrder,
      iniciarJornada,
      finalizarJornada,
    }),
    [
      customers, orders, queue, delivered, jornada, historial, loading, refreshing,
      selectedId, selected, selectOrder, refresh, reorderQueue, moveOrder,
      promoteToPrincipal, completeOrder, requestReassign, updateOrderLocation, voyOrder, iniciarJornada, finalizarJornada,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOrders(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOrders fuera de OrdersProvider');
  return ctx;
}
