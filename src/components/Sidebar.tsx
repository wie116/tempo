import { useMemo, useState } from 'react';
import { useDrag, useStore, useUI } from '../store';
import { startPointerGesture } from '../lib/gesture';
import { durationLabel } from '../lib/time';
import type { Task } from '../types';

export function Sidebar({
  onOpenTasks, onEditTask, onClose,
}: { onOpenTasks: () => void; onEditTask: (id: string) => void; onClose?: () => void }) {
  const lists = useStore((s) => s.lists);
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const toggleCollapsed = useStore((s) => s.toggleListCollapsed);
  const allBlocks = useStore((s) => s.blocks);
  const [draftList, setDraftList] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  /** Una tarea no recurrente se atenúa mientras tenga un bloque en la agenda. */
  const scheduled = useMemo(() => {
    const ids = new Set<string>();
    // Un bloque omitido no consume la tarea: vuelve a estar disponible.
    for (const b of Object.values(allBlocks)) if (b.taskId && b.status !== 'skipped') ids.add(b.taskId);
    return ids;
  }, [allBlocks]);

  const submit = (listId: string) => {
    const text = draft.trim();
    if (!text) return;
    // Sintaxis rápida: "Reunión 45m" · "Leer 1h" · "* " al final = recurrente
    const recurring = /\*\s*$/.test(text);
    const m = text.match(/\s(\d+)\s*(m|min|h)\b/i);
    const estimatedMin = m ? (/h/i.test(m[2]) ? Number(m[1]) * 60 : Number(m[1])) : null;
    const title = text.replace(/\s(\d+)\s*(m|min|h)\b/i, '').replace(/\*\s*$/, '').trim();
    addTask(listId, title || text, { estimatedMin, recurring });
    setDraft('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Tareas</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenTasks}
            className="rounded-md px-2 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Administrar
          </button>
          {onClose && (
            <button onClick={onClose} className="rounded-md px-2 py-1 text-[12px] text-muted lg:hidden">
              Cerrar
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {lists.map((list) => {
          const items = tasks
            .filter((t) => t.listId === list.id && !t.archived)
            .sort((a, b) => a.order - b.order);
          return (
            <section key={list.id} className="mb-3.5">
              <button
                onClick={() => toggleCollapsed(list.id)}
                aria-expanded={!list.collapsed}
                className="mb-1.5 flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface-2"
              >
                <svg
                  width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden
                  className="shrink-0 text-muted transition-transform"
                  style={{ transform: list.collapsed ? 'rotate(-90deg)' : 'none' }}
                >
                  <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: list.color }} />
                <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold">{list.name}</h3>
                <span className="tabular font-mono text-[11px] text-muted">{items.length}</span>
              </button>

              {list.collapsed ? null : (
              <>
              <ul className="space-y-1">
                {items.map((task) => (
                  <li key={task.id}>
                    <TaskChip
                      task={task}
                      groupColor={list.color}
                      dimmed={!task.recurring && task.repeat === 'none' && scheduled.has(task.id)}
                      onEdit={() => onEditTask(task.id)}
                    />
                  </li>
                ))}
              </ul>

              {draftList === list.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => { submit(list.id); setDraftList(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit(list.id);
                    if (e.key === 'Escape') { setDraft(''); setDraftList(null); }
                  }}
                  placeholder="Tarea 45m · * = recurrente"
                  className="mt-1 w-full rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[13px] outline-none placeholder:text-muted"
                />
              ) : (
                <button
                  onClick={() => setDraftList(list.id)}
                  className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[12.5px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  + Agregar tarea
                </button>
              )}
              </>
              )}
            </section>
          );
        })}
      </div>

      <p className="shrink-0 border-t border-line px-3 py-2.5 text-[12px] leading-snug text-muted">
        Arrastrá una tarea a la grilla para agendarla. Para una pausa, marcá una franja
        vacía y elegí <span className="text-ink">Pausa</span>.
      </p>
    </div>
  );
}

function TaskChip({
  task, groupColor, dimmed, onEdit,
}: { task: Task; groupColor: string; dimmed: boolean; onEdit: () => void }) {
  const begin = useDrag((s) => s.begin);
  const defaultMin = useStore((s) => s.settings.defaultBlockMin);
  const focused = useUI((s) => s.focusedTaskId === task.id);
  const focusTask = useUI((s) => s.focusTask);
  const color = task.color ?? groupColor;
  const repeats = task.repeat !== 'none';

  return (
    <div
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        focusTask(task.id);
        startPointerGesture(e, {
          // Un clic solo selecciona. Para agendarla hay que arrastrarla hasta la grilla.
          onDrag: () =>
            begin({
              mode: 'new', taskId: task.id, title: task.title, color, kind: 'task',
              grabOffsetMin: 0, durationMin: task.estimatedMin ?? defaultMin,
              dayIndex: 0, startMin: 9 * 60, anchorMin: 9 * 60, anchorDayIndex: 0, moved: false,
            }),
        });
      }}
      className={[
        'group grid cursor-grab items-center gap-2 rounded-lg border bg-surface px-2.5 py-2 transition-colors',
        dimmed ? 'opacity-45' : '',
      ].join(' ')}
      style={{
        // Columnas fijas: el título es lo único elástico, así los iconos
        // caen siempre en la misma vertical aunque la tarea no los tenga.
        gridTemplateColumns: '3px minmax(0,1fr) 12px 46px 18px',
        touchAction: 'pan-y',
        borderColor: focused ? 'var(--accent)' : 'var(--border)',
        boxShadow: focused ? '0 0 0 1px var(--accent)' : undefined,
      }}
    >
      <span className="h-5 w-[3px] rounded-full" style={{ background: color }} />
      <span className="min-w-0 truncate text-[13.5px]">{task.title}</span>
      <span className="text-center text-[10px] leading-none" style={{ color: repeats || task.recurring ? color : 'transparent' }}>
        {repeats ? '⟳' : '↻'}
      </span>
      <span className="tabular text-right font-mono text-[11px] text-muted">
        {task.estimatedMin ? durationLabel(task.estimatedMin) : '—'}
      </span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        aria-label={`Editar ${task.title}`}
        title="Editar tarea"
        className={`grid h-[18px] w-[18px] place-items-center rounded text-muted transition-opacity hover:text-ink ${
          focused ? 'opacity-80' : 'opacity-0 group-hover:opacity-80'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M11.2 2.6a1.3 1.3 0 0 1 1.9 0l.3.3a1.3 1.3 0 0 1 0 1.9L6.2 12 3.5 12.5 4 9.8l7.2-7.2Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
