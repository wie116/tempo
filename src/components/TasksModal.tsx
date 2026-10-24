import { useMemo, useState } from 'react';
import { UNSORTED_NAME, useStore } from '../store';
import { PALETTE } from '../lib/themes';
import { durationLabel } from '../lib/time';
import { Btn, ColorPicker, ConfirmModal, Field, Modal, NumField, Segmented, Tabs, inputCls } from './Modal';
import type { Task } from '../types';
import { pick } from '../lib/i18n';

export function TasksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lists = useStore((s) => s.lists);
  const tasks = useStore((s) => s.tasks);
  const addList = useStore((s) => s.addList);
  const addTask = useStore((s) => s.addTask);
  const unsortedListId = useStore((s) => s.unsortedListId);
  const language = useStore((s) => s.settings.language);
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
        title={pick(language, 'Tareas y rutinas', 'Tasks and routines')}
        subtitle={pick(language, 'Separá pendientes únicos de hábitos y actividades repetitivas.', 'Keep one-time tasks separate from habits and recurring activities.')}
        size="lg"
      >
        <Tabs
          active={section}
          onChange={setSection}
          tabs={[
            { id: 'todo' as const, label: 'To-Do' },
            { id: 'routine' as const, label: pick(language, 'Rutinas', 'Routines') },
            { id: 'archive' as const, label: `${pick(language, 'Archivo', 'Archive')} (${tasks.filter((t) => t.archived).length})` },
          ]}
        />
        <div className="flex min-h-[26rem] flex-col sm:flex-row">
          {/* Clasificaciones */}
          <nav className="shrink-0 border-b border-line p-3 sm:w-52 sm:border-b-0 sm:border-r">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{pick(language, 'Clasificaciones', 'Classifications')}</p>
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
                onClick={() => { const id = addList(pick(language, 'Nueva clasificación', 'New classification'), section === 'routine' ? 'routine' : 'todo'); setActiveList(id); setEditingList(id); }}
              >
                + {pick(language, 'Clasificación', 'Classification')}
              </button>
              {currentList && <button className="rounded-lg border border-line px-2 py-1.5 text-[12px] text-muted hover:text-ink" onClick={() => setEditingList(currentList.id)}>{pick(language, 'Editar', 'Edit')}</button>}
              {currentList && sortedLists.length > 1 && currentList.id !== unsortedListId && currentList.name !== UNSORTED_NAME && (
                <button
                  onClick={() => setConfirm({ kind: 'list', id: currentList.id })}
                  aria-label={pick(language, 'Eliminar clasificación', 'Delete classification')}
                  title={pick(language, 'Eliminar clasificación', 'Delete classification')}
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
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={pick(language, 'Buscar por nombre o notas…', 'Search by name or notes…')} className={inputCls} />
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls} aria-label={pick(language, 'Filtrar prioridad', 'Filter priority')}>
                <option value="all">{pick(language, 'Toda prioridad', 'Any priority')}</option><option value="urgent">{pick(language, 'Urgente', 'Urgent')}</option><option value="high">{pick(language, 'Alta', 'High')}</option><option value="normal">{pick(language, 'Normal', 'Normal')}</option><option value="low">{pick(language, 'Baja', 'Low')}</option>
              </select>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} aria-label={pick(language, 'Filtrar duración', 'Filter duration')}>
                <option value="all">{pick(language, 'Toda duración', 'Any duration')}</option><option value="short">{pick(language, 'Hasta 30 min', 'Up to 30 min')}</option><option value="medium">{pick(language, 'Hasta 1 h', 'Up to 1 hr')}</option><option value="long">{pick(language, 'Más de 1 h', 'More than 1 hr')}</option>
              </select>
            </div>
            {section !== 'archive' && <div className="mb-2 flex justify-end">
              <Btn variant="primary" onClick={() => {
                if (!current) return;
                const id = addTask(current, section === 'routine' ? pick(language, 'Nueva rutina', 'New routine') : pick(language, 'Nueva tarea', 'New task'), { recurring: section === 'routine' });
                setEditingTask(id);
              }}>{pick(language, 'Agregar', 'Add')}</Btn>
            </div>}

            {items.length === 0 ? (
              <p className="px-1 py-8 text-center text-[12.5px] text-muted">
                {section === 'archive' ? pick(language, 'No hay elementos archivados en esta clasificación.', 'There are no archived items in this classification.') : pick(language, `Esta clasificación todavía no tiene ${section === 'todo' ? 'tareas' : 'rutinas'}.`, `This classification does not have any ${section === 'todo' ? 'tasks' : 'routines'} yet.`)}
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
                ? pick(language, 'Cada To-Do sigue disponible hasta que lo completes. Al completar su bloque pasa al Archivo; si queda pendiente, no se pierde.', 'Each To-Do stays available until you complete it. Completing its block moves it to Archive; pending work is never lost.')
                : section === 'routine'
                  ? pick(language, 'Las rutinas permanecen disponibles. La frecuencia se define en cada bloque de la agenda.', 'Routines remain available. Their frequency is defined on each schedule block.')
                  : pick(language, 'Restaurá un elemento si necesitás volver a usarlo.', 'Restore an item when you need to use it again.')}
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
  const language = useStore((s) => s.settings.language);
  const color = task.color ?? groupColor;
  return (
    <div className="group flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2 transition-colors hover:bg-surface-2">
      <span className="h-5 w-[3px] shrink-0 rounded-full" style={{ background: color }} />
      <button onClick={onEdit} className="min-w-0 flex-1 truncate text-left text-[13px]">
        {task.title}
      </button>
      <span className="tabular shrink-0 font-mono text-[10.5px] text-muted">
        {task.estimatedMin ? durationLabel(task.estimatedMin) : pick(language, 'libre', 'flexible')}
      </span>
      <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
        {task.recurring ? pick(language, 'Rutina', 'Routine') : task.priority === 'urgent' ? pick(language, 'Urgente', 'Urgent') : task.priority === 'high' ? pick(language, 'Alta', 'High') : 'To-Do'}
      </span>
      {!task.recurring && (task.plannedDate || task.dueDate) && <span className="hidden rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">
        {task.dueDate ? `${pick(language, 'vence', 'due')} ${task.dueDate.slice(8, 10)}/${task.dueDate.slice(5, 7)}` : task.plannedDate?.slice(5).split('-').reverse().join('/')}
      </span>}
      {archived && <button onClick={() => updateTask(task.id, { archived: false })}
        className="shrink-0 rounded px-1.5 py-1 text-[12px] font-medium text-muted hover:text-ink">{pick(language, 'Restaurar', 'Restore')}</button>}
      <button onClick={onEdit} className="shrink-0 rounded px-1.5 py-1 text-[12px] text-muted hover:text-ink">
        {pick(language, 'Editar', 'Edit')}
      </button>
      <button
        onClick={onDelete}
        aria-label={`${pick(language, 'Eliminar', 'Delete')} ${task.title}`}
        title={pick(language, 'Eliminar tarea', 'Delete task')}
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
  const language = useStore((s) => s.settings.language);

  if (!task) return null;
  const groupColor = lists.find((l) => l.id === task.listId)?.color ?? PALETTE[0];

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={pick(language, 'Editar tarea', 'Edit task')}
        size="sm"
        footer={
          <>
            <Btn variant="danger" onClick={() => (onDelete ? onDelete(task.id) : setAskDelete(true))}>
              {pick(language, 'Eliminar', 'Delete')}
            </Btn>
            {!task.archived && <Btn onClick={() => { updateTask(task.id, { archived: true }); onClose(); }}>
              {pick(language, 'Archivar', 'Archive')}
            </Btn>}
            <Btn variant="primary" onClick={onClose}>{pick(language, 'Listo', 'Done')}</Btn>
          </>
        }
      >
        <div className="space-y-4 p-5">
            <Field label={pick(language, 'Nombre', 'Name')}>
              <input
                autoFocus
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                onFocus={(e) => e.currentTarget.select()}
                className={inputCls}
              />
            </Field>

            <Field label={pick(language, 'Tipo', 'Type')} hint={task.recurring ? pick(language, 'Las rutinas se reutilizan y pueden generar una serie.', 'Routines are reusable and can generate a series.') : pick(language, 'Los To-Do son únicos y se archivan al completarlos.', 'To-Dos are one-time tasks and are archived when completed.')}>
              <Segmented
                value={task.recurring ? 'routine' : 'todo'}
                onChange={(value) => updateTask(task.id, { recurring: value === 'routine' })}
                options={[{ id: 'todo', label: 'To-Do' }, { id: 'routine', label: pick(language, 'Rutina', 'Routine') }]}
              />
            </Field>

            {!task.recurring && <>
              <Field label={pick(language, 'Prioridad', 'Priority')}><Segmented value={task.priority} onChange={(value) => updateTask(task.id, { priority: value as Task['priority'] })}
                options={[{ id: 'low', label: pick(language, 'Baja', 'Low') }, { id: 'normal', label: 'Normal' }, { id: 'high', label: pick(language, 'Alta', 'High') }, { id: 'urgent', label: pick(language, 'Urgente', 'Urgent') }]} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={pick(language, 'Mostrar en Hoy', 'Show in Today')}><input type="date" value={task.plannedDate ?? ''} onChange={(e) => updateTask(task.id, { plannedDate: e.target.value || null, inbox: false })} className={`${inputCls} font-mono`} /></Field>
                <Field label={pick(language, 'Fecha límite', 'Due date')}><input type="date" value={task.dueDate ?? ''} onChange={(e) => updateTask(task.id, { dueDate: e.target.value || null })} className={`${inputCls} font-mono`} /></Field>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[12px]"><input type="checkbox" checked={task.inbox}
                onChange={(e) => updateTask(task.id, { inbox: e.target.checked, plannedDate: e.target.checked ? null : task.plannedDate })} className="h-4 w-4 accent-[var(--accent)]" />{pick(language, 'Guardar en Inbox para clasificar después', 'Save to Inbox to sort later')}</label>
            </>}

            <Field label={pick(language, 'Duración', 'Duration')} hint={pick(language, 'Vacío = toma la duración por defecto y la ajustás en la agenda.', 'Empty = use the default duration and adjust it in the schedule.')}>
              <div className="flex flex-wrap items-center gap-1.5">
                <NumField
                  value={task.estimatedMin}
                  onCommit={(v) => updateTask(task.id, { estimatedMin: v })}
                  allowEmpty
                  placeholder={pick(language, 'libre', 'flexible')}
                  suffix="min"
                />
                <span className="mx-1 h-4 w-px bg-[var(--border)]" />
                {[null, 30, 60, 90].map((m, i) => (
                  <button
                    key={i}
                    onClick={() => updateTask(task.id, { estimatedMin: m })}
                    className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-muted hover:text-ink"
                  >
                    {m === null ? pick(language, 'libre', 'flexible') : `${m}m`}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={pick(language, 'Color de la etiqueta', 'Label color')}>
              <ColorPicker
                value={task.color}
                onChange={(c) => updateTask(task.id, { color: c })}
                palette={PALETTE}
                allowInherit={groupColor}
              />
            </Field>

            <Field label={pick(language, 'Clasificación', 'Classification')}>
              <select
                value={task.listId}
                onChange={(e) => updateTask(task.id, { listId: e.target.value })}
                className={inputCls}
              >
                {lists.filter((l) => l.scope === (task.recurring ? 'routine' : 'todo')).map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            </Field>

            <Field label={pick(language, 'Notas', 'Notes')}>
              <textarea
                rows={3}
                value={task.notes}
                onChange={(e) => updateTask(task.id, { notes: e.target.value })}
                placeholder={pick(language, 'Detalles, links, contexto…', 'Details, links, context…')}
                className={`${inputCls} resize-y`}
              />
            </Field>
          <p className="rounded-lg border border-dashed border-line px-3 py-2 text-[11px] leading-snug text-muted">{pick(language, 'La repetición se configura al abrir un bloque en la agenda. Así podés usar esta misma tarea una vez o con varias frecuencias sin alterar otros eventos.', 'Configure repetition by opening a block in the schedule. This lets you use the same task once or at several frequencies without changing other events.')}</p>
        </div>
      </Modal>

      {!onDelete && (
        <ConfirmModal
          open={askDelete}
          onClose={() => setAskDelete(false)}
          onConfirm={() => { removeTask(task.id); onClose(); }}
          title={pick(language, 'Eliminar tarea', 'Delete task')}
          message={pick(language, `Vas a eliminar "${task.title}".`, `You are about to delete "${task.title}".`)}
          detail={pick(language, 'Se borran también todos sus bloques de la agenda. Esto no se puede deshacer.', 'All of its schedule blocks will also be deleted. This cannot be undone.')}
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
  const unsortedListId = useStore((s) => s.unsortedListId);
  const language = useStore((s) => s.settings.language);
  if (!list) return null;
  const protectedList = list.id === unsortedListId || list.name === UNSORTED_NAME;

  return (
    <Modal
      open
      onClose={onClose}
      title={pick(language, 'Editar clasificación', 'Edit classification')}
      size="sm"
      footer={
        <>
          {!protectedList && <Btn variant="danger" onClick={() => onDelete(list.id)}>{pick(language, 'Eliminar clasificación', 'Delete classification')}</Btn>}
          <Btn variant="primary" onClick={onClose}>{pick(language, 'Listo', 'Done')}</Btn>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <Field label={pick(language, 'Nombre', 'Name')}>
          <input
            autoFocus
            value={list.name}
            onChange={(e) => updateList(list.id, { name: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label={pick(language, 'Color de la clasificación', 'Classification color')} hint={pick(language, 'Lo heredan las tareas que no tengan color propio.', 'Tasks without their own color inherit it.')}>
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
  const language = useStore((s) => s.settings.language);

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
        ? tasks.find((t) => t.id === target.id)?.title ?? pick(language, 'la tarea', 'the task')
        : lists.find((l) => l.id === target.id)?.name ?? pick(language, 'la clasificación', 'the classification');
    return { taskCount: taskIds.length, blockCount: all.length, pending, name };
  }, [target, tasks, lists, blocks, language]);

  if (!target || !info) return null;

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const detail =
    info.blockCount === 0
      ? undefined
      : language === 'en'
        ? `${plural(info.blockCount, 'schedule block', 'schedule blocks')} will also be deleted` +
          (info.pending > 0 ? ` (${info.pending} still incomplete).` : ', all already completed.') +
          ' This cannot be undone.'
        : `Se van a borrar también ${plural(info.blockCount, 'bloque', 'bloques')} de la agenda` +
          (info.pending > 0 ? ` (${plural(info.pending, 'sigue', 'siguen')} sin completar).` : ', todos ya completados.') +
          ' Esto no se puede deshacer.';

  return (
    <ConfirmModal
      open
      onClose={onClose}
      onConfirm={() => (target.kind === 'task' ? removeTask(target.id) : removeList(target.id))}
      title={target.kind === 'task' ? pick(language, 'Eliminar tarea', 'Delete task') : pick(language, 'Eliminar clasificación', 'Delete classification')}
      message={
        target.kind === 'task'
          ? pick(language, `Vas a eliminar "${info.name}".`, `You are about to delete "${info.name}".`)
          : language === 'en' ? `You are about to delete the classification "${info.name}" and its ${info.taskCount} ${info.taskCount === 1 ? 'task' : 'tasks'}.` : `Vas a eliminar la clasificación "${info.name}" y ${plural(info.taskCount, 'su tarea', 'sus tareas')}.`
      }
      detail={detail}
    />
  );
}
