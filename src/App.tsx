import { lazy, Suspense, useEffect, useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore, useToasts, useUI } from './store';
import { minutesOf, weekDays } from './lib/time';
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
import { TimerBar } from './components/TimerBar';
import { Toasts } from './components/Toasts';

const MonthView = lazy(() => import('./components/MonthView').then((m) => ({ default: m.MonthView })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const TasksModal = lazy(() => import('./components/TasksModal').then((m) => ({ default: m.TasksModal })));
const TaskEditModal = lazy(() => import('./components/TasksModal').then((m) => ({ default: m.TaskEditModal })));
const BlockModal = lazy(() => import('./components/BlockModal').then((m) => ({ default: m.BlockModal })));
const AutoplanModal = lazy(() => import('./components/AutoplanModal').then((m) => ({ default: m.AutoplanModal })));
const TodayModal = lazy(() => import('./components/TodayModal').then((m) => ({ default: m.TodayModal })));
const OnboardingModal = lazy(() => import('./components/OnboardingModal').then((m) => ({ default: m.OnboardingModal })));

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
  const [integrationNotice, setIntegrationNotice] = useState<string | null>(null);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [autoplan, setAutoplan] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => localStorage.getItem('tempo-onboarding-v2') !== 'done');
  const finishOnboarding = () => { localStorage.setItem('tempo-onboarding-v2', 'done'); setOnboardingOpen(false); };
  const locateBlock = (id: string) => {
    const block = useStore.getState().blocks[id];
    if (!block) return;
    useStore.getState().setCursor(block.startsAt.slice(0, 10));
    useStore.getState().setView('day');
    useUI.getState().setMulti([id]);
    useUI.getState().focusBlock(id);
    setActivityOpen(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.focus({ preventScroll: true });
    }));
  };

  const anchor = parseISO(cursor);
  const days = view === 'day' ? [anchor] : weekDays(anchor, mondayFirst);

  useClockEngine();

  // En una pantalla angosta una semana de siete columnas pierde legibilidad.
  // Abrimos en Día la primera vez; si el usuario elige Semana después, respetamos esa decisión.
  useEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches && useStore.getState().view === 'week') {
      useStore.getState().setView('day');
    }
  }, []);

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
    const url = new URL(window.location.href);
    const result = url.searchParams.get('google_calendar');
    if (result !== 'connected' && result !== 'error') return;
    setIntegrationNotice(result);
    setSettingsOpen(true);
    url.searchParams.delete('google_calendar');
    window.history.replaceState({}, '', url);
  }, []);

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
      if ((e.ctrlKey || e.metaKey) && !typingNow(e.target) && e.key.toLowerCase() === 'c') {
        const ui = useUI.getState();
        const ids = ui.multi.length ? ui.multi : ui.focusedBlockId ? [ui.focusedBlockId] : [];
        if (!ids.length) return;
        e.preventDefault();
        ui.setClipboard(ids);
        useToasts.getState().push({ title: `${ids.length} ${ids.length === 1 ? 'bloque copiado' : 'bloques copiados'}`, body: 'Pegá con Ctrl+V o Cmd+V.', kind: 'info', ttl: 1800 });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !typingNow(e.target) && e.key.toLowerCase() === 'v') {
        const ui = useUI.getState();
        const state = useStore.getState();
        const ids = ui.clipboardIds.filter((id) => state.blocks[id]);
        if (!ids.length) return;
        const anchor = [...ids].map((id) => state.blocks[id]).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
        e.preventDefault();
        // Una franja activa (el pequeño selector Bloque/Pausa) es el destino
        // explícito. El primer bloque copiado cae ahí y el resto conserva su
        // separación original. Sin franja, pegamos diez minutos después.
        const targetDay = ui.range ? parseISO(ui.range.dayKey) : parseISO(anchor.startsAt);
        const targetStart = ui.range ? ui.range.startMin : Math.min(24 * 60, minutesOf(anchor.startsAt) + 10);
        const pasted = state.placeBlockGroup(ids, anchor.id, targetDay, targetStart, true);
        ui.setMulti(pasted);
        ui.focusBlock(pasted[0] ?? null);
        useToasts.getState().push({ title: `${pasted.length} ${pasted.length === 1 ? 'bloque pegado' : 'bloques pegados'}`, kind: 'info', ttl: 1500 });
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
        onOpenActivity={() => setActivityOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 shrink-0 border-r border-line xl:block">
          <Sidebar onOpenTasks={() => setTasksOpen(true)} onEditTask={setTaskId} />
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex bg-black/30 xl:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="h-full w-[22rem] max-w-[92%] shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
              <Suspense fallback={<div className="grid h-full place-items-center text-[12px] text-muted">Abriendo mes…</div>}>
                <MonthView anchor={anchor} />
              </Suspense>
            ) : (
              <>
                <Toolbar onAutoplan={() => setAutoplan(true)} />
                <Calendar days={days} onOpenBlock={setBlockId} />
              </>
            )}
          </div>
        </main>

        <NowPanel
          onOpenBlock={setBlockId}
          onLocateBlock={locateBlock}
          onAutoplan={() => { setActivityOpen(false); setAutoplan(true); }}
          mobileOpen={activityOpen}
          onCloseMobile={() => setActivityOpen(false)}
        />
      </div>

      <TimerBar onOpenBlock={setBlockId} onOpenToday={() => setTodayOpen(true)} />
      <Toasts />

      <Suspense fallback={null}>
        <SettingsModal
          open={settingsOpen}
          onClose={() => { setSettingsOpen(false); setIntegrationNotice(null); }}
          integrationNotice={integrationNotice}
        />
        <TasksModal open={tasksOpen} onClose={() => setTasksOpen(false)} />
        <TodayModal
          open={todayOpen}
          onClose={() => setTodayOpen(false)}
          onOpenBlock={setBlockId}
          onAutoplan={() => setAutoplan(true)}
        />
        <BlockModal id={blockId} onClose={() => setBlockId(null)} />
        <TaskEditModal id={taskId} onClose={() => setTaskId(null)} />
        {autoplan && (
          <AutoplanModal open onClose={() => setAutoplan(false)} />
        )}
        <OnboardingModal open={onboardingOpen} onDone={finishOnboarding} />
      </Suspense>
    </div>
  );
}
