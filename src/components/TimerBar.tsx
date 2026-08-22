import { useMemo } from 'react';
import type { Block } from '../types';
import { useClock, useStore } from '../store';
import { dateKey, durationLabel, hhmm, minutesOf } from '../lib/time';
import { isReadOnlyBlock } from '../lib/planning';

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

/**
 * No hay botón de play: el reloj de pared es el timer.
 * Esta barra solo lee la agenda y te dice dónde estás parado.
 */
export function TimerBar({ onOpenBlock, onOpenToday }: { onOpenBlock: (id: string) => void; onOpenToday: () => void }) {
  const blocks = useStore((s) => s.blocks);
  const now = useClock((s) => s.now);

  const d = new Date(now);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const nowSec = nowMin * 60 + d.getSeconds();
  const todayKey = dateKey(d);

  const today = useMemo(
    () =>
      Object.values(blocks)
        .filter((b) => b.startsAt.slice(0, 10) === todayKey)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [blocks, todayKey]
  );

  const current: Block | undefined = today.find(
    (b) => nowMin >= minutesOf(b.startsAt) && nowMin < minutesOf(b.startsAt) + b.durationMin
  );
  const next = today.find((b) => minutesOf(b.startsAt) > nowMin);
  const openPast = today.filter(
    (b) => !isReadOnlyBlock(b) && b.kind !== 'break' && b.status === 'planned' && minutesOf(b.startsAt) + b.durationMin <= nowMin
  );

  const endSec = current ? (minutesOf(current.startsAt) + current.durationMin) * 60 : 0;
  const remaining = current ? Math.max(0, endSec - nowSec) : 0;
  const progress = current ? 1 - remaining / (current.durationMin * 60) : 0;
  const untilNext = next ? minutesOf(next.startsAt) - nowMin : null;
  const isBreak = current?.kind === 'break';

  return (
    <div className="app-bottom-bar relative flex shrink-0 items-center gap-2 border-t border-line bg-surface px-3 py-2 sm:gap-3 sm:px-4">
      <div
        className="absolute inset-x-0 top-0 h-[2px] origin-left"
        style={{
          background: isBreak ? 'var(--accent)' : 'var(--now)',
          transform: `scaleX(${progress})`,
          transition: 'transform 900ms linear',
        }}
      />

      <div className="tabular font-mono text-[21px] font-bold leading-none tracking-tight">
        {current ? `${pad(remaining / 60)}:${pad(remaining % 60)}` : hhmm(nowMin)}
      </div>

      <div className="min-w-0 flex-1">
        {current ? (
          <button onClick={() => onOpenBlock(current.id)} className="block max-w-full truncate text-left text-[12.5px] font-medium">
            {isBreak ? 'Pausa' : current.title}
            <span className="tabular ml-2 font-mono text-[10.5px] font-normal text-muted">
              hasta {hhmm(minutesOf(current.startsAt) + current.durationMin)}
            </span>
          </button>
        ) : (
          <p className="truncate text-[12.5px] font-medium text-muted">
            {today.length === 0 ? 'Hoy no tenés nada agendado' : 'Hueco libre'}
          </p>
        )}
        <p className="truncate text-[10.5px] text-muted">
          {next
            ? `${next.kind === 'break' ? 'Pausa' : next.title} en ${durationLabel(untilNext!)}`
            : current
              ? 'Último bloque del día'
              : 'Marcá una franja en la grilla para agendar'}
        </p>
      </div>

      {openPast.length > 0 ? (
        <button
          onClick={onOpenToday}
          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold"
          style={{ background: 'var(--now)', color: '#fff' }}
        >
          {openPast.length} sin cerrar
        </button>
      ) : (
        <button
          onClick={onOpenToday}
          className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-ink"
        >
          Hoy
        </button>
      )}
    </div>
  );
}
