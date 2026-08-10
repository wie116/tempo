import { useMemo } from 'react';
import { isSameMonth, isToday } from 'date-fns';
import { useStore } from '../store';
import { dateKey, fmt, hhmm, minutesOf, monthGrid } from '../lib/time';

export function MonthView({ anchor }: { anchor: Date }) {
  const mondayFirst = useStore((s) => s.settings.weekStartsOnMonday);
  const blocks = useStore((s) => s.blocks);
  const setCursor = useStore((s) => s.setCursor);
  const setView = useStore((s) => s.setView);

  const days = useMemo(() => monthGrid(anchor, mondayFirst), [anchor, mondayFirst]);
  const byDay = useMemo(() => {
    const m: Record<string, typeof blocks[string][]> = {};
    for (const b of Object.values(blocks)) {
      const k = b.startsAt.slice(0, 10);
      (m[k] ??= []).push(b);
    }
    for (const k in m) m[k].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return m;
  }, [blocks]);

  const headers = mondayFirst
    ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    : ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-line">
        {headers.map((h) => (
          <div key={h} className="px-2 py-2 text-center text-[10px] uppercase tracking-[0.14em] text-muted">
            {h}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 auto-rows-fr overflow-y-auto">
        {days.map((d) => {
          const key = dateKey(d);
          const items = byDay[key] ?? [];
          const outside = !isSameMonth(d, anchor);
          const totalMin = items.reduce((n, b) => n + (b.kind === 'break' ? 0 : b.durationMin), 0);
          return (
            <button
              key={key}
              onClick={() => { setCursor(key); setView('day'); }}
              className={[
                'min-h-20 border-b border-r border-[var(--grid-line)] p-1.5 text-left align-top',
                'hover:bg-surface-2',
                outside ? 'opacity-40' : '',
              ].join(' ')}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={[
                    'tabular grid h-6 w-6 place-items-center rounded-full font-mono text-[12px]',
                    isToday(d) ? 'font-bold text-accent-fg' : '',
                  ].join(' ')}
                  style={{ background: isToday(d) ? 'var(--accent)' : undefined }}
                >
                  {fmt(d, 'd')}
                </span>
                {totalMin > 0 && (
                  <span className="tabular font-mono text-[9px] text-muted">
                    {Math.round((totalMin / 60) * 10) / 10}h
                  </span>
                )}
              </div>
              <ul className="space-y-0.5">
                {items.slice(0, 3).map((b) => (
                  <li key={b.id} className="flex items-center gap-1 truncate text-[10.5px]">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: b.kind === 'break' ? 'var(--muted)' : b.color }}
                    />
                    <span className="tabular shrink-0 font-mono text-[9px] text-muted">
                      {hhmm(minutesOf(b.startsAt))}
                    </span>
                    <span className="truncate">{b.title}</span>
                  </li>
                ))}
                {items.length > 3 && (
                  <li className="pl-2.5 text-[9.5px] text-muted">+{items.length - 3} más</li>
                )}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
