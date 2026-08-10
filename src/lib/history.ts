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
  sync: () => void;
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
  sync: () => set({ canUndo: past.length > 0, canRedo: future.length > 0 }),
}));

const snapOf = (s: { lists: List[]; tasks: Task[]; blocks: Record<string, Block> }): Snap => ({
  lists: s.lists,
  tasks: s.tasks,
  blocks: s.blocks,
});

export function initHistory(): () => void {
  return useStore.subscribe((state, prev) => {
    if (applying || isApplyingRemote()) return;
    // Solo nos importan los datos, no la vista ni el cursor de fecha.
    if (state.lists === prev.lists && state.tasks === prev.tasks && state.blocks === prev.blocks) return;

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
