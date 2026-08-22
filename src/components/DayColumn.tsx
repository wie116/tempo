import { useMemo } from 'react';
import { isToday } from 'date-fns';
import { useStore } from '../store';
import { dateKey } from '../lib/time';
import { BlockView } from './BlockView';
import { layoutBlockLanes } from '../lib/planning';

export function DayColumn({
  day, dayIndex, onOpenBlock,
}: { day: Date; dayIndex: number; onOpenBlock: (id: string) => void }) {
  const all = useStore((s) => s.blocks);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const dayEndHour = useStore((s) => s.settings.dayEndHour);
  const key = dateKey(day);
  const today = isToday(day);

  const blocks = useMemo(
    () =>
      Object.values(all)
        .filter((b) => b.startsAt.slice(0, 10) === key)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [all, key]
  );
  const lanes = useMemo(() => layoutBlockLanes(blocks), [blocks]);

  return (
    <div
      data-day-index={dayIndex}
      className="relative flex-1 border-r border-[var(--grid-line)] last:border-r-0"
      style={{
        background: today ? 'color-mix(in oklab, var(--accent) 3.5%, transparent)' : undefined,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 bg-surface-2/70"
        style={{ height: `${(dayStartHour / 24) * 100}%` }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-surface-2/70"
        style={{ height: `${((24 - dayEndHour) / 24) * 100}%` }}
      />
      {blocks.map((b) => (
        <BlockView
          key={b.id}
          block={b}
          dayIndex={dayIndex}
          dayStartMin={0}
          isToday={today}
          lane={lanes[b.id]?.lane ?? 0}
          laneCount={lanes[b.id]?.laneCount ?? 1}
          onOpen={onOpenBlock}
        />
      ))}
    </div>
  );
}
