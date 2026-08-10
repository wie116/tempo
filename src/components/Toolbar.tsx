import { useStore, useUI } from '../store';
import type { Tool } from '../store';
import { ZOOM_STEPS, durationLabel, hhmm, zoomStep } from '../lib/time';

const TOOLS: { id: Tool; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: 'select', label: 'Seleccionar', hint: 'Arrastrá para marcar una franja · V',
    icon: <path d="M4 3l8.5 5.2-3.7.8-1.9 3.6L4 3Z" fill="currentColor" />,
  },
  {
    id: 'box', label: 'Caja', hint: 'Seleccioná varios bloques a la vez · C',
    icon: <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.4 2" />,
  },
];

export function Toolbar({ onAutoplan }: { onAutoplan: (preset: 'wand' | 'dice') => void }) {
  const tool = useUI((s) => s.tool);
  const setTool = useUI((s) => s.setTool);
  const range = useUI((s) => s.range);
  const multi = useUI((s) => s.multi);
  const slotPx = useStore((s) => s.settings.slotPx);
  const setZoom = useStore((s) => s.setZoom);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface-2/40 px-2.5 py-2">
      <div className="flex rounded-lg border border-line bg-surface p-0.5">
        {TOOLS.map((t) => (
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

      <span className="mx-0.5 h-6 w-px bg-[var(--border)]" />

      <button
        onClick={() => onAutoplan('wand')}
        title="Varita: acomoda las pendientes desde ahora, en orden"
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 13 11 5M9.5 3.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12.5 9.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2L11 11.2l1.2-.5.5-1.2Z" fill="currentColor" />
        </svg>
        Varita
      </button>

      <button
        onClick={() => onAutoplan('dice')}
        title="Dado: mismo motor, pero mezcla el orden"
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="5.8" cy="5.8" r="1.05" fill="currentColor" />
          <circle cx="10.2" cy="10.2" r="1.05" fill="currentColor" />
          <circle cx="8" cy="8" r="1.05" fill="currentColor" />
        </svg>
        Dado
      </button>

      <div className="ml-auto flex items-center gap-2">
        {range && (
          <span className="tabular hidden font-mono text-[12px] text-muted sm:inline">
            {hhmm(range.startMin)}–{hhmm(range.startMin + range.durationMin)} · {durationLabel(range.durationMin)}
          </span>
        )}
        {multi.length > 0 && (
          <span className="font-mono text-[12px] text-muted">{multi.length} seleccionados</span>
        )}

        <div className="flex items-center rounded-lg border border-line bg-surface">
          <button
            onClick={() => setZoom(zoomStep(slotPx, -1))}
            disabled={slotPx <= ZOOM_STEPS[0]}
            aria-label="Alejar"
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
            aria-label="Acercar"
            className="px-2.5 py-1.5 text-[15px] leading-none text-muted hover:text-ink disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
