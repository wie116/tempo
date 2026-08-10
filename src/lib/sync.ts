import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Block, List, Settings, Task } from '../types';
import { useStore } from '../store';
import { supabase } from './supabase';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';

interface SyncState {
  status: SyncStatus;
  lastError: string | null;
  lastSyncedAt: number | null;
  set: (patch: Partial<SyncState>) => void;
}

export const useSync = create<SyncState>((set) => ({
  status: 'off',
  lastError: null,
  lastSyncedAt: null,
  set: (patch) => set(patch),
}));

/* ---------- Traducción entre el modelo local y las filas de Postgres ---------- */

const listToRow = (l: List, userId: string) => ({
  id: l.id, user_id: userId, name: l.name, color: l.color,
  sort_order: l.order, collapsed: l.collapsed,
});
const rowToList = (r: any): List => ({
  id: r.id, name: r.name, color: r.color, order: r.sort_order ?? 0, collapsed: !!r.collapsed,
});

const taskToRow = (t: Task, userId: string) => ({
  id: t.id, user_id: userId, list_id: t.listId, title: t.title,
  estimated_min: t.estimatedMin, color: t.color, is_recurring: t.recurring,
  is_archived: t.archived, notes: t.notes ?? '', sort_order: t.order,
});
const rowToTask = (r: any): Task => ({
  id: r.id, listId: r.list_id, title: r.title,
  estimatedMin: r.estimated_min ?? null, color: r.color ?? null,
  recurring: !!r.is_recurring, archived: !!r.is_archived,
  notes: r.notes ?? '', order: r.sort_order ?? 0,
});

const blockToRow = (b: Block, userId: string) => ({
  id: b.id, user_id: userId, task_id: b.taskId, title: b.title, color: b.color,
  starts_at: b.startsAt, duration_min: b.durationMin, kind: b.kind,
  status: b.status, closed_at: b.closedAt, notes: b.notes ?? '',
});
const rowToBlock = (r: any): Block => ({
  id: r.id, taskId: r.task_id ?? null, title: r.title, color: r.color,
  startsAt: r.starts_at, durationMin: r.duration_min, kind: r.kind,
  status: r.status, closedAt: r.closed_at ?? null, notes: r.notes ?? '',
});

/* ---------- Instantánea para saber qué cambió ---------- */

interface Snapshot {
  lists: Record<string, string>;
  tasks: Record<string, string>;
  blocks: Record<string, string>;
  settings: string;
}

const emptySnapshot = (): Snapshot => ({ lists: {}, tasks: {}, blocks: {}, settings: '' });

function snapshotOf(lists: List[], tasks: Task[], blocks: Record<string, Block>, settings: Settings): Snapshot {
  const s = emptySnapshot();
  for (const l of lists) s.lists[l.id] = JSON.stringify(l);
  for (const t of tasks) s.tasks[t.id] = JSON.stringify(t);
  for (const b of Object.values(blocks)) s.blocks[b.id] = JSON.stringify(b);
  s.settings = JSON.stringify(settings);
  return s;
}

let synced: Snapshot = emptySnapshot();
let userId: string | null = null;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeStore: (() => void) | null = null;
let channel: RealtimeChannel | null = null;

/* ---------- Bajar todo ---------- */

export async function pullAll(): Promise<void> {
  if (!supabase || !userId) return;
  useSync.getState().set({ status: 'syncing', lastError: null });

  const [l, t, b, p] = await Promise.all([
    supabase.from('lists').select('*'),
    supabase.from('tasks').select('*'),
    supabase.from('blocks').select('*'),
    supabase.from('profiles').select('settings').eq('id', userId).maybeSingle(),
  ]);

  const err = l.error || t.error || b.error || p.error;
  if (err) {
    useSync.getState().set({ status: 'error', lastError: err.message });
    return;
  }

  const lists = (l.data ?? []).map(rowToList).sort((a, c) => a.order - c.order);
  const tasks = (t.data ?? []).map(rowToTask);
  const blocks: Record<string, Block> = {};
  for (const row of b.data ?? []) {
    const blk = rowToBlock(row);
    blocks[blk.id] = blk;
  }

  applyingRemote = true;
  const current = useStore.getState();
  const remoteSettings = (p.data?.settings ?? {}) as Partial<Settings>;
  const settings = { ...current.settings, ...remoteSettings };
  useStore.setState({ lists, tasks, blocks, settings });
  applyingRemote = false;

  synced = snapshotOf(lists, tasks, blocks, settings);
  useSync.getState().set({ status: 'idle', lastSyncedAt: Date.now() });
}

