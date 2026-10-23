const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

export type RouteInfo = {
  path: { latitude: number; longitude: number }[];
  km: number;
  mins: number;
};

const cache = new Map<string, RouteInfo>();

/** Decodifica una polyline de Google a coordenadas. */
export function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/**
 * Ruta real por calles usando Google Directions API.
 * origin = primera parada, destination = última, resto = waypoints.
 * Retorna null si falla (el mapa dibuja línea recta como respaldo).
 */
export async function fetchRoute(points: { lat: number; lng: number }[]): Promise<RouteInfo | null> {
  if (points.length < 2 || !KEY) return null;
  const sig = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  const hit = cache.get(sig);
  if (hit) return hit;

  const str = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`;
  const params = new URLSearchParams({
    origin: str(points[0]),
    destination: str(points[points.length - 1]),
    key: KEY,
  });
  if (points.length > 2) {
    params.set('waypoints', points.slice(1, -1).map(str).join('|'));
  }
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
    const json = await res.json();
    if (json.status !== 'OK' || !json.routes?.[0]) return null;
    const route = json.routes[0];
    const legs = route.legs ?? [];
    const info: RouteInfo = {
      path: decodePolyline(route.overview_polyline.points),
      km: legs.reduce((a: number, l: any) => a + (l.distance?.value ?? 0), 0) / 1000,
      mins: Math.round(legs.reduce((a: number, l: any) => a + (l.duration?.value ?? 0), 0) / 60),
    };
    cache.set(sig, info);
    return info;
  } catch {
    return null;
  }
}
