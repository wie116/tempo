import { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore } from '../store';
import { expandSeries } from '../lib/repeat';
import { findConflicts } from '../lib/conflicts';
import { dateKey, fmt, hhmm, snap } from '../lib/time';
import { Btn, Field, Modal, NumField } from './Modal';
import type { Task } from '../types';

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

  const [day, setDay] = useState(dateKey(initialDay));
  const [startMin, setStartMin] = useState(snap(initialStartMin));
  const [durationMin, setDurationMin] = useState(task?.estimatedMin ?? 30);
  const [excluded, setExcluded] = useState<string[]>([]);

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
  const included = dates.filter((d) => !excluded.includes(dateKey(d)));
  const includedConflicts = conflicts.filter((c) => !excluded.includes(dateKey(c.date)));
  const canConfirm = includedConflicts.length === 0 && included.length > 0;

  const confirm = () => {
    if (!canConfirm) return;
    scheduleSeries(taskId, included, startMin, durationMin);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Agendar la serie"
      subtitle={task.title}
      footer={
        <>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={confirm} disabled={!canConfirm}>
            Agendar {included.length || ''}
          </Btn>
        </>
      }
    >
      <div className="space-y-4 border-b border-line p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Arranca el">
            <input
              type="date"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[13px] outline-none"
            />
          </Field>
          <Field label="Hora">
            <input
              type="time"
              step={600}
              value={hhmm(startMin)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (!Number.isNaN(h)) setStartMin(snap(h * 60 + m));
              }}
              className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[13px] outline-none"
            />
          </Field>
          <Field label="Duración">
            <NumField value={durationMin} onCommit={(v) => v && setDurationMin(v)} suffix="min" />
          </Field>
        </div>

        <p className="text-[11.5px] leading-snug text-muted">
          {task.repeat === 'daily'
            ? 'Se repite todos los días.'
            : `Se repite ${task.repeatWeekdays?.length ? 'los días que elegiste' : 'una vez por semana, el mismo día'} en la pestaña Repetición de la tarea.`}
          {' '}Para cambiar qué días o hasta cuándo, editá la tarea.
        </p>
      </div>

      <div className="p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">
            {dates.length} {dates.length === 1 ? 'ocurrencia' : 'ocurrencias'}
          </h3>
          {conflicts.length > 0 && (
            <span className="font-mono text-[10.5px]" style={{ color: 'var(--now)' }}>
              {conflicts.length} con choque
            </span>
          )}
        </div>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {dates.map((d) => {
            const key = dateKey(d);
            const conflict = conflicts.find((c) => dateKey(c.date) === key);
            const off = excluded.includes(key);
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
                    Choca con {conflict.withTitles.join(', ')}
                  </span>
                ) : (
                  <span className="flex-1 text-[11.5px] text-muted">Libre</span>
                )}
                {conflict && (
                  <button
                    onClick={() => setExcluded((ex) => (off ? ex.filter((x) => x !== key) : [...ex, key]))}
                    className="shrink-0 rounded px-1.5 text-[11px] text-muted hover:text-ink"
                  >
                    {off ? 'Incluir' : 'Excluir'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {conflicts.length > 0 && (
          <p className="mt-3 rounded-lg border border-dashed px-3 py-2.5 text-[11.5px] leading-snug"
            style={{ borderColor: 'var(--now)', color: 'var(--now)' }}>
            Hay días que se pisan con algo que ya agendaste. Excluilos uno por uno o cambiá la hora —
            no se puede confirmar mientras quede algún choque.
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Para exportar el tipo sin usarlo acá directo (evita warning de import sin uso). */
export type { Task as _TaskRef };