/** Primera vez: si la nube está vacía y acá hay datos, los subimos. */
async function seedRemoteIfEmpty(): Promise<boolean> {
  if (!supabase || !userId) return false;
  const { count, error } = await supabase.from('lists').select('id', { count: 'exact', head: true });
  if (error) return false;
  if ((count ?? 0) > 0) return false;

  const { lists, tasks, blocks, settings } = useStore.getState();
  if (lists.length === 0 && Object.keys(blocks).length === 0) return false;

  await supabase.from('lists').upsert(lists.map((x) => listToRow(x, userId!)));
  await supabase.from('tasks').upsert(tasks.map((x) => taskToRow(x, userId!)));
  await supabase.from('blocks').upsert(Object.values(blocks).map((x) => blockToRow(x, userId!)));
  await supabase.from('profiles').upsert({ id: userId, settings });
  synced = snapshotOf(lists, tasks, blocks, settings);
  return true;
}

/* ---------- Subir solo lo que cambió ---------- */

async function pushChanges(): Promise<void> {
  if (!supabase || !userId || applyingRemote) return;
  const { lists, tasks, blocks, settings } = useStore.getState();
  const next = snapshotOf(lists, tasks, blocks, settings);

  const changedLists = lists.filter((x) => next.lists[x.id] !== synced.lists[x.id]);
  const changedTasks = tasks.filter((x) => next.tasks[x.id] !== synced.tasks[x.id]);
  const changedBlocks = Object.values(blocks).filter((x) => next.blocks[x.id] !== synced.blocks[x.id]);

  const goneLists = Object.keys(synced.lists).filter((id) => !(id in next.lists));
  const goneTasks = Object.keys(synced.tasks).filter((id) => !(id in next.tasks));
  const goneBlocks = Object.keys(synced.blocks).filter((id) => !(id in next.blocks));
  const settingsChanged = next.settings !== synced.settings;

  const nothing =
    !changedLists.length && !changedTasks.length && !changedBlocks.length &&
    !goneLists.length && !goneTasks.length && !goneBlocks.length && !settingsChanged;
  if (nothing) return;

  useSync.getState().set({ status: 'syncing' });

  try {
    // Orden importante: primero borrar hijos, después padres.
    if (goneBlocks.length) await supabase.from('blocks').delete().in('id', goneBlocks);
    if (goneTasks.length) await supabase.from('tasks').delete().in('id', goneTasks);
    if (goneLists.length) await supabase.from('lists').delete().in('id', goneLists);

    // Y al insertar, al revés: padres primero.
    if (changedLists.length) {
      const { error } = await supabase.from('lists').upsert(changedLists.map((x) => listToRow(x, userId!)));
      if (error) throw error;
    }
    if (changedTasks.length) {
      const { error } = await supabase.from('tasks').upsert(changedTasks.map((x) => taskToRow(x, userId!)));
      if (error) throw error;
    }
    if (changedBlocks.length) {
      const { error } = await supabase.from('blocks').upsert(changedBlocks.map((x) => blockToRow(x, userId!)));
      if (error) throw error;
    }
    if (settingsChanged) {
      const { error } = await supabase.from('profiles').upsert({ id: userId, settings });
      if (error) throw error;
    }

    synced = next;
    useSync.getState().set({ status: 'idle', lastError: null, lastSyncedAt: Date.now() });
  } catch (e: any) {
    useSync.getState().set({ status: 'error', lastError: e?.message ?? 'Error al sincronizar' });
  }
}

/* ---------- Arranque y apagado ---------- */

export async function startSync(uid: string): Promise<void> {
  if (!supabase) return;
  stopSync();
  userId = uid;

  const seeded = await seedRemoteIfEmpty();
  if (!seeded) await pullAll();
  else useSync.getState().set({ status: 'idle', lastSyncedAt: Date.now() });

  // Cada cambio local se agrupa 500 ms antes de viajar: escribir en un campo
  // de texto no dispara veinte peticiones.
  unsubscribeStore = useStore.subscribe(() => {
    if (applyingRemote) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void pushChanges(), 500);
  });

  channel = supabase
    .channel('tempo-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'blocks' }, schedulePull)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, schedulePull)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, schedulePull)
    .subscribe();

  window.addEventListener('beforeunload', flushSync);
}

/** Un cambio desde otro dispositivo: volvemos a bajar todo, que es más simple y seguro. */
function schedulePull() {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(() => void pullAll(), 800);
}

function flushSync() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    void pushChanges();
  }
}

export function stopSync(): void {
  if (unsubscribeStore) { unsubscribeStore(); unsubscribeStore = null; }
  if (channel) { void supabase?.removeChannel(channel); channel = null; }
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  if (pullTimer) { clearTimeout(pullTimer); pullTimer = null; }
  window.removeEventListener('beforeunload', flushSync);
  userId = null;
  synced = emptySnapshot();
  useSync.getState().set({ status: 'off', lastError: null, lastSyncedAt: null });
}

/** Fuerza una subida inmediata, sin esperar el agrupado. */
export const syncNow = () => { flushSync(); return pushChanges(); };
