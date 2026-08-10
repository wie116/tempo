import type { ChimeId } from './lib/audio';

export type ViewMode = 'day' | 'week' | 'month';
export type BlockKind = 'task' | 'break' | 'adhoc';
export type BlockStatus = 'planned' | 'done';

export interface List {
  id: string;
  name: string;
  color: string;
  order: number;
  collapsed: boolean;
}

export interface Task {
  id: string;
  listId: string;
  title: string;
  /** null = sin duración fija: al agendarla toma la duración por defecto. */
  estimatedMin: number | null;
  /** null = usa el color del grupo. */
  color: string | null;
  /** Las recurrentes no se gastan: siguen disponibles al agendarlas o completarlas. */
  recurring: boolean;
  archived: boolean;
  notes: string;
  order: number;
}

export interface Block {
  id: string;
  taskId: string | null;
  title: string;
  color: string;
  /** ISO local, ej. "2026-08-09T09:30". Siempre múltiplo de 10 minutos. */
  startsAt: string;
  durationMin: number;
  kind: BlockKind;
  status: BlockStatus;
  /** epoch ms del momento en que lo cerraste a mano. */
  closedAt: number | null;
  notes: string;
}

export type PlanOrder = 'random' | 'list' | 'longest' | 'shortest';

export interface AutoplanConfig {
  order: PlanOrder;
  /** 'now' arranca en la hora actual; 'dayStart' al inicio de la jornada. */
  from: 'now' | 'dayStart' | 'custom';
  customFromMin: number;
  untilMin: number;
  /** Minutos para tareas sin duración propia. */
  defaultMin: number;
  /** Aire entre bloques. */
  gapMin: number;
  listIds: string[] | null;
  includeRecurring: boolean;
}

export interface Settings {
  theme: string;
  dayStartHour: number;
  dayEndHour: number;
  /** Alto en px de un slot de 10 min. Es el nivel de zoom. */
  slotPx: number;
  weekStartsOnMonday: boolean;
  rightPanelOpen: boolean;
  defaultBlockMin: number;
  soundEnabled: boolean;
  volume: number;
  chime: ChimeId;
  breakChime: ChimeId;
  startChime: boolean;
  /** Avisar cuando un bloque termina y quedó sin cerrar. */
  closePrompt: boolean;
  autoplan: AutoplanConfig;
}
