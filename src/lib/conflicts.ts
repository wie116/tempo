import type { Block } from '../types';
import { SLOT_MIN, dateKey, minutesOf, snap } from './time';

export interface Conflict {
  date: Date;
  /** Bloques existentes que se pisan con el horario propuesto ese día. */
  withTitles: string[];
}

/**
 * Para cada fecha candidata, busca si ya hay algo agendado que se superponga
 * con el horario propuesto. No mueve ni empuja nada: solo avisa.
 */
export function findConflicts(
  dates: Date[],
  startMin: number,
  durationMin: number,
  existing: Block[],
  /** Ids a ignorar (por ejemplo, los bloques de la misma serie si se está reprogramando). */
  ignoreIds: Set<string> = new Set()
): Conflict[] {
  const end = startMin + durationMin;
  const byDay = new Map<string, Block[]>();
  for (const b of existing) {
    if (ignoreIds.has(b.id)) continue;
    const key = b.startsAt.slice(0, 10);
    const list = byDay.get(key);
    if (list) list.push(b);
    else byDay.set(key, [b]);
  }

  const conflicts: Conflict[] = [];
  for (const d of dates) {
    const key = dateKey(d);
    const dayBlocks = byDay.get(key) ?? [];
    const hits = dayBlocks.filter((b) => {
      const bs = minutesOf(b.startsAt);
      return bs < end && bs + b.durationMin > startMin;
    });
    if (hits.length) conflicts.push({ date: d, withTitles: hits.map((b) => b.title) });
  }
  return conflicts;
}

/** Busca el hueco más cercano sin alterar los bloques existentes. Prioriza
 * avanzar en el día y, si no entra, prueba hacia atrás. */
export function findAvailableStart(
  date: Date,
  desiredStart: number,
  durationMin: number,
  existing: Block[],
  dayStartMin = 0,
  dayEndMin = 24 * 60
): number | null {
  const key = dateKey(date);
  const occupied = existing
    .filter((block) => block.startsAt.slice(0, 10) === key)
    .map((block) => ({ start: minutesOf(block.startsAt), end: minutesOf(block.startsAt) + block.durationMin }));
  const maxStart = dayEndMin - durationMin;
  const fits = (start: number) =>
    start >= dayStartMin && start <= maxStart &&
    occupied.every((slot) => start + durationMin <= slot.start || start >= slot.end);
  const wanted = snap(Math.max(dayStartMin, Math.min(desiredStart, maxStart)));
  if (fits(wanted)) return wanted;
  for (let start = wanted + SLOT_MIN; start <= maxStart; start += SLOT_MIN) if (fits(start)) return start;
  for (let start = wanted - SLOT_MIN; start >= dayStartMin; start -= SLOT_MIN) if (fits(start)) return start;
  return null;
}
