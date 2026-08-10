import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseISO } from 'date-fns';
import type { Block, BlockKind, List, Settings, Task, ViewMode } from './types';
import { uid } from './lib/id';
import { SLOT_MIN, dateKey, isoFor, minutesOf, snap } from './lib/time';
import { PALETTE } from './lib/themes';
import type { PlanItem } from './lib/autoplan';

const DEFAULT_SETTINGS: Settings = {
  theme: 'daylight',
  dayStartHour: 6,
  dayEndHour: 23,
  slotPx: 12,
  weekStartsOnMonday: true,
  rightPanelOpen: true,
  defaultBlockMin: 30,
  soundEnabled: true,
  volume: 0.6,
  chime: 'bell',
  breakChime: 'chime',
  startChime: true,
  closePrompt: true,
  autoplan: {
    order: 'list',
    from: 'now',
    customFromMin: 9 * 60,
    untilMin: 20 * 60,
    defaultMin: 30,
    gapMin: 0,
    listIds: null,
    includeRecurring: true,
  },
};

/* ---------------------------------------------------------------
   Empaquetado: nada se superpone. El bloque recién movido manda.
---------------------------------------------------------------- */
function packDay(
  blocks: Record<string, Block>,
  dayKey: string,
  anchorId: string,
  dayEndMin: number
): Record<string, Block> {
  const sameDay = Object.values(blocks).filter((b) => b.startsAt.slice(0, 10) === dayKey);
  const anchor = sameDay.find((b) => b.id === anchorId);
  if (!anchor || sameDay.length < 2) return blocks;

  const anchorStart = minutesOf(anchor.startsAt);
  const taken = [{ start: anchorStart, end: anchorStart + anchor.durationMin }];
  const rest = sameDay
    .filter((b) => b.id !== anchorId)
    .sort((a, b) => minutesOf(a.startsAt) - minutesOf(b.startsAt) || a.id.localeCompare(b.id));

  const out = { ...blocks };
  for (const b of rest) {
    let start = minutesOf(b.startsAt);
    let guard = 0;
    let bumped = true;
    while (bumped && guard++ < 300) {
      bumped = false;
      for (const t of taken) {
        if (start < t.end && start + b.durationMin > t.start) {
          start = t.end;
          bumped = true;
        }
      }
    }
    start = snap(Math.min(start, Math.max(0, dayEndMin - b.durationMin)));
    taken.push({ start, end: start + b.durationMin });
    if (start !== minutesOf(b.startsAt)) out[b.id] = { ...b, startsAt: isoFor(parseISO(b.startsAt), start) };
  }
  return out;
}

/** Toda escritura pasa por acá: garantiza múltiplos de 10 minutos. */
function normalize(b: Block): Block {
  return {
    ...b,
    startsAt: isoFor(parseISO(b.startsAt), snap(minutesOf(b.startsAt))),
    durationMin: Math.max(SLOT_MIN, snap(b.durationMin)),
  };
}

interface State {
  lists: List[];
  tasks: Task[];
  blocks: Record<string, Block>;
  settings: Settings;
  view: ViewMode;
  cursor: string;

