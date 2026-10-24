import { create } from 'zustand';
import type { Block, List, Task } from '../types';
import { useStore } from '../store';
import { isApplyingRemote } from './sync';

interface Snap {
  lists: List[];
  tasks: Task[];
  blocks: Record<string, Block>;
}

interface HistoryStore {
  canUndo: boolean;
  canRedo: boolean;
  entries: ActivityEntry[];
  sync: () => void;
  addEntry: (entry: Omit<ActivityEntry, 'id' | 'at'>) => void;
  clearEntries: () => void;
}

export interface ActivityEntry {
  id: string;
  at: number;
  title: string;
  detail?: string;
  blockId?: string;
}

const MAX = 80;
/** Cambios más rápidos que esto se agrupan en un solo paso. */
const COALESCE_MS = 600;

let past: Snap[] = [];
let future: Snap[] = [];
let applying = false;
let lastAt = 0;

export const useHistory = create<HistoryStore>((set) => ({
  canUndo: false,
  canRedo: false,
  entries: [],
  sync: () => set({ canUndo: past.length > 0, canRedo: future.length > 0 }),
  addEntry: (entry) => set((state) => ({
    entries: [{ ...entry, id: `${Date.now()}-${Math.random()}`, at: Date.now() }, ...state.entries].slice(0, 50),
  })),
  clearEntries: () => set({ entries: [] }),
}));

const snapOf = (s: { lists: List[]; tasks: Task[]; blocks: Record<string, Block> }): Snap => ({
  lists: s.lists,
  tasks: s.tasks,
  blocks: s.blocks,
});

function logChange(state: Snap, prev: Snap): void {
  const language = useStore.getState().settings.language;
  const before = prev.blocks;
  const after = state.blocks;
  const added = Object.values(after).filter((block) => !before[block.id]);
  const removed = Object.values(before).filter((block) => !after[block.id]);
  if (added.length) {
    useHistory.getState().addEntry({
      title: added.length === 1 ? (language === 'en' ? `Scheduled ${added[0].title}` : `Agendaste ${added[0].title}`) : (language === 'en' ? `Scheduled ${added.length} blocks` : `Agendaste ${added.length} bloques`),
      detail: added.length === 1 ? added[0].startsAt.replace('T', ' · ') : (language === 'en' ? 'The structure was saved to the schedule.' : 'La estructura quedó guardada en la agenda.'),
      blockId: added.length === 1 ? added[0].id : undefined,
    });
    return;
  }
  if (removed.length) {
    useHistory.getState().addEntry({
      title: removed.length === 1 ? (language === 'en' ? `Removed ${removed[0].title}` : `Quitaste ${removed[0].title}`) : (language === 'en' ? `Removed ${removed.length} blocks` : `Quitaste ${removed.length} bloques`),
      detail: language === 'en' ? 'You can recover it with Undo.' : 'Podés recuperarlo con Deshacer.',
    });
    return;
  }
  const changed = Object.values(after).filter((block) => before[block.id] && JSON.stringify(before[block.id]) !== JSON.stringify(block));
  if (changed.length) {
    const first = changed[0];
    const old = before[first.id];
    const statusTitle = old.status !== first.status
      ? first.status === 'done' ? (language === 'en' ? `Completed ${first.title}` : `Completaste ${first.title}`) : first.status === 'skipped' ? (language === 'en' ? `Skipped ${first.title}` : `Omitiste ${first.title}`) : (language === 'en' ? `Reopened ${first.title}` : `Reabriste ${first.title}`)
      : null;
    useHistory.getState().addEntry({
      title: statusTitle ?? (changed.length === 1 ? (language === 'en' ? `Updated ${first.title}` : `Actualizaste ${first.title}`) : (language === 'en' ? `Moved ${changed.length} blocks` : `Moviste ${changed.length} bloques`)),
      detail: old.startsAt !== first.startsAt ? `${language === 'en' ? 'New time' : 'Nuevo horario'}: ${first.startsAt.replace('T', ' · ')}` : undefined,
      blockId: first.id,
    });
    return;
  }
  const taskDelta = state.tasks.length - prev.tasks.length;
  if (taskDelta !== 0) {
    useHistory.getState().addEntry({
      title: taskDelta > 0 ? (language === 'en' ? 'Added a task' : 'Agregaste una tarea') : (language === 'en' ? 'Removed a task' : 'Quitaste una tarea'),
      detail: language === 'en' ? 'The change was saved to your plan.' : 'El cambio quedó guardado en tu plan.',
    });
  }
}

export function initHistory(): () => void {
  return useStore.subscribe((state, prev) => {
    if (applying || isApplyingRemote()) return;
    // Solo nos importan los datos, no la vista ni el cursor de fecha.
    if (state.lists === prev.lists && state.tasks === prev.tasks && state.blocks === prev.blocks) return;

    logChange(snapOf(state), snapOf(prev));

    const now = Date.now();
    // Escribir un título letra por letra no debería llenar el historial:
    // guardamos el estado del comienzo de la ráfaga y listo.
    if (now - lastAt < COALESCE_MS && past.length > 0) {
      lastAt = now;
      return;
    }

    past.push(snapOf(prev));
    if (past.length > MAX) past.shift();
    future = [];
    lastAt = now;
    useHistory.getState().sync();
  });
}

export function undo(): void {
  const snap = past.pop();
  if (!snap) return;
  future.push(snapOf(useStore.getState()));
  applying = true;
  useStore.setState(snap);
  applying = false;
  lastAt = 0;
  useHistory.getState().sync();
}

export function redo(): void {
  const snap = future.pop();
  if (!snap) return;
  past.push(snapOf(useStore.getState()));
  applying = true;
  useStore.setState(snap);
  applying = false;
  lastAt = 0;
  useHistory.getState().sync();
}

export function clearHistory(): void {
  past = [];
  future = [];
  lastAt = 0;
  useHistory.getState().sync();
}
