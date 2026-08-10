import { useMemo } from 'react';
import { isToday } from 'date-fns';
import { useStore } from '../store';
import { dateKey } from '../lib/time';
import { BlockView } from './BlockView';

export function DayColumn({
  day, dayIndex, onOpenBlock,
}: { day: Date; dayIndex: number; onOpenBlock: (id: string) => void }) {
  const all = useStore((s) => s.blocks);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const key = dateKey(day);
  const today = isToday(day);

  const blocks = useMemo(
    () =>
      Object.values(all)
        .filter((b) => b.startsAt.slice(0, 10) === key)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [all, key]
  );

  return (
    <div
      data-day-index={dayIndex}
      className="relative flex-1 border-r border-[var(--grid-line)] last:border-r-0"
      style={{
        background: today ? 'color-mix(in oklab, var(--accent) 3.5%, transparent)' : undefined,
      }}
    >
      {blocks.map((b) => (
        <BlockView
          key={b.id}
          block={b}
          dayIndex={dayIndex}
          dayStartMin={dayStartHour * 60}
          isToday={today}
          onOpen={onOpenBlock}
        />
      ))}
    </div>
  );
}
