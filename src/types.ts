import type { ChimeId } from './lib/audio';

export type ViewMode = 'day' | 'week' | 'month';
export type BlockKind = 'task' | 'break' | 'adhoc';
/** 'skipped' = no lo hiciste: queda como registro y la tarea vuelve a estar disponible. */
export type BlockStatus = 'planned' | 'done' | 'skipped';

export interface List {
  id: string;
  name: string;
  color: string;
  order: number;
  collapsed: boolean;
}

export type RepeatMode = 'none' | 'daily' | 'weekly';

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
  /** Repetición al agendarla: crea la serie completa de una vez. */
  repeat: RepeatMode;
  /** yyyy-MM-dd. null = hasta el tope del horizonte. */
  repeatUntil: string | null;
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
  /** Fijo: no se mueve por arrastre, ni por cadena, ni por la varita. */
  pinned: boolean;
  /** Une los bloques nacidos de una misma repetición. */
  seriesId: string | null;
  notes: string;
}

export type PlanOrder = 'random' | 'list' | 'longest' | 'shortest';

export type PlanSource = 'pending' | 'today';

export interface AutoplanConfig {
  /** 'pending' agenda tareas nuevas; 'today' reordena lo que ya está en el día. */
  source: PlanSource;
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
  /** Al mover un bloque, arrastrar con él los que vienen después. */
  chainMove: boolean;
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
