import { subDays } from 'date-fns';
import type { Block } from '../types';
import { dateKey, minutesOf } from './time';

export interface Stats {
  todayPlanned: number;
  todayDone: number;
  todayPlannedMin: number;
  todayDoneMin: number;
  /** Bloques que terminaron y siguen sin cerrar. */
  openPast: number;
  /** Hora habitual de arranque, en minutos desde medianoche. null si no hay datos. */
  typicalStartMin: number | null;
  /** Duración mediana de un bloque cerrado. */
  typicalBlockMin: number | null;
  /** Días seguidos con al menos un bloque cerrado. */
  streak: number;
  /** Cumplimiento de los últimos 7 días, 0–1. null si no planificaste nada. */
  weekRate: number | null;
  /** Grupos con más bloques sin cerrar, para detectar dónde se te cae el plan. */
  weakSpots: { title: string; missed: number }[];
  activeDays: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function computeStats(blocks: Record<string, Block>, now = new Date()): Stats {
  const all = Object.values(blocks).filter((b) => b.kind !== 'break');
  const todayKey = dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const today = all.filter((b) => b.startsAt.slice(0, 10) === todayKey);
  const todayDone = today.filter((b) => b.status === 'done');

  const openPast = today.filter(
    (b) => b.status === 'planned' && minutesOf(b.startsAt) + b.durationMin <= nowMin
  ).length;

  /* Arranque habitual: primer bloque cerrado de cada día con actividad */
  const byDay = new Map<string, Block[]>();
  for (const b of all) {
    const k = b.startsAt.slice(0, 10);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(b);
  }

  const firstStarts: number[] = [];
  for (const [, list] of byDay) {
    const done = list.filter((b) => b.status === 'done');
    if (!done.length) continue;
    firstStarts.push(Math.min(...done.map((b) => minutesOf(b.startsAt))));
  }

  const doneDurations = all.filter((b) => b.status === 'done').map((b) => b.durationMin);

  /* Racha: días consecutivos hacia atrás con al menos un bloque cerrado */
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const k = dateKey(subDays(now, i));
    const list = byDay.get(k) ?? [];
    const hasDone = list.some((b) => b.status === 'done');
    if (hasDone) streak++;
    else if (i > 0 || list.length > 0) break;
  }

  /* Cumplimiento de la semana */
  let planned7 = 0;
  let done7 = 0;
  for (let i = 0; i < 7; i++) {
    const k = dateKey(subDays(now, i));
    for (const b of byDay.get(k) ?? []) {
      planned7++;
      if (b.status === 'done') done7++;
    }
  }

  /* Dónde se cae el plan: títulos que quedaron sin cerrar más veces */
  const missed = new Map<string, number>();
  for (const b of all) {
    const past = b.startsAt.slice(0, 10) < todayKey;
    if (past && b.status === 'planned') missed.set(b.title, (missed.get(b.title) ?? 0) + 1);
  }

  return {
    todayPlanned: today.length,
    todayDone: todayDone.length,
    todayPlannedMin: today.reduce((n, b) => n + b.durationMin, 0),
    todayDoneMin: todayDone.reduce((n, b) => n + b.durationMin, 0),
    openPast,
    typicalStartMin: median(firstStarts),
    typicalBlockMin: median(doneDurations),
    streak,
    weekRate: planned7 ? done7 / planned7 : null,
    weakSpots: [...missed.entries()]
      .map(([title, m]) => ({ title, missed: m }))
      .sort((a, b) => b.missed - a.missed)
      .slice(0, 3),
    activeDays: byDay.size,
  };
}
