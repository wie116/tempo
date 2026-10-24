import { useMemo, useState } from 'react';
import { addDays, subDays } from 'date-fns';
import type { Block, BlockStatus } from '../types';
import { useClock, useStore } from '../store';
import { computeStats } from '../lib/stats';
import { clockLabel, dateKey, durationLabel, fmt, minutesOf } from '../lib/time';
import { useHistory } from '../lib/history';
import { Btn, Modal, Tabs } from './Modal';
import { isReadOnlyBlock } from '../lib/planning';
import { pick } from '../lib/i18n';

type ReviewTab = 'today' | 'close' | 'tomorrow' | 'week' | 'activity';

export function TodayModal({
  open, onClose, onOpenBlock, onLocateBlock, onAutoplan, onPlanTomorrow,
}: {
  open: boolean;
  onClose: () => void;
  onOpenBlock: (id: string) => void;
  onLocateBlock: (id: string) => void;
  onAutoplan: () => void;
  onPlanTomorrow: () => void;
}) {
  const [tab, setTab] = useState<ReviewTab>('today');
  const blocks = useStore((s) => s.blocks);
  const tasks = useStore((s) => s.tasks);
  const setStatus = useStore((s) => s.setStatus);
  const updateBlock = useStore((s) => s.updateBlock);
  const updateTask = useStore((s) => s.updateTask);
  const removeBlock = useStore((s) => s.removeBlock);
  const unscheduleBlocks = useStore((s) => s.unscheduleBlocks);
  const entries = useHistory((s) => s.entries);
  const clearEntries = useHistory((s) => s.clearEntries);
  const now = useClock((s) => s.now);
  const language = useStore((s) => s.settings.language);
  const locale = useStore((s) => s.settings.locale);
  const timeFormat = useStore((s) => s.settings.timeFormat);

  const nowDate = new Date(now);
  const todayKey = dateKey(nowDate);
  const tomorrowKey = dateKey(addDays(nowDate, 1));
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
  const stats = useMemo(() => computeStats(blocks, nowDate), [blocks, now]);
  const today = useMemo(() => Object.values(blocks).filter((block) => block.startsAt.slice(0, 10) === todayKey).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [blocks, todayKey]);
  const unresolved = today.filter((block) => block.kind !== 'break' && !isReadOnlyBlock(block) && block.status !== 'done');
  const tomorrowBlocks = useMemo(() => Object.values(blocks).filter((block) => block.startsAt.slice(0, 10) === tomorrowKey).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [blocks, tomorrowKey]);
  const scheduledTomorrowIds = new Set(tomorrowBlocks.map((block) => block.taskId).filter(Boolean));
  const tomorrowPending = tasks.filter((task) => !task.archived && task.plannedDate === tomorrowKey && !scheduledTomorrowIds.has(task.id));

  const moveTomorrow = (id: string) => {
    const block = blocks[id];
    if (!block) return;
    updateBlock(id, { startsAt: `${tomorrowKey}T${block.startsAt.slice(11, 16)}`, status: 'planned', closedAt: null });
  };
  const archive = (id: string) => {
    const block = blocks[id];
    const task = block?.taskId ? tasks.find((item) => item.id === block.taskId) : null;
    if (task && !task.recurring) updateTask(task.id, { archived: true });
    removeBlock(id);
  };

  return <Modal open={open} onClose={onClose} size="lg" title={pick(language, 'Revisión y planificación', 'Review and planning')} subtitle={pick(language, 'Cerrá lo pendiente, prepará mañana y entendé tu semana sin salir de la agenda.', 'Close pending work, prepare tomorrow, and understand your week without leaving the schedule.')} footer={<Btn variant="primary" onClick={onClose}>{pick(language, 'Listo', 'Done')}</Btn>}>
    <Tabs active={tab} onChange={setTab} tabs={[
      { id: 'today' as const, label: pick(language, 'Hoy', 'Today') },
      { id: 'close' as const, label: `${pick(language, 'Cierre', 'Close')}${unresolved.length ? ` (${unresolved.length})` : ''}` },
      { id: 'tomorrow' as const, label: pick(language, 'Mañana', 'Tomorrow') },
      { id: 'week' as const, label: pick(language, 'Semana', 'Week') },
      { id: 'activity' as const, label: pick(language, 'Historial', 'History') },
    ]} />

    {tab === 'today' && <div className="p-5">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label={pick(language, 'Planificado', 'Planned')} value={durationLabel(stats.todayPlannedMin)} /><Metric label={pick(language, 'Completado', 'Completed')} value={durationLabel(stats.todayDoneMin)} /><Metric label={pick(language, 'Sin cerrar', 'Unclosed')} value={String(stats.openPast)} /><Metric label={pick(language, 'Omitido', 'Skipped')} value={String(stats.todaySkipped)} /></div>
      <AgendaList blocks={today} nowMin={nowMin} onOpen={(id) => { onClose(); onOpenBlock(id); }} onToggle={setStatus} />
      {today.length === 0 && <Empty text={pick(language, 'El día está vacío.', 'The day is empty.')} action={pick(language, 'Organizar el día', 'Arrange the day')} onAction={() => { onClose(); onAutoplan(); }} />}
    </div>}

    {tab === 'close' && <div className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl bg-surface-2 p-4"><div><h3 className="text-[14px] font-semibold">{pick(language, 'Cerrá el día sin perder nada', 'Close the day without losing anything')}</h3><p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted">{pick(language, 'Completá, devolvé a pendientes, pasá a mañana o archivá cada tarea única.', 'Complete, return to pending, move to tomorrow, or archive each one-time task.')}</p></div>{unresolved.length > 0 && <Btn onClick={() => unresolved.forEach((block) => moveTomorrow(block.id))}>{pick(language, 'Pasar todo a mañana', 'Move all to tomorrow')}</Btn>}</div>
      {unresolved.length === 0 ? <Empty text={pick(language, 'No quedó ninguna tarea abierta. El día está cerrado.', 'No open tasks remain. The day is closed.')} /> : <ul className="space-y-2">{unresolved.map((block) => {
        const task = block.taskId ? tasks.find((item) => item.id === block.taskId) : null;
        return <li key={block.id} className="rounded-xl border border-line p-3"><div className="flex items-start gap-3"><span className="mt-1 h-3 w-1 rounded-full" style={{ background: block.color }} /><div className="min-w-0 flex-1"><button onClick={() => { onClose(); onLocateBlock(block.id); }} className="truncate text-left text-[13px] font-semibold hover:underline">{block.title}</button><p className="font-mono text-[10.5px] text-muted">{clockLabel(minutesOf(block.startsAt))}–{clockLabel(minutesOf(block.startsAt) + block.durationMin)} · {block.status === 'skipped' ? pick(language, 'omitida', 'skipped') : pick(language, 'abierta', 'open')}</p></div></div><div className="mt-3 flex flex-wrap gap-1.5"><Btn variant="primary" onClick={() => setStatus(block.id, 'done')}>{pick(language, 'Completar', 'Complete')}</Btn><Btn onClick={() => moveTomorrow(block.id)}>{pick(language, 'Mañana', 'Tomorrow')}</Btn><Btn onClick={() => unscheduleBlocks([block.id])}>{pick(language, 'Volver a pendientes', 'Return to pending')}</Btn>{task && !task.recurring && <Btn variant="danger" onClick={() => archive(block.id)}>{pick(language, 'Archivar', 'Archive')}</Btn>}</div></li>;
      })}</ul>}
    </div>}

    {tab === 'tomorrow' && <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-[15px] font-semibold first-letter:uppercase">{fmt(addDays(nowDate, 1), language === 'en' ? 'EEEE, LLLL d' : "EEEE d 'de' LLLL")}</h3><p className="text-[11.5px] text-muted">{tomorrowBlocks.length} {pick(language, 'bloques con horario', 'scheduled blocks')} · {tomorrowPending.length} {pick(language, 'tareas por ubicar', 'tasks to schedule')}</p></div><Btn variant="primary" onClick={() => { onClose(); onPlanTomorrow(); }}>{pick(language, 'Abrir mañana y organizar', 'Open tomorrow and arrange')}</Btn></div>
      {tomorrowPending.length > 0 && <section className="mb-5 rounded-xl border border-line p-3"><h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">{pick(language, 'Pendientes por ubicar', 'Unscheduled')}</h4><ul className="grid gap-1 sm:grid-cols-2">{tomorrowPending.map((task) => <li key={task.id} className="truncate rounded-lg bg-surface-2 px-2.5 py-2 text-[12px]">{task.title}</li>)}</ul></section>}
      <AgendaList blocks={tomorrowBlocks} nowMin={-1} onOpen={(id) => { onClose(); onOpenBlock(id); }} onToggle={setStatus} />
      {!tomorrowBlocks.length && !tomorrowPending.length && <Empty text={pick(language, 'Mañana todavía está libre.', 'Tomorrow is still free.')} action={pick(language, 'Empezar a planificar', 'Start planning')} onAction={() => { onClose(); onPlanTomorrow(); }} />}
    </div>}

    {tab === 'week' && <WeeklySummary blocks={Object.values(blocks)} now={nowDate} stats={stats} />}

    {tab === 'activity' && <div className="p-5"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-[11.5px] text-muted">{pick(language, 'Cambios recientes de esta sesión. Deshacer sigue disponible en la barra.', 'Recent changes from this session. Undo remains available in the toolbar.')}</p>{entries.length > 0 && <Btn onClick={clearEntries}>{pick(language, 'Limpiar', 'Clear')}</Btn>}</div>{entries.length === 0 ? <Empty text={pick(language, 'Todavía no hay actividad reciente.', 'No recent activity yet.')} /> : <ul className="space-y-1.5">{entries.map((entry) => <li key={entry.id} className="flex gap-3 rounded-lg border border-line px-3 py-2.5"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" /><div className="min-w-0 flex-1"><button disabled={!entry.blockId} onClick={() => entry.blockId && (onClose(), onLocateBlock(entry.blockId))} className="block truncate text-left text-[12.5px] font-medium disabled:cursor-default">{entry.title}</button>{entry.detail && <p className="truncate text-[10.5px] text-muted">{entry.detail}</p>}</div><time className="shrink-0 font-mono text-[10px] text-muted">{new Date(entry.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' })}</time></li>)}</ul>}</div>}
  </Modal>;
}

function AgendaList({ blocks, nowMin, onOpen, onToggle }: { blocks: Block[]; nowMin: number; onOpen: (id: string) => void; onToggle: (id: string, status: BlockStatus) => void }) {
  const language = useStore((s) => s.settings.language);
  return <ul className="space-y-1">{blocks.map((block) => { const start = minutesOf(block.startsAt); const live = nowMin >= start && nowMin < start + block.durationMin; return <li key={block.id} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2" style={{ borderColor: live ? 'var(--now)' : 'var(--border)', opacity: block.status === 'done' ? .55 : 1 }}><span className="w-28 shrink-0 font-mono text-[11px] text-muted">{clockLabel(start)}–{clockLabel(start + block.durationMin)}</span><span className="h-4 w-[3px] rounded-full" style={{ background: block.kind === 'break' ? 'var(--muted)' : block.color }} /><button onClick={() => onOpen(block.id)} className={`min-w-0 flex-1 truncate text-left text-[12.5px] ${block.status === 'done' ? 'line-through' : ''}`}>{block.title}</button>{block.kind !== 'break' && !isReadOnlyBlock(block) && <button onClick={() => onToggle(block.id, block.status === 'done' ? 'planned' : 'done')} className="grid h-5 w-5 place-items-center rounded-full border border-line" aria-label={pick(language, 'Alternar completado', 'Toggle completion')}>{block.status === 'done' ? '✓' : ''}</button>}</li>; })}</ul>;
}

function WeeklySummary({ blocks, now, stats }: { blocks: Block[]; now: Date; stats: ReturnType<typeof computeStats> }) {
  const language = useStore((s) => s.settings.language);
  const rows = Array.from({ length: 7 }, (_, index) => subDays(now, 6 - index)).map((day) => { const list = blocks.filter((block) => block.kind !== 'break' && block.startsAt.slice(0, 10) === dateKey(day)); const planned = list.reduce((sum, block) => sum + block.durationMin, 0); const done = list.filter((block) => block.status === 'done').reduce((sum, block) => sum + block.durationMin, 0); return { day, planned, done, rate: planned ? done / planned : 0 }; });
  return <div className="p-5"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label={pick(language, 'Cumplimiento', 'Completion')} value={stats.weekRate === null ? '—' : `${Math.round(stats.weekRate * 100)}%`} /><Metric label={pick(language, 'Bloque típico', 'Typical block')} value={stats.typicalBlockMin === null ? '—' : durationLabel(stats.typicalBlockMin)} /><Metric label={pick(language, 'Arranque habitual', 'Typical start')} value={stats.typicalStartMin === null ? '—' : clockLabel(stats.typicalStartMin)} /><Metric label={pick(language, 'Días activos', 'Active days')} value={String(rows.filter((row) => row.planned > 0).length)} /></div><div className="mt-5 space-y-3">{rows.map((row) => <div key={dateKey(row.day)} className="grid grid-cols-[58px_1fr_72px] items-center gap-3"><span className="text-[11px] font-medium capitalize">{fmt(row.day, 'EEE d')}</span><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${row.rate * 100}%` }} /></div><span className="text-right font-mono text-[10.5px] text-muted">{durationLabel(row.done)} / {durationLabel(row.planned)}</span></div>)}</div>{stats.weakSpots.length > 0 && <div className="mt-5 rounded-xl border border-line p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{pick(language, 'Lo que más se posterga', 'Most often postponed')}</p><p className="mt-1 text-[12px]">{stats.weakSpots.map((spot) => `${spot.title} (${spot.missed})`).join(' · ')}</p></div>}</div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-line p-2.5"><p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">{label}</p><p className="mt-1 font-mono text-[18px] font-bold">{value}</p></div>; }
function Empty({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) { return <div className="rounded-xl border border-dashed border-line py-8 text-center"><p className="text-[12.5px] text-muted">{text}</p>{action && onAction && <div className="mt-3"><Btn variant="primary" onClick={onAction}>{action}</Btn></div>}</div>; }
