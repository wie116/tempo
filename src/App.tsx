import { useEffect, useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore, useUI } from './store';
import { dateKey, weekDays, zoomStep } from './lib/time';
import { unlockAudio } from './lib/audio';
import { useClockEngine } from './hooks/useClockEngine';
import { TopBar } from './components/TopBar';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { NowPanel } from './components/NowPanel';
import { Calendar } from './components/Calendar';
import { MonthView } from './components/MonthView';
import { TimerBar } from './components/TimerBar';
import { Toasts } from './components/Toasts';
import { SettingsModal } from './components/SettingsModal';
import { TasksModal } from './components/TasksModal';
import { BlockModal } from './components/BlockModal';
import { AutoplanModal } from './components/AutoplanModal';
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
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const cursor = useStore((s) => s.cursor);
  const setCursor = useStore((s) => s.setCursor);
  const theme = useStore((s) => s.settings.theme);
  const slotPx = useStore((s) => s.settings.slotPx);
  const setZoom = useStore((s) => s.setZoom);
  const mondayFirst = useStore((s) => s.settings.weekStartsOnMonday);
  const setTool = useUI((s) => s.setTool);
  const clearSelection = useUI((s) => s.clearSelection);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [autoplan, setAutoplan] = useState<'wand' | 'dice' | null>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { clearSelection(); return; }
      if (typingNow(e.target)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ui = useUI.getState();
        const ids = ui.multi.length ? ui.multi : ui.focusedBlockId ? [ui.focusedBlockId] : [];
        if (ids.length) {
          e.preventDefault();
          useStore.getState().removeBlocks(ids);
          ui.clearSelection();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'd': setView('day'); break;
        case 's': case 'w': setView('week'); break;
        case 'm': setView('month'); break;
        case 't': setCursor(dateKey(new Date())); break;
        case 'v': setTool('select'); break;
        case 'c': setTool('box'); break;
        case 'r': {
          const st = useStore.getState();
          st.updateSettings({ rightPanelOpen: !st.settings.rightPanelOpen });
          break;
        }
        case 'l': setTasksOpen(true); break;
        case 'h': setTodayOpen(true); break;
        case '+': case '=': setZoom(zoomStep(slotPx, 1)); break;
        case '-': setZoom(zoomStep(slotPx, -1)); break;
        case ',': setSettingsOpen(true); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setView, setCursor, setTool, clearSelection, setZoom, slotPx]);

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
          <Sidebar onOpenTasks={() => setTasksOpen(true)} />
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="h-full w-80 max-w-[88%] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <Sidebar
                onOpenTasks={() => { setTasksOpen(true); setSidebarOpen(false); }}
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
                <Calendar days={days} onOpenBlock={setBlockId} />
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
      {autoplan && (
        <AutoplanModal open onClose={() => setAutoplan(null)} preset={autoplan} />
      )}
    </div>
  );
}
