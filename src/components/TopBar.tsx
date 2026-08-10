import { addDays, addMonths, parseISO } from 'date-fns';
import { useStore } from '../store';
import { dateKey, fmt } from '../lib/time';
import type { ViewMode } from '../types';

const VIEWS: { id: ViewMode; label: string; short: string }[] = [
  { id: 'day', label: 'Día', short: 'D' },
  { id: 'week', label: 'Semana', short: 'S' },
  { id: 'month', label: 'Mes', short: 'M' },
];

export function TopBar({
  onToggleSidebar, onOpenTasks, onOpenToday, onOpenSettings,
}: {
  onToggleSidebar: () => void;
  onOpenTasks: () => void;
  onOpenToday: () => void;
  onOpenSettings: () => void;
}) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const cursor = useStore((s) => s.cursor);
  const setCursor = useStore((s) => s.setCursor);
  const anchor = parseISO(cursor);

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
    <header className="flex shrink-0 items-center gap-1.5 border-b border-line bg-surface px-2 py-2 sm:gap-2 sm:px-3">
      <button
        onClick={onToggleSidebar}
        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
        aria-label="Abrir tareas"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M3 5h14M3 10h14M3 15h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      {/* El punto ámbar es el mismo de la línea de "ahora" */}
      <div className="mr-1 hidden items-center gap-1.5 sm:flex">
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--now)' }} />
        <span className="font-mono text-[13px] font-bold tracking-tight">tempo</span>
      </div>

      <div className="flex items-center">
        <button onClick={() => shift(-1)} className="rounded-lg px-2 py-1.5 text-[15px] leading-none text-muted hover:text-ink" aria-label="Anterior">‹</button>
        <button
          onClick={() => setCursor(dateKey(new Date()))}
          title="Ir al día de hoy"
          className="rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink"
        >
          Ir a hoy
        </button>
        <button onClick={() => shift(1)} className="rounded-lg px-2 py-1.5 text-[15px] leading-none text-muted hover:text-ink" aria-label="Siguiente">›</button>
      </div>

      <h1 className="min-w-0 flex-1 truncate px-1.5 text-[14px] font-semibold capitalize sm:text-[15px]">{label}</h1>

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
            {v.label}
          </button>
        ))}
      </div>

      <button
        onClick={onOpenToday}
        title="Resumen del día · H"
        className="hidden rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink sm:block"
      >
        Resumen
      </button>

      <button
        onClick={onOpenTasks}
        title="Tareas · L"
        className="hidden rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink lg:block"
      >
        Tareas
      </button>

      <button
        onClick={onOpenSettings}
        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label="Ajustes"
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}
