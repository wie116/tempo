import { parseISO } from 'date-fns';
import { useStore } from '../store';
import { PALETTE } from '../lib/themes';
import { durationLabel, fmt, hhmm, isoFor, minutesOf, snap } from '../lib/time';
import { Btn, ColorPicker, Field, Modal, NumField, inputCls } from './Modal';

export function BlockModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const block = useStore((s) => (id ? s.blocks[id] ?? null : null));
  const task = useStore((s) => (block?.taskId ? s.tasks.find((t) => t.id === block.taskId) ?? null : null));
  const updateBlock = useStore((s) => s.updateBlock);
  const removeBlock = useStore((s) => s.removeBlock);
  const setDone = useStore((s) => s.setDone);
  const duplicateBlock = useStore((s) => s.duplicateBlock);

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
      <div className="space-y-4 p-5">
        {!isBreak && (
          <Field label="Título" hint={task ? `Viene de la tarea "${task.title}". Editar acá no cambia la tarea.` : undefined}>
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
            <ColorPicker value={block.color} onChange={(c) => c && updateBlock(block.id, { color: c })} palette={PALETTE} />
          </Field>
        )}

        <Field label="Notas">
          <textarea
            rows={3}
            value={block.notes}
            onChange={(e) => updateBlock(block.id, { notes: e.target.value })}
            placeholder="Qué hay que lograr en este bloque…"
            className={`${inputCls} resize-y`}
          />
        </Field>

        <label className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5">
          <input
            type="checkbox"
            checked={block.status === 'done'}
            onChange={() => setDone(block.id, block.status !== 'done')}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-[13px]">Completado</span>
          {task?.recurring && (
            <span className="ml-auto text-[11px] text-muted">La tarea es recurrente ↻, no se gasta</span>
          )}
        </label>
      </div>
    </Modal>
  );
}
