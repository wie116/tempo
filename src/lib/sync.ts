import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Block, List, RepeatMode, Settings, Task, TaskPriority } from '../types';
import type { Database, Json } from './database.types';
import { useStore } from '../store';
import { supabase } from './supabase';
import { fetchAllPages } from './pagination';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';

interface SyncState {
  status: SyncStatus;
  lastError: string | null;
  lastSyncedAt: number | null;
  pendingChanges: boolean;
  concurrentChange: boolean;
  set: (patch: Partial<SyncState>) => void;
}

export const useSync = create<SyncState>((set) => ({
  status: 'off',
  lastError: null,
  lastSyncedAt: null,
  pendingChanges: false,
  concurrentChange: false,
  set: (patch) => set(patch),
}));

/* ---------- Traducción entre el modelo local y las filas de Postgres ---------- */

type Tables = Database['public']['Tables'];
type ListRow = Tables['lists']['Row'];
type ListInsert = Tables['lists']['Insert'];
type TaskRow = Tables['tasks']['Row'];
type TaskInsert = Tables['tasks']['Insert'];
type BlockRow = Tables['blocks']['Row'];
type BlockInsert = Tables['blocks']['Insert'];
type SyncRows = { lists: ListRow; tasks: TaskRow; blocks: BlockRow };

const settingsJson = (settings: Settings) => settings as unknown as NonNullable<Json>;

const repeatMode = (value: string | null): RepeatMode => (
  value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly'
    ? value
    : 'none'
);

const taskPriority = (value: string | null): TaskPriority => (
  value === 'low' || value === 'high' || value === 'urgent' ? value : 'normal'
);

const listToRow = (l: List, userId: string): ListInsert => ({
  id: l.id, user_id: userId, name: l.name, color: l.color,
  sort_order: l.order, collapsed: l.collapsed, scope: l.scope,
});
const rowToList = (r: ListRow): List => ({
  id: r.id, name: r.name, color: r.color, order: r.sort_order ?? 0,
  collapsed: !!r.collapsed, scope: r.scope === 'routine' ? 'routine' : 'todo',
});

const taskToRow = (t: Task, userId: string): TaskInsert => ({
  id: t.id, user_id: userId, list_id: t.listId, title: t.title,
  estimated_min: t.estimatedMin, color: t.color, is_recurring: t.recurring,
  repeat: t.repeat, repeat_until: t.repeatUntil, repeat_weekdays: t.repeatWeekdays,
  priority: t.priority, planned_date: t.plannedDate, due_date: t.dueDate, is_inbox: t.inbox,
  is_archived: t.archived, notes: t.notes ?? '', sort_order: t.order,
});
const rowToTask = (r: TaskRow): Task => ({
  id: r.id, listId: r.list_id ?? '', title: r.title,
  estimatedMin: r.estimated_min ?? null, color: r.color ?? null,
  recurring: !!r.is_recurring, repeat: repeatMode(r.repeat), repeatUntil: r.repeat_until ?? null,
  repeatWeekdays: r.repeat_weekdays ?? null,
  priority: taskPriority(r.priority), plannedDate: r.planned_date ?? null,
  dueDate: r.due_date ?? null, inbox: !!r.is_inbox,
  archived: !!r.is_archived, notes: r.notes ?? '', order: r.sort_order ?? 0,
});

