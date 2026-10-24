import type { Block, Task } from '../types';
import { isReadOnlyBlock } from './planning';

export interface PastCleanupSnapshot {
  blocks: Array<Pick<Block, 'id' | 'status' | 'closedAt'>>;
  tasks: Array<Pick<Task, 'id' | 'archived'>>;
}

export interface PastCleanupResult {
  blocks: Record<string, Block>;
  tasks: Task[];
  snapshot: PastCleanupSnapshot | null;
}

/** Bloques editables que siguen pendientes en una fecha anterior a hoy. */
export function pastUnclosedBlocks(blocks: Record<string, Block>, todayKey: string): Block[] {
  return Object.values(blocks)
    .filter((block) =>
      block.startsAt.slice(0, 10) < todayKey &&
      block.status === 'planned' &&
      block.kind !== 'break' &&
      !isReadOnlyBlock(block)
    )
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

/**
 * Cierra en un solo cambio todos los bloques pendientes de días anteriores.
 * No elimina registros: usa el estado `skipped` y devuelve una instantánea
 * mínima para que la interfaz pueda deshacer exactamente esta operación.
 */
export function cleanPastUnclosed(
  blocks: Record<string, Block>,
  tasks: Task[],
  todayKey: string,
  closedAt: number
): PastCleanupResult {
  const targets = pastUnclosedBlocks(blocks, todayKey);
  if (!targets.length) return { blocks, tasks, snapshot: null };

  const affectedTaskIds = new Set(targets.flatMap((block) => block.taskId ? [block.taskId] : []));
  const taskSnapshot = tasks
    .filter((task) => affectedTaskIds.has(task.id) && !task.recurring)
    .map(({ id, archived }) => ({ id, archived }));
  const nextBlocks = { ...blocks };

  for (const block of targets) {
    nextBlocks[block.id] = { ...block, status: 'skipped', closedAt };
  }

  return {
    blocks: nextBlocks,
    tasks: taskSnapshot.length
      ? tasks.map((task) => affectedTaskIds.has(task.id) && !task.recurring ? { ...task, archived: false } : task)
      : tasks,
    snapshot: {
      blocks: targets.map(({ id, status, closedAt: previousClosedAt }) => ({ id, status, closedAt: previousClosedAt })),
      tasks: taskSnapshot,
    },
  };
}

/** Restaura únicamente los estados modificados por una limpieza anterior. */
export function restorePastCleanup(
  blocks: Record<string, Block>,
  tasks: Task[],
  snapshot: PastCleanupSnapshot
): Pick<PastCleanupResult, 'blocks' | 'tasks'> {
  const nextBlocks = { ...blocks };
  for (const previous of snapshot.blocks) {
    const current = nextBlocks[previous.id];
    if (current) nextBlocks[previous.id] = { ...current, status: previous.status, closedAt: previous.closedAt };
  }

  const archivedByTask = new Map(snapshot.tasks.map((task) => [task.id, task.archived]));
  return {
    blocks: nextBlocks,
    tasks: snapshot.tasks.length
      ? tasks.map((task) => archivedByTask.has(task.id) ? { ...task, archived: archivedByTask.get(task.id)! } : task)
      : tasks,
  };
}
