import { create } from 'zustand';

export interface LeftoverEntry {
  title: string;
  durationMin: number;
  reason: string;
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

/**
 * Vive solo en memoria: es un recordatorio del último plan, no un historial.
 * Se limpia sola al cambiar de día o al volver a planificar.
 */
export const usePlannerLog = create<PlannerLogStore>((set) => ({
  leftover: [],
  dayKey: null,
  set: (dayKey, leftover) => set({ dayKey, leftover }),
  clear: () => set({ leftover: [], dayKey: null }),
}));
