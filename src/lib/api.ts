import * as SecureStore from 'expo-secure-store';

// Emulador Android: 10.0.2.2 = localhost del PC (127.0.0.1 apunta al propio emulador).
// Fisico en misma wifi: cambia .env a la IP LAN (ej. 192.168.101.8). Remoto/https: ngrok.
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000/api/v1';
const TOKEN_KEY = 'control_entregas_token';

let memToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (memToken) return memToken;
  try {
    memToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    memToken = null;
  }
  return memToken;
}

export async function saveToken(t: string | null) {
  memToken = t;
  try {
    if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // noop
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(memToken ? { Authorization: `Bearer ${memToken}` } : {}),
    ...(extra ?? {}),
  };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: authHeaders(init?.headers as Record<string, string> | undefined),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

function list<T>(r: any): T[] {
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.data)) return r.data;
  return [];
}

export const api = {
  base: BASE,
  login: async (email: string, password: string) => {
    const r = await req<{ token: string; user: any }>(`/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await saveToken(r.token);
    return r;
  },
  logout: async () => {
    try {
      await req(`/auth/logout`, { method: 'POST' });
    } catch {
      // noop
    }
    await saveToken(null);
  },
  me: () => req<any>(`/auth/me`),
  myOrders: async () => list<any>(await req(`/orders?per_page=100`)),
  customers: async () => list<any>(await req(`/customers?per_page=100`)),
  reorder: (order_ids: number[]) =>
    req<any>(`/orders-reorder`, { method: 'PATCH', body: JSON.stringify({ order_ids }) }),
  complete: (orderId: number, firma: string, firmado_por: string, metodo_pago_final: string, foto: string) =>
    req<any>(`/orders/${orderId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ firma, firmado_por, metodo_pago_final, foto }),
    }),
  requestReassign: (orderId: number, motivo: string) =>
    req<any>(`/orders/${orderId}/request-reassign`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }),
  updateAddress: (addressId: number, body: { lat: number; lng: number }) =>
    req<any>(`/addresses/${addressId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  jornadaMia: () => req<any>(`/jornadas/mia`),
  jornadaIniciar: () => req<any>(`/jornadas/iniciar`, { method: 'POST' }),
  jornadaFinalizar: () => req<any>(`/jornadas/finalizar`, { method: 'POST', body: JSON.stringify({}) }),
  voy: (orderId: number, lat?: number, lng?: number) =>
    req<any>(`/orders/${orderId}/voy`, {
      method: 'POST',
      body: JSON.stringify({ lat, lng }),
    }),
  trackingPoints: (points: { lat: number; lng: number; recorded_at: string; accuracy?: number; speed?: number; order_id?: number }[]) =>
    req<any>(`/tracking/points`, {
      method: 'POST',
      body: JSON.stringify({ points }),
    }),
  jornadas: async () => list<any>(await req(`/jornadas?per_page=50`)),
  jornadaDetalle: (id: number) => req<any>(`/jornadas/${id}`),
};
