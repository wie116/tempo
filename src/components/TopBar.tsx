import { addDays, addMonths, parseISO } from 'date-fns';
import { useClock, useStore } from '../store';
import { SyncBadge } from './SyncBadge';
import { dateKey, fmt } from '../lib/time';
import type { ViewMode } from '../types';
import { usePlannerLog } from '../lib/plannerLog';

const VIEWS: { id: ViewMode; label: string; short: string }[] = [
  { id: 'day', label: 'Día', short: 'D' },
  { id: 'week', label: 'Semana', short: 'S' },
  { id: 'month', label: 'Mes', short: 'M' },
];

export function TopBar({
  onToggleSidebar, onOpenTasks, onOpenToday, onOpenActivity, onOpenSettings, onOpenSearch,
}: {
  onToggleSidebar: () => void;
  onOpenTasks: () => void;
  onOpenToday: () => void;
  onOpenActivity: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
}) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const cursor = useStore((s) => s.cursor);
  const setCursor = useStore((s) => s.setCursor);
  const anchor = parseISO(cursor);
  const blocks = useStore((s) => s.blocks);
  const now = useClock((s) => s.now);
  const plannerDayKey = usePlannerLog((s) => s.dayKey);
  const plannerLeftover = usePlannerLog((s) => s.leftover);
  const nowDate = new Date(now);
  const today = dateKey(nowDate);
  const hasAttention = (plannerDayKey === today && plannerLeftover.length > 0) || Object.values(blocks).some((block) =>
    block.status === 'planned' && block.kind !== 'break' &&
    new Date(block.startsAt).getTime() + block.durationMin * 60_000 <= now
  );

  const shift = (dir: -1 | 1) => {
    const next =
      view === 'day' ? addDays(anchor, dir)
      : view === 'week' ? addDays(anchor, dir * 7)
      : addMonths(anchor, dir);
    setCursor(dateKey(next));
  };

  const label =
    view === 'month' ? fmt(anchor, "LLLL yyyy")
    : view === 'day' ? fmt(anchor, "EEEE d 'de' LLLL")
    : fmt(anchor, "'Semana del' d 'de' LLLL");

  return (
    <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 border-b border-line bg-surface px-2 py-1.5 sm:gap-x-3 sm:px-3 sm:py-2">
      <div className="col-span-3 flex min-w-0 items-center gap-1.5 sm:col-span-1 sm:gap-2">
      <button
        onClick={onToggleSidebar}
        className="relative rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink xl:hidden"
        aria-label="Abrir tareas"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M3 5h14M3 10h14M3 15h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {hasAttention && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--surface)]" style={{ background: 'var(--now)' }} />}
      </button>

      {/* El punto ámbar es el mismo de la línea de "ahora" */}
      <div className="mr-1 hidden items-center gap-1.5 sm:flex">
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--now)' }} />
        <span className="font-mono text-[13px] font-bold tracking-tight">tempo</span>
      </div>

      <h1 className="min-w-0 flex-1 truncate px-1 text-[14px] font-semibold first-letter:uppercase sm:text-[15px]">{label}</h1>

      <button
        onClick={onOpenActivity}
        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink xl:hidden"
        aria-label="Abrir actividad y pendientes"
        title="Actividad y pendientes"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M5 5h10M5 10h10M5 15h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="3" cy="5" r="1" fill="currentColor" /><circle cx="3" cy="10" r="1" fill="currentColor" /><circle cx="3" cy="15" r="1" fill="currentColor" />
        </svg>
      </button>

      <SyncBadge />

      <button onClick={onOpenSearch} className="hidden items-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[11.5px] text-muted hover:text-ink lg:flex" title="Buscar o ejecutar · Ctrl+K">
        Buscar <kbd className="rounded bg-surface-2 px-1 font-mono text-[9px]">Ctrl K</kbd>
      </button>

      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-muted transition-colors hover:border-[var(--accent)] hover:bg-surface-2 hover:text-ink"
        aria-label="Ajustes"
        title="Ajustes"
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="hidden text-[12px] font-medium lg:inline">Ajustes</span>
      </button>
      </div>

      <div className="col-start-2 row-start-2 flex items-center rounded-xl bg-surface-2 p-0.5 sm:row-start-1">
        <button onClick={() => shift(-1)} className="rounded-lg px-2 py-1.5 text-[15px] leading-none text-muted hover:text-ink" aria-label="Anterior">‹</button>
        <button
          onClick={() => setCursor(dateKey(new Date()))}
          title="Ir al día de hoy"
          className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold shadow-sm transition-transform hover:-translate-y-px"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          Hoy
        </button>
        <button onClick={() => shift(1)} className="rounded-lg px-2 py-1.5 text-[15px] leading-none text-muted hover:text-ink" aria-label="Siguiente">›</button>
      </div>

      <div className="col-start-3 row-start-2 flex items-center justify-self-end gap-2 sm:row-start-1">
      <div className="flex rounded-lg bg-surface-2 p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            title={`Atajo: ${v.short}`}
            className="rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors sm:px-3 sm:text-[13px]"
            style={
              view === v.id
                ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 2px rgb(0 0 0 / .1)' }
                : { color: 'var(--muted)' }
            }
          >
            <span className="hidden sm:inline">{v.label}</span>
            <span className="sm:hidden">{v.short}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onOpenToday}
        title="Revisión, cierre y semana"
        className="hidden rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink md:block"
      >
        Revisar
      </button>

      <button
        onClick={onOpenTasks}
        title="Tareas y rutinas"
        className="hidden rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink xl:block"
      >
        Tareas
      </button>

      </div>
    </header>
  );
}