const blockToRow = (b: Block, userId: string): BlockInsert => ({
  id: b.id, user_id: userId, task_id: b.taskId, title: b.title, color: b.color,
  starts_at: b.startsAt, duration_min: b.durationMin, kind: b.kind,
  status: b.status, closed_at: b.closedAt, pinned: b.pinned,
  series_id: b.seriesId, notes: b.notes ?? '', icon: b.icon ?? null,
  repeat: b.repeat ?? 'none', repeat_until: b.repeatUntil ?? null, repeat_weekdays: b.repeatWeekdays ?? null,
});
const rowToBlock = (r: BlockRow): Block => ({
  id: r.id, taskId: r.task_id ?? null, title: r.title, color: r.color,
  startsAt: r.starts_at, durationMin: r.duration_min,
  kind: r.kind === 'break' || r.kind === 'adhoc' ? r.kind : 'task',
  status: r.status === 'done' || r.status === 'skipped' ? r.status : 'planned',
  closedAt: r.closed_at ?? null, pinned: !!r.pinned,
  seriesId: r.series_id ?? null, notes: r.notes ?? '', icon: r.icon ?? null,
  repeat: repeatMode(r.repeat), repeatUntil: r.repeat_until ?? null, repeatWeekdays: r.repeat_weekdays ?? null,
  source: r.source === 'google-calendar' ? 'google-calendar' : 'tempo',
  external: r.external_ref as Block['external'] ?? null,
  syncStatus: r.sync_status === 'synced' || r.sync_status === 'pending' || r.sync_status === 'conflict' || r.sync_status === 'error' ? r.sync_status : 'local',
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

/**
 * Si acabamos de escribir, una bajada que ya estaba en camino (disparada por
 * el eco de Realtime de nuestro propio cambio anterior) todavía puede
 * pensar que el dato viejo es el vigente y pisar lo que recién restauraste.
 * Mientras esta ventana esté abierta, confiamos en lo local y no bajamos nada.
 */
let suppressPullUntil = 0;
export function holdPulls(ms = 2000): void {
  suppressPullUntil = Math.max(suppressPullUntil, Date.now() + ms);
}
let applyingRemote = false;

/** El historial de deshacer no debe registrar lo que baja de la nube. */
export const isApplyingRemote = () => applyingRemote;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeStore: (() => void) | null = null;
let channel: RealtimeChannel | null = null;

/* ---------- Bajar todo ---------- */

type SyncTable = 'lists' | 'tasks' | 'blocks';

/** Descarga una tabla completa sin depender del máximo de filas de PostgREST. */
async function fetchAllRows<T extends SyncTable>(table: T): Promise<SyncRows[T][]> {
  const client = supabase;
  if (!client) return [];
  return fetchAllPages(async (from, to) => {
    // El orden estable es obligatorio al paginar: evita saltos o duplicados
    // entre páginas aunque Postgres cambie su plan de ejecución.
    const { data, error } = await client
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as unknown as SyncRows[T][];
  });
}

export async function pullAll(): Promise<void> {
  if (!supabase || !userId) return;
  useSync.getState().set({ status: 'syncing', lastError: null });

  try {
    const [listRows, taskRows, blockRows, profile] = await Promise.all([
      fetchAllRows('lists'),
      fetchAllRows('tasks'),
      fetchAllRows('blocks'),
      supabase.from('profiles').select('settings').eq('id', userId).maybeSingle(),
    ]);
    if (profile.error) throw profile.error;

    const lists = listRows.map(rowToList).sort((a, c) => a.order - c.order);
    const tasks = taskRows.map(rowToTask);
    const blocks: Record<string, Block> = {};
    for (const row of blockRows) {
      const blk = rowToBlock(row);
      blocks[blk.id] = blk;
    }

    applyingRemote = true;
    const current = useStore.getState();
    const remoteSettings = (profile.data?.settings ?? {}) as unknown as Partial<Settings>;
    const settings = { ...current.settings, ...remoteSettings };
    useStore.setState({ lists, tasks, blocks, settings });
    applyingRemote = false;

    synced = snapshotOf(lists, tasks, blocks, settings);
    useSync.getState().set({ status: 'idle', lastSyncedAt: Date.now(), pendingChanges: false });
  } catch (error: any) {
    applyingRemote = false;
    useSync.getState().set({ status: 'error', lastError: error?.message ?? 'No se pudieron bajar todos los datos' });
  }
}

/** Primera vez: si la nube está vacía y acá hay datos, los subimos. */
async function seedRemoteIfEmpty(): Promise<boolean> {
  if (!supabase || !userId) return false;
  const { count, error } = await supabase.from('lists').select('id', { count: 'exact', head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return false;

  const { lists, tasks, blocks, settings } = useStore.getState();
  if (lists.length === 0 && Object.keys(blocks).length === 0) return false;

  await uploadEverything(lists, tasks, blocks, settings);
  synced = snapshotOf(lists, tasks, blocks, settings);
  return true;
}

/** Sube el estado completo, en tandas y comprobando cada paso. */
async function uploadEverything(
  lists: List[], tasks: Task[], blocks: Record<string, Block>, settings: Settings
): Promise<void> {
  if (!supabase || !userId) return;

  const chunk = <T,>(arr: T[], n = 400): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  // Padres primero: un bloque no puede apuntar a una tarea que todavía no existe.
  for (const part of chunk(lists)) {
    const { error } = await supabase.from('lists').upsert(part.map((x) => listToRow(x, userId!)));
    if (error) throw new Error(`Grupos: ${error.message}`);
  }
  for (const part of chunk(tasks)) {
    const { error } = await supabase.from('tasks').upsert(part.map((x) => taskToRow(x, userId!)));
    if (error) throw new Error(`Tareas: ${error.message}`);
  }
  for (const part of chunk(Object.values(blocks))) {
    const { error } = await supabase.from('blocks').upsert(part.map((x) => blockToRow(x, userId!)));
    if (error) throw new Error(`Bloques: ${error.message}`);
  }
  const { error } = await supabase.from('profiles').upsert({ id: userId, settings: settingsJson(settings) });
  if (error) throw new Error(`Ajustes: ${error.message}`);

  suppressPullUntil = Date.now() + 1200;
}

/** Fuerza la subida de todo, ignorando lo que creíamos ya sincronizado. */
export async function forcePushAll(): Promise<void> {
  if (!supabase || !userId) return;
  useSync.getState().set({ status: 'syncing', lastError: null });
  try {
    const { lists, tasks, blocks, settings } = useStore.getState();
    await uploadEverything(lists, tasks, blocks, settings);
    synced = snapshotOf(lists, tasks, blocks, settings);
    useSync.getState().set({ status: 'idle', lastSyncedAt: Date.now(), pendingChanges: false });
  } catch (e: any) {
    const language = useStore.getState().settings.language;
    useSync.getState().set({ status: 'error', lastError: e?.message ?? (language === 'en' ? 'Upload error' : 'Error al subir') });
  }
}

/** Cuántas filas hay realmente del lado del servidor. */
export async function fetchRemoteCounts(): Promise<{ lists: number; tasks: number; blocks: number } | null> {
  if (!supabase || !userId) return null;
  const head = { count: 'exact' as const, head: true };
  const [l, t, b] = await Promise.all([
    supabase.from('lists').select('id', head),
    supabase.from('tasks').select('id', head),
    supabase.from('blocks').select('id', head),
  ]);
  if (l.error || t.error || b.error) return null;
  return { lists: l.count ?? 0, tasks: t.count ?? 0, blocks: b.count ?? 0 };
}

/* ---------- Subir solo lo que cambió ---------- */

function pushChanges(): Promise<void> {
  pushChain = pushChain.then(doPush).catch(() => {});
  return pushChain;
}

async function doPush(): Promise<void> {
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
  if (nothing) {
    useSync.getState().set({ pendingChanges: false });
    return;
  }

  useSync.getState().set({ status: 'syncing' });

  try {
    // Orden importante: primero borrar hijos, después padres.
    if (goneBlocks.length) {
      const { error } = await supabase.from('blocks').delete().in('id', goneBlocks);
      if (error) throw new Error(`Borrar bloques: ${error.message}`);
    }
    if (goneTasks.length) {
      const { error } = await supabase.from('tasks').delete().in('id', goneTasks);
      if (error) throw new Error(`Borrar tareas: ${error.message}`);
    }
    if (goneLists.length) {
      const { error } = await supabase.from('lists').delete().in('id', goneLists);
      if (error) throw new Error(`Borrar grupos: ${error.message}`);
    }

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
      const { error } = await supabase.from('profiles').upsert({ id: userId, settings: settingsJson(settings) });
      if (error) throw error;
    }

    synced = next;
    // Acabamos de escribir: si una bajada estaba en camino (el eco de Realtime
    // de este mismo cambio), le damos margen para no pisar lo que recién subió.
    suppressPullUntil = Date.now() + 1200;
    useSync.getState().set({ status: 'idle', lastError: null, lastSyncedAt: Date.now(), pendingChanges: false });
  } catch (e: any) {
    const language = useStore.getState().settings.language;
    useSync.getState().set({ status: 'error', lastError: e?.message ?? (language === 'en' ? 'Sync error' : 'Error al sincronizar') });
  }
}

/* ---------- Arranque y apagado ---------- */

export async function startSync(uid: string): Promise<void> {
  if (!supabase) return;
  // Supabase puede volver a avisar "sesión iniciada" sin que haya pasado nada
  // (se renovó el token solo, la pestaña recuperó el foco). Si ya estábamos
  // sincronizando para este mismo usuario, no hay que reiniciar nada: frenar
  // y volver a bajar todo tiraría a la basura una subida que esté en camino.
  if (userId === uid) return;
  stopSync();
  userId = uid;

  try {
    const seeded = await seedRemoteIfEmpty();
    if (!seeded) await pullAll();
    else useSync.getState().set({ status: 'idle', lastSyncedAt: Date.now(), pendingChanges: false });
  } catch (e: any) {
    const language = useStore.getState().settings.language;
    useSync.getState().set({ status: 'error', lastError: e?.message ?? (language === 'en' ? 'Could not upload your schedule' : 'No se pudo subir tu agenda') });
  }

  // Cada cambio local se agrupa 500 ms antes de viajar: escribir en un campo
  // de texto no dispara veinte peticiones.
  unsubscribeStore = useStore.subscribe((state, previous) => {
    if (applyingRemote) return;
    if (state.lists === previous.lists && state.tasks === previous.tasks && state.blocks === previous.blocks && state.settings === previous.settings) return;
    useSync.getState().set({ pendingChanges: true });
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void pushChanges(), 500);
  });

  channel = supabase
    .channel('tempo-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'blocks' }, schedulePull)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, schedulePull)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, schedulePull)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` }, schedulePull)
    .subscribe();

  window.addEventListener('beforeunload', flushSync);
}

/**
 * Un cambio desde otro dispositivo: volvemos a bajar todo.
 * Antes de bajar, mandamos lo que tengamos pendiente. Si no, la bajada
 * pisaría un cambio local recién hecho y el bloque "volvería" a su lugar viejo.
 */
function schedulePull() {
  if (pushTimer) useSync.getState().set({ concurrentChange: true });
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(async () => {
    await pushPending();
    if (Date.now() < suppressPullUntil) return; // acabamos de escribir: lo local manda
    await pullAll();
  }, 800);
}

/** Vacía la cola de subida y espera a que termine. */
async function pushPending(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  await pushChanges();
}

function flushSync() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    void pushChanges();
  }
}

/** Nunca dos subidas a la vez: la segunda espera a la primera. */
let pushChain: Promise<void> = Promise.resolve();

export function stopSync(): void {
  if (unsubscribeStore) { unsubscribeStore(); unsubscribeStore = null; }
  if (channel) { void supabase?.removeChannel(channel); channel = null; }
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  if (pullTimer) { clearTimeout(pullTimer); pullTimer = null; }
  window.removeEventListener('beforeunload', flushSync);
  userId = null;
  synced = emptySnapshot();
  useSync.getState().set({ status: 'off', lastError: null, lastSyncedAt: null, pendingChanges: false, concurrentChange: false });
}

/** Fuerza una subida inmediata, sin esperar el agrupado. */
export const syncNow = () => { flushSync(); return pushChanges(); };
