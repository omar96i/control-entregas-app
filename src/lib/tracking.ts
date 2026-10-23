import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { api } from './api';

export const TRACK_TASK = 'control-entregas-location';
export const TRACK_INTERVAL_MS = 30000;

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

/** Pedido al que se atribuyen los puntos (el marcado con «Voy»). */
export function setTrackingOrder(id: number | null) {
  activeOrderId = id;
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
    await api.trackingPoints(batch);
    queue = queue.slice(batch.length);
  } catch {
    // Sin red: se conserva la cola para el próximo ciclo.
  } finally {
    flushing = false;
  }
}

export async function flushTracking() {
  await flushQueue();
}

export async function ensureTrackingPermissions(): Promise<{ fg: boolean; bg: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { fg: false, bg: false };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { fg: true, bg: bg.granted };
}

export async function startTracking(): Promise<void> {
  if (Platform.OS === 'web') return;
  const started = await Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false);
  if (started) return;
  await Location.startLocationUpdatesAsync(TRACK_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: TRACK_INTERVAL_MS,
    distanceInterval: 25,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Control de Entregas · En jornada',
      notificationBody: 'Compartiendo tu ubicación con la central.',
    },
  });
}

export async function stopTracking(): Promise<void> {
  if (Platform.OS !== 'web') {
    const started = await Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false);
    if (started) {
      await Location.stopLocationUpdatesAsync(TRACK_TASK).catch(() => {});
    }
  }
  queue = [];
}

export async function isTrackingActive(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false);
}
