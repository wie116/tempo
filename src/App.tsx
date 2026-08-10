import { useEffect, useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore, useUI } from './store';
import { weekDays } from './lib/time';
import { unlockAudio } from './lib/audio';
import { useClockEngine } from './hooks/useClockEngine';
import { useAuth } from './hooks/useAuth';
import { initHistory, redo, undo } from './lib/history';
import { holdPulls, syncNow } from './lib/sync';
import { AuthScreen } from './components/AuthScreen';
import { TopBar } from './components/TopBar';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { NowPanel } from './components/NowPanel';
import { Calendar } from './components/Calendar';
import { MonthView } from './components/MonthView';
import { TimerBar } from './components/TimerBar';
import { Toasts } from './components/Toasts';
import { SettingsModal } from './components/SettingsModal';
import { TaskEditModal, TasksModal } from './components/TasksModal';
import { BlockModal } from './components/BlockModal';
import { AutoplanModal } from './components/AutoplanModal';
import { SeriesScheduleModal } from './components/SeriesScheduleModal';
import { TodayModal } from './components/TodayModal';

/** La vista de día no necesita todo el ancho: una columna estirada se lee peor. */
const WIDTH = { day: 'max-w-2xl', week: 'max-w-6xl', month: 'max-w-6xl' };

/** ¿El foco está en un campo de texto? Entonces los atajos no corren. */
function typingNow(target: EventTarget | null): boolean {
  const el = (target as HTMLElement | null) ?? (document.activeElement as HTMLElement | null);
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable ||
    el.closest('[role="dialog"]') !== null
  );
}

export default function App() {
  const { session, ready, cloudEnabled } = useAuth();
  const view = useStore((s) => s.view);
  const cursor = useStore((s) => s.cursor);
  const theme = useStore((s) => s.settings.theme);
  const mondayFirst = useStore((s) => s.settings.weekStartsOnMonday);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [autoplan, setAutoplan] = useState<'wand' | 'dice' | null>(null);
  const [seriesPrompt, setSeriesPrompt] = useState<{ taskId: string; day: Date; startMin: number } | null>(null);

  const anchor = parseISO(cursor);
  const days = view === 'day' ? [anchor] : weekDays(anchor, mondayFirst);

  useClockEngine();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  /* iOS y Chrome bloquean el audio hasta el primer gesto */
  useEffect(() => {
    const once = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', once);
      window.removeEventListener('keydown', once);
    };
    window.addEventListener('pointerdown', once);
    window.addEventListener('keydown', once);
    return once;
  }, []);

  /**
   * Solo dejamos Suprimir. Los atajos de una sola letra se disparaban mientras
   * escribías y no vale la pena pelear con cada campo de la app.
   */
  useEffect(() => initHistory(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // En un campo de texto, Ctrl+Z lo maneja el navegador.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typingNow(e.target)) {
        e.preventDefault();
        // Evita que una bajada ya programada pise el deshacer antes de
        // que termine de subir; y lo subimos ya mismo en vez de esperar.
        holdPulls();
        if (e.shiftKey) redo();
        else undo();
        void syncNow();
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (typingNow(e.target)) return;

      const ui = useUI.getState();
      const ids = ui.multi.length ? ui.multi : ui.focusedBlockId ? [ui.focusedBlockId] : [];
      if (!ids.length) return;
      e.preventDefault();
      useStore.getState().removeBlocks(ids);
      ui.clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) {
    return (
      <div className="grid h-full place-items-center bg-bg text-[13px] text-muted">
        Abriendo tu agenda…
      </div>
    );
  }

  if (cloudEnabled && !session) return <AuthScreen />;

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <TopBar
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onOpenTasks={() => setTasksOpen(true)}
        onOpenToday={() => setTodayOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-line lg:block">
          <Sidebar onOpenTasks={() => setTasksOpen(true)} onEditTask={setTaskId} />
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="h-full w-80 max-w-[88%] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <Sidebar
                onOpenTasks={() => { setTasksOpen(true); setSidebarOpen(false); }}
                onEditTask={(id) => { setTaskId(id); setSidebarOpen(false); }}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-hidden p-2 sm:p-3">
          <div className={`card mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden ${WIDTH[view]}`}>
            {view === 'month' ? (
              <MonthView anchor={anchor} />
            ) : (
              <>
                <Toolbar onAutoplan={setAutoplan} />
                <Calendar days={days} onOpenBlock={setBlockId} onScheduleSeries={setSeriesPrompt} />
              </>
            )}
          </div>
        </main>

        <NowPanel onOpenBlock={setBlockId} />
      </div>

      <TimerBar onOpenBlock={setBlockId} onOpenToday={() => setTodayOpen(true)} />
      <Toasts />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TasksModal open={tasksOpen} onClose={() => setTasksOpen(false)} />
      <TodayModal
        open={todayOpen}
        onClose={() => setTodayOpen(false)}
        onOpenBlock={setBlockId}
        onAutoplan={() => setAutoplan('wand')}
      />
      <BlockModal id={blockId} onClose={() => setBlockId(null)} />
      <TaskEditModal id={taskId} onClose={() => setTaskId(null)} />
      {autoplan && (
        <AutoplanModal open onClose={() => setAutoplan(null)} preset={autoplan} />
      )}
      {seriesPrompt && (
        <SeriesScheduleModal
          taskId={seriesPrompt.taskId}
          initialDay={seriesPrompt.day}
          initialStartMin={seriesPrompt.startMin}
          onClose={() => setSeriesPrompt(null)}
        />
      )}
    </div>
  );
}
