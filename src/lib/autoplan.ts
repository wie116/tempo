import type { AutoplanConfig, Block, List, Task } from '../types';
import { SLOT_MIN, minutesOf, snap } from './time';
import { isReadOnlyBlock } from './planning';

/** Algo que se puede acomodar: viene de una tarea pendiente o de un bloque ya agendado. */
export interface PlanCandidate {
  key: string;
  taskId: string | null;
  blockId: string | null;
  title: string;
  color: string;
  durationMin: number;
}

export interface PlanItem extends PlanCandidate {
  startMin: number;
}

export interface PlanResult {
  placed: PlanItem[];
  leftover: (PlanCandidate & { reason: string })[];
  freeMin: number;
}

interface Gap {
  start: number;
  end: number;
}

/** Huecos libres, ya descontado todo lo que no se mueve. */
export function findGaps(obstacles: Block[], fromMin: number, untilMin: number): Gap[] {
  const busy = obstacles
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

/** Candidatos a partir de las tareas que todavía no están en la agenda. */
export function candidatesFromTasks(
  tasks: Task[], lists: List[], scheduledTaskIds: Set<string>, cfg: AutoplanConfig, targetDay?: string
): PlanCandidate[] {
  const listOrder = new Map(lists.map((l) => [l.id, l.order]));
  const priorityOrder: Record<Task['priority'], number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  return tasks
    .filter((t) => {
      if (t.archived) return false;
      if (!t.recurring && t.inbox) return false;
      if (!t.recurring && targetDay && t.plannedDate && t.plannedDate > targetDay) return false;
      if (cfg.listIds && !cfg.listIds.includes(t.listId)) return false;
      if (!t.recurring && scheduledTaskIds.has(t.id)) return false;
      if (t.recurring && !cfg.includeRecurring) return false;
      return true;
    })
    .sort((a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') ||
      (listOrder.get(a.listId) ?? 0) - (listOrder.get(b.listId) ?? 0) ||
      a.order - b.order
    )
    .map((t) => ({
      key: t.id,
      taskId: t.id,
      blockId: null,
      title: t.title,
      color: t.color ?? lists.find((l) => l.id === t.listId)?.color ?? '#2F6F5E',
      durationMin: Math.max(SLOT_MIN, snap(t.estimatedMin ?? cfg.defaultMin)),
    }));
}

/**
 * Candidatos a partir de los bloques que ya están en el día.
 * Fijos: las pausas, lo completado y lo que clavaste con el candadito.
 * Todo lo demás que siga pendiente se mueve,
 * incluso si su horario ya pasó — justamente eso es lo que hay que reacomodar.
 */
export function candidatesFromDay(dayBlocks: Block[], _fromMin: number): {
  candidates: PlanCandidate[];
  obstacles: Block[];
} {
  const candidates: PlanCandidate[] = [];
  const obstacles: Block[] = [];

  for (const b of [...dayBlocks].sort((a, c) => a.startsAt.localeCompare(c.startsAt))) {
    const movable = b.kind !== 'break' && b.status === 'planned' && !b.pinned && !isReadOnlyBlock(b);
    if (movable) {
      candidates.push({
        key: b.id, taskId: b.taskId, blockId: b.id,
        title: b.title, color: b.color, durationMin: b.durationMin,
      });
    } else {
      obstacles.push(b);
    }
  }
  return { candidates, obstacles };
}

/** Acomoda los candidatos en los huecos. Nunca mueve un obstáculo. */
export function autoplan(
  candidates: PlanCandidate[],
  obstacles: Block[],
  cfg: AutoplanConfig,
  fromMin: number,
  seed = Date.now()
): PlanResult {
  let pool = [...candidates];

  switch (cfg.order) {
    case 'random': pool = shuffle(pool, seed); break;
    case 'longest': pool.sort((a, b) => b.durationMin - a.durationMin); break;
    case 'shortest': pool.sort((a, b) => a.durationMin - b.durationMin); break;
    default: break; // 'list' conserva el orden con el que llegaron
  }

  const gaps = findGaps(obstacles, fromMin, cfg.untilMin).map((g) => ({ ...g }));
  const freeMin = gaps.reduce((n, g) => n + (g.end - g.start), 0);

  const placed: PlanItem[] = [];
  const leftover: PlanResult['leftover'] = [];

  for (const c of pool) {
    const g = gaps.find((x) => x.end - x.start >= c.durationMin);
    if (!g) {
      const biggest = gaps.reduce((m, x) => Math.max(m, x.end - x.start), 0);
      leftover.push({
        ...c,
        reason: biggest === 0 ? 'No queda espacio libre' : `El hueco más grande es de ${biggest} min`,
      });
      continue;
    }
    placed.push({ ...c, startMin: g.start });
    g.start = snap(g.start + c.durationMin + cfg.gapMin);
    if (g.end - g.start < SLOT_MIN) g.start = g.end;
  }

  return { placed, leftover, freeMin };
}
