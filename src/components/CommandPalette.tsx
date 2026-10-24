import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { useStore } from '../store';
import { dateKey } from '../lib/time';
import { Modal } from './Modal';
import { pick } from '../lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  onReview: () => void;
  onFocus: () => void;
  onAutoplan: () => void;
  onTasks: () => void;
  onSettings: () => void;
  onLocateBlock: (id: string) => void;
  onEditTask: (id: string) => void;
}

export function CommandPalette(props: Props) {
  const [query, setQuery] = useState('');
  const tasks = useStore((s) => s.tasks);
  const blocks = useStore((s) => s.blocks);
  const language = useStore((s) => s.settings.language);
  const go = (day: string) => { useStore.getState().setCursor(day); useStore.getState().setView('day'); props.onClose(); };
  const commands = [
    { label: pick(language, 'Ir a hoy', 'Go to today'), hint: pick(language, 'Abrir la agenda de hoy', "Open today's schedule"), run: () => go(dateKey(new Date())) },
    { label: pick(language, 'Planificar mañana', 'Plan tomorrow'), hint: pick(language, 'Abrir mañana en vista Día', 'Open tomorrow in Day view'), run: () => go(dateKey(addDays(new Date(), 1))) },
    { label: pick(language, 'Revisión y cierre del día', 'Review and close the day'), hint: pick(language, 'Pendientes, mañana, semana e historial', 'Pending items, tomorrow, week, and history'), run: props.onReview },
    { label: pick(language, 'Abrir modo Enfoque', 'Open Focus mode'), hint: pick(language, 'Reloj y tarea actual sin distracciones', 'Clock and current task without distractions'), run: props.onFocus },
    { label: pick(language, 'Organizar agenda', 'Arrange schedule'), hint: pick(language, 'Acomodar tareas en huecos disponibles', 'Fit tasks into available gaps'), run: props.onAutoplan },
    { label: pick(language, 'Administrar tareas y rutinas', 'Manage tasks and routines'), hint: pick(language, 'Abrir biblioteca de tareas', 'Open task library'), run: props.onTasks },
    { label: pick(language, 'Abrir ajustes', 'Open settings'), hint: pick(language, 'Apariencia, avisos e integraciones', 'Appearance, notifications, and integrations'), run: props.onSettings },
  ];
  const normalized = query.trim().toLocaleLowerCase('es');
  const dateCommand = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? { label: `${pick(language, 'Ir al', 'Go to')} ${normalized}`, hint: pick(language, 'Abrir esa fecha en vista Día', 'Open that date in Day view'), run: () => go(normalized) }
    : null;
  const results = useMemo(() => {
    if (!normalized) return { commands, tasks: [], blocks: [] };
    const availableCommands = dateCommand ? [dateCommand, ...commands] : commands;
    return {
      commands: availableCommands.filter((item) => dateCommand === item || `${item.label} ${item.hint}`.toLocaleLowerCase('es').includes(normalized)),
      tasks: tasks.filter((task) => !task.archived && `${task.title} ${task.notes}`.toLocaleLowerCase('es').includes(normalized)).slice(0, 6),
      blocks: Object.values(blocks).filter((block) => `${block.title} ${block.notes}`.toLocaleLowerCase('es').includes(normalized)).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 6),
    };
  }, [normalized, tasks, blocks]);
  const run = (action: () => void) => { props.onClose(); action(); };

  return <Modal open={props.open} onClose={props.onClose} size="sm" title={pick(language, 'Buscar o ejecutar', 'Search or run')} subtitle={pick(language, 'Tareas, eventos, fechas y acciones desde un solo lugar.', 'Tasks, events, dates, and actions in one place.')}>
    <div className="border-b border-line p-3">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 focus-within:border-[var(--accent)]">
        <span className="text-muted">⌕</span>
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={pick(language, 'Buscar tarea o escribir una acción…', 'Search for a task or type an action…')} className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted" />
        <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-muted">Esc</kbd>
      </div>
    </div>
    <div className="max-h-[60vh] p-2">
      {results.commands.length > 0 && <ResultSection title={pick(language, 'Acciones', 'Actions')}>{results.commands.map((item) => <Result key={item.label} title={item.label} detail={item.hint} icon="→" onClick={() => run(item.run)} />)}</ResultSection>}
      {results.tasks.length > 0 && <ResultSection title={pick(language, 'Tareas', 'Tasks')}>{results.tasks.map((task) => <Result key={task.id} title={task.title} detail={task.recurring ? pick(language, 'Rutina reutilizable', 'Reusable routine') : task.plannedDate ? `${pick(language, 'Prevista', 'Planned')}: ${task.plannedDate}` : 'To-Do'} icon="✓" onClick={() => run(() => props.onEditTask(task.id))} />)}</ResultSection>}
      {results.blocks.length > 0 && <ResultSection title={pick(language, 'Agenda', 'Schedule')}>{results.blocks.map((block) => <Result key={block.id} title={block.title} detail={block.startsAt.replace('T', ' · ')} icon="◷" onClick={() => run(() => props.onLocateBlock(block.id))} />)}</ResultSection>}
      {!results.commands.length && !results.tasks.length && !results.blocks.length && <p className="px-3 py-8 text-center text-[12.5px] text-muted">{pick(language, 'No encontré resultados.', 'No results found.')}</p>}
    </div>
  </Modal>;
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mb-2 last:mb-0"><h3 className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h3><div>{children}</div></section>; }
function Result({ title, detail, icon, onClick }: { title: string; detail: string; icon: string; onClick: () => void }) { return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line text-[12px] text-muted">{icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium">{title}</span><span className="block truncate text-[10.5px] text-muted">{detail}</span></span></button>; }
