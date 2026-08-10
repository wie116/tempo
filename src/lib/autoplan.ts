import type { AutoplanConfig, Block, List, Task } from '../types';
import { SLOT_MIN, minutesOf, snap } from './time';

export interface PlanItem {
  taskId: string;
  title: string;
  color: string;
  startMin: number;
  durationMin: number;
}

export interface PlanResult {
  placed: PlanItem[];
  /** Tareas que no entraron en ningún hueco. */
  leftover: { taskId: string; title: string; durationMin: number; reason: string }[];
  freeMin: number;
}

interface Gap {
  start: number;
  end: number;
}

/** Huecos libres del día, ya descontados los bloques existentes. */
export function findGaps(dayBlocks: Block[], fromMin: number, untilMin: number): Gap[] {
  const busy = dayBlocks
    .map((b) => ({ start: minutesOf(b.startsAt), end: minutesOf(b.startsAt) + b.durationMin }))
    .filter((b) => b.end > fromMin)
    .sort((a, b) => a.start - b.start);

  const gaps: Gap[] = [];
  let cursor = fromMin;
  for (const b of busy) {
    if (b.start > cursor) gaps.push({ start: cursor, end: Math.min(b.start, untilMin) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= untilMin) break;
  }
  if (cursor < untilMin) gaps.push({ start: cursor, end: untilMin });
  return gaps.filter((g) => g.end - g.start >= SLOT_MIN);
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Acomoda tareas pendientes en los huecos del día.
 * No mueve nada de lo que ya estaba: solo rellena.
 */
export function autoplan(
  tasks: Task[],
  lists: List[],
  dayBlocks: Block[],
  scheduledTaskIds: Set<string>,
  cfg: AutoplanConfig,
  fromMin: number,
  seed = Date.now()
): PlanResult {
  const listOrder = new Map(lists.map((l) => [l.id, l.order]));

  let pool = tasks.filter((t) => {
    if (t.archived) return false;
    if (cfg.listIds && !cfg.listIds.includes(t.listId)) return false;
    if (!t.recurring && scheduledTaskIds.has(t.id)) return false;
    if (t.recurring && !cfg.includeRecurring) return false;
    if (t.recurring && scheduledTaskIds.has(t.id)) return false;
    return true;
  });

  const dur = (t: Task) => Math.max(SLOT_MIN, snap(t.estimatedMin ?? cfg.defaultMin));

  switch (cfg.order) {
    case 'random':
      pool = shuffle(pool, seed);
      break;
    case 'longest':
      pool = [...pool].sort((a, b) => dur(b) - dur(a));
      break;
    case 'shortest':
      pool = [...pool].sort((a, b) => dur(a) - dur(b));
      break;
    default:
      pool = [...pool].sort(
        (a, b) => (listOrder.get(a.listId) ?? 0) - (listOrder.get(b.listId) ?? 0) || a.order - b.order
      );
  }

  const gaps = findGaps(dayBlocks, fromMin, cfg.untilMin).map((g) => ({ ...g }));
  const freeMin = gaps.reduce((n, g) => n + (g.end - g.start), 0);

  const placed: PlanItem[] = [];
  const leftover: PlanResult['leftover'] = [];

  for (const t of pool) {
    const need = dur(t);
    const list = lists.find((l) => l.id === t.listId);
    // Primer hueco donde entre, sumando el aire configurado.
    const g = gaps.find((x) => x.end - x.start >= need);
    if (!g) {
      const biggest = gaps.reduce((m, x) => Math.max(m, x.end - x.start), 0);
      leftover.push({
        taskId: t.id,
        title: t.title,
        durationMin: need,
        reason: biggest === 0 ? 'No queda espacio libre' : `El hueco más grande es de ${biggest} min`,
      });
      continue;
    }
    placed.push({
      taskId: t.id,
      title: t.title,
      color: t.color ?? list?.color ?? '#2F6F5E',
      startMin: g.start,
      durationMin: need,
    });
    g.start = snap(g.start + need + cfg.gapMin);
    if (g.end - g.start < SLOT_MIN) g.start = g.end;
  }

  return { placed, leftover, freeMin };
}
