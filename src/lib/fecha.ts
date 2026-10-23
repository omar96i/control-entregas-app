/** Zona horaria operativa: todo se muestra en hora de Colombia. */
export const TZ = 'America/Bogota';

/** "2026-10-23 09:32:00" (hora Bogotá, como manda el back) -> Date. */
export function bogota(wall: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(wall.trim());
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}-05:00`);
}

function toDate(s: string | null | undefined): Date | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(t)) {
    const d = new Date(t);
    return Number.isNaN(+d) ? null : d;
  }
  return bogota(t);
}

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-CO', { timeZone: TZ, ...o });

/** "09:32" en hora Bogotá, venga del back ("Y-m-d H:i:s") o un ISO. */
export function hora(s: string | null | undefined): string {
  const d = typeof s === 'string' ? toDate(s) : null;
  if (!d) return '—';
  return fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/** "09:32:05" en hora Bogotá. */
export function horaSeg(s: string | null | undefined): string {
  const d = typeof s === 'string' ? toDate(s) : null;
  if (!d) return '—';
  return fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
}

/** "2026-10-23" del día actual en Bogotá (no depende del ajuste del teléfono). */
export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** "jueves, 23 de octubre". */
export function fechaLarga(d?: Date): string {
  try {
    return fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d ?? new Date());
  } catch {
    return '';
  }
}

/** "23 oct". */
export function fechaCorta(d?: Date): string {
  try {
    return fmt({ day: 'numeric', month: 'short' }).format(d ?? new Date());
  } catch {
    return '';
  }
}
