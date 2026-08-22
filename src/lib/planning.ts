import { parseISO } from 'date-fns';
import type { Block } from '../types';
import { SLOT_MIN, isoFor, minutesOf, snap } from './time';

export interface BlockPatch {
  id: string;
  patch: Partial<Block>;
}

export const isReadOnlyBlock = (block: Block): boolean => Boolean(block.external?.readOnly);

export interface BlockLane {
  lane: number;
  laneCount: number;
}

/** Reparte visualmente eventos que se solapan, sin modificar sus horarios. */
export function layoutBlockLanes(blocks: readonly Block[]): Record<string, BlockLane> {
  const sorted = [...blocks].sort(
    (a, b) => minutesOf(a.startsAt) - minutesOf(b.startsAt) || b.durationMin - a.durationMin
  );
  const result: Record<string, BlockLane> = {};
  let cluster: Block[] = [];
  let clusterEnd = -1;

  const finishCluster = () => {
    if (!cluster.length) return;
    const laneEnds: number[] = [];
    const assigned: { block: Block; lane: number }[] = [];
    for (const block of cluster) {
      const start = minutesOf(block.startsAt);
      const lane = laneEnds.findIndex((end) => end <= start);
      const index = lane === -1 ? laneEnds.length : lane;
      laneEnds[index] = start + block.durationMin;
      assigned.push({ block, lane: index });
    }
    for (const item of assigned) result[item.block.id] = { lane: item.lane, laneCount: laneEnds.length };
    cluster = [];
  };

  for (const block of sorted) {
    const start = minutesOf(block.startsAt);
    if (cluster.length && start >= clusterEnd) finishCluster();
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, start + block.durationMin);
    if (cluster.length === 1) clusterEnd = start + block.durationMin;
  }
  finishCluster();
  return result;
}

/** Intervalos semiabiertos: tocarse en el borde no es superposición. */
export const overlaps = (aStart: number, aDuration: number, bStart: number, bDuration: number) =>
  aStart < bStart + bDuration && aStart + aDuration > bStart;

/** Al soltar sobre un bloque, su mitad funciona como divisor natural. */
export function insertionAroundTarget(
  pointerMin: number,
  targetStart: number,
  targetDuration: number,
  movingDuration: number
): { startMin: number; position: 'before' | 'after' } {
  const position = pointerMin < targetStart + targetDuration / 2 ? 'before' : 'after';
  return {
    position,
    startMin: position === 'before' ? targetStart - movingDuration : targetStart + targetDuration,
  };
}

/** Única frontera de escritura para la forma de un bloque. */
export function normalizeBlock(block: Block): Block {
  return {
    ...block,
    pinned: Boolean(block.pinned),
    seriesId: block.seriesId ?? null,
    source: block.source ?? 'tempo',
    external: block.external ?? null,
    syncStatus: block.syncStatus ?? 'local',
    icon: block.icon ?? null,
    repeat: block.repeat ?? 'none',
    repeatUntil: block.repeatUntil ?? null,
    repeatWeekdays: block.repeatWeekdays ?? null,
    startsAt: isoFor(parseISO(block.startsAt), snap(minutesOf(block.startsAt))),
    durationMin: Math.max(SLOT_MIN, snap(block.durationMin)),
  };
}

/**
 * Empaqueta un día sin superponer bloques. Los fijos mandan; después mandan
 * los ids prioritarios en el orden recibido; el resto se acomoda alrededor.
 */
export function packDay(
  blocks: Record<string, Block>,
  dayKey: string,
  priorityIds: readonly string[],
  dayEndMin: number
): Record<string, Block> {
  const sameDay = Object.values(blocks).filter((b) => b.startsAt.slice(0, 10) === dayKey);
  if (sameDay.length < 2) return blocks;

  const out = { ...blocks };
  const taken: { start: number; end: number }[] = [];
  const priority = new Set(priorityIds);

  const availableStart = (desired: number, duration: number): number => {
    const maxStart = Math.max(0, dayEndMin - duration);
    const preferred = snap(Math.min(desired, maxStart));
    const fits = (start: number) =>
      start >= 0 && start <= maxStart &&
      taken.every((slot) => !overlaps(start, duration, slot.start, slot.end - slot.start));
    if (fits(preferred)) return preferred;

    // Primero conservamos la expectativa de "empujar hacia abajo".
    let forward = preferred;
    let guard = 0;
    while (forward <= maxStart && guard++ < 300) {
      const hit = [...taken]
        .sort((a, b) => a.start - b.start)
        .find((slot) => overlaps(forward, duration, slot.start, slot.end - slot.start));
      if (!hit) return forward;
      forward = snap(hit.end);
    }

    // Si el final del día no alcanza, usamos el hueco anterior más cercano.
    const occupied = [...taken].sort((a, b) => a.start - b.start);
    const gaps: { start: number; end: number }[] = [];
    let cursor = 0;
    for (const slot of occupied) {
      if (slot.start > cursor) gaps.push({ start: cursor, end: slot.start });
      cursor = Math.max(cursor, slot.end);
    }
    if (cursor < dayEndMin) gaps.push({ start: cursor, end: dayEndMin });
    const backward = gaps
      .filter((gap) => gap.end - gap.start >= duration && gap.start <= preferred)
      .map((gap) => Math.max(gap.start, Math.min(preferred, gap.end - duration)))
      .filter(fits)
      .sort((a, b) => Math.abs(preferred - a) - Math.abs(preferred - b))[0];
    return backward ?? preferred;
  };

  const place = (block: Block, immovable: boolean): number => {
    let start = minutesOf(block.startsAt);
    if (!immovable) start = availableStart(start, block.durationMin);
    taken.push({ start, end: start + block.durationMin });
    return start;
  };

  const commit = (block: Block, immovable: boolean) => {
    const start = place(block, immovable);
    if (start !== minutesOf(block.startsAt)) {
      out[block.id] = { ...block, startsAt: isoFor(parseISO(block.startsAt), start) };
    }
  };

  sameDay.filter((b) => b.pinned || isReadOnlyBlock(b)).forEach((b) => commit(b, true));
  for (const id of priorityIds) {
    const block = sameDay.find((b) => b.id === id);
    if (block && !block.pinned && !isReadOnlyBlock(block)) commit(block, false);
  }
  sameDay
    .filter((b) => !b.pinned && !isReadOnlyBlock(b) && !priority.has(b.id))
    .sort((a, b) => minutesOf(a.startsAt) - minutesOf(b.startsAt) || a.id.localeCompare(b.id))
    .forEach((b) => commit(b, false));

  return out;
}

/** Aplica una operación múltiple de manera atómica y empaqueta cada día tocado. */
export function applyBlockPatches(
  blocks: Record<string, Block>,
  patches: readonly BlockPatch[],
  dayEndMin: number
): Record<string, Block> {
  let out = { ...blocks };
  const prioritiesByDay = new Map<string, string[]>();

  for (const { id, patch } of patches) {
    const previous = out[id];
    if (!previous || previous.pinned || isReadOnlyBlock(previous)) continue;
    const next = normalizeBlock({ ...previous, ...patch });
    out[id] = next;
    const dayKey = next.startsAt.slice(0, 10);
    const ids = prioritiesByDay.get(dayKey) ?? [];
    ids.push(id);
    prioritiesByDay.set(dayKey, ids);
  }

  for (const [dayKey, ids] of prioritiesByDay) out = packDay(out, dayKey, ids, dayEndMin);
  return out;
}
