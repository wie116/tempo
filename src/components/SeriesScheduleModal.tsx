import { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore } from '../store';
import { expandSeries } from '../lib/repeat';
import { findAvailableStart, findConflicts } from '../lib/conflicts';
import { clockLabel, dateKey, fmt, snap } from '../lib/time';
import { Btn, Field, Modal, NumField, TimeField } from './Modal';
import type { Task } from '../types';
import { pick } from '../lib/i18n';

/**
 * Se abre al arrastrar una tarea que repite, o desde "Agendar la serie"
 * en el panel de la tarea. Muestra qué días se van a crear y bloquea
 * la confirmación si algo se pisa con lo que ya está en la agenda.
 */
export function SeriesScheduleModal({
  taskId, initialDay, initialStartMin, onClose,
}: {
  taskId: string;
  initialDay: Date;
  initialStartMin: number;
  onClose: () => void;
}) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId) ?? null);
  const blocks = useStore((s) => s.blocks);
  const scheduleSeries = useStore((s) => s.scheduleSeries);
  const language = useStore((s) => s.settings.language);

  const [day, setDay] = useState(dateKey(initialDay));
  const [startMin, setStartMin] = useState(snap(initialStartMin));
  const [durationMin, setDurationMin] = useState(task?.estimatedMin ?? 30);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [conflictMode, setConflictMode] = useState<'move' | 'exclude'>('move');

  if (!task) return null;
  const anchor = parseISO(day);

  const dates = useMemo(
    () => expandSeries(anchor, task.repeat, task.repeatUntil, task.repeatWeekdays),
    [anchor.getTime(), task.repeat, task.repeatUntil, task.repeatWeekdays]
  );

  const conflicts = useMemo(
    () => findConflicts(dates, startMin, durationMin, Object.values(blocks)),
    [dates, startMin, durationMin, blocks]
  );
  const resolvedStarts = useMemo(() => new Map(dates.map((date) => [
    dateKey(date),
    findAvailableStart(date, startMin, durationMin, Object.values(blocks), 0, 24 * 60),
  ])), [dates, startMin, durationMin, blocks]);
  const included = dates.filter((d) => !excluded.includes(dateKey(d)));
  const includedConflicts = conflicts.filter((c) => !excluded.includes(dateKey(c.date)));
  const unresolved = included.filter((date) => resolvedStarts.get(dateKey(date)) === null);
  const canConfirm = included.length > 0 && unresolved.length === 0 &&
    (conflictMode === 'move' || includedConflicts.length === 0);

  const confirm = () => {
    if (!canConfirm) return;
    scheduleSeries(taskId, included.map((date) => ({
      date,
      startMin: conflictMode === 'move' ? resolvedStarts.get(dateKey(date)) ?? startMin : startMin,
    })), durationMin);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={pick(language, 'Agendar la serie', 'Schedule series')}
      subtitle={task.title}
      footer={
        <>
          <Btn onClick={onClose}>{pick(language, 'Cancelar', 'Cancel')}</Btn>
          <Btn variant="primary" onClick={confirm} disabled={!canConfirm}>
            {pick(language, 'Agendar', 'Schedule')} {included.length || ''}
          </Btn>
        </>
      }
    >
      <div className="space-y-4 border-b border-line p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={pick(language, 'Arranca el', 'Starts on')}>
            <input
              type="date"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[13px] outline-none"
            />
          </Field>
          <Field label={pick(language, 'Hora', 'Time')}>
            <TimeField value={startMin} onCommit={setStartMin} />
          </Field>
          <Field label={pick(language, 'Duración', 'Duration')}>
            <NumField value={durationMin} onCommit={(v) => v && setDurationMin(v)} suffix="min" />
          </Field>
        </div>

        <p className="text-[11.5px] leading-snug text-muted">
          {task.repeat === 'daily' ? pick(language, 'Se repite todos los días.', 'Repeats every day.')
            : task.repeat === 'monthly' ? pick(language, 'Se repite cada mes, el mismo día.', 'Repeats every month on the same day.')
            : task.repeat === 'yearly' ? pick(language, 'Se repite cada año, en la misma fecha.', 'Repeats every year on the same date.')
            : pick(language, `Se repite ${task.repeatWeekdays?.length ? 'los días que elegiste' : 'una vez por semana, el mismo día'} en la pestaña Repetición de la rutina.`, `Repeats ${task.repeatWeekdays?.length ? 'on the days you chose' : 'once a week on the same day'} in the routine's Repeat tab.`)}
          {' '}{pick(language, 'Para cambiar qué días o hasta cuándo, editá la tarea.', 'Edit the task to change the days or end date.')}
        </p>
      </div>

      <div className="p-5">
        {conflicts.length > 0 && (
          <div className="mb-4 rounded-xl border border-line bg-surface-2 p-3">
            <p className="mb-2 text-[12px] font-medium">{pick(language, 'Cuando una fecha esté ocupada', 'When a date is busy')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => setConflictMode('move')} className="rounded-lg border p-2.5 text-left"
                style={{ borderColor: conflictMode === 'move' ? 'var(--accent)' : 'var(--border)' }}>
                <span className="block text-[12.5px] font-medium">{pick(language, 'Mover al próximo hueco', 'Move to the next gap')}</span>
                <span className="block text-[10.5px] text-muted">{pick(language, 'Conserva la fecha y busca una hora libre.', 'Keeps the date and finds a free time.')}</span>
              </button>
              <button onClick={() => setConflictMode('exclude')} className="rounded-lg border p-2.5 text-left"
                style={{ borderColor: conflictMode === 'exclude' ? 'var(--accent)' : 'var(--border)' }}>
                <span className="block text-[12.5px] font-medium">{pick(language, 'Elegir fechas a omitir', 'Choose dates to skip')}</span>
                <span className="block text-[10.5px] text-muted">{pick(language, 'No mueve nada; excluí los choques manualmente.', 'Moves nothing; exclude conflicts manually.')}</span>
              </button>
            </div>
          </div>
        )}
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">
            {dates.length} {dates.length === 1 ? pick(language, 'ocurrencia', 'occurrence') : pick(language, 'ocurrencias', 'occurrences')}
          </h3>
          {conflicts.length > 0 && (
            <span className="font-mono text-[10.5px]" style={{ color: 'var(--now)' }}>
              {conflicts.length} {pick(language, 'con choque', 'conflicts')}
            </span>
          )}
        </div>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {dates.map((d) => {
            const key = dateKey(d);
            const conflict = conflicts.find((c) => dateKey(c.date) === key);
            const off = excluded.includes(key);
            const resolvedStart = resolvedStarts.get(key);
            return (
              <li
                key={key}
                className="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5"
                style={{
                  borderColor: conflict && !off ? 'var(--now)' : 'var(--border)',
                  background: conflict && !off ? 'color-mix(in oklab, var(--now) 8%, transparent)' : undefined,
                  opacity: off ? 0.45 : 1,
                }}
              >
                <span className="w-24 shrink-0 text-[12px] capitalize">{fmt(d, 'EEE d LLL')}</span>
                {conflict ? (
                  <span className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: off ? 'var(--muted)' : 'var(--now)' }}>
                    {conflictMode === 'move' && resolvedStart !== null
                      ? pick(language, `${clockLabel(startMin)} ocupado · pasa a ${clockLabel(resolvedStart!)}`, `${clockLabel(startMin)} busy · moves to ${clockLabel(resolvedStart!)}`)
                      : `${pick(language, 'Choca con', 'Conflicts with')} ${conflict.withTitles.join(', ')}`}
                  </span>
                ) : (
                  <span className="flex-1 text-[11.5px] text-muted">{pick(language, 'Libre', 'Free')}</span>
                )}
                {conflict && conflictMode === 'exclude' && (
                  <button
                    onClick={() => setExcluded((ex) => (off ? ex.filter((x) => x !== key) : [...ex, key]))}
                    className="shrink-0 rounded px-1.5 text-[11px] text-muted hover:text-ink"
                  >
                    {off ? pick(language, 'Incluir', 'Include') : pick(language, 'Excluir', 'Exclude')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {conflicts.length > 0 && conflictMode === 'exclude' && (
          <p className="mt-3 rounded-lg border border-dashed px-3 py-2.5 text-[11.5px] leading-snug"
            style={{ borderColor: 'var(--now)', color: 'var(--now)' }}>
            {pick(language, 'Excluí las fechas ocupadas o cambiá la hora. No se puede confirmar mientras quede algún choque.', 'Exclude busy dates or change the time. You cannot confirm while a conflict remains.')}
          </p>
        )}
        {unresolved.length > 0 && (
          <p className="mt-3 rounded-lg border border-dashed px-3 py-2.5 text-[11.5px] leading-snug"
            style={{ borderColor: 'var(--now)', color: 'var(--now)' }}>
            {unresolved.length} {pick(language, 'fechas no tienen un hueco suficiente dentro del día. Excluilas o reducí la duración.', 'dates do not have a large enough gap in the day. Exclude them or shorten the duration.')}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Para exportar el tipo sin usarlo acá directo (evita warning de import sin uso). */
export type { Task as _TaskRef };
