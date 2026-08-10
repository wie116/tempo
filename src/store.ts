import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseISO } from 'date-fns';
import type { Block, BlockKind, BlockStatus, List, Settings, Task, ViewMode } from './types';
import { uid } from './lib/id';
import { SLOT_MIN, clamp, dateKey, isoFor, minutesOf, snap } from './lib/time';
import { PALETTE } from './lib/themes';
import { expandSeries } from './lib/repeat';
import type { PlanItem } from './lib/autoplan';

/** Grupo donde caen los bloques creados a mano, sin tarea previa. */
export const UNSORTED_NAME = 'Sin clasificar';

const DEFAULT_SETTINGS: Settings = {
  theme: 'daylight',
  dayStartHour: 6,
  dayEndHour: 23,
  slotPx: 12,
  weekStartsOnMonday: true,
  rightPanelOpen: true,
  chainMove: false,
  defaultBlockMin: 10,
  soundEnabled: true,
  volume: 0.6,
  chime: 'bell',
  breakChime: 'chime',
  startChime: true,
  closePrompt: true,
  autoplan: {
    source: 'pending',
    order: 'list',
    from: 'now',
    customFromMin: 9 * 60,
    untilMin: 20 * 60,
    defaultMin: 10,
    gapMin: 0,
    listIds: null,
    includeRecurring: true,
    reassign: 'none',
    reassignMin: 30,
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

  const out = { ...blocks };
  const taken: { start: number; end: number }[] = [];

  const place = (b: Block, immovable: boolean): number => {
    let start = minutesOf(b.startsAt);
    if (!immovable) {
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
    }
    taken.push({ start, end: start + b.durationMin });
    return start;
  };

  // 1) Los fijos no se mueven jamás, ni siquiera por el bloque que acabás de soltar.
  for (const b of sameDay.filter((x) => x.pinned)) place(b, true);

  // 2) El que acabás de mover manda sobre el resto, pero cede ante un fijo.
  if (!anchor.pinned) {
    const start = place(anchor, false);
    if (start !== minutesOf(anchor.startsAt)) {
      out[anchor.id] = { ...anchor, startsAt: isoFor(parseISO(anchor.startsAt), start) };
    }
  }

  // 3) Los demás se acomodan alrededor.
  const rest = sameDay
    .filter((b) => b.id !== anchorId && !b.pinned)
    .sort((a, b) => minutesOf(a.startsAt) - minutesOf(b.startsAt) || a.id.localeCompare(b.id));

  for (const b of rest) {
    const start = place(b, false);
    if (start !== minutesOf(b.startsAt)) {
      out[b.id] = { ...b, startsAt: isoFor(parseISO(b.startsAt), start) };
    }
  }
  return out;
}

/** Toda escritura pasa por acá: garantiza múltiplos de 10 minutos. */
function normalize(b: Block): Block {
  return {
    ...b,
    pinned: Boolean(b.pinned),
    seriesId: b.seriesId ?? null,
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
  /** Grupo automático para los bloques sueltos. */
  unsortedListId: string | null;

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

  ensureUnsortedList: () => string;
  addBlock: (b: Omit<Block, 'id'>) => string;
  /** Bloque creado a mano: le damos una tarea para poder administrarlo desde el panel. */
  addAdhocBlock: (day: Date, startMin: number, durationMin: number, title?: string) => string;
  /** Reubica bloques ya existentes sin recalcular colisiones: el plan ya viene sin choques. */
  applyReorder: (day: Date, items: { blockId: string; startMin: number }[]) => void;
  /** Mueve un bloque y arrastra con él a todos los que vengan después ese día. */
  moveChain: (day: Date, blockId: string, newStartMin: number) => void;
  /** Saca bloques de la agenda y devuelve su tarea a pendientes. */
  unscheduleBlocks: (ids: string[]) => void;
  blockFromTask: (taskId: string, day: Date, startMin: number, durationMin?: number) => string | null;
  addBreak: (day: Date, startMin: number, durationMin: number) => string;
  updateBlock: (id: string, patch: Partial<Block>) => void;
  removeBlock: (id: string) => void;
  removeBlocks: (ids: string[]) => void;
  removeSeries: (seriesId: string) => void;
  /** Estira el bloque hacia arriba empujando lo de encima, sin pisarlo. */
  resizeTop: (day: Date, id: string, newStartMin: number) => void;
  setDone: (id: string, done: boolean) => void;
  /** Pendiente, completado u omitido. */
  setStatus: (id: string, status: BlockStatus) => void;
  toggleDone: (id: string) => void;
  setPinned: (ids: string[], pinned: boolean) => void;
  duplicateBlock: (id: string) => string | null;
  shiftBlocks: (ids: string[], deltaMin: number) => void;
  /** "Necesité más tiempo": cierra el original y agenda la continuación. */
  extendBlock: (id: string, extraMin: number) => string | null;
  applyPlan: (day: Date, items: PlanItem[]) => void;
  /** Crea los bloques de una serie ya resuelta (fechas puntuales, sin conflictos). */
  scheduleSeries: (taskId: string, dates: Date[], startMin: number, durationMin: number) => void;
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
    id: uid(), listId, title, estimatedMin, color: null, recurring,
    repeat: 'none', repeatUntil: null, repeatWeekdays: null, archived: false, notes: '', order,
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
      unsortedListId: null,

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
              recurring: false, repeat: 'none', repeatUntil: null, repeatWeekdays: null, archived: false, notes: '',
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

      ensureUnsortedList: () => {
        const s = get();
        const found =
          s.lists.find((l) => l.id === s.unsortedListId) ??
          s.lists.find((l) => l.name === UNSORTED_NAME);
        if (found) {
          if (s.unsortedListId !== found.id) set({ unsortedListId: found.id });
          return found.id;
        }
        const id = uid();
        set((st) => ({
          lists: [...st.lists, { id, name: UNSORTED_NAME, color: PALETTE[7], order: 999, collapsed: false }],
          unsortedListId: id,
        }));
        return id;
      },

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
        const base = {
          taskId,
          title: task.title,
          color: task.color ?? list?.color ?? PALETTE[0],
          durationMin: durationMin ?? task.estimatedMin ?? s.settings.defaultBlockMin,
          kind: 'task' as const,
          status: 'planned' as const,
          closedAt: null,
          pinned: false,
          notes: '',
        };

        if (task.repeat === 'none') {
          return s.addBlock({ ...base, startsAt: isoFor(day, startMin), seriesId: null });
        }

        // Materializamos la serie entera de una: es mucho más fácil de editar
        // y de depurar que recalcular repeticiones al vuelo.
        const seriesId = uid();
        const dates = expandSeries(day, task.repeat, task.repeatUntil, task.repeatWeekdays);
        let firstId: string | null = null;
        for (const d of dates) {
          const id = get().addBlock({ ...base, startsAt: isoFor(d, startMin), seriesId });
          if (!firstId) firstId = id;
        }
        return firstId;
      },

      addBreak: (day, startMin, durationMin) =>
        get().addBlock({
          taskId: null, title: 'Pausa', color: 'var(--muted)',
          startsAt: isoFor(day, startMin), durationMin,
          kind: 'break', status: 'planned', closedAt: null, pinned: false, seriesId: null, notes: '',
        }),

      addAdhocBlock: (day, startMin, durationMin, title = 'Bloque') => {
        const s = get();
        const listId = s.ensureUnsortedList();
        const color = get().lists.find((l) => l.id === listId)?.color ?? PALETTE[7];
        const taskId = get().addTask(listId, title, { estimatedMin: durationMin });
        return get().addBlock({
          taskId, title, color,
          startsAt: isoFor(day, startMin), durationMin,
          kind: 'adhoc', status: 'planned', closedAt: null, pinned: false, seriesId: null, notes: '',
        });
      },

      moveChain: (day, blockId, newStartMin) =>
        set((s) => {
          const anchor = s.blocks[blockId];
          if (!anchor || anchor.pinned) return s;
          const key = anchor.startsAt.slice(0, 10);
          const oldStart = minutesOf(anchor.startsAt);

          const dayBlocks = Object.values(s.blocks)
            .filter((b) => b.startsAt.slice(0, 10) === key)
            .sort((a, b) => minutesOf(a.startsAt) - minutesOf(b.startsAt));

          // La cadena arranca en el bloque que agarraste y corta en el primer fijo:
          // un bloque clavado parte el día en dos y nada lo cruza.
          const chain: Block[] = [];
          let started = false;
          for (const b of dayBlocks) {
            if (b.id === blockId) started = true;
            if (!started) continue;
            if (b.pinned) break;
            chain.push(b);
          }
          if (!chain.length) return s;

          // Topes: ni pisar el fijo de adelante ni el de atrás.
          const chainStart = minutesOf(chain[0].startsAt);
          const chainEnd = minutesOf(chain[chain.length - 1].startsAt) + chain[chain.length - 1].durationMin;
          // Hacia atrás topamos contra cualquier bloque anterior, esté fijo o no:
          // la cadena no incluye lo de antes, así que si no frenamos se solapan.
          const inChain = new Set(chain.map((b) => b.id));
          const before = dayBlocks.filter(
            (b) => !inChain.has(b.id) && minutesOf(b.startsAt) + b.durationMin <= chainStart
          );
          const pinsAfter = dayBlocks.filter((b) => b.pinned && minutesOf(b.startsAt) >= chainEnd);
          const floor = before.length
            ? Math.max(...before.map((b) => minutesOf(b.startsAt) + b.durationMin))
            : 0;
          const ceil = pinsAfter.length ? Math.min(...pinsAfter.map((b) => minutesOf(b.startsAt))) : 24 * 60;

          let delta = snap(newStartMin) - oldStart;
          delta = Math.max(delta, floor - chainStart);
          delta = Math.min(delta, ceil - chainEnd);
          if (delta === 0) return s;

          const blocks = { ...s.blocks };
          for (const b of chain) {
            blocks[b.id] = { ...b, startsAt: isoFor(day, Math.max(0, snap(minutesOf(b.startsAt) + delta))) };
          }
          return { blocks };
        }),

      applyReorder: (day, items) =>
        set((s) => {
          const blocks = { ...s.blocks };
          for (const it of items) {
            const b = blocks[it.blockId];
            if (!b) continue;
            blocks[it.blockId] = { ...b, startsAt: isoFor(day, snap(it.startMin)) };
          }
          return { blocks };
        }),

      unscheduleBlocks: (ids) => {
        for (const id of ids) {
          const b = get().blocks[id];
          if (!b) continue;
          // Un bloque suelto sin tarea detrás no puede volver a ningún lado: le creamos una.
          if (!b.taskId) {
            const listId = get().ensureUnsortedList();
            get().addTask(listId, b.title, { estimatedMin: b.durationMin });
          }
          get().removeBlock(id);
        }
      },

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

      removeSeries: (seriesId) =>
        set((s) => {
          const blocks = { ...s.blocks };
          for (const b of Object.values(s.blocks)) if (b.seriesId === seriesId) delete blocks[b.id];
          return { blocks };
        }),

      resizeTop: (day, id, newStartMin) =>
        set((s) => {
          const b = s.blocks[id];
          if (!b || b.pinned) return s;
          const key = b.startsAt.slice(0, 10);
          const end = minutesOf(b.startsAt) + b.durationMin;
          const floor = s.settings.dayStartHour * 60;

          const above = Object.values(s.blocks)
            .filter((x) => x.startsAt.slice(0, 10) === key && x.id !== id)
            .filter((x) => minutesOf(x.startsAt) < minutesOf(b.startsAt))
            .sort((a, c) => minutesOf(c.startsAt) - minutesOf(a.startsAt));

          /* Probamos un techo y vemos si lo de arriba entra empujado hacia arriba.
             Si topa contra un fijo o contra el inicio de la jornada, cedemos nosotros. */
          const simulate = (topMin: number) => {
            const moves: { id: string; start: number }[] = [];
            let ceiling = topMin;
            for (const x of above) {
              const xd = x.durationMin;
              let xs = minutesOf(x.startsAt);
              if (xs + xd > ceiling) {
                if (x.pinned) return { blockedAt: xs + xd, moves, lowest: ceiling };
                xs = snap(ceiling - xd);
                moves.push({ id: x.id, start: xs });
              }
              ceiling = Math.min(ceiling, xs);
            }
            return { blockedAt: null as number | null, moves, lowest: ceiling };
          };

          let start = snap(clamp(newStartMin, floor, end - SLOT_MIN));
          let sim = simulate(start);
          if (sim.blockedAt !== null) {
            start = snap(clamp(Math.max(start, sim.blockedAt), floor, end - SLOT_MIN));
            sim = simulate(start);
          }
          if (sim.lowest < floor) {
            start = snap(clamp(start + (floor - sim.lowest), floor, end - SLOT_MIN));
            sim = simulate(start);
          }
          if (sim.blockedAt !== null) return s;

          const blocks = { ...s.blocks };
          blocks[id] = { ...b, startsAt: isoFor(day, start), durationMin: end - start };
          for (const m of sim.moves) {
            const x = blocks[m.id];
            if (x) blocks[m.id] = { ...x, startsAt: isoFor(day, m.start) };
          }
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

      setStatus: (id, status) =>
        set((s) => {
          const b = s.blocks[id];
          if (!b) return s;
          return {
            blocks: {
              ...s.blocks,
              [id]: { ...b, status, closedAt: status === 'planned' ? null : Date.now() },
            },
          };
        }),

      toggleDone: (id) => {
        const b = get().blocks[id];
        if (b) get().setDone(id, b.status !== 'done');
      },

      setPinned: (ids, pinned) =>
        set((s) => {
          const blocks = { ...s.blocks };
          for (const id of ids) if (blocks[id]) blocks[id] = { ...blocks[id], pinned };
          return { blocks };
        }),

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

      scheduleSeries: (taskId, dates, startMin, durationMin) => {
        const s = get();
        const task = s.tasks.find((t) => t.id === taskId);
        if (!task || !dates.length) return;
        const list = s.lists.find((l) => l.id === task.listId);
        const color = task.color ?? list?.color ?? PALETTE[0];
        const seriesId = dates.length > 1 ? uid() : null;
        for (const d of dates) {
          s.addBlock({
            taskId, title: task.title, color,
            startsAt: isoFor(d, startMin), durationMin,
            kind: 'task', status: 'planned', closedAt: null,
            pinned: false, seriesId, notes: '',
          });
        }
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
            pinned: false,
            seriesId: null,
            notes: '',
          });
        }
      },
    }),
    {
      name: 'tempo-v3',
      version: 4,
      migrate: (persisted: any) => ({
        ...persisted,
        settings: {
          ...DEFAULT_SETTINGS,
          ...(persisted?.settings ?? {}),
          // El default viejo era 30; ahora arranca en 10.
          defaultBlockMin: persisted?.settings?.defaultBlockMin === 30 ? 10 : persisted?.settings?.defaultBlockMin ?? 10,
          autoplan: { ...DEFAULT_SETTINGS.autoplan, ...(persisted?.settings?.autoplan ?? {}) },
          // settings.autoplan ya trae reassign/reassignMin por el merge de arriba
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
  focusedTaskId: string | null;
  setTool: (t: Tool) => void;
  setRange: (r: RangeSelection | null) => void;
  setMulti: (ids: string[]) => void;
  focusBlock: (id: string | null) => void;
  focusTask: (id: string | null) => void;
  clearSelection: () => void;
}

export const useUI = create<UIStore>((set) => ({
  tool: 'select',
  range: null,
  multi: [],
  focusedBlockId: null,
  focusedTaskId: null,
  setTool: (tool) => set({ tool, range: null, multi: [] }),
  setRange: (range) => set({ range, multi: [] }),
  setMulti: (multi) => set({ multi, range: null }),
  focusBlock: (focusedBlockId) => set({ focusedBlockId, focusedTaskId: null }),
  focusTask: (focusedTaskId) => set({ focusedTaskId, focusedBlockId: null }),
  clearSelection: () => set({ range: null, multi: [], focusedBlockId: null, focusedTaskId: null }),
}));

/* ---------- Arrastre (efímero) ---------- */

export type DragMode = 'move' | 'resize' | 'resizeTop' | 'range' | 'new' | 'box';

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
  /** Muestra un botón de deshacer que llama a esto. */
  onUndo?: () => void;
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
