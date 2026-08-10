import type { Block } from '../types';
import { dateKey, minutesOf } from './time';

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
