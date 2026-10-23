import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from './api';

export const TRACK_TASK = 'control-entregas-location';
// Intervalo de envío (testeo: 5 s; producción: 30000).
export const TRACK_INTERVAL_MS = 5000;

export type TrackPoint = {
  lat: number;
  lng: number;
  recorded_at: string;
  accuracy?: number;
  speed?: number;
  order_id?: number;
};

let queue: TrackPoint[] = [];
let activeOrderId: number | null = null;
let flushing = false;
let running = false;

export type TrackEvent = {
  at: string;
  kind: 'send-ok' | 'send-error' | 'start' | 'stop' | 'perm' | 'voy';
  detail: string;
};

const MAX_EVENTS = 80;
let events: TrackEvent[] = [];
let sentTotal = 0;
let lastSendAt: string | null = null;
let lastError: string | null = null;

function log(kind: TrackEvent['kind'], detail: string) {
  const at = new Date().toISOString();
  events = [{ at, kind, detail }, ...events].slice(0, MAX_EVENTS);
  console.log(`[tracking] ${at.slice(11, 19)} ${kind}: ${detail}`);
}

export function getTrackingLog(): TrackEvent[] {
  return events;
}

export function getTrackingStatus() {
  return {
    running,
    lastSendAt,
    sentTotal,
    queued: queue.length,
    lastError,
    orderId: activeOrderId,
  };
}

/** Pedido al que se atribuyen los puntos (el marcado con «Voy»). */
export function setTrackingOrder(id: number | null) {
  activeOrderId = id;
  log('voy', id === null ? 'pedido liberado → tiempo libre' : `pedido ${id} marcado (Voy)`);
}

export function getTrackingOrder(): number | null {
  return activeOrderId;
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask(TRACK_TASK, async ({ data, error }: any) => {
  if (error) return;
  const locations = (data?.locations ?? []) as Location.LocationObject[];
  if (locations.length === 0) return;
  for (const l of locations) {
    queue.push({
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      recorded_at: new Date(l.timestamp).toISOString(),
      accuracy: l.coords.accuracy ?? undefined,
      speed: l.coords.speed ?? undefined,
      order_id: activeOrderId ?? undefined,
    });
  }
  if (queue.length > 200) queue = queue.slice(-200);
  await flushQueue();
  });
}

async function flushQueue() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    const batch = queue.slice(0, 100);
    const ctx = batch.some((p) => p.order_id != null)
      ? `pedido ${[...new Set(batch.map((p) => p.order_id).filter((x) => x != null))].join(',')}`
      : 'tiempo libre';
    await api.trackingPoints(batch);
    queue = queue.slice(batch.length);
    sentTotal += batch.length;
    lastSendAt = new Date().toISOString();
    lastError = null;
    log('send-ok', `${batch.length} pts → back · ${ctx}`);
  } catch (e: any) {
    lastError = e?.message ?? 'Error de red';
    log('send-error', `${lastError} · quedan ${queue.length} en cola`);
  } finally {
    flushing = false;
  }
}

export async function flushTracking() {
  await flushQueue();
}

export async function ensureTrackingPermissions(): Promise<{ fg: boolean; bg: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) {
    log('perm', 'permiso de ubicación en primer plano denegado');
    return { fg: false, bg: false };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) log('perm', 'permiso en segundo plano denegado (se necesita "Permitir siempre")');
  return { fg: true, bg: bg.granted };
}

export async function startTracking(): Promise<void> {
  if (Platform.OS === 'web') return;
  const started = await Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false);
  if (started) {
    running = true;
    return;
  }
  await Location.startLocationUpdatesAsync(TRACK_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: TRACK_INTERVAL_MS,
    // Sin filtro de distancia en testeo: envía aunque esté quieto.
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Control de Entregas · En jornada',
      notificationBody: 'Compartiendo tu ubicación con la central.',
      killServiceOnDestroy: false,
    },
  });
  running = true;
  log('start', `rastreo iniciado · envío cada ${TRACK_INTERVAL_MS / 1000} s`);
}

export async function stopTracking(): Promise<void> {
  if (Platform.OS !== 'web') {
    const started = await Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false);
    if (started) {
      await Location.stopLocationUpdatesAsync(TRACK_TASK).catch(() => {});
    }
  }
  running = false;
  queue = [];
  log('stop', 'rastreo detenido');
}

export async function isTrackingActive(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false);
}
