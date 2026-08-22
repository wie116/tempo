import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import type { Block, BlockKind, BlockStatus, List, Settings, Task, ViewMode } from './types';
import { uid } from './lib/id';
import { SLOT_MIN, clamp, dateKey, isoFor, minutesOf, snap } from './lib/time';
import { PALETTE } from './lib/themes';
import { expandSeries } from './lib/repeat';
import type { PlanItem } from './lib/autoplan';
import { applyBlockPatches, isReadOnlyBlock, normalizeBlock, packDay } from './lib/planning';
import { findAvailableStart } from './lib/conflicts';

/** Grupo donde caen los bloques creados a mano, sin tarea previa. */
export const UNSORTED_NAME = 'Sin clasificar';

const DEFAULT_SETTINGS: Settings = {
  theme: 'daylight',
  dayStartHour: 7,
  dayEndHour: 23,
  slotPx: 12,
  weekStartsOnMonday: true,
  rightPanelOpen: true,
  clockStyle: 'rings',
  chainMove: false,
  defaultBlockMin: 10,
  soundEnabled: true,
  volume: 0.6,
  chime: 'bell',
  breakChime: 'chime',
  startChime: true,
  closePrompt: true,
  showPendingTray: true,
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
  resetAllData: () => void;
  setZoom: (slotPx: number) => void;

  addList: (name: string, scope?: List['scope']) => string;
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
  removeSeriesFrom: (seriesId: string, fromStartsAt: string) => void;
  /** Crea o reemplaza la repetición desde una ocurrencia concreta. */
  setBlockRecurrence: (id: string, repeat: Task['repeat'], until: string | null, weekdays: number[] | null) => void;
  /** Copia los cambios puntuales de una ocurrencia al resto de su serie. */
  applyBlockToSeries: (id: string, scope: 'all' | 'future') => void;
  /** Estira el bloque hacia arriba empujando lo de encima, sin pisarlo. */
  resizeTop: (day: Date, id: string, newStartMin: number) => void;
  setDone: (id: string, done: boolean) => void;
  /** Pendiente, completado u omitido. */
  setStatus: (id: string, status: BlockStatus) => void;
  toggleDone: (id: string) => void;
  setPinned: (ids: string[], pinned: boolean) => void;
  duplicateBlock: (id: string) => string | null;
  shiftBlocks: (ids: string[], deltaMin: number) => void;
  /** Mueve o copia una selección conservando distancias entre días y horas. */
  placeBlockGroup: (ids: string[], anchorId: string, day: Date, startMin: number, copy: boolean) => string[];
  /** "Necesité más tiempo": cierra el original y agenda la continuación. */
  extendBlock: (id: string, extraMin: number) => string | null;
  applyPlan: (day: Date, items: PlanItem[]) => void;
  /** Crea los bloques de una serie ya resuelta (fechas puntuales, sin conflictos). */
  scheduleSeries: (taskId: string, occurrences: { date: Date; startMin: number }[], durationMin: number) => void;
}