  setView: (v: ViewMode) => void;
  setCursor: (d: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  setZoom: (slotPx: number) => void;

  addList: (name: string) => string;
  updateList: (id: string, patch: Partial<List>) => void;
  removeList: (id: string) => void;
  toggleListCollapsed: (id: string) => void;

  addTask: (listId: string, title: string, opts?: Partial<Task>) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;

  addBlock: (b: Omit<Block, 'id'>) => string;
  blockFromTask: (taskId: string, day: Date, startMin: number, durationMin?: number) => string | null;
  addBreak: (day: Date, startMin: number, durationMin: number) => string;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  removeBlock: (id: string) => void;
  removeBlocks: (ids: string[]) => void;
  setDone: (id: string, done: boolean) => void;
  toggleDone: (id: string) => void;
  duplicateBlock: (id: string) => string | null;
  shiftBlocks: (ids: string[], deltaMin: number) => void;
  /** "Necesité más tiempo": cierra el original y agenda la continuación. */
  extendBlock: (id: string, extraMin: number) => string | null;
  applyPlan: (day: Date, items: PlanItem[]) => void;
}

function seed() {
  const l1 = uid(), l2 = uid(), l3 = uid();
  const L = (id: string, name: string, color: string, order: number): List => ({
    id, name, color, order, collapsed: false,
  });
  const lists: List[] = [
    L(l1, 'Trabajo', PALETTE[0], 0),
    L(l2, 'Personal', PALETTE[1], 1),
    L(l3, 'Rutina', PALETTE[6], 2),
  ];
  const t = (listId: string, title: string, estimatedMin: number | null, recurring = false, order = 0): Task => ({
    id: uid(), listId, title, estimatedMin, color: null, recurring, archived: false, notes: '', order,
  });
  const tasks: Task[] = [
    t(l1, 'Foco profundo', 90, false, 0),
    t(l1, 'Responder mails', 30, true, 1),
    t(l1, 'Revisar pendientes', null, false, 2),
    t(l2, 'Leer', 40, true, 0),
    t(l2, 'Trámite del banco', null, false, 1),
    t(l3, 'Movimiento', 60, true, 0),
    t(l3, 'Cierre del día', 10, true, 1),
  ];
  return { lists, tasks };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...seed(),
      blocks: {},
      settings: DEFAULT_SETTINGS,
      view: 'week',
      cursor: dateKey(new Date()),

      setView: (view) => set({ view }),
      setCursor: (cursor) => set({ cursor }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      /** Vuelve la configuración a fábrica sin tocar bloques ni tareas. */
      resetSettings: () =>
        set((s) => {
          // Respetamos la jornada mínima que exigen los bloques ya agendados.
          let latest = 0;
          let earliest = 24 * 60;
          for (const b of Object.values(s.blocks)) {
            earliest = Math.min(earliest, minutesOf(b.startsAt));
            latest = Math.max(latest, minutesOf(b.startsAt) + b.durationMin);
          }
          const has = Object.keys(s.blocks).length > 0;
          return {
            settings: {
              ...DEFAULT_SETTINGS,
              dayStartHour: has ? Math.min(DEFAULT_SETTINGS.dayStartHour, Math.floor(earliest / 60)) : DEFAULT_SETTINGS.dayStartHour,
              dayEndHour: has ? Math.max(DEFAULT_SETTINGS.dayEndHour, Math.ceil(latest / 60)) : DEFAULT_SETTINGS.dayEndHour,
            },
          };
        }),
      setZoom: (slotPx) => set((s) => ({ settings: { ...s.settings, slotPx } })),

      addList: (name) => {
        const id = uid();
        set((s) => ({
          lists: [...s.lists, { id, name, color: PALETTE[s.lists.length % PALETTE.length], order: s.lists.length, collapsed: false }],
        }));
        return id;
      },
      updateList: (id, patch) =>
        set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      removeList: (id) =>
        set((s) => ({
          lists: s.lists.filter((l) => l.id !== id),
          tasks: s.tasks.filter((t) => t.listId !== id),
        })),
      toggleListCollapsed: (id) =>
        set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, collapsed: !l.collapsed } : l)) })),

      addTask: (listId, title, opts) => {
        const id = uid();
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id, listId, title, color: null,
              recurring: false, archived: false, notes: '',
              order: s.tasks.filter((t) => t.listId === listId).length,
              ...opts,
              estimatedMin:
                opts?.estimatedMin == null ? null : Math.max(SLOT_MIN, snap(opts.estimatedMin)),
            },
          ],
        }));
        return id;
      },
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...patch,
                  estimatedMin:
                    patch.estimatedMin === undefined
                      ? t.estimatedMin
                      : patch.estimatedMin === null
                        ? null
                        : Math.max(SLOT_MIN, snap(patch.estimatedMin)),
                }
              : t
          ),
        })),
      removeTask: (id) =>
        set((s) => {
          const blocks = { ...s.blocks };
          for (const b of Object.values(blocks)) if (b.taskId === id) delete blocks[b.id];
          return { tasks: s.tasks.filter((t) => t.id !== id), blocks };
        }),

      addBlock: (b) => {
        const id = uid();
        set((s) => {
          const next = { ...s.blocks, [id]: normalize({ ...b, id }) };
          return { blocks: packDay(next, b.startsAt.slice(0, 10), id, s.settings.dayEndHour * 60) };
        });
        return id;
      },

      blockFromTask: (taskId, day, startMin, durationMin) => {
        const s = get();
        const task = s.tasks.find((t) => t.id === taskId);
        if (!task) return null;
        const list = s.lists.find((l) => l.id === task.listId);
        return s.addBlock({
          taskId,
          title: task.title,
          color: task.color ?? list?.color ?? PALETTE[0],
          startsAt: isoFor(day, startMin),
          durationMin: durationMin ?? task.estimatedMin ?? s.settings.defaultBlockMin,
          kind: 'task',
          status: 'planned',
          closedAt: null,
          notes: '',
        });
      },

      addBreak: (day, startMin, durationMin) =>
        get().addBlock({
          taskId: null, title: 'Pausa', color: 'var(--muted)',
          startsAt: isoFor(day, startMin), durationMin,
          kind: 'break', status: 'planned', closedAt: null, notes: '',
        }),

      updateBlock: (id, patch) =>
        set((s) => {
          const prev = s.blocks[id];
          if (!prev) return s;
          const merged = normalize({ ...prev, ...patch });
          const next = { ...s.blocks, [id]: merged };
          const timeChanged = merged.startsAt !== prev.startsAt || merged.durationMin !== prev.durationMin;
          return {
            blocks: timeChanged
              ? packDay(next, merged.startsAt.slice(0, 10), id, s.settings.dayEndHour * 60)
              : next,
          };
        }),

      removeBlock: (id) =>
        set((s) => {
          const blocks = { ...s.blocks };
          delete blocks[id];
          return { blocks };
        }),

      removeBlocks: (ids) =>
        set((s) => {
          const blocks = { ...s.blocks };
          for (const id of ids) delete blocks[id];
          return { blocks };
        }),

      setDone: (id, done) =>
        set((s) => {
          const b = s.blocks[id];
          if (!b) return s;
          return {
            blocks: {
              ...s.blocks,
              [id]: { ...b, status: done ? 'done' : 'planned', closedAt: done ? Date.now() : null },
            },
          };
        }),

      toggleDone: (id) => {
        const b = get().blocks[id];
        if (b) get().setDone(id, b.status !== 'done');
      },

      duplicateBlock: (id) => {
        const s = get();
        const b = s.blocks[id];
        if (!b) return null;
        return s.addBlock({
          ...b,
          startsAt: isoFor(parseISO(b.startsAt), minutesOf(b.startsAt) + b.durationMin),
          status: 'planned',
          closedAt: null,
        });
      },

      shiftBlocks: (ids, deltaMin) =>
        set((s) => {
          const blocks = { ...s.blocks };
          for (const id of ids) {
            const b = blocks[id];
            if (!b) continue;
            const start = Math.max(0, snap(minutesOf(b.startsAt) + deltaMin));
            blocks[id] = { ...b, startsAt: isoFor(parseISO(b.startsAt), start) };
          }
          return { blocks };
        }),

      extendBlock: (id, extraMin) => {
        const s = get();
        const b = s.blocks[id];
        if (!b) return null;
        s.setDone(id, true);
        const day = parseISO(b.startsAt);
        const nowMin = snap(new Date().getHours() * 60 + new Date().getMinutes());
        const after = minutesOf(b.startsAt) + b.durationMin;
        return s.addBlock({
          ...b,
          startsAt: isoFor(day, Math.max(after, nowMin)),
          durationMin: extraMin,
          status: 'planned',
          closedAt: null,
        });
      },

      applyPlan: (day, items) => {
        const s = get();
        for (const it of items) {
          s.addBlock({
            taskId: it.taskId,
            title: it.title,
            color: it.color,
            startsAt: isoFor(day, it.startMin),
            durationMin: it.durationMin,
            kind: 'task',
            status: 'planned',
            closedAt: null,
            notes: '',
          });
        }
      },
    }),
    {
      name: 'tempo-v3',
      version: 3,
      migrate: (persisted: any) => ({
        ...persisted,
        settings: {
          ...DEFAULT_SETTINGS,
          ...(persisted?.settings ?? {}),
          autoplan: { ...DEFAULT_SETTINGS.autoplan, ...(persisted?.settings?.autoplan ?? {}) },
        },
      }),
      /**
       * Red de seguridad: al abrir la app redondeamos todo a la grilla de 10 min.
       * Así ningún bloque raro guardado por una versión anterior sobrevive.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const blocks: Record<string, Block> = {};
        let dirty = false;
        for (const [id, b] of Object.entries(state.blocks ?? {})) {
          const fixed = normalize(b as Block);
          if (fixed.startsAt !== (b as Block).startsAt || fixed.durationMin !== (b as Block).durationMin) dirty = true;
          blocks[id] = fixed;
        }
        const tasks = (state.tasks ?? []).map((t) =>
          t.estimatedMin === null ? t : { ...t, estimatedMin: Math.max(SLOT_MIN, snap(t.estimatedMin)) }
        );
        if (dirty || tasks.some((t, i) => t.estimatedMin !== state.tasks[i]?.estimatedMin)) {
          useStore.setState({ blocks, tasks });
        }
      },
    }
  )
);

/* ---------- Estado de interfaz (no se persiste) ---------- */

export type Tool = 'select' | 'box';

export interface RangeSelection {
  dayKey: string;
  dayIndex: number;
  startMin: number;
  durationMin: number;
}

interface UIStore {
  tool: Tool;
  /** Franja de tiempo marcada en la grilla, todavía sin bloque. */
  range: RangeSelection | null;
  /** Bloques marcados con la herramienta de caja. */
  multi: string[];
  focusedBlockId: string | null;
  setTool: (t: Tool) => void;
  setRange: (r: RangeSelection | null) => void;
  setMulti: (ids: string[]) => void;
  focusBlock: (id: string | null) => void;
  clearSelection: () => void;
}

export const useUI = create<UIStore>((set) => ({
  tool: 'select',
  range: null,
  multi: [],
  focusedBlockId: null,
  setTool: (tool) => set({ tool, range: null, multi: [] }),
  setRange: (range) => set({ range, multi: [] }),
  setMulti: (multi) => set({ multi, range: null }),
  focusBlock: (focusedBlockId) => set({ focusedBlockId }),
  clearSelection: () => set({ range: null, multi: [], focusedBlockId: null }),
}));

/* ---------- Arrastre (efímero) ---------- */

export type DragMode = 'move' | 'resize' | 'range' | 'new' | 'box';

export interface DragState {
  mode: DragMode;
  blockId?: string;
  taskId?: string;
  title: string;
  color: string;
  kind: BlockKind;
  grabOffsetMin: number;
  durationMin: number;
  dayIndex: number;
  startMin: number;
  /** Ancla para arrastres que crecen en dos direcciones. */
  anchorMin: number;
  anchorDayIndex: number;
  moved: boolean;
}

interface DragStore {
  drag: DragState | null;
  begin: (d: DragState) => void;
  update: (patch: Partial<DragState>) => void;
  end: () => void;
}

export const useDrag = create<DragStore>((set) => ({
  drag: null,
  begin: (drag) => set({ drag }),
  update: (patch) => set((s) => (s.drag ? { drag: { ...s.drag, ...patch } } : s)),
  end: () => set({ drag: null }),
}));

/* ---------- Avisos en la app (nada de notificaciones del navegador) ---------- */

export interface Toast {
  id: string;
  title: string;
  body?: string;
  blockId?: string;
  kind: 'info' | 'close-prompt';
  /** ms; 0 = queda hasta que la cierres. */
  ttl: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts.filter((x) => x.blockId !== t.blockId || !t.blockId), { ...t, id }] }));
    if (t.ttl > 0) setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.ttl);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/* ---------- Reloj: el motor que corre siempre ---------- */

interface ClockStore {
  /** epoch ms, se refresca cada segundo mientras la pestaña está viva. */
  now: number;
  tick: () => void;
}

export const useClock = create<ClockStore>((set) => ({
  now: Date.now(),
  tick: () => set({ now: Date.now() }),
}));
