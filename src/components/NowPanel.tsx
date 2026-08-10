import { useMemo } from 'react';
import type { Block } from '../types';
import { useClock, useStore } from '../store';
import { dateKey, durationLabel, hhmm, minutesOf } from '../lib/time';
import { EMPTY_LEFTOVER, usePlannerLog } from '../lib/plannerLog';

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

const SIZE = 208;
const CX = SIZE / 2;
const R_OUT = 92;
const R_IN = 76;

export function NowPanel({ onOpenBlock }: { onOpenBlock: (id: string) => void }) {
  const open = useStore((s) => s.settings.rightPanelOpen);
  const setSettings = useStore((s) => s.updateSettings);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const dayEndHour = useStore((s) => s.settings.dayEndHour);
  const blocks = useStore((s) => s.blocks);
  const setStatus = useStore((s) => s.setStatus);
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

  const todaySkipped = useMemo(
    () => today.filter((b) => b.status === 'skipped' && b.kind !== 'break'),
    [today]
  );
  // Nunca devolver un [] literal desde el selector: crearía una referencia
  // nueva en cada render y Zustand entraría en un bucle de actualizaciones.
  const plannerDayKey = usePlannerLog((s) => s.dayKey);
  const plannerLeftover = usePlannerLog((s) => s.leftover);
  const leftover = plannerDayKey === todayKey ? plannerLeftover : EMPTY_LEFTOVER;
  const clearLeftover = usePlannerLog((s) => s.clear);

  const current: Block | undefined = today.find(
    (b) => nowMin >= minutesOf(b.startsAt) && nowMin < minutesOf(b.startsAt) + b.durationMin
  );
  const next = today.find((b) => minutesOf(b.startsAt) > nowMin);

  if (!open) {
    return (
      <aside className="hidden w-12 shrink-0 flex-col items-center gap-3 border-l border-line bg-surface py-3 lg:flex">
        <button
          onClick={() => setSettings({ rightPanelOpen: true })}
          aria-label="Abrir el reloj"
          className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M9.5 3 5 8l4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="tabular font-mono text-[13px] font-bold tracking-tight" style={{ writingMode: 'vertical-rl' }}>
          {pad(d.getHours())}:{pad(d.getMinutes())}
        </span>
        {current && (
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: current.kind === 'break' ? 'var(--muted)' : current.color }} />
        )}
      </aside>
    );
  }

  const start = current ? minutesOf(current.startsAt) : 0;
  const endSec = current ? (start + current.durationMin) * 60 : 0;
  const remaining = current ? Math.max(0, endSec - nowSec) : 0;
  const blockProgress = current ? 1 - remaining / (current.durationMin * 60) : 0;
  const isBreak = current?.kind === 'break';
  const ring = isBreak ? 'var(--muted)' : current ? current.color : 'var(--border)';

  /* Anillo exterior: la jornada entera. Interior: el bloque en curso. */
  const dayStartMin = dayStartHour * 60;
  const dayTotal = Math.max(1, dayEndHour * 60 - dayStartMin);
  const dayProgress = Math.min(1, Math.max(0, (nowMin - dayStartMin) / dayTotal));
  const C_OUT = 2 * Math.PI * R_OUT;
  const C_IN = 2 * Math.PI * R_IN;

  const hours = Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, i) => dayStartHour + i);

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-line bg-surface lg:flex">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3.5 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Ahora</h2>
        <button
          onClick={() => setSettings({ rightPanelOpen: false })}
          aria-label="Plegar el reloj"
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M6.5 3 11 8l-4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
          <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
            {/* Marcas: una por hora de tu jornada */}
            {hours.map((h) => {
              const frac = (h * 60 - dayStartMin) / dayTotal;
              const a = frac * 2 * Math.PI;
              const passed = h * 60 <= nowMin;
              const r1 = R_OUT + 6;
              const r2 = R_OUT + (h % 3 === 0 ? 12 : 9);
              return (
                <line
                  key={h}
                  x1={CX + Math.cos(a) * r1} y1={CX + Math.sin(a) * r1}
                  x2={CX + Math.cos(a) * r2} y2={CX + Math.sin(a) * r2}
                  stroke={passed ? 'var(--muted)' : 'var(--grid-line-strong)'}
                  strokeWidth={h % 3 === 0 ? 1.8 : 1}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Anillo exterior fino: cuánto llevás de la jornada */}
            <circle cx={CX} cy={CX} r={R_OUT} fill="none" stroke="var(--grid-line-strong)" strokeWidth="2" />
            <circle
              cx={CX} cy={CX} r={R_OUT} fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"
              strokeDasharray={C_OUT} strokeDashoffset={C_OUT * (1 - dayProgress)}
            />

            {/* Anillo interior grueso: el bloque en curso, vaciándose */}
            <circle cx={CX} cy={CX} r={R_IN} fill="none" stroke="var(--grid-line)" strokeWidth="9" />
            {current && (
              <circle
                cx={CX} cy={CX} r={R_IN} fill="none" stroke={ring} strokeWidth="9" strokeLinecap="round"
                strokeDasharray={C_IN} strokeDashoffset={C_IN * blockProgress}
                style={{ transition: 'stroke-dashoffset 900ms linear' }}
              />
            )}
          </svg>

          {/* Punto ámbar en la posición actual de la jornada */}
          <span
            className="absolute h-2.5 w-2.5 rounded-full"
            style={{
              background: 'var(--now)',
              left: CX + Math.cos(dayProgress * 2 * Math.PI - Math.PI / 2) * R_OUT - 5,
              top: CX + Math.sin(dayProgress * 2 * Math.PI - Math.PI / 2) * R_OUT - 5,
            }}
          />

          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="tabular font-mono text-[42px] font-bold leading-none tracking-tighter">
                {pad(d.getHours())}:{pad(d.getMinutes())}
              </p>
              {current ? (
                <p className="tabular mt-1.5 font-mono text-[14px] font-semibold" style={{ color: ring }}>
                  −{pad(remaining / 60)}:{pad(remaining % 60)}
                </p>
              ) : (
                <p className="tabular mt-1.5 font-mono text-[13px] text-muted">:{pad(d.getSeconds())}</p>
              )}
            </div>
          </div>
        </div>

        {current ? (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
              {isBreak ? 'En pausa' : 'En curso'}
            </p>
            <button
              onClick={() => onOpenBlock(current.id)}
              className="mt-1 block w-full text-left text-[19px] font-semibold leading-snug tracking-tight"
            >
              {current.title}
            </button>
            <p className="tabular mt-1 font-mono text-[12.5px] text-muted">
              {hhmm(start)}–{hhmm(start + current.durationMin)} · {durationLabel(current.durationMin)}
            </p>

            {current.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-[13px] leading-relaxed">
                {current.notes}
              </p>
            )}

            {current.kind !== 'break' && (
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={() => setStatus(current.id, current.status === 'done' ? 'planned' : 'done')}
                  className="flex-1 rounded-lg py-2.5 text-[14px] font-semibold"
                  style={
                    current.status === 'done'
                      ? { border: '1px solid var(--border)', color: 'var(--muted)' }
                      : { background: 'var(--accent)', color: 'var(--accent-fg)' }
                  }
                >
                  {current.status === 'done' ? 'Hecho ✓' : 'Completar'}
                </button>
                <button
                  onClick={() => setStatus(current.id, current.status === 'skipped' ? 'planned' : 'skipped')}
                  title="No lo estoy haciendo: queda como omitido y la tarea vuelve a pendientes"
                  className="rounded-lg border border-line px-3 py-2.5 text-[13px] font-medium"
                  style={current.status === 'skipped' ? { borderColor: 'var(--muted)', color: 'var(--text)' } : { color: 'var(--muted)' }}
                >
                  {current.status === 'skipped' ? 'Omitido' : 'Saltear'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Sin bloque</p>
            <p className="mt-1 text-[15px] leading-snug text-muted">
              {today.length === 0 ? 'El día está sin planificar.' : 'Estás en un hueco libre.'}
            </p>
          </div>
        )}

        {(leftover.length > 0 || todaySkipped.length > 0) && (
          <div className="mt-5 border-t border-line pt-3.5">
            {leftover.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Sin agendar hoy</p>
                  <button onClick={clearLeftover} className="text-[10.5px] text-muted hover:text-ink">
                    Ocultar
                  </button>
                </div>
                <ul className="space-y-1">
                  {leftover.map((l, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-[12px]">
                      <span className="min-w-0 flex-1 truncate">{l.title}</span>
                      <span className="tabular shrink-0 font-mono text-[10px] text-muted">
                        {durationLabel(l.durationMin)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[10.5px] leading-snug text-muted">
                  No entraron al planificar. Siguen pendientes en su grupo.
                </p>
              </div>
            )}
            {todaySkipped.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-muted">Omitidas hoy</p>
                <ul className="space-y-1">
                  {todaySkipped.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => onOpenBlock(b.id)}
                        className="block w-full truncate text-left text-[12px] text-muted hover:text-ink"
                      >
                        {b.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {next && (
          <div className="mt-5 border-t border-line pt-3.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Después</p>
            <button
              onClick={() => onOpenBlock(next.id)}
              className="mt-1 block w-full truncate text-left text-[15px] font-medium"
            >
              {next.kind === 'break' ? 'Pausa' : next.title}
            </button>
            <p className="tabular mt-0.5 font-mono text-[12px] text-muted">
              {hhmm(minutesOf(next.startsAt))} · en {durationLabel(minutesOf(next.startsAt) - nowMin)}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
