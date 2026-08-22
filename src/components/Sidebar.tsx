import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { useDrag, useStore, useUI } from '../store';
import { startPointerGesture } from '../lib/gesture';
import { dateKey, durationLabel } from '../lib/time';
import { parseTaskDraft } from '../lib/taskCapture';
import type { List, Task, TaskPriority } from '../types';

type Section = 'today' | 'inbox' | 'todo' | 'routine';
const SECTION_META: { id: Section; label: string; hint: string; description: string }[] = [
  { id: 'today', label: 'Hoy', hint: 'Para ubicar', description: 'Tareas previstas para este día que todavía necesitan un horario en la agenda.' },
  { id: 'inbox', label: 'Inbox', hint: 'Sin clasificar', description: 'Tareas capturadas sin clasificar, listas para ordenar y acomodar más adelante.' },
  { id: 'todo', label: 'To-Do', hint: 'Tareas únicas', description: 'Tareas que se realizan una sola vez y se archivan cuando las completás.' },
  { id: 'routine', label: 'Rutinas', hint: 'Reutilizables', description: 'Actividades reutilizables que podés agendar una vez o repetir con la frecuencia que necesites.' },
];

export function Sidebar({ onOpenTasks, onEditTask, onClose }: {
  onOpenTasks: () => void; onEditTask: (id: string) => void; onClose?: () => void;
}) {
  const lists = useStore((s) => s.lists);
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const toggleCollapsed = useStore((s) => s.toggleListCollapsed);
  const allBlocks = useStore((s) => s.blocks);
  const cursor = useStore((s) => s.cursor);
  const [section, setSection] = useState<Section>('today');
  const [draftList, setDraftList] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [quick, setQuick] = useState('');
  const [quickListId, setQuickListId] = useState<string | null>(null);

  const actualToday = dateKey(new Date());
  const today = cursor;
  const scheduled = useMemo(() => {
    const ids = new Set<string>();
    for (const block of Object.values(allBlocks)) if (block.taskId && block.status === 'planned') ids.add(block.taskId);
    return ids;
  }, [allBlocks]);

  const scope = section === 'routine' ? 'routine' : 'todo';
  const scopedLists = lists.filter((list) => list.scope === scope).sort((a, b) => a.order - b.order);
  const fallbackList = scopedLists[0]?.id;
  const belongs = (task: Task) => {
    if (task.archived) return false;
    if (section === 'routine') return task.recurring;
    if (task.recurring) return false;
    if (section === 'inbox') return task.inbox;
    if (section === 'today') return !task.inbox && Boolean(task.plannedDate && task.plannedDate <= today) && !scheduled.has(task.id);
    return !task.inbox;
  };

  const create = (raw: string, preferredListId?: string | null) => {
    const parsed = parseTaskDraft(raw);
    if (!parsed) return false;
    const wantedScope = section === 'routine' ? 'routine' : 'todo';
    const tagged = parsed.classification
      ? lists.find((list) => list.scope === wantedScope && list.name.toLocaleLowerCase() === parsed.classification!.toLocaleLowerCase())
      : null;
    const listId = tagged?.id ?? (lists.some((list) => list.id === preferredListId && list.scope === wantedScope) ? preferredListId! : fallbackList);
    if (!listId) return false;
    addTask(listId, parsed.title, {
      estimatedMin: parsed.estimatedMin,
      recurring: section === 'routine',
      inbox: section === 'inbox',
      plannedDate: parsed.plannedDate ?? (section === 'today' ? today : null),
      dueDate: parsed.dueDate,
      priority: parsed.priority,
    });
    return true;
  };
  const submitQuick = () => { if (create(quick, quickListId)) setQuick(''); };
  const activeMeta = SECTION_META.find((item) => item.id === section)!;
  const activeCount = tasks.filter((task) => countIn(section, task, today, scheduled)).length;

  return <div className="flex h-full min-h-0 flex-col bg-surface">
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2.5">
      <div><h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Plan de tareas</h2>
        <p className="mt-0.5 text-[10.5px] text-muted">Capturá, clasificá y llevá a la agenda</p></div>
      <div className="flex items-center gap-1">
        <button onClick={onOpenTasks} className="rounded-md px-2 py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink">Administrar</button>
        {onClose && <button onClick={onClose} className="rounded-md px-2 py-1 text-[12px] text-muted xl:hidden">Cerrar</button>}
      </div>
    </div>

    <div className="grid shrink-0 grid-cols-4 gap-1 border-b border-line p-2" role="tablist" aria-label="Vista de tareas">
      {SECTION_META.map((item) => {
        const count = tasks.filter((task) => countIn(item.id, task, today, scheduled)).length;
        return <button key={item.id} role="tab" aria-selected={section === item.id} onClick={() => setSection(item.id)}
          className="relative rounded-lg px-1 py-2 text-center transition-colors" style={{ background: section === item.id ? 'var(--surface-2)' : undefined }}>
          <span className="block text-[11.5px] font-semibold">{item.id === 'today' && cursor !== actualToday ? 'Día' : item.label}</span>
          <span className="block truncate text-[9px] text-muted">{count ? `${count} · ` : ''}{item.hint}</span>
          {count > 0 && item.id === 'today' && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--now)' }} />}
        </button>;
      })}
    </div>

    <section className="shrink-0 border-b border-line px-3 py-3" style={{ background: 'color-mix(in oklab, var(--accent) 5%, var(--surface))' }}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[18px] font-semibold leading-none tracking-tight">
          {section === 'today' && cursor !== actualToday ? 'Día' : activeMeta.label}
        </h3>
        {activeCount > 0 && (
          <span className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 font-mono text-[10px] font-semibold"
            style={{ background: 'color-mix(in oklab, var(--accent) 13%, transparent)', color: 'var(--accent)' }}>
            {activeCount}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{activeMeta.description}</p>
    </section>

    <div className="shrink-0 border-b border-line p-2">
      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 p-1.5 focus-within:border-[var(--accent)]">
        <span className="pl-1 text-[15px] text-muted">+</span>
        <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitQuick()}
          placeholder={section === 'routine' ? 'Rutina 30m #Bienestar' : section === 'inbox' ? 'Capturá cualquier cosa…' : 'Informe mañana 45m prioridad alta'}
          aria-label="Captura rápida de tarea" className="min-w-0 flex-1 bg-transparent px-1 py-1 text-[12.5px] outline-none placeholder:text-muted" />
        {scopedLists.length > 1 && section !== 'inbox' && <select
          value={scopedLists.some((list) => list.id === quickListId) ? quickListId! : fallbackList}
          onChange={(e) => setQuickListId(e.target.value)} aria-label="Clasificación para la nueva tarea"
          className="max-w-24 rounded-md border border-line bg-surface px-1.5 py-1 text-[10px] text-muted outline-none">
          {scopedLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
        </select>}
        <button onClick={submitQuick} disabled={!quick.trim()} className="rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-30"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>Agregar</button>
      </div>
      <p className="mt-1 px-1 text-[9.5px] text-muted">Entiende “mañana”, “45m”, “vence 30/8”, “prioridad alta” y “#Trabajo”.</p>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
      {section === 'inbox' && tasks.filter(belongs).length === 0 && <Empty text="Inbox está vacío. Todo lo que captures acá espera una clasificación." />}
      {section === 'today' && tasks.filter(belongs).length === 0 && <Empty text="No hay tareas esperando para hoy. Las que ya tienen horario están en la agenda." />}
      {scopedLists.map((list) => {
        const items = tasks.filter((task) => task.listId === list.id && belongs(task)).sort(sortTasks);
        if ((section === 'today' || section === 'inbox') && items.length === 0) return null;
        return <TaskSection key={list.id} list={list} items={items} scheduled={scheduled} toggleCollapsed={toggleCollapsed}
          onEditTask={onEditTask} onStartDraft={() => setDraftList(list.id)} draftOpen={draftList === list.id}
          draft={draft} setDraft={setDraft} submitDraft={() => { if (create(draft, list.id)) setDraft(''); setDraftList(null); }} section={section} />;
      })}
    </div>
    <p className="shrink-0 border-t border-line px-3 py-2 text-[11px] leading-snug text-muted">
      Arrastrá a la grilla para asignar horario. Un To‑Do con día pero sin horario reaparece en <span className="text-ink">Hoy</span> cuando corresponde.
    </p>
  </div>;
}

function countIn(section: Section, task: Task, today: string, scheduled: Set<string>) {
  if (task.archived) return false;
  if (section === 'routine') return task.recurring;
  if (task.recurring) return false;
  if (section === 'inbox') return task.inbox;
  if (section === 'today') return !task.inbox && Boolean(task.plannedDate && task.plannedDate <= today) && !scheduled.has(task.id);
  return !task.inbox;
}

const sortTasks = (a: Task, b: Task) => {
  const priority: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  return priority[a.priority] - priority[b.priority] || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.order - b.order;
};
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11.5px] leading-relaxed text-muted">{text}</p>; }

function TaskSection({ list, items, scheduled, toggleCollapsed, onEditTask, onStartDraft, draftOpen, draft, setDraft, submitDraft, section }: {
  list: List; items: Task[]; scheduled: Set<string>; toggleCollapsed: (id: string) => void; onEditTask: (id: string) => void;
  onStartDraft: () => void; draftOpen: boolean; draft: string; setDraft: (value: string) => void; submitDraft: () => void; section: Section;
}) {
  return <section className="mb-3.5">
    <button onClick={() => toggleCollapsed(list.id)} aria-expanded={!list.collapsed} className="mb-1.5 flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-surface-2">
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0 text-muted transition-transform" style={{ transform: list.collapsed ? 'rotate(-90deg)' : 'none' }} aria-hidden>
        <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="h-2 w-2 rounded-full" style={{ background: list.color }} /><h3 className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{list.name}</h3>
      <span className="font-mono text-[10px] text-muted">{items.length}</span>
    </button>
    {!list.collapsed && <><ul className="space-y-1">{items.map((task) => <li key={task.id}><TaskChip task={task} groupColor={list.color}
      dimmed={!task.recurring && scheduled.has(task.id)} onEdit={() => onEditTask(task.id)} /></li>)}</ul>
      {section !== 'today' && section !== 'inbox' && (draftOpen ? <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={submitDraft}
        onKeyDown={(e) => { if (e.key === 'Enter') submitDraft(); if (e.key === 'Escape') { setDraft(''); } }} placeholder={section === 'routine' ? 'Nueva rutina 30m' : 'Nueva tarea mañana 45m'}
        className="mt-1 w-full rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[12.5px] outline-none" />
        : <button onClick={onStartDraft} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[12px] text-muted hover:bg-surface-2 hover:text-ink">+ Agregar {section === 'routine' ? 'rutina' : 'tarea'}</button>)}</>}
  </section>;
}

function TaskChip({ task, groupColor, dimmed, onEdit }: { task: Task; groupColor: string; dimmed: boolean; onEdit: () => void }) {
  const begin = useDrag((s) => s.begin);
  const defaultMin = useStore((s) => s.settings.defaultBlockMin);
  const updateTask = useStore((s) => s.updateTask);
  const focused = useUI((s) => s.focusedTaskId === task.id);
  const focusTask = useUI((s) => s.focusTask);
  const color = task.color ?? groupColor;
  const tomorrow = dateKey(addDays(new Date(), 1));
  const priorityColor = task.priority === 'urgent' ? 'var(--now)' : task.priority === 'high' ? '#b86b18' : 'var(--muted)';
  return <div><div onPointerDown={(e) => {
    if (e.button !== 0) return; focusTask(task.id); if (dimmed) return;
    startPointerGesture(e, { onDrag: (pointer) => begin({ mode: 'new', taskId: task.id, title: task.title, color, kind: 'task', grabOffsetMin: 0,
      durationMin: task.estimatedMin ?? defaultMin, dayIndex: 0, startMin: 9 * 60, anchorMin: 9 * 60, anchorDayIndex: 0, moved: false,
      pointerClientX: pointer.clientX, pointerClientY: pointer.clientY, overGrid: false }) });
  }} className={`group grid items-center gap-2 rounded-lg border bg-surface px-2.5 py-2 transition-colors ${dimmed ? 'cursor-default opacity-45' : 'cursor-grab'}`}
    style={{ gridTemplateColumns: '3px minmax(0,1fr) auto 42px 18px', touchAction: 'pan-y', borderColor: focused ? 'var(--accent)' : 'var(--border)' }}>
    <span className="h-5 w-[3px] rounded-full" style={{ background: color }} /><span className="min-w-0 truncate text-[13px]">{task.title}</span>
    <span className="flex items-center gap-1 text-[9.5px]" style={{ color: priorityColor }}>{task.priority !== 'normal' && <span title={`Prioridad ${task.priority}`}>●</span>}
      {task.plannedDate && <span className="rounded bg-surface-2 px-1">{task.plannedDate.slice(5).replace('-', '/')}</span>}</span>
    <span className="text-right font-mono text-[10.5px] text-muted">{task.estimatedMin ? durationLabel(task.estimatedMin) : '—'}</span>
    <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label={`Editar ${task.title}`}
      className={`grid h-[18px] w-[18px] place-items-center rounded text-muted hover:text-ink ${focused ? 'opacity-80' : 'opacity-0 group-hover:opacity-80'}`}>
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M11.2 2.6a1.3 1.3 0 0 1 1.9 0l.3.3a1.3 1.3 0 0 1 0 1.9L6.2 12 3.5 12.5 4 9.8l7.2-7.2Z" stroke="currentColor" strokeWidth="1.3" /></svg>
    </button>
  </div>{focused && !task.recurring && <div className="ml-2 mt-1 flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
    <button onClick={() => updateTask(task.id, { plannedDate: dateKey(new Date()), inbox: false })} className="rounded px-2 py-1 text-[10.5px] text-muted hover:bg-surface hover:text-ink">Hoy</button>
    <button onClick={() => updateTask(task.id, { plannedDate: tomorrow, inbox: false })} className="rounded px-2 py-1 text-[10.5px] text-muted hover:bg-surface hover:text-ink">Mañana</button>
    <button onClick={() => updateTask(task.id, { plannedDate: null, inbox: true })} className="rounded px-2 py-1 text-[10.5px] text-muted hover:bg-surface hover:text-ink">Inbox</button>
    <button onClick={() => updateTask(task.id, { archived: true })} className="rounded px-2 py-1 text-[10.5px] text-muted hover:bg-surface hover:text-ink">Archivar</button>
  </div>}</div>;
}
