import { useMemo, useState } from 'react';
import type { Block } from '../types';
import { useClock, useDrag, useStore, useToasts } from '../store';
import { clockLabel, dateKey, durationLabel, minutesOf } from '../lib/time';
import { EMPTY_LEFTOVER, usePlannerLog } from '../lib/plannerLog';
import { isReadOnlyBlock } from '../lib/planning';
import { startPointerGesture } from '../lib/gesture';
import { EventIcon } from './EventIcon';
import { pick } from '../lib/i18n';
import { pastUnclosedBlocks } from '../lib/overdue';
import { holdPulls, syncNow } from '../lib/sync';
import { Btn, Modal } from './Modal';

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

const SIZE = 208;
const CX = SIZE / 2;
const R_OUT = 92;
const R_IN = 76;

export function NowPanel({
  onOpenBlock, onLocateBlock, onAutoplan, onOpenFocus, onOpenFloating, mobileOpen = false, onCloseMobile,
}: {
  onOpenBlock: (id: string) => void;
  onLocateBlock: (id: string) => void;
  onAutoplan: () => void;
  onOpenFocus: () => void;
  onOpenFloating: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const open = useStore((s) => s.settings.rightPanelOpen);
  const setSettings = useStore((s) => s.updateSettings);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const dayEndHour = useStore((s) => s.settings.dayEndHour);
  const showPendingTray = useStore((s) => s.settings.showPendingTray);
  const clockStyle = useStore((s) => s.settings.clockStyle);
  const language = useStore((s) => s.settings.language);
  const blocks = useStore((s) => s.blocks);
  const setStatus = useStore((s) => s.setStatus);
  const cleanPastUnclosed = useStore((s) => s.cleanPastUnclosed);
  const restorePastCleanup = useStore((s) => s.restorePastCleanup);
  const now = useClock((s) => s.now);
  const beginDrag = useDrag((s) => s.begin);
  const [showAllUnclosed, setShowAllUnclosed] = useState(false);
  const [showAllLeftover, setShowAllLeftover] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);

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
  const unclosed = useMemo(
    () => Object.values(blocks)
      .filter((b) =>
        b.status === 'planned' && b.kind !== 'break' && !isReadOnlyBlock(b) &&
        new Date(b.startsAt).getTime() + b.durationMin * 60_000 <= now
      )
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [blocks, now]
  );
  const previousUnclosed = useMemo(
    () => pastUnclosedBlocks(blocks, todayKey),
    [blocks, todayKey]
  );
  const previousTaskCount = useMemo(
    () => new Set(previousUnclosed.flatMap((block) => block.taskId ? [block.taskId] : [block.id])).size,
    [previousUnclosed]
  );
  const previousDayKeys = useMemo(
    () => [...new Set(previousUnclosed.map((block) => block.startsAt.slice(0, 10)))].sort(),
    [previousUnclosed]
  );
  const todayUnclosed = useMemo(
    () => unclosed.filter((block) => block.startsAt.slice(0, 10) === todayKey),
    [unclosed, todayKey]
  );
  // Nunca devolver un [] literal desde el selector: crearía una referencia
  // nueva en cada render y Zustand entraría en un bucle de actualizaciones.
  const plannerDayKey = usePlannerLog((s) => s.dayKey);
  const plannerLeftover = usePlannerLog((s) => s.leftover);
  const leftover = plannerDayKey === todayKey ? plannerLeftover : EMPTY_LEFTOVER;
  const visibleLeftover = useMemo(
    () => leftover.filter((entry) => !entry.taskId || !Object.values(blocks)
      .some((block) => block.taskId === entry.taskId && block.status === 'planned')),
    [leftover, blocks]
  );
  const clearLeftover = usePlannerLog((s) => s.clear);

  const confirmPastCleanup = () => {
    const count = previousUnclosed.length;
    const snapshot = cleanPastUnclosed(todayKey);
    setCleanupOpen(false);
    setShowAllUnclosed(false);
    if (!snapshot || count === 0) return;
    useToasts.getState().push({
      title: pick(language, `${count} ${count === 1 ? 'bloque marcado' : 'bloques marcados'} como no ${count === 1 ? 'realizado' : 'realizados'}`, `${count} ${count === 1 ? 'block' : 'blocks'} marked as not done`),
      body: pick(language, 'Las tareas únicas volvieron a Pendientes.', 'One-time tasks returned to Pending.'),
      kind: 'info',
      ttl: 8000,
      onUndo: () => {
        holdPulls();
        restorePastCleanup(snapshot);
        void syncNow();
      },
    });
  };

  const current: Block | undefined = today.find(
    (b) => nowMin >= minutesOf(b.startsAt) && nowMin < minutesOf(b.startsAt) + b.durationMin
  );
  const next = today.find((b) => minutesOf(b.startsAt) > nowMin);

  if (!open && !mobileOpen) {
    return (
      <aside className="hidden w-12 shrink-0 flex-col items-center gap-3 border-l border-line bg-surface py-3 xl:flex">
        <button
          onClick={() => setSettings({ rightPanelOpen: true })}
          aria-label={pick(language, 'Abrir el reloj', 'Open clock')}
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
        {(visibleLeftover.length > 0 || unclosed.length > 0) && <span className="h-2 w-2 rounded-full" style={{ background: 'var(--now)' }} title={pick(language, 'Hay actividad pendiente', 'Pending activity')} />}
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
    <>
    {mobileOpen && (
      <button
        className="fixed inset-0 z-40 bg-black/35 xl:hidden"
        onClick={onCloseMobile}
        aria-label={pick(language, 'Cerrar panel de actividad', 'Close activity panel')}
      />
    )}
    <aside className={mobileOpen
      ? 'fixed inset-y-0 right-0 z-50 flex w-[min(22rem,92vw)] flex-col border-l border-line bg-surface shadow-2xl xl:hidden'
      : 'hidden w-72 shrink-0 flex-col border-l border-line bg-surface xl:flex'}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3.5 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{pick(language, 'Actividad', 'Activity')}</h2>
        <button onClick={() => setSettings({ showPendingTray: !showPendingTray })} aria-pressed={showPendingTray}
          className="ml-auto flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10.5px] font-medium"
          style={{ borderColor: visibleLeftover.length ? 'var(--now)' : 'var(--border)', color: visibleLeftover.length ? 'var(--now)' : 'var(--muted)', background: showPendingTray ? 'var(--surface-2)' : undefined }}>
          {pick(language, 'Pendientes', 'Pending')} {visibleLeftover.length > 0 && <span className="rounded-full px-1.5 font-mono" style={{ background: 'color-mix(in oklab, var(--now) 16%, transparent)' }}>{visibleLeftover.length}</span>}
        </button>
        <button
          onClick={() => mobileOpen ? onCloseMobile?.() : setSettings({ rightPanelOpen: false })}
          aria-label={mobileOpen ? pick(language, 'Cerrar actividad', 'Close activity') : pick(language, 'Plegar el reloj', 'Collapse clock')}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M6.5 3 11 8l-4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex rounded-lg bg-surface-2 p-0.5" role="tablist" aria-label={pick(language, 'Estilo del reloj', 'Clock style')}>
          {([
            ['rings', pick(language, 'Anillos', 'Rings')], ['focus', pick(language, 'Enfoque', 'Focus')], ['stats', 'Digital'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={clockStyle === id}
              onClick={() => setSettings({ clockStyle: id })}
              className="flex-1 rounded-md px-1.5 py-1.5 text-[10.5px] font-medium transition-colors"
              style={clockStyle === id
                ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 2px rgb(0 0 0 / .08)' }
                : { color: 'var(--muted)' }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button onClick={onOpenFocus} className="rounded-lg border border-line px-2 py-2 text-[11.5px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink">{pick(language, 'Modo Enfoque', 'Focus mode')}</button>
          <button onClick={onOpenFloating} title={pick(language, 'Abrir una ventana siempre visible', 'Open an always-on-top window')} className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-2 text-[11.5px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="2.5" y="3" width="11" height="9.5" rx="1.8" stroke="currentColor" strokeWidth="1.3" />
              <path d="M8.5 6h3v3M11.5 6 8 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {pick(language, 'Flotante', 'Floating')}
          </button>
        </div>

        {clockStyle === 'rings' && <>
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
              <p className="tabular flex items-start justify-center font-mono font-bold leading-none tracking-tighter">
                <span className="text-[42px]">{pad(d.getHours())}:{pad(d.getMinutes())}</span>
                <span className="mt-0.5 text-[12px] text-muted">:{pad(d.getSeconds())}</span>
              </p>
              {current ? (
                <>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted">{pick(language, 'Restan', 'Remaining')}</p>
                  <p className="tabular font-mono text-[14px] font-semibold" style={{ color: ring }}>
                    {pad(remaining / 60)}:{pad(remaining % 60)}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted">{pick(language, 'Hora actual', 'Current time')} · :{pad(d.getSeconds())}</p>
              )}
            </div>
          </div>
        </div>
        </>}

        {clockStyle === 'focus' && (
          <div
            className="mx-auto flex overflow-hidden border-y border-line px-1 py-4"
            style={{ width: SIZE, height: SIZE }}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{pick(language, 'Ahora', 'Now')}</p>
              <p
                className="tabular mt-1 whitespace-nowrap text-[39px] font-semibold leading-none tracking-[-0.035em]"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {pad(d.getHours())}:{pad(d.getMinutes())}<span className="ml-1 text-[14px] font-normal text-muted">:{pad(d.getSeconds())}</span>
              </p>

              <p className="mt-3 truncate text-[12px] font-medium text-muted">
                {current ? (isBreak ? pick(language, 'Pausa', 'Break') : current.title) : pick(language, 'Sin tarea en curso', 'No task in progress')}
              </p>

              <div className="mt-auto">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-muted">{pick(language, 'Restante', 'Remaining')}</p>
                  <p className="tabular font-mono text-[20px] font-semibold leading-none" style={{ color: current ? ring : 'var(--muted)' }}>
                    {current ? `${pad(remaining / 60)}:${pad(remaining % 60)}` : '—:—'}
                  </p>
                </div>
                <div className="relative mt-3 h-px bg-[var(--grid-line-strong)]">
                  <div className="absolute inset-y-0 left-0 h-[3px] -translate-y-px transition-[width] duration-700" style={{ width: `${blockProgress * 100}%`, background: ring }} />
                  <span className="absolute -top-[3px] h-[7px] w-[7px] -translate-x-1/2 rounded-full transition-[left] duration-700" style={{ left: `${blockProgress * 100}%`, background: current ? ring : 'var(--border)' }} />
                </div>
                <div className="mt-2 flex justify-between text-[9.5px] text-muted">
                  <span>{current ? clockLabel(start) : pick(language, 'Inicio', 'Start')}</span>
                  <span>{current ? clockLabel(start + current.durationMin) : pick(language, 'Fin', 'End')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {clockStyle === 'stats' && (
          <div
            className="mx-auto overflow-hidden rounded-2xl border border-line bg-surface-2 p-4 shadow-inner"
            style={{ width: SIZE, height: SIZE }}
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              <span>{current ? pick(language, 'En curso', 'In progress') : pick(language, 'Sin bloque', 'No block')}</span>
            </div>
            <p className="tabular mt-2 whitespace-nowrap font-mono text-[35px] font-bold leading-none tracking-[-0.07em] text-ink">
              {pad(d.getHours())}:{pad(d.getMinutes())}<span className="ml-1 text-[17px] font-medium text-muted">:{pad(d.getSeconds())}</span>
            </p>
            <div className="mt-4 border-t border-line pt-3 font-mono">
              <p className="truncate text-[10px] uppercase tracking-[0.13em] text-muted">{current ? (isBreak ? pick(language, 'Pausa', 'Break') : current.title) : pick(language, 'Esperando próxima tarea', 'Waiting for the next task')}</p>
              <div className="mt-1 flex items-end justify-between gap-2">
                <span className="text-[9px] uppercase text-muted">{pick(language, 'Restan', 'Remaining')}</span>
                <span className="tabular text-[25px] font-bold leading-none" style={{ color: current ? 'var(--accent)' : 'var(--muted)' }}>
                  {current ? `${pad(remaining / 60)}:${pad(remaining % 60)}` : '--:--'}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-12 gap-1" aria-label={`${Math.round(blockProgress * 100)}% completado`}>
              {Array.from({ length: 12 }, (_, i) => {
                const active = i < Math.round(blockProgress * 12);
                return <span key={i} className="h-3 rounded-[2px] transition-colors" style={{ background: active ? 'var(--accent)' : 'var(--grid-line-strong)', boxShadow: active ? '0 0 5px color-mix(in oklab, var(--accent) 40%, transparent)' : undefined }} />;
              })}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[8.5px] uppercase tracking-wider text-muted"><span>{pick(language, 'Inicio', 'Start')}</span><span>{Math.round(blockProgress * 100)}%</span><span>{pick(language, 'Fin', 'End')}</span></div>
          </div>
        )}

        {current ? (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
              {isBreak ? pick(language, 'En pausa', 'On break') : pick(language, 'En curso', 'In progress')}
            </p>
            <button
              onClick={() => onOpenBlock(current.id)}
              className="mt-1 block w-full text-left text-[19px] font-semibold leading-snug tracking-tight"
            >
              {current.icon && <EventIcon value={current.icon} size={18} className="mr-1 inline-block align-[-3px]" />}{current.title}
            </button>
            <p className="tabular mt-1 font-mono text-[12.5px] text-muted">
              {clockLabel(start)}–{clockLabel(start + current.durationMin)} · {durationLabel(current.durationMin)}
            </p>

            {current.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-[13px] leading-relaxed">
                {current.notes}
              </p>
            )}

            {current.kind !== 'break' && !isReadOnlyBlock(current) && (
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
                  {current.status === 'done' ? pick(language, 'Hecho ✓', 'Done ✓') : pick(language, 'Completar', 'Complete')}
                </button>
                <button
                  onClick={() => setStatus(current.id, current.status === 'skipped' ? 'planned' : 'skipped')}
                  title={pick(language, 'No lo estoy haciendo: queda como omitido y la tarea vuelve a pendientes', 'Not doing it: mark it skipped and return the task to pending')}
                  className="rounded-lg border border-line px-3 py-2.5 text-[13px] font-medium"
                  style={current.status === 'skipped' ? { borderColor: 'var(--muted)', color: 'var(--text)' } : { color: 'var(--muted)' }}
                >
                  {current.status === 'skipped' ? pick(language, 'Omitido', 'Skipped') : pick(language, 'Saltear', 'Skip')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{pick(language, 'Sin bloque', 'No block')}</p>
            <p className="mt-1 text-[15px] leading-snug text-muted">
              {today.length === 0 ? pick(language, 'El día está sin planificar.', 'The day is unplanned.') : pick(language, 'Estás en un hueco libre.', 'You are in a free gap.')}
            </p>
          </div>
        )}

        {((showPendingTray && visibleLeftover.length > 0) || todaySkipped.length > 0 || unclosed.length > 0) && (
          <div className="mt-5 border-t border-line pt-3.5">
            {previousUnclosed.length > 0 && (
              <div className="mb-4 rounded-xl border p-3" style={{ borderColor: 'color-mix(in oklab, var(--now) 45%, var(--border))' }}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--now)' }}>
                      {pick(language, 'Días anteriores sin cerrar', 'Previous days left unclosed')}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-muted">
                      {previousUnclosed.length} {pick(language, previousUnclosed.length === 1 ? 'bloque' : 'bloques', previousUnclosed.length === 1 ? 'block' : 'blocks')} · {previousTaskCount} {pick(language, previousTaskCount === 1 ? 'tarea' : 'tareas', previousTaskCount === 1 ? 'task' : 'tasks')} · {previousDayKeys.length} {pick(language, previousDayKeys.length === 1 ? 'día' : 'días', previousDayKeys.length === 1 ? 'day' : 'days')}
                    </p>
                  </div>
                  <button
                    onClick={() => setCleanupOpen(true)}
                    className="shrink-0 rounded-lg border px-2 py-1 text-[10.5px] font-medium transition-colors hover:bg-surface-2"
                    style={{ borderColor: 'color-mix(in oklab, var(--now) 45%, var(--border))', color: 'var(--now)' }}
                  >
                    {pick(language, 'Limpiar', 'Clean up')}
                  </button>
                </div>
                <ul className="space-y-1">
                  {(showAllUnclosed ? previousUnclosed : previousUnclosed.slice(0, 4)).map((block) => (
                    <li key={block.id}>
                      <button onClick={() => onLocateBlock(block.id)} title={pick(language, 'Ir al bloque en la agenda', 'Go to block in schedule')} className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-[12px] hover:bg-surface-2 hover:text-ink">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: block.color }} />
                        <span className="min-w-0 flex-1 truncate">{block.title}</span>
                        <span className="font-mono text-[10px] text-muted">
                          {language === 'en'
                            ? `${block.startsAt.slice(5, 7)}/${block.startsAt.slice(8, 10)}`
                            : `${block.startsAt.slice(8, 10)}/${block.startsAt.slice(5, 7)}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {previousUnclosed.length > 4 && <button onClick={() => setShowAllUnclosed((value) => !value)} className="mt-2 text-[10.5px] font-medium text-muted hover:text-ink">
                  {showAllUnclosed ? pick(language, 'Mostrar menos', 'Show less') : `${pick(language, 'Ver', 'Show')} ${previousUnclosed.length - 4} ${pick(language, 'más', 'more')}`}
                </button>}
              </div>
            )}
            {todayUnclosed.length > 0 && (
              <div className="mb-4 rounded-xl border border-line p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {pick(language, 'Sin cerrar hoy', 'Unclosed today')}
                </p>
                <ul className="space-y-1">
                  {todayUnclosed.map((block) => (
                    <li key={block.id}>
                      <button onClick={() => onLocateBlock(block.id)} title={pick(language, 'Ir al bloque en la agenda', 'Go to block in schedule')} className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-[12px] hover:bg-surface-2 hover:text-ink">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: block.color }} />
                        <span className="min-w-0 flex-1 truncate">{block.title}</span>
                        <span className="font-mono text-[10px] text-muted">{clockLabel(minutesOf(block.startsAt) + block.durationMin)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {showPendingTray && visibleLeftover.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{pick(language, 'Pendientes por ubicar', 'Unscheduled')}</p>
                  <button onClick={clearLeftover} className="text-[10.5px] text-muted hover:text-ink">
                    {pick(language, 'Ocultar', 'Hide')}
                  </button>
                </div>
                <ul className="space-y-1">
                  {(showAllLeftover ? visibleLeftover : visibleLeftover.slice(0, 4)).map((l, i) => (
                    <li
                      key={`${l.taskId ?? l.title}-${i}`}
                      onPointerDown={(event) => {
                        if (!l.taskId || event.button !== 0) return;
                        startPointerGesture(event, {
                          onDrag: (pointer) => beginDrag({
                            mode: 'new', taskId: l.taskId!, title: l.title, color: l.color, kind: 'task',
                            grabOffsetMin: 0, durationMin: l.durationMin,
                            dayIndex: 0, startMin: 9 * 60, anchorMin: 9 * 60, anchorDayIndex: 0, moved: false,
                            pointerClientX: pointer.clientX, pointerClientY: pointer.clientY, overGrid: false,
                          }),
                        });
                      }}
                      className={`flex items-baseline gap-2 rounded-lg border border-line px-2 py-1.5 text-[12px] ${l.taskId ? 'cursor-grab' : ''}`}
                      style={{ touchAction: 'pan-y' }}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color }} />
                      <span className="min-w-0 flex-1 truncate">{l.title}</span>
                      <span className="tabular shrink-0 font-mono text-[10px] text-muted">
                        {durationLabel(l.durationMin)}
                      </span>
                    </li>
                  ))}
                </ul>
                {visibleLeftover.length > 4 && <button onClick={() => setShowAllLeftover((value) => !value)} className="mt-2 text-[10.5px] font-medium text-muted hover:text-ink">
                  {showAllLeftover ? pick(language, 'Mostrar menos', 'Show less') : `${pick(language, 'Ver', 'Show')} ${visibleLeftover.length - 4} ${pick(language, 'más', 'more')}`}
                </button>}
                <p className="mt-1 text-[10.5px] leading-snug text-muted">
                  {pick(language, 'Arrastralas desde acá a la agenda o volvé a organizar.', 'Drag them from here into the schedule or arrange again.')}
                </p>
                <button onClick={onAutoplan} className="mt-2 w-full rounded-lg border border-line px-2.5 py-2 text-[12px] font-medium text-muted hover:text-ink">
                  {pick(language, 'Reorganizar pendientes', 'Rearrange pending')}
                </button>
              </div>
            )}
            {todaySkipped.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-muted">{pick(language, 'Omitidas hoy', 'Skipped today')}</p>
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
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{pick(language, 'Después', 'Next')}</p>
            <button
              onClick={() => onOpenBlock(next.id)}
              className="mt-1 block w-full truncate text-left text-[15px] font-medium"
            >
              {next.kind === 'break' ? pick(language, 'Pausa', 'Break') : <>{next.icon && <EventIcon value={next.icon} size={14} className="mr-1 inline-block align-[-2px]" />}{next.title}</>}
            </button>
            <p className="tabular mt-0.5 font-mono text-[12px] text-muted">
              {clockLabel(minutesOf(next.startsAt))} · {pick(language, 'en', 'in')} {durationLabel(minutesOf(next.startsAt) - nowMin)}
            </p>
          </div>
        )}
      </div>
    </aside>
    <Modal
      open={cleanupOpen}
      onClose={() => setCleanupOpen(false)}
      title={pick(language,
        `¿Marcar ${previousUnclosed.length} ${previousUnclosed.length === 1 ? 'bloque' : 'bloques'} como no ${previousUnclosed.length === 1 ? 'realizado' : 'realizados'}?`,
        `Mark ${previousUnclosed.length} ${previousUnclosed.length === 1 ? 'block' : 'blocks'} as not done?`
      )}
      size="sm"
      footer={<>
        <Btn onClick={() => setCleanupOpen(false)}>{pick(language, 'Cancelar', 'Cancel')}</Btn>
        <Btn variant="primary" onClick={confirmPastCleanup}>{pick(language, 'Marcar como no realizadas', 'Mark as not done')}</Btn>
      </>}
    >
      <div className="space-y-3 p-5 text-[13px] leading-relaxed">
        <p className="text-muted">
          {pick(language,
            'Se cerrarán únicamente los bloques pendientes anteriores a hoy. Los bloques de hoy no cambian.',
            'Only pending blocks before today will be closed. Today’s blocks will not change.'
          )}
        </p>
        <div className="rounded-xl bg-surface-2 p-3 text-[12px]">
          <p>{previousUnclosed.length} {pick(language, previousUnclosed.length === 1 ? 'bloque vencido' : 'bloques vencidos', previousUnclosed.length === 1 ? 'overdue block' : 'overdue blocks')} · {previousTaskCount} {pick(language, previousTaskCount === 1 ? 'tarea' : 'tareas', previousTaskCount === 1 ? 'task' : 'tasks')}</p>
          {previousDayKeys.length > 0 && <p className="mt-1 text-muted">
            {pick(language, 'Desde', 'From')} {language === 'en' ? `${previousDayKeys[0].slice(5, 7)}/${previousDayKeys[0].slice(8, 10)}` : `${previousDayKeys[0].slice(8, 10)}/${previousDayKeys[0].slice(5, 7)}`} {pick(language, 'hasta', 'to')} {language === 'en' ? `${previousDayKeys.at(-1)!.slice(5, 7)}/${previousDayKeys.at(-1)!.slice(8, 10)}` : `${previousDayKeys.at(-1)!.slice(8, 10)}/${previousDayKeys.at(-1)!.slice(5, 7)}`}
          </p>}
          <p className="mt-2 text-muted">
            {pick(language, 'Las tareas únicas volverán a Pendientes. Las rutinas conservarán sus próximas fechas.', 'One-time tasks will return to Pending. Routines will keep their upcoming dates.')}
          </p>
        </div>
        <p className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--accent)' }}>
          <span aria-hidden>✓</span>
          <span>{pick(language, 'No se borra ninguna tarea ni registro.', 'No task or record will be deleted.')}</span>
        </p>
      </div>
    </Modal>
    </>
  );
}
