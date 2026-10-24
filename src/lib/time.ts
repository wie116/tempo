import {
  addDays,
  format,
  parseISO,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  endOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { TimeFormat } from '../types';
import { formatClock } from './i18n';

/** Toda la app snapea a esta unidad. Cambiala acá y cambia en todos lados. */
export const SLOT_MIN = 10;

export const minToPx = (min: number, slotPx: number) => (min / SLOT_MIN) * slotPx;
export const pxToMin = (px: number, slotPx: number) => (px / slotPx) * SLOT_MIN;
export const snap = (min: number) => Math.round(min / SLOT_MIN) * SLOT_MIN;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const dateKey = (d: Date) => format(d, 'yyyy-MM-dd');
export const toLocalISO = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

/** Minutos desde medianoche de un ISO local. */
export function minutesOf(iso: string): number {
  const d = parseISO(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function isoFor(day: Date, minutesFromMidnight: number): string {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutesFromMidnight);
  return toLocalISO(d);
}

export function weekDays(anchor: Date, mondayFirst: boolean): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: mondayFirst ? 1 : 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthGrid(anchor: Date, mondayFirst: boolean): Date[] {
  const opts = { weekStartsOn: (mondayFirst ? 1 : 0) as 0 | 1 };
  const start = startOfWeek(startOfMonth(anchor), opts);
  const end = endOfWeek(endOfMonth(anchor), opts);
  const out: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "09:30" · "14:00" — siempre 24 h con dos dígitos. */
export function hhmm(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Etiqueta compacta de la regla horaria: "07", "14", "7a", "2p". */
export const hourLabel = (h: number) => activeTimeFormat === '12h'
  ? `${h % 12 || 12}${h % 24 < 12 ? 'a' : 'p'}`
  : String(h % 24).padStart(2, '0');

/** "1 h 30" · "45 min" */
export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

let activeDateLocale: Locale = es;
let activeDateLanguage: 'es' | 'en' = 'es';
let activeTimeFormat: TimeFormat = '24h';

export function configureDateFormatting(locale: Locale, language: 'es' | 'en', timeFormat: TimeFormat = '24h') {
  activeDateLocale = locale;
  activeDateLanguage = language;
  activeTimeFormat = timeFormat;
}

/** Hora para lectura en la interfaz. Los campos editables siguen usando HH:MM estable. */
export const clockLabel = (minutes: number) => formatClock(minutes, activeTimeFormat);

export const fmt = (d: Date, pattern: string) => {
  let localizedPattern = pattern;
  if (activeDateLanguage === 'en') {
    localizedPattern = localizedPattern
      .replace("'Semana del' d 'de' LLLL", "'Week of' LLLL d")
      .replace("EEEE d 'de' LLLL", 'EEEE, LLLL d')
      .replace("d 'de' LLLL", 'LLLL d');
  }
  return format(d, localizedPattern, { locale: activeDateLocale });
};

/* ---------- Zoom ---------- */

/** Rango de zoom: de una hora aplastada a bloques de 10 min bien legibles. */
export const ZOOM_MIN = 4;
export const ZOOM_MAX = 96;
export const ZOOM_STEPS = [4, 5, 6, 8, 10, 12, 14, 17, 20, 24, 30, 38, 48, 60, 76, 96];

export function zoomStep(current: number, dir: 1 | -1): number {
  const i = ZOOM_STEPS.reduce(
    (best, v, idx) => (Math.abs(v - current) < Math.abs(ZOOM_STEPS[best] - current) ? idx : best),
    0
  );
  return ZOOM_STEPS[clamp(i + dir, 0, ZOOM_STEPS.length - 1)];
}

/** Cada cuántos minutos dibujar la línea fina, según cuánto espacio hay. */
export function minorInterval(slotPx: number): number {
  if (slotPx >= 17) return 10;
  if (slotPx >= 9) return 30;
  return 0;
}

/** Cada cuántas horas poner etiqueta en la regla. */
export function labelEvery(slotPx: number): number {
  if (slotPx >= 8) return 1;
  if (slotPx >= 5) return 2;
  return 3;
}
