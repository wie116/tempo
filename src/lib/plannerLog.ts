import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LeftoverEntry {
  title: string;
  durationMin: number;
  reason: string;
  taskId: string | null;
  color: string;
}

/** Referencia estable: nunca crear un [] nuevo dentro de un selector de Zustand. */
export const EMPTY_LEFTOVER: LeftoverEntry[] = [];

interface PlannerLogStore {
  /** Lo que quedó afuera del último autoplan aplicado hoy. */
  leftover: LeftoverEntry[];
  dayKey: string | null;
  set: (dayKey: string, leftover: LeftoverEntry[]) => void;
  clear: () => void;
}

/** Bandeja local del último plan. Persiste recargas, pero solo se muestra en
 * el día al que pertenece y se reemplaza al volver a organizar. */
export const usePlannerLog = create<PlannerLogStore>()(
  persist(
    (set) => ({
      leftover: [],
      dayKey: null,
      set: (dayKey, leftover) => set({ dayKey, leftover }),
      clear: () => set({ leftover: [], dayKey: null }),
    }),
    { name: 'tempo-planner-log', version: 1 }
  )
);
