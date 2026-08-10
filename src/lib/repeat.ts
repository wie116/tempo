import { addDays, addMonths, addYears, parseISO } from 'date-fns';
import type { RepeatMode } from '../types';
import { dateKey } from './time';

/**
 * Cuántas repeticiones materializamos como máximo.
 * No hay proceso de fondo que extienda las series, así que "para siempre"
 * en realidad llega hasta acá. Es preferible ser honesto y decirlo en la UI.
 */
export const MAX_OCCURRENCES: Record<Exclude<RepeatMode, 'none'>, number> = {
  daily: 180,
  weekly: 180,
};

export const UNTIL_PRESETS = [
  { id: '1m', label: '1 mes', add: (d: Date) => addMonths(d, 1) },
  { id: '3m', label: '3 meses', add: (d: Date) => addMonths(d, 3) },
  { id: '1y', label: '1 año', add: (d: Date) => addYears(d, 1) },
];

export const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Fechas concretas de una serie que arranca en `from`.
 * 'daily' recorre todos los días. 'weekly' recorre solo los días de semana
 * indicados en `weekdays` (por ejemplo lun/mié/vie); si no se especifica
 * ninguno, usa el mismo día de la semana en que se agendó — el comportamiento
 * de antes, cuando "semanal" era un solo día repetido.
 */
export function expandSeries(
  from: Date, repeat: RepeatMode, until: string | null, weekdays: number[] | null = null
): Date[] {
  if (repeat === 'none') return [from];
  const cap = MAX_OCCURRENCES[repeat];
  const limit = until ? parseISO(until) : addYears(from, 3);
  const days = repeat === 'weekly' ? (weekdays?.length ? weekdays : [from.getDay()]) : null;

  const out: Date[] = [];
  let d = from;
  let guard = 0;
  while (out.length < cap && dateKey(d) <= dateKey(limit) && guard++ < 3000) {
    if (repeat === 'daily' || days!.includes(d.getDay())) out.push(d);
    d = addDays(d, 1);
  }
  return out.length ? out : [from];
}

/** Cuántos bloques se van a crear, para avisarlo antes. */
export const countSeries = (from: Date, repeat: RepeatMode, until: string | null, weekdays: number[] | null = null) =>
  expandSeries(from, repeat, until, weekdays).length;
