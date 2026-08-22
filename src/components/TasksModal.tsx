import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { PALETTE } from '../lib/themes';
import { durationLabel } from '../lib/time';
import { Btn, ColorPicker, ConfirmModal, Field, Modal, NumField, Segmented, Tabs, inputCls } from './Modal';
import type { Task } from '../types';

export function TasksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lists = useStore((s) => s.lists);
  const tasks = useStore((s) => s.tasks);
  const addList = useStore((s) => s.addList);
  const addTask = useStore((s) => s.addTask);
  const [activeList, setActiveList] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'task' | 'list'; id: string } | null>(null);
  const [section, setSection] = useState<'todo' | 'routine' | 'archive'>('todo');
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('all');
  const [duration, setDuration] = useState('all');

  const sortedLists = useMemo(() => [...lists]
    .filter((l) => section === 'archive' || l.scope === section)
    .sort((a, b) => a.order - b.order), [lists, section]);
  const current = activeList && sortedLists.some((l) => l.id === activeList) ? activeList : sortedLists[0]?.id ?? null;
  const currentList = sortedLists.find((l) => l.id === current);
  const items = useMemo(
    () => tasks.filter((t) => query.trim() ? sortedLists.some((l) => l.id === t.listId) : t.listId === current)
      .filter((t) => section === 'archive' ? t.archived : !t.archived && t.recurring === (section === 'routine'))
      .filter((t) => !query.trim() || `${t.title} ${t.notes}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
      .filter((t) => priority === 'all' || t.priority === priority)
      .filter((t) => duration === 'all' || (duration === 'short' ? (t.estimatedMin ?? 30) <= 30 : duration === 'medium' ? (t.estimatedMin ?? 60) <= 60 : (t.estimatedMin ?? 0) > 60))
      .sort((a, b) => a.order - b.order),
    [tasks, current, section, query, priority, duration, sortedLists]
  );

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Tareas y rutinas"
        subtitle="Separá pendientes únicos de hábitos y actividades repetitivas."
        size="lg"
      >
        <Tabs
          active={section}
          onChange={setSection}
          tabs={[
            { id: 'todo' as const, label: 'To-Do' },
            { id: 'routine' as const, label: 'Rutinas' },
            { id: 'archive' as const, label: `Archivo (${tasks.filter((t) => t.archived).length})` },
          ]}
        />
        <div className="flex min-h-[26rem] flex-col sm:flex-row">
          {/* Clasificaciones */}
          <nav className="shrink-0 border-b border-line p-3 sm:w-52 sm:border-b-0 sm:border-r">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Clasificaciones</p>
            <ul className="flex gap-1.5 overflow-x-auto sm:block sm:space-y-0.5 sm:overflow-visible">
              {sortedLists.map((l) => {
                const n = tasks.filter((t) => t.listId === l.id)
                  .filter((t) => section === 'archive' ? t.archived : !t.archived && t.recurring === (section === 'routine')).length;
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
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                className="col-span-2 w-full rounded-lg border border-line px-2 py-1.5 text-[12px] text-muted transition-colors hover:border-[var(--accent)] hover:text-ink"
                onClick={() => { const id = addList('Nueva clasificación', section === 'routine' ? 'routine' : 'todo'); setActiveList(id); setEditingList(id); }}
              >
                + Clasificación
              </button>
              {currentList && <button className="rounded-lg border border-line px-2 py-1.5 text-[12px] text-muted hover:text-ink" onClick={() => setEditingList(currentList.id)}>Editar</button>}
              {currentList && sortedLists.length > 1 && (
                <button
                  onClick={() => setConfirm({ kind: 'list', id: currentList.id })}
                  aria-label="Eliminar clasificación"
                  title="Eliminar clasificación"
                  className="grid min-w-0 place-items-center rounded-lg border border-line px-2 py-1.5 text-muted transition-colors hover:border-[var(--now)] hover:text-[var(--now)]"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </nav>

          {/* Tareas de la clasificación */}
          <div className="min-w-0 flex-1 p-3">
            <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o notas…" className={inputCls} />
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls} aria-label="Filtrar prioridad">
                <option value="all">Toda prioridad</option><option value="urgent">Urgente</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baja</option>
              </select>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} aria-label="Filtrar duración">
                <option value="all">Toda duración</option><option value="short">Hasta 30 min</option><option value="medium">Hasta 1 h</option><option value="long">Más de 1 h</option>
              </select>
            </div>
            {section !== 'archive' && <div className="mb-2 flex justify-end">
              <Btn variant="primary" onClick={() => {
                if (!current) return;
                const id = addTask(current, section === 'routine' ? 'Nueva rutina' : 'Nueva tarea', { recurring: section === 'routine' });
                setEditingTask(id);
              }}>Agregar</Btn>
            </div>}

            {items.length === 0 ? (
              <p className="px-1 py-8 text-center text-[12.5px] text-muted">
                {section === 'archive' ? 'No hay elementos archivados en esta clasificación.' : `Esta clasificación todavía no tiene ${section === 'todo' ? 'tareas' : 'rutinas'}.`}
              </p>
            ) : (
              <ul className="space-y-1">
                {items.map((t) => (
                  <li key={t.id}>
                    <TaskRow
                      task={t}
                      groupColor={lists.find((l) => l.id === t.listId)?.color ?? PALETTE[0]}
                      onEdit={() => setEditingTask(t.id)}
                      onDelete={() => setConfirm({ kind: 'task', id: t.id })}
                      archived={section === 'archive'}
                    />
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 px-1 text-[11px] leading-snug text-muted">
              {section === 'todo'
                ? 'Cada To-Do sigue disponible hasta que lo completes. Al completar su bloque pasa al Archivo; si queda pendiente, no se pierde.'
                : section === 'routine'
                  ? 'Las rutinas permanecen disponibles. La frecuencia se define en cada bloque de la agenda.'
                  : 'Restaurá un elemento si necesitás volver a usarlo.'}
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
  task, groupColor, onEdit, onDelete, archived,
}: { task: Task; groupColor: string; onEdit: () => void; onDelete: () => void; archived: boolean }) {
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
      <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
        {task.recurring ? 'Rutina' : task.priority === 'urgent' ? 'Urgente' : task.priority === 'high' ? 'Alta' : 'To-Do'}
      </span>
      {!task.recurring && (task.plannedDate || task.dueDate) && <span className="hidden rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">
        {task.dueDate ? `vence ${task.dueDate.slice(8, 10)}/${task.dueDate.slice(5, 7)}` : task.plannedDate?.slice(5).split('-').reverse().join('/')}
      </span>}
      {archived && <button onClick={() => updateTask(task.id, { archived: false })}
        className="shrink-0 rounded px-1.5 py-1 text-[12px] font-medium text-muted hover:text-ink">Restaurar</button>}
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
            {!task.archived && <Btn onClick={() => { updateTask(task.id, { archived: true }); onClose(); }}>
              Archivar
            </Btn>}
            <Btn variant="primary" onClick={onClose}>Listo</Btn>
          </>
        }
      >
        <div className="space-y-4 p-5">
            <Field label="Nombre">
              <input
                autoFocus
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                onFocus={(e) => e.currentTarget.select()}
                className={inputCls}
              />
            </Field>

            <Field label="Tipo" hint={task.recurring ? 'Las rutinas se reutilizan y pueden generar una serie.' : 'Los To-Do son únicos y se archivan al completarlos.'}>
              <Segmented
                value={task.recurring ? 'routine' : 'todo'}
                onChange={(value) => updateTask(task.id, { recurring: value === 'routine' })}
                options={[{ id: 'todo', label: 'To-Do' }, { id: 'routine', label: 'Rutina' }]}
              />
            </Field>

            {!task.recurring && <>
              <Field label="Prioridad"><Segmented value={task.priority} onChange={(value) => updateTask(task.id, { priority: value as Task['priority'] })}
                options={[{ id: 'low', label: 'Baja' }, { id: 'normal', label: 'Normal' }, { id: 'high', label: 'Alta' }, { id: 'urgent', label: 'Urgente' }]} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mostrar en Hoy"><input type="date" value={task.plannedDate ?? ''} onChange={(e) => updateTask(task.id, { plannedDate: e.target.value || null, inbox: false })} className={`${inputCls} font-mono`} /></Field>
                <Field label="Fecha límite"><input type="date" value={task.dueDate ?? ''} onChange={(e) => updateTask(task.id, { dueDate: e.target.value || null })} className={`${inputCls} font-mono`} /></Field>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[12px]"><input type="checkbox" checked={task.inbox}
                onChange={(e) => updateTask(task.id, { inbox: e.target.checked, plannedDate: e.target.checked ? null : task.plannedDate })} className="h-4 w-4 accent-[var(--accent)]" />Guardar en Inbox para clasificar después</label>
            </>}

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

            <Field label="Clasificación">
              <select
                value={task.listId}
                onChange={(e) => updateTask(task.id, { listId: e.target.value })}
                className={inputCls}
              >
                {lists.filter((l) => l.scope === (task.recurring ? 'routine' : 'todo')).map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
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
          <p className="rounded-lg border border-dashed border-line px-3 py-2 text-[11px] leading-snug text-muted">La repetición se configura al abrir un bloque en la agenda. Así podés usar esta misma tarea una vez o con varias frecuencias sin alterar otros eventos.</p>
        </div>
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
      title="Editar clasificación"
      size="sm"
      footer={
        <>
          <Btn variant="danger" onClick={() => onDelete(list.id)}>Eliminar clasificación</Btn>
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
        <Field label="Color de la clasificación" hint="Lo heredan las tareas que no tengan color propio.">
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
        : lists.find((l) => l.id === target.id)?.name ?? 'la clasificación';
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
      title={target.kind === 'task' ? 'Eliminar tarea' : 'Eliminar clasificación'}
      message={
        target.kind === 'task'
          ? `Vas a eliminar "${info.name}".`
          : `Vas a eliminar la clasificación "${info.name}" y ${plural(info.taskCount, 'su tarea', 'sus tareas')}.`
      }
      detail={detail}
    />
  );
}
