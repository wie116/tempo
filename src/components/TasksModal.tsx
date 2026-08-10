import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { PALETTE } from '../lib/themes';
import { durationLabel } from '../lib/time';
import { Btn, ColorPicker, ConfirmModal, Field, Modal, NumField, Segmented, Tabs, inputCls } from './Modal';
import { UNTIL_PRESETS, WEEKDAY_LABELS, countSeries } from '../lib/repeat';
import { dateKey } from '../lib/time';
import type { RepeatMode } from '../types';
import type { Task } from '../types';

export function TasksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lists = useStore((s) => s.lists);
  const tasks = useStore((s) => s.tasks);
  const addList = useStore((s) => s.addList);
  const addTask = useStore((s) => s.addTask);
  const [activeList, setActiveList] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'task' | 'list'; id: string } | null>(null);

  const sortedLists = useMemo(() => [...lists].sort((a, b) => a.order - b.order), [lists]);
  const current = activeList ?? sortedLists[0]?.id ?? null;
  const currentList = sortedLists.find((l) => l.id === current);
  const items = useMemo(
    () => tasks.filter((t) => t.listId === current && !t.archived).sort((a, b) => a.order - b.order),
    [tasks, current]
  );

  const create = () => {
    const text = draft.trim();
    if (!text || !current) return;
    addTask(current, text);
    setDraft('');
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Tareas"
        subtitle="Agrupá, coloreá y definí duraciones. Después arrastralas a la agenda."
        size="lg"
      >
        <div className="flex min-h-[26rem] flex-col sm:flex-row">
          {/* Grupos */}
          <nav className="shrink-0 border-b border-line p-3 sm:w-52 sm:border-b-0 sm:border-r">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Grupos</p>
            <ul className="flex gap-1.5 overflow-x-auto sm:block sm:space-y-0.5 sm:overflow-visible">
              {sortedLists.map((l) => {
                const n = tasks.filter((t) => t.listId === l.id && !t.archived).length;
                const on = l.id === current;
                return (
                  <li key={l.id} className="shrink-0">
                    <button
                      onClick={() => setActiveList(l.id)}
                      onDoubleClick={() => setEditingList(l.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
                      style={{ background: on ? 'var(--surface-2)' : undefined }}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{l.name}</span>
                      <span className="tabular font-mono text-[10px] text-muted">{n}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex gap-1.5">
              <Btn onClick={() => { const id = addList('Nuevo grupo'); setActiveList(id); setEditingList(id); }}>
                + Grupo
              </Btn>
              {currentList && <Btn onClick={() => setEditingList(currentList.id)}>Editar</Btn>}
              {currentList && sortedLists.length > 1 && (
                <button
                  onClick={() => setConfirm({ kind: 'list', id: currentList.id })}
                  aria-label="Eliminar grupo"
                  title="Eliminar grupo"
                  className="rounded-lg border border-line px-2 py-1.5 text-muted transition-colors hover:border-[var(--now)] hover:text-[var(--now)]"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </nav>

          {/* Tareas del grupo */}
          <div className="min-w-0 flex-1 p-3">
            <div className="mb-2 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="Nueva tarea…"
                className={inputCls}
              />
              <Btn variant="primary" onClick={create} disabled={!draft.trim()}>Agregar</Btn>
            </div>

            {items.length === 0 ? (
              <p className="px-1 py-8 text-center text-[12.5px] text-muted">
                Este grupo está vacío. Escribí arriba para sumar la primera tarea.
              </p>
            ) : (
              <ul className="space-y-1">
                {items.map((t) => (
                  <li key={t.id}>
                    <TaskRow
                      task={t}
                      groupColor={currentList?.color ?? PALETTE[0]}
                      onEdit={() => setEditingTask(t.id)}
                      onDelete={() => setConfirm({ kind: 'task', id: t.id })}
                    />
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 px-1 text-[11px] leading-snug text-muted">
              Sin duración fija, la tarea toma la duración por defecto al agendarla y podés estirarla después.
              Las recurrentes (↻) nunca se gastan.
            </p>
          </div>
        </div>
      </Modal>

      <TaskEditModal
        id={editingTask}
        onClose={() => setEditingTask(null)}
        onDelete={(id) => { setEditingTask(null); setConfirm({ kind: 'task', id }); }}
      />
      <ListEditModal
        id={editingList}
        onClose={() => setEditingList(null)}
        onDelete={(id) => { setEditingList(null); setConfirm({ kind: 'list', id }); }}
      />
      <DeleteConfirm target={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

export function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.8 4.2h10.4M6.3 4.2V3.1a.8.8 0 0 1 .8-.8h1.8a.8.8 0 0 1 .8.8v1.1"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4.2 4.2 4.8 13a.9.9 0 0 0 .9.8h4.6a.9.9 0 0 0 .9-.8l.6-8.8"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.7 6.6v4.8M9.3 6.6v4.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function TaskRow({
  task, groupColor, onEdit, onDelete,
}: { task: Task; groupColor: string; onEdit: () => void; onDelete: () => void }) {
  const updateTask = useStore((s) => s.updateTask);
  const color = task.color ?? groupColor;
  return (
    <div className="group flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2 transition-colors hover:bg-surface-2">
      <span className="h-5 w-[3px] shrink-0 rounded-full" style={{ background: color }} />
      <button onClick={onEdit} className="min-w-0 flex-1 truncate text-left text-[13px]">
        {task.title}
      </button>
      <span className="tabular shrink-0 font-mono text-[10.5px] text-muted">
        {task.estimatedMin ? durationLabel(task.estimatedMin) : 'libre'}
      </span>
      <button
        onClick={() => updateTask(task.id, { recurring: !task.recurring })}
        title={task.recurring ? 'Recurrente' : 'Marcar como recurrente'}
        className="shrink-0 rounded px-1 text-[12px]"
        style={{ color: task.recurring ? color : 'var(--muted)', opacity: task.recurring ? 1 : 0.45 }}
      >
        ↻
      </button>
      <button onClick={onEdit} className="shrink-0 rounded px-1.5 py-1 text-[12px] text-muted hover:text-ink">
        Editar
      </button>
      <button
        onClick={onDelete}
        aria-label={`Eliminar ${task.title}`}
        title="Eliminar tarea"
        className="shrink-0 rounded p-1 text-muted transition-colors hover:text-[var(--now)]"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

export function TaskEditModal({
  id, onClose, onDelete,
}: { id: string | null; onClose: () => void; onDelete?: (id: string) => void }) {
  const task = useStore((s) => (id ? s.tasks.find((t) => t.id === id) ?? null : null));
  const lists = useStore((s) => s.lists);
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const [tab, setTab] = useState<'general' | 'repeat'>('general');
  const [askDelete, setAskDelete] = useState(false);

  if (!task) return null;
  const groupColor = lists.find((l) => l.id === task.listId)?.color ?? PALETTE[0];

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Editar tarea"
        size="sm"
        footer={
          <>
            <Btn variant="danger" onClick={() => (onDelete ? onDelete(task.id) : setAskDelete(true))}>
              Eliminar
            </Btn>
            <Btn variant="primary" onClick={onClose}>Listo</Btn>
          </>
        }
      >
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'general' as const, label: 'General' },
            { id: 'repeat' as const, label: 'Repetición' },
          ]}
        />

        {tab === 'general' ? (
          <div className="space-y-4 p-5">
            <Field label="Nombre">
              <input
                autoFocus
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Duración" hint="Vacío = toma la duración por defecto y la ajustás en la agenda.">
              <div className="flex flex-wrap items-center gap-1.5">
                <NumField
                  value={task.estimatedMin}
                  onCommit={(v) => updateTask(task.id, { estimatedMin: v })}
                  allowEmpty
                  placeholder="libre"
                  suffix="min"
                />
                <span className="mx-1 h-4 w-px bg-[var(--border)]" />
                {[null, 30, 60, 90].map((m, i) => (
                  <button
                    key={i}
                    onClick={() => updateTask(task.id, { estimatedMin: m })}
                    className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-muted hover:text-ink"
                  >
                    {m === null ? 'libre' : `${m}m`}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Color de la etiqueta">
              <ColorPicker
                value={task.color}
                onChange={(c) => updateTask(task.id, { color: c })}
                palette={PALETTE}
                allowInherit={groupColor}
              />
            </Field>

            <Field label="Grupo">
              <select
                value={task.listId}
                onChange={(e) => updateTask(task.id, { listId: e.target.value })}
                className={inputCls}
              >
                {lists.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            </Field>

            <Field label="Notas">
              <textarea
                rows={3}
                value={task.notes}
                onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                placeholder="Detalles, links, contexto…"
                className={`${inputCls} resize-y`}
              />
            </Field>
          </div>
        ) : (
          <RepeatTab task={task} />
        )}
      </Modal>

      {!onDelete && (
        <ConfirmModal
          open={askDelete}
          onClose={() => setAskDelete(false)}
          onConfirm={() => { removeTask(task.id); onClose(); }}
          title="Eliminar tarea"
          message={`Vas a eliminar "${task.title}".`}
          detail="Se borran también todos sus bloques de la agenda. Esto no se puede deshacer."
        />
      )}
    </>
  );
}

function RepeatTab({ task }: { task: Task }) {
  const updateTask = useStore((s) => s.updateTask);
  const today = new Date();
  const n = task.repeat === 'none' ? 0 : countSeries(today, task.repeat, task.repeatUntil, task.repeatWeekdays);

  return (
    <div className="space-y-4 p-5">
      <label className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5">
        <input
          type="checkbox"
          checked={task.recurring}
          onChange={(e) => updateTask(task.id, { recurring: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
        />
        <span className="min-w-0">
          <span className="block text-[13px]">Nunca se gasta ↻</span>
          <span className="block text-[11px] leading-snug text-muted">
            Sigue disponible en el panel aunque la agendes o la completes.
          </span>
        </span>
      </label>

      <Field label="Repetir al agendarla" hint="Al arrastrarla a un día se abre una revisión antes de crear la serie.">
        <Segmented
          value={task.repeat}
          onChange={(v) => updateTask(task.id, { repeat: v as RepeatMode })}
          options={[
            { id: 'none', label: 'No' },
            { id: 'daily', label: 'Cada día' },
            { id: 'weekly', label: 'Semanal' },
          ]}
        />
      </Field>

      {task.repeat === 'weekly' && (
        <Field label="Qué días" hint="Podés elegir varios. Vacío = el mismo día en que la agendes.">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((label, i) => {
              const on = (task.repeatWeekdays ?? []).includes(i);
              return (
                <button
                  key={i}
                  onClick={() => {
                    const cur = task.repeatWeekdays ?? [];
                    const next = on ? cur.filter((x) => x !== i) : [...cur, i].sort();
                    updateTask(task.id, { repeatWeekdays: next.length ? next : null });
                  }}
                  className="rounded-md border px-2.5 py-1.5 text-[12px]"
                  style={{
                    borderColor: on ? 'var(--accent)' : 'var(--border)',
                    background: on ? 'var(--accent)' : undefined,
                    color: on ? 'var(--accent-fg)' : 'var(--muted)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {task.repeat !== 'none' && (
        <>
          <Field label="Hasta cuándo">
            <div className="flex flex-wrap items-center gap-1.5">
              {UNTIL_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => updateTask(task.id, { repeatUntil: dateKey(p.add(new Date())) })}
                  className="rounded-md border border-line px-2.5 py-1.5 text-[12px] text-muted hover:text-ink"
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => updateTask(task.id, { repeatUntil: null })}
                className="rounded-md border px-2.5 py-1.5 text-[12px]"
                style={{
                  borderColor: task.repeatUntil === null ? 'var(--accent)' : 'var(--border)',
                  color: task.repeatUntil === null ? 'var(--text)' : 'var(--muted)',
                }}
              >
                Siempre
              </button>
            </div>
            <div className="mt-2">
              <input
                type="date"
                value={task.repeatUntil ?? ''}
                onChange={(e) => updateTask(task.id, { repeatUntil: e.target.value || null })}
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[13px] outline-none"
              />
            </div>
          </Field>

          <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[11.5px] leading-snug text-muted">
            Se van a crear <span className="font-semibold text-ink">{n} bloques</span> al agendarla.
            {task.repeatUntil === null && ' "Siempre" llega hasta el tope del horizonte; cuando se acabe, volvés a arrastrarla.'}
          </p>
        </>
      )}
    </div>
  );
}

function ListEditModal({
  id, onClose, onDelete,
}: { id: string | null; onClose: () => void; onDelete: (id: string) => void }) {
  const list = useStore((s) => (id ? s.lists.find((l) => l.id === id) ?? null : null));
  const updateList = useStore((s) => s.updateList);
  if (!list) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar grupo"
      size="sm"
      footer={
        <>
          <Btn variant="danger" onClick={() => onDelete(list.id)}>Eliminar grupo</Btn>
          <Btn variant="primary" onClick={onClose}>Listo</Btn>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <Field label="Nombre">
          <input
            autoFocus
            value={list.name}
            onChange={(e) => updateList(list.id, { name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Color del grupo" hint="Lo heredan las tareas que no tengan color propio.">
          <ColorPicker value={list.color} onChange={(c) => c && updateList(list.id, { color: c })} palette={PALETTE} />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Antes de borrar, contamos cuántos bloques de la agenda quedarían huérfanos.
 * Es la parte que la gente no ve venir, así que va destacada.
 */
function DeleteConfirm({
  target, onClose,
}: { target: { kind: 'task' | 'list'; id: string } | null; onClose: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const lists = useStore((s) => s.lists);
  const blocks = useStore((s) => s.blocks);
  const removeTask = useStore((s) => s.removeTask);
  const removeList = useStore((s) => s.removeList);

  const info = useMemo(() => {
    if (!target) return null;
    const taskIds =
      target.kind === 'task'
        ? [target.id]
        : tasks.filter((t) => t.listId === target.id).map((t) => t.id);
    const all = Object.values(blocks).filter((b) => b.taskId && taskIds.includes(b.taskId));
    const pending = all.filter((b) => b.status === 'planned').length;
    const name =
      target.kind === 'task'
        ? tasks.find((t) => t.id === target.id)?.title ?? 'la tarea'
        : lists.find((l) => l.id === target.id)?.name ?? 'el grupo';
    return { taskCount: taskIds.length, blockCount: all.length, pending, name };
  }, [target, tasks, lists, blocks]);

  if (!target || !info) return null;

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const detail =
    info.blockCount === 0
      ? undefined
      : `Se van a borrar también ${plural(info.blockCount, 'bloque', 'bloques')} de la agenda` +
        (info.pending > 0 ? ` (${plural(info.pending, 'sigue', 'siguen')} sin completar).` : ', todos ya completados.') +
        ' Esto no se puede deshacer.';

  return (
    <ConfirmModal
      open
      onClose={onClose}
      onConfirm={() => (target.kind === 'task' ? removeTask(target.id) : removeList(target.id))}
      title={target.kind === 'task' ? 'Eliminar tarea' : 'Eliminar grupo'}
      message={
        target.kind === 'task'
          ? `Vas a eliminar "${info.name}".`
          : `Vas a eliminar el grupo "${info.name}" y ${plural(info.taskCount, 'su tarea', 'sus tareas')}.`
      }
      detail={detail}
    />
  );
}
