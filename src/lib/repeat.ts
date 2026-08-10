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
  weekly: 78,
};

export const UNTIL_PRESETS = [
  { id: '1m', label: '1 mes', add: (d: Date) => addMonths(d, 1) },
  { id: '3m', label: '3 meses', add: (d: Date) => addMonths(d, 3) },
  { id: '1y', label: '1 año', add: (d: Date) => addYears(d, 1) },
];

/** Fechas concretas de una serie que arranca en `from`. */
export function expandSeries(from: Date, repeat: RepeatMode, until: string | null): Date[] {
  if (repeat === 'none') return [from];
  const cap = MAX_OCCURRENCES[repeat];
  const step = repeat === 'daily' ? 1 : 7;
  const limit = until ? parseISO(until) : addYears(from, 3);

  const out: Date[] = [];
  let d = from;
  while (out.length < cap && dateKey(d) <= dateKey(limit)) {
    out.push(d);
    d = addDays(d, step);
  }
  return out.length ? out : [from];
}

/** Cuántos bloques se van a crear, para avisarlo antes. */
export const countSeries = (from: Date, repeat: RepeatMode, until: string | null) =>
  expandSeries(from, repeat, until).length;
