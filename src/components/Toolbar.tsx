import { useDrag, useStore, useUI } from '../store';
import type { Tool } from '../store';
import { ZOOM_STEPS, clockLabel, durationLabel, zoomStep } from '../lib/time';
import { redo, undo, useHistory } from '../lib/history';
import { pick } from '../lib/i18n';
import type { AppLanguage } from '../types';

const toolsFor = (language: AppLanguage): { id: Tool; label: string; hint: string; icon: React.ReactNode }[] => [
  {
    id: 'select', label: pick(language, 'Seleccionar', 'Select'), hint: pick(language, 'Arrastrá para marcar una franja · V', 'Drag to select a time range · V'),
    icon: <path d="M4 3l8.5 5.2-3.7.8-1.9 3.6L4 3Z" fill="currentColor" />,
  },
  {
    id: 'box', label: pick(language, 'Caja', 'Box'), hint: pick(language, 'Seleccioná varios bloques a la vez · C', 'Select several blocks at once · C'),
    icon: <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.4 2" />,
  },
];

export function Toolbar({ onAutoplan }: { onAutoplan: () => void }) {
  const tool = useUI((s) => s.tool);
  const setTool = useUI((s) => s.setTool);
  const range = useUI((s) => s.range);
  const multi = useUI((s) => s.multi);
  const slotPx = useStore((s) => s.settings.slotPx);
  const cursor = useStore((s) => s.cursor);
  const blocks = useStore((s) => s.blocks);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const dayEndHour = useStore((s) => s.settings.dayEndHour);
  const setZoom = useStore((s) => s.setZoom);
  const language = useStore((s) => s.settings.language);
  const tools = toolsFor(language);
  const occupied = Object.values(blocks).filter((b) => b.startsAt.slice(0, 10) === cursor && b.kind !== 'break' && b.status !== 'skipped')
    .reduce((sum, b) => sum + b.durationMin, 0);
  const capacity = Math.max(60, (dayEndHour - dayStartHour) * 60);
  const load = Math.round(occupied / capacity * 100);

  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-surface-2/40 px-2.5 py-2 sm:gap-2">
      <MobileEditLock />

      <div className="flex rounded-lg border border-line bg-surface p-0.5">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={`${t.label} — ${t.hint}`}
            aria-label={t.label}
            aria-pressed={tool === t.id}
            className="rounded-md p-2 transition-colors"
            style={
              tool === t.id
                ? { background: 'var(--accent)', color: 'var(--accent-fg)' }
                : { color: 'var(--muted)' }
            }
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>{t.icon}</svg>
          </button>
        ))}
      </div>

      <UndoRedo />

      <ChainLock />

      <span className="mx-0.5 hidden h-6 w-px shrink-0 bg-[var(--border)] sm:block" />

      <button
        onClick={onAutoplan}
        title={pick(language, 'Organizá bloques o tareas pendientes en los huecos disponibles', 'Arrange pending blocks or tasks in available gaps')}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 13 11 5M9.5 3.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2L11 11.2l1.2-.5.5-1.2Z" fill="currentColor" />
        </svg>
        {pick(language, 'Organizar', 'Arrange')}
      </button>

      <div className="hidden min-w-28 shrink-0 md:block" title={pick(language, `${occupied} minutos asignados de ${capacity}`, `${occupied} minutes scheduled out of ${capacity}`)}>
        <div className="mb-1 flex justify-between text-[10px] text-muted"><span>{pick(language, 'Carga del día', 'Day load')}</span><span className="font-mono">{load}%</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, load)}%`, background: load > 90 ? 'var(--now)' : 'var(--accent)' }} /></div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {range && (
          <span className="tabular hidden font-mono text-[12px] text-muted sm:inline">
            {clockLabel(range.startMin)}–{clockLabel(range.startMin + range.durationMin)} · {durationLabel(range.durationMin)}
          </span>
        )}
        {multi.length > 0 && (
          <span className="font-mono text-[12px] text-muted">{multi.length} {multi.length === 1 ? pick(language, 'seleccionado', 'selected') : pick(language, 'seleccionados', 'selected')}</span>
        )}

        <div
          className="flex items-center rounded-lg border border-line bg-surface"
          title={pick(language, 'Zoom de los bloques · Ctrl + rueda sobre la agenda', 'Block zoom · Ctrl + wheel over the schedule')}
        >
          <button
            onClick={() => setZoom(zoomStep(slotPx, -1))}
            disabled={slotPx <= ZOOM_STEPS[0]}
            aria-label={pick(language, 'Alejar', 'Zoom out')}
            className="px-2.5 py-1.5 text-[15px] leading-none text-muted hover:text-ink disabled:opacity-30"
          >
            −
          </button>
          <span className="tabular w-10 text-center font-mono text-[11px] text-muted">
            {slotPx >= 17 ? '10m' : slotPx >= 9 ? '30m' : '1h'}
          </span>
          <button
            onClick={() => setZoom(zoomStep(slotPx, 1))}
            disabled={slotPx >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
            aria-label={pick(language, 'Acercar', 'Zoom in')}
            className="px-2.5 py-1.5 text-[15px] leading-none text-muted hover:text-ink disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}


/** Imán: con esto activo, mover un bloque atrae a los que vienen después. */
function ChainLock() {
  const on = useStore((s) => s.settings.chainMove);
  const set = useStore((s) => s.updateSettings);
  const language = useStore((s) => s.settings.language);
  return (
    <button
      onClick={() => set({ chainMove: !on })}
      aria-pressed={on}
      title={
        on
          ? pick(language, 'Imán activo: al mover un bloque, los siguientes del día se mueven con él', 'Magnet on: moving a block also moves the ones that follow')
          : pick(language, 'Suelto: cada bloque se mueve solo', 'Independent: each block moves on its own')
      }
      className="rounded-lg border p-2 transition-colors"
      style={
        on
          ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: 'var(--accent-fg)' }
          : { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--muted)' }
      }
    >
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3.4 2.8v5.1a4.6 4.6 0 0 0 9.2 0V2.8M3.4 5.5h3M9.6 5.5h3"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.4 2.8h3v2.7h-3zM9.6 2.8h3v2.7h-3z" fill="currentColor" opacity={on ? 1 : .55} />
      </svg>
    </button>
  );
}


/** Protección táctil: sólo existe en celular y no altera el escritorio. */
function MobileEditLock() {
  const locked = useStore((s) => s.settings.mobileEditLocked);
  const updateSettings = useStore((s) => s.updateSettings);
  const clearSelection = useUI((s) => s.clearSelection);
  const endDrag = useDrag((s) => s.end);
  const language = useStore((s) => s.settings.language);

  const toggle = () => {
    const next = !locked;
    updateSettings({ mobileEditLocked: next });
    if (next) {
      endDrag();
      clearSelection();
    }
  };

  return (
    <button
      onClick={toggle}
      aria-pressed={locked}
      aria-label={locked ? pick(language, 'Agenda móvil protegida. Desbloquear edición', 'Mobile schedule protected. Unlock editing') : pick(language, 'Agenda móvil editable. Bloquear edición', 'Mobile schedule editable. Lock editing')}
      title={locked ? pick(language, 'Protegida: tocá para permitir cambios táctiles', 'Protected: tap to allow touch changes') : pick(language, 'Editable: tocá para proteger la agenda', 'Editable: tap to protect the schedule')}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-2 text-[11.5px] font-semibold transition-colors sm:hidden"
      style={locked
        ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: 'var(--accent-fg)' }
        : { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--muted)' }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="3.2" y="7" width="9.6" height="6.2" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d={locked ? 'M5.5 7V5.1a2.5 2.5 0 0 1 5 0V7' : 'M5.5 7V5.1a2.5 2.5 0 0 1 4.8-.9'}
          stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {locked ? pick(language, 'Protegida', 'Protected') : pick(language, 'Editable', 'Editable')}
    </button>
  );
}


/** Deshacer y rehacer. También responden a Ctrl+Z y Ctrl+Shift+Z. */
function UndoRedo() {
  const canUndo = useHistory((s) => s.canUndo);
  const canRedo = useHistory((s) => s.canRedo);
  const language = useStore((s) => s.settings.language);
  const cls = 'rounded-md p-2 text-muted transition-colors hover:text-ink disabled:opacity-25';

  return (
    <div className="flex rounded-lg border border-line bg-surface p-0.5">
      <button onClick={undo} disabled={!canUndo} title={pick(language, 'Deshacer · Ctrl+Z', 'Undo · Ctrl+Z')} aria-label={pick(language, 'Deshacer', 'Undo')} className={cls}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 7h6.2a3.4 3.4 0 0 1 0 6.8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.6 4.2 2.8 7l2.8 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button onClick={redo} disabled={!canRedo} title={pick(language, 'Rehacer · Ctrl+Shift+Z', 'Redo · Ctrl+Shift+Z')} aria-label={pick(language, 'Rehacer', 'Redo')} className={cls}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M13 7H6.8a3.4 3.4 0 0 0 0 6.8H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.4 4.2 13.2 7l-2.8 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