function seed() {
  const l1 = uid(), l2 = uid(), l3 = uid(), l4 = uid();
  const L = (id: string, name: string, color: string, order: number, scope: List['scope']): List => ({
    id, name, color, order, collapsed: false, scope,
  });
  const lists: List[] = [
    L(l1, 'Trabajo', PALETTE[0], 0, 'todo'),
    L(l2, 'Personal', PALETTE[1], 1, 'todo'),
    L(l3, 'Bienestar', PALETTE[6], 0, 'routine'),
    L(l4, 'Trabajo recurrente', PALETTE[2], 1, 'routine'),
  ];
  const t = (listId: string, title: string, estimatedMin: number | null, recurring = false, order = 0): Task => ({
    id: uid(), listId, title, estimatedMin, color: null, recurring,
    repeat: 'none', repeatUntil: null, repeatWeekdays: null,
    priority: 'normal', plannedDate: null, dueDate: null, inbox: false,
    archived: false, notes: '', order,
  });
  const tasks: Task[] = [
    t(l1, 'Foco profundo', 90, false, 0),
    t(l4, 'Responder mails', 30, true, 1),
    t(l1, 'Revisar pendientes', null, false, 2),
    t(l3, 'Leer', 40, true, 0),
    t(l2, 'Trámite del banco', null, false, 1),
    t(l3, 'Movimiento', 60, true, 1),
    t(l4, 'Cierre del día', 10, true, 2),
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
      /** Vuelve las preferencias a fábrica sin tocar bloques ni tareas. */
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
      /** Elimina el contenido del usuario y deja Tempo vacío, con preferencias de fábrica. */
      resetAllData: () => set({
        lists: [],
        tasks: [],
        blocks: {},
        settings: DEFAULT_SETTINGS,
        view: 'week',
        cursor: dateKey(new Date()),
        unsortedListId: null,
      }),
      setZoom: (slotPx) => set((s) => ({ settings: { ...s.settings, slotPx } })),

      addList: (name, scope = 'todo') => {
        const id = uid();
        set((s) => ({
          lists: [...s.lists, {
            id, name, color: PALETTE[s.lists.length % PALETTE.length],
            order: s.lists.filter((list) => list.scope === scope).length, collapsed: false, scope,
          }],
        }));
        return id;
      },
      updateList: (id, patch) =>
        set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      removeList: (id) =>
        set((s) => {
          const removedTaskIds = new Set(s.tasks.filter((t) => t.listId === id).map((t) => t.id));
          const blocks = { ...s.blocks };
          for (const block of Object.values(blocks)) {
            if (block.taskId && removedTaskIds.has(block.taskId)) delete blocks[block.id];
          }
          return {
            lists: s.lists.filter((l) => l.id !== id),
            tasks: s.tasks.filter((t) => t.listId !== id),
            blocks,
            unsortedListId: s.unsortedListId === id ? null : s.unsortedListId,
          };
        }),
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
              priority: 'normal', plannedDate: null, dueDate: null, inbox: false,
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
                  ...(patch.recurring !== undefined && patch.recurring !== t.recurring
                    ? {
                        listId: s.lists.find((list) => list.scope === (patch.recurring ? 'routine' : 'todo'))?.id ?? t.listId,
                        inbox: patch.recurring ? false : t.inbox,
                      }
                    : {}),
                  // Un To-Do es único por definición. Al convertir una rutina
                  // limpiamos cualquier serie configurada anteriormente.
                  ...(patch.recurring === false
                    ? { recurring: false, repeat: 'none' as const, repeatUntil: null, repeatWeekdays: null }
                    : {}),
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
            s.lists.find((l) => l.name === UNSORTED_NAME && l.scope === 'todo');
        if (found) {
          if (s.unsortedListId !== found.id) set({ unsortedListId: found.id });
          return found.id;
        }
        const id = uid();
        set((st) => ({
          lists: [...st.lists, { id, name: UNSORTED_NAME, color: PALETTE[7], order: 999, collapsed: false, scope: 'todo' }],
          unsortedListId: id,
        }));
        return id;
      },

      addBlock: (b) => {
        const id = uid();
        set((s) => {
          const block = normalizeBlock({ ...b, id });
          const next = { ...s.blocks, [id]: block };
          return { blocks: packDay(next, block.startsAt.slice(0, 10), [id], 24 * 60) };
        });
        return id;
      },

      blockFromTask: (taskId, day, startMin, durationMin) => {
        const s = get();
        const task = s.tasks.find((t) => t.id === taskId);
        if (!task) return null;
        if (!task.recurring && Object.values(s.blocks).some((b) => b.taskId === taskId && b.status === 'planned')) {
          return null;
        }
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

        // Cada arrastre crea una ocurrencia aislada. La repetición se configura
        // después sobre este bloque, de modo que la misma plantilla pueda usarse
        // una vez, semanalmente y mensualmente sin cambiar su definición.
        return s.addBlock({ ...base, startsAt: isoFor(day, startMin), seriesId: null });
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
          if (!anchor || anchor.pinned || isReadOnlyBlock(anchor)) return s;
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
            if (b.pinned || isReadOnlyBlock(b)) break;
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
          const pinsAfter = dayBlocks.filter(
            (b) => (b.pinned || isReadOnlyBlock(b)) && minutesOf(b.startsAt) >= chainEnd
          );
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
          const patches = items.map((it) => ({ id: it.blockId, patch: { startsAt: isoFor(day, it.startMin) } }));
          return { blocks: applyBlockPatches(s.blocks, patches, 24 * 60) };
        }),

      unscheduleBlocks: (ids) => {
        for (const id of ids) {
          const b = get().blocks[id];
          if (!b || isReadOnlyBlock(b)) continue;
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
          if (!prev || isReadOnlyBlock(prev)) return s;
          const merged = normalizeBlock({ ...prev, ...patch });
          const next = { ...s.blocks, [id]: merged };
          const timeChanged = merged.startsAt !== prev.startsAt || merged.durationMin !== prev.durationMin;
          return {
            blocks: timeChanged
              ? packDay(next, merged.startsAt.slice(0, 10), [id], 24 * 60)
              : next,
          };
        }),

      removeBlock: (id) =>
        set((s) => {
          if (s.blocks[id] && isReadOnlyBlock(s.blocks[id])) return s;
          const blocks = { ...s.blocks };
          delete blocks[id];
          return { blocks };
        }),

      removeBlocks: (ids) =>
        set((s) => {
          const blocks = { ...s.blocks };
          for (const id of ids) if (!blocks[id] || !isReadOnlyBlock(blocks[id])) delete blocks[id];
          return { blocks };
        }),

      removeSeries: (seriesId) =>
        set((s) => {
          const blocks = { ...s.blocks };
          for (const b of Object.values(s.blocks)) {
            if (b.seriesId === seriesId && !isReadOnlyBlock(b)) delete blocks[b.id];
          }
          return { blocks };
        }),

      removeSeriesFrom: (seriesId, fromStartsAt) =>
        set((s) => {
          const blocks = { ...s.blocks };
          for (const b of Object.values(s.blocks)) {
            if (b.seriesId === seriesId && b.startsAt >= fromStartsAt && !isReadOnlyBlock(b)) delete blocks[b.id];
          }
          return { blocks };
        }),

      setBlockRecurrence: (id, repeat, until, weekdays) => {
        const initial = get();
        const anchor = initial.blocks[id];
        if (!anchor || isReadOnlyBlock(anchor) || anchor.kind === 'break') return;
        const oldSeriesId = anchor.seriesId;
        const seriesId = repeat === 'none' ? null : oldSeriesId ?? uid();
        const blocks = { ...initial.blocks };
        const occurrenceDetails = new Map<string, { notes: string; icon: string | null }>();

        // Reemplazamos desde esta referencia hacia adelante; el historial queda intacto.
        if (oldSeriesId) {
          for (const block of Object.values(blocks)) {
            if (block.seriesId === oldSeriesId && block.startsAt >= anchor.startsAt) {
              occurrenceDetails.set(block.startsAt.slice(0, 10), { notes: block.notes, icon: block.icon ?? null });
            }
            if (block.id !== id && block.seriesId === oldSeriesId && block.startsAt >= anchor.startsAt) delete blocks[block.id];
          }
        }
        blocks[id] = normalizeBlock({
          ...anchor, seriesId, repeat, repeatUntil: until, repeatWeekdays: weekdays,
        });
        set({ blocks });
        if (repeat === 'none') return;

        const anchorDate = parseISO(anchor.startsAt);
        const startMin = minutesOf(anchor.startsAt);
        const dates = expandSeries(anchorDate, repeat, until, weekdays).slice(1);
        for (const date of dates) {
          const current = get();
          const free = findAvailableStart(
            date, startMin, anchor.durationMin, Object.values(current.blocks),
            0, 24 * 60
          );
          if (free === null) continue;
          const details = occurrenceDetails.get(dateKey(date));
          current.addBlock({
            ...anchor,
            startsAt: isoFor(date, free),
            status: 'planned', closedAt: null, pinned: false,
            // Comentarios e íconos son propios de cada referencia. Sólo se
            // propagan cuando la persona pulsa explícitamente “Aplicar”.
            notes: details?.notes ?? '', icon: details?.icon ?? null,
            seriesId, repeat, repeatUntil: until, repeatWeekdays: weekdays,
          });
        }
      },

      applyBlockToSeries: (id, scope) =>
        set((s) => {
          const anchor = s.blocks[id];
          if (!anchor?.seriesId || isReadOnlyBlock(anchor)) return s;
          let blocks = { ...s.blocks };
          const anchorMin = minutesOf(anchor.startsAt);
          const touchedByDay = new Map<string, string[]>();
          for (const block of Object.values(s.blocks)) {
            if (block.seriesId !== anchor.seriesId || isReadOnlyBlock(block)) continue;
            if (scope === 'future' && block.startsAt < anchor.startsAt) continue;
            const next = normalizeBlock({
              ...block,
              title: anchor.title, color: anchor.color, durationMin: anchor.durationMin,
              notes: anchor.notes, icon: anchor.icon ?? null,
              startsAt: isoFor(parseISO(block.startsAt), anchorMin),
            });
            blocks[block.id] = next;
            const key = next.startsAt.slice(0, 10);
            touchedByDay.set(key, [...(touchedByDay.get(key) ?? []), block.id]);
          }
          for (const [key, ids] of touchedByDay) blocks = packDay(blocks, key, ids, 24 * 60);
          return { blocks };
        }),

      resizeTop: (day, id, newStartMin) =>
        set((s) => {
          const b = s.blocks[id];
          if (!b || b.pinned || isReadOnlyBlock(b)) return s;
          const key = b.startsAt.slice(0, 10);
          const end = minutesOf(b.startsAt) + b.durationMin;
          const floor = 0;

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
                if (x.pinned || isReadOnlyBlock(x)) return { blockedAt: xs + xd, moves, lowest: ceiling };
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
          if (!b || isReadOnlyBlock(b)) return s;
          return {
            blocks: {
              ...s.blocks,
              [id]: { ...b, status: done ? 'done' : 'planned', closedAt: done ? Date.now() : null },
            },
            tasks: b.taskId
              ? s.tasks.map((t) => t.id === b.taskId && !t.recurring ? { ...t, archived: done } : t)
              : s.tasks,
          };
        }),

      setStatus: (id, status) =>
        set((s) => {
          const b = s.blocks[id];
          if (!b || isReadOnlyBlock(b)) return s;
          return {
            blocks: {
              ...s.blocks,
              [id]: { ...b, status, closedAt: status === 'planned' ? null : Date.now() },
            },
            tasks: b.taskId
              ? s.tasks.map((t) => t.id === b.taskId && !t.recurring
                ? { ...t, archived: status === 'done' }
                : t)
              : s.tasks,
          };
        }),

      toggleDone: (id) => {
        const b = get().blocks[id];
        if (b) get().setDone(id, b.status !== 'done');
      },

      setPinned: (ids, pinned) =>
        set((s) => {
          const blocks = { ...s.blocks };
          for (const id of ids) {
            if (blocks[id] && !isReadOnlyBlock(blocks[id])) blocks[id] = { ...blocks[id], pinned };
          }
          return { blocks };
        }),

      duplicateBlock: (id) => {
        const s = get();
        const b = s.blocks[id];
        if (!b || isReadOnlyBlock(b)) return null;
        return s.addBlock({
          ...b,
          startsAt: isoFor(parseISO(b.startsAt), minutesOf(b.startsAt) + b.durationMin),
          status: 'planned',
          closedAt: null,
        });
      },

      shiftBlocks: (ids, deltaMin) =>
        set((s) => {
          const movable = ids
            .map((id) => s.blocks[id])
            .filter((b): b is Block => Boolean(b && !b.pinned && !isReadOnlyBlock(b)));
          if (!movable.length) return s;
          const requested = snap(deltaMin);
          const minStart = Math.min(...movable.map((b) => minutesOf(b.startsAt)));
          const maxEnd = Math.max(...movable.map((b) => minutesOf(b.startsAt) + b.durationMin));
          const delta = clamp(requested, -minStart, 24 * 60 - maxEnd);
          const patches = movable.map((b) => ({
            id: b.id,
            patch: { startsAt: isoFor(parseISO(b.startsAt), minutesOf(b.startsAt) + delta) },
          }));
          return { blocks: applyBlockPatches(s.blocks, patches, 24 * 60) };
        }),

      placeBlockGroup: (ids, anchorId, day, startMin, copy) => {
        const s = get();
        const anchor = s.blocks[anchorId];
        if (!anchor || anchor.pinned || isReadOnlyBlock(anchor)) return [];
        const selected = [...new Set(ids)]
          .map((id) => s.blocks[id])
          .filter((block): block is Block => Boolean(block && !block.pinned && !isReadOnlyBlock(block)));
        if (!selected.some((block) => block.id === anchorId)) selected.push(anchor);

        const requestedDelta = startMin - minutesOf(anchor.startsAt);
        const earliest = Math.min(...selected.map((block) => minutesOf(block.startsAt)));
        const latest = Math.max(...selected.map((block) => minutesOf(block.startsAt) + block.durationMin));
        const minuteDelta = clamp(
          requestedDelta,
          -earliest,
          24 * 60 - latest
        );
        const dayDelta = differenceInCalendarDays(day, parseISO(anchor.startsAt));

        if (!copy) {
          const patches = selected.map((block) => ({
            id: block.id,
            patch: {
              startsAt: isoFor(addDays(parseISO(block.startsAt), dayDelta), minutesOf(block.startsAt) + minuteDelta),
            },
          }));
          set({ blocks: applyBlockPatches(s.blocks, patches, 24 * 60) });
          return selected.map((block) => block.id);
        }

        const blocks = { ...s.blocks };
        const newIds: string[] = [];
        const prioritiesByDay = new Map<string, string[]>();
        for (const source of selected) {
          const id = uid();
          const startsAt = isoFor(addDays(parseISO(source.startsAt), dayDelta), minutesOf(source.startsAt) + minuteDelta);
          blocks[id] = normalizeBlock({
            ...source, id, startsAt,
            status: 'planned', closedAt: null, pinned: false,
            seriesId: null, repeat: 'none', repeatUntil: null, repeatWeekdays: null,
            source: 'tempo', external: null, syncStatus: 'local',
          });
          newIds.push(id);
          const key = startsAt.slice(0, 10);
          prioritiesByDay.set(key, [...(prioritiesByDay.get(key) ?? []), id]);
        }
        let packed = blocks;
        for (const [key, priority] of prioritiesByDay) packed = packDay(packed, key, priority, 24 * 60);
        set({ blocks: packed });
        return newIds;
      },

      extendBlock: (id, extraMin) => {
        const s = get();
        const b = s.blocks[id];
        if (!b || isReadOnlyBlock(b)) return null;
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

      scheduleSeries: (taskId, occurrences, durationMin) => {
        const s = get();
        const task = s.tasks.find((t) => t.id === taskId);
        if (!task || !occurrences.length) return;
        const list = s.lists.find((l) => l.id === task.listId);
        const color = task.color ?? list?.color ?? PALETTE[0];
        const seriesId = occurrences.length > 1 ? uid() : null;
        for (const occurrence of occurrences) {
          s.addBlock({
            taskId, title: task.title, color,
            startsAt: isoFor(occurrence.date, occurrence.startMin), durationMin,
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
      version: 7,
      migrate: (persisted: any) => {
        const oldLists: List[] = persisted?.lists ?? [];
        const oldTasks: Task[] = persisted?.tasks ?? [];
        const taskById = new Map(oldTasks.map((task) => [task.id, task]));
        const routineListIds = new Map<string, string>();
        const lists: List[] = oldLists.map((list) => ({ ...list, scope: 'todo' as const }));
        for (const task of oldTasks) {
          const routine = Boolean(task.recurring || task.repeat !== 'none');
          if (!routine || routineListIds.has(task.listId)) continue;
          const source = oldLists.find((list) => list.id === task.listId);
          const id = uid();
          routineListIds.set(task.listId, id);
          lists.push({
            id,
            name: source?.name ?? 'Rutinas',
            color: source?.color ?? PALETTE[6],
            order: routineListIds.size - 1,
            collapsed: false,
            scope: 'routine',
          });
        }
        const tasks = oldTasks.map((task) => {
          const recurring = Boolean(task.recurring || task.repeat !== 'none');
          return {
            ...task,
            listId: recurring ? routineListIds.get(task.listId) ?? task.listId : task.listId,
            recurring,
            priority: task.priority ?? 'normal',
            plannedDate: task.plannedDate ?? null,
            dueDate: task.dueDate ?? null,
            inbox: task.inbox ?? false,
            // A partir de v7 la regla vive en cada bloque/serie.
            repeat: 'none' as const,
            repeatUntil: null,
            repeatWeekdays: null,
          };
        });
        const blocks = Object.fromEntries(Object.entries(persisted?.blocks ?? {}).map(([id, raw]) => {
          const block = raw as Block;
          const oldTask = block.taskId ? taskById.get(block.taskId) : null;
          const oldRepeat = block.seriesId && oldTask?.repeat && oldTask.repeat !== 'none' ? oldTask.repeat : 'none';
          return [id, {
            ...block,
            icon: block.icon ?? null,
            repeat: block.repeat ?? oldRepeat,
            repeatUntil: block.repeatUntil ?? oldTask?.repeatUntil ?? null,
            repeatWeekdays: block.repeatWeekdays ?? oldTask?.repeatWeekdays ?? null,
          }];
        }));
        return {
          ...persisted,
          lists,
          tasks,
          blocks,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(persisted?.settings ?? {}),
            defaultBlockMin: persisted?.settings?.defaultBlockMin === 30 ? 10 : persisted?.settings?.defaultBlockMin ?? 10,
            autoplan: { ...DEFAULT_SETTINGS.autoplan, ...(persisted?.settings?.autoplan ?? {}) },
          },
        };
      },
      /** Las preferencias nuevas reciben su valor por defecto aunque la persona
       * ya tenga datos guardados con la misma versión del esquema. */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...saved,
          settings: {
            ...current.settings,
            ...(saved.settings ?? {}),
            autoplan: { ...current.settings.autoplan, ...(saved.settings?.autoplan ?? {}) },
          },
        };
      },
      /**
       * Red de seguridad: al abrir la app redondeamos todo a la grilla de 10 min.
       * Así ningún bloque raro guardado por una versión anterior sobrevive.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const blocks: Record<string, Block> = {};
        let dirty = false;
        for (const [id, b] of Object.entries(state.blocks ?? {})) {
          const fixed = normalizeBlock(b as Block);
          if (
            fixed.startsAt !== (b as Block).startsAt || fixed.durationMin !== (b as Block).durationMin ||
            fixed.source !== (b as Block).source || fixed.external !== (b as Block).external ||
            fixed.syncStatus !== (b as Block).syncStatus
          ) dirty = true;
          blocks[id] = fixed;
        }
        const completed = new Set(Object.values(state.blocks ?? {})
          .filter((block) => block.status === 'done' && block.taskId)
          .map((block) => block.taskId as string));
        const tasks = (state.tasks ?? []).map((t) => ({
          ...t,
          estimatedMin: t.estimatedMin === null ? null : Math.max(SLOT_MIN, snap(t.estimatedMin)),
          archived: Boolean(t.archived || (!t.recurring && completed.has(t.id))),
        }));
        if (dirty || tasks.some((t, i) =>
          t.estimatedMin !== state.tasks[i]?.estimatedMin || t.archived !== state.tasks[i]?.archived
        )) {
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
  clipboardIds: string[];
  setTool: (t: Tool) => void;
  setRange: (r: RangeSelection | null) => void;
  setMulti: (ids: string[]) => void;
  focusBlock: (id: string | null) => void;
  focusTask: (id: string | null) => void;
  setClipboard: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useUI = create<UIStore>((set) => ({
  tool: 'select',
  range: null,
  multi: [],
  focusedBlockId: null,
  focusedTaskId: null,
  clipboardIds: [],
  setTool: (tool) => set({ tool, range: null, multi: [] }),
  setRange: (range) => set({ range, multi: [] }),
  setMulti: (multi) => set({ multi, range: null }),
  focusBlock: (focusedBlockId) => set({ focusedBlockId, focusedTaskId: null }),
  focusTask: (focusedTaskId) => set({ focusedTaskId, focusedBlockId: null }),
  setClipboard: (clipboardIds) => set({ clipboardIds }),
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
  /** Posición continua para que la vista siga al puntero; startMin conserva el snap. */
  visualStartMin?: number;
  visualDurationMin?: number;
  /** Última posición conocida: permite renderizar también el primer frame del gesto. */
  pointerClientX?: number;
  pointerClientY?: number;
  /** El puntero está sobre un destino donde se puede soltar. */
  overGrid?: boolean;
  /** Ancla para arrastres que crecen en dos direcciones. */
  anchorMin: number;
  anchorDayIndex: number;
  moved: boolean;
  /** Intención al soltar sobre otro bloque, derivada de la mitad bajo el puntero. */
  insertion?: 'before' | 'after' | null;
  insertionTarget?: string | null;
  /** Selección que acompaña al bloque ancla durante un movimiento. */
  groupIds?: string[];
  /** Ctrl/Cmd + arrastre crea copias aisladas en vez de mover originales. */
  copy?: boolean;
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
