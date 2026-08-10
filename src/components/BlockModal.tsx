import { useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore } from '../store';
import { PALETTE } from '../lib/themes';
import { durationLabel, fmt, hhmm, isoFor, minutesOf, snap } from '../lib/time';
import { Btn, ColorPicker, ConfirmModal, Field, Modal, NumField, Segmented, Tabs, inputCls } from './Modal';
import type { BlockStatus } from '../types';

export function BlockModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const block = useStore((s) => (id ? s.blocks[id] ?? null : null));
  const task = useStore((s) => (block?.taskId ? s.tasks.find((t) => t.id === block.taskId) ?? null : null));
  const updateBlock = useStore((s) => s.updateBlock);
  const removeBlock = useStore((s) => s.removeBlock);
  const removeSeries = useStore((s) => s.removeSeries);
  const updateTask = useStore((s) => s.updateTask);
  const duplicateBlock = useStore((s) => s.duplicateBlock);
  const setStatus = useStore((s) => s.setStatus);
  const setPinned = useStore((s) => s.setPinned);

  const [tab, setTab] = useState<'general' | 'more'>('general');
  const [askSeries, setAskSeries] = useState(false);

  if (!block) return null;

  const day = parseISO(block.startsAt);
  const start = minutesOf(block.startsAt);
  const isBreak = block.kind === 'break';

  const setStart = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    if (Number.isNaN(h)) return;
    updateBlock(block.id, { startsAt: isoFor(day, snap(h * 60 + m)) });
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={isBreak ? 'Pausa' : block.title || 'Bloque'}
        subtitle={`${fmt(day, "EEEE d 'de' LLLL")} · ${hhmm(start)}–${hhmm(start + block.durationMin)}`}
        size="sm"
        footer={
          <>
            <Btn variant="danger" onClick={() => { removeBlock(block.id); onClose(); }}>Eliminar</Btn>
            <Btn onClick={() => { duplicateBlock(block.id); onClose(); }}>Duplicar</Btn>
            <Btn variant="primary" onClick={onClose}>Listo</Btn>
          </>
        }
      >
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'general' as const, label: 'General' },
            { id: 'more' as const, label: 'Notas y estado' },
          ]}
        />

        {tab === 'general' ? (
          <div className="space-y-4 p-5">
            {!isBreak && (
              <Field
                label="Título"
                hint={task ? `Viene de la tarea "${task.title}". Editar acá no cambia la tarea.` : undefined}
              >
                <input
                  autoFocus
                  value={block.title}
                  onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                  className={inputCls}
                />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Empieza">
                <input
                  type="time"
                  step={600}
                  value={hhmm(start)}
                  onChange={(e) => setStart(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </Field>
              <Field label="Dura">
                <NumField
                  value={block.durationMin}
                  onCommit={(v) => v && updateBlock(block.id, { durationMin: v })}
                  suffix="min"
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[10, 20, 30, 45, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  onClick={() => updateBlock(block.id, { durationMin: snap(m) })}
                  className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-muted hover:text-ink"
                  style={block.durationMin === snap(m) ? { borderColor: 'var(--accent)', color: 'var(--text)' } : undefined}
                >
                  {durationLabel(snap(m))}
                </button>
              ))}
            </div>

            {!isBreak && (
              <Field label="Color">
                <ColorPicker
                  value={block.color}
                  onChange={(c) => c && updateBlock(block.id, { color: c })}
                  palette={PALETTE}
                />
              </Field>
            )}
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <Field label="Notas">
              <textarea
                rows={4}
                value={block.notes}
                onChange={(e) => updateBlock(block.id, { notes: e.target.value })}
                placeholder="Qué hay que lograr en este bloque…"
                className={`${inputCls} resize-y`}
              />
            </Field>

            <label className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5">
              <input
                type="checkbox"
                checked={block.pinned}
                onChange={(e) => setPinned([block.id], e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px]">Fijo en este horario</span>
                <span className="block text-[11px] leading-snug text-muted">
                  No se mueve por arrastre, ni con la cadena, ni con la varita. Además corta la cadena en dos.
                </span>
              </span>
            </label>

            <Field
              label="Estado"
              hint={
                block.status === 'skipped'
                  ? 'Omitido: el bloque queda como registro y la tarea vuelve a estar disponible en su grupo.'
                  : task?.recurring
                    ? 'La tarea es recurrente ↻, no se gasta.'
                    : undefined
              }
            >
              <Segmented
                value={block.status}
                onChange={(v) => setStatus(block.id, v as BlockStatus)}
                options={[
                  { id: 'planned', label: 'Pendiente' },
                  { id: 'done', label: 'Completado' },
                  { id: 'skipped', label: 'Omitido' },
                ]}
              />
            </Field>

            {block.seriesId && (
              <div className="rounded-lg border border-dashed border-line px-3 py-2.5">
                <p className="text-[12.5px]">Este bloque es parte de una repetición.</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {task && task.repeat !== 'none' && (
                    <button
                      onClick={() => updateTask(task.id, { repeat: 'none' })}
                      className="text-[12px] text-muted underline underline-offset-2 hover:text-ink"
                    >
                      Dejar de repetir
                    </button>
                  )}
                  <button
                    onClick={() => setAskSeries(true)}
                    className="text-[12px] underline underline-offset-2"
                    style={{ color: 'var(--now)' }}
                  >
                    Eliminar toda la serie
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted">
                  Dejar de repetir no toca los bloques ya agendados: solo evita que se cree una serie
                  nueva la próxima vez que arrastres esta tarea.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={askSeries}
        onClose={() => setAskSeries(false)}
        onConfirm={() => { if (block.seriesId) removeSeries(block.seriesId); onClose(); }}
        title="Eliminar la serie"
        message={`Vas a borrar todas las repeticiones de "${block.title}".`}
        detail="Se quitan de todos los días, pasados y futuros. La tarea sigue en su grupo."
      />
    </>
  );
}
