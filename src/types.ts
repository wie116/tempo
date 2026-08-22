import type { ChimeId } from './lib/audio';

export type ViewMode = 'day' | 'week' | 'month';
export type BlockKind = 'task' | 'break' | 'adhoc';
/** 'skipped' = no lo hiciste: queda como registro y la tarea vuelve a estar disponible. */
export type BlockStatus = 'planned' | 'done' | 'skipped';
export type BlockSource = 'tempo' | 'google-calendar';
export type ExternalSyncStatus = 'local' | 'synced' | 'pending' | 'conflict' | 'error';

export interface ExternalBlockRef {
  provider: 'google-calendar';
  /** Identifica la conexión OAuth, no contiene credenciales. */
  accountId: string;
  calendarId: string;
  eventId: string;
  etag: string | null;
  updatedAt: string | null;
  readOnly: boolean;
}

export interface List {
  id: string;
  name: string;
  color: string;
  order: number;
  collapsed: boolean;
  /** Clasificaciones independientes para To-Do y Rutinas. */
  scope: 'todo' | 'routine';
}

export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  listId: string;
  title: string;
  /** null = sin duración fija: al agendarla toma la duración por defecto. */
  estimatedMin: number | null;
  /** null = usa el color del grupo. */
  color: string | null;
  /** true = Rutina reutilizable; false = To-Do único que se archiva al completarse. */
  recurring: boolean;
  /** @deprecated La repetición vive en Block; se conserva para migrar datos antiguos. */
  repeat: RepeatMode;
  /** yyyy-MM-dd. null = hasta el tope del horizonte. */
  repeatUntil: string | null;
  /** Solo para 'weekly': qué días de la semana (0=domingo..6=sábado). null = el día en que se agendó. */
  repeatWeekdays: number[] | null;
  priority: TaskPriority;
  /** Día en que debe aparecer en Hoy. null = sin día asignado. */
  plannedDate: string | null;
  /** Fecha límite independiente del día previsto. */
  dueDate: string | null;
  /** Capturada todavía sin clasificar. */
  inbox: boolean;
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
  /** Fijo: no se mueve por arrastre, ni por cadena, ni por el organizador. */
  pinned: boolean;
  /** Une los bloques nacidos de una misma repetición. */
  seriesId: string | null;
  notes: string;
  /** Ícono puntual de esta ocurrencia, elegido de una galería. */
  icon?: string | null;
  /** La regla pertenece a la serie materializada, no a la tarea plantilla. */
  repeat?: RepeatMode;
  repeatUntil?: string | null;
  repeatWeekdays?: number[] | null;
  /** Campos opcionales para abrir datos antiguos sin una migración destructiva. */
  source?: BlockSource;
  external?: ExternalBlockRef | null;
  syncStatus?: ExternalSyncStatus;
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
  /** Duración uniforme para esta tanda, sin tocar lo guardado en cada tarea. */
  reassign: 'none' | 'manual' | 'auto';
  reassignMin: number;
}

export interface Settings {
  theme: string;
  dayStartHour: number;
  dayEndHour: number;
  /** Alto en px de un slot de 10 min. Es el nivel de zoom. */
  slotPx: number;
  weekStartsOnMonday: boolean;
  rightPanelOpen: boolean;
  /** Forma de presentar la hora y el avance en el panel de actividad. */
  clockStyle: 'rings' | 'focus' | 'stats';
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
  /** Permite ocultar la bandeja sin descartar lo que contiene. */
  showPendingTray: boolean;
  autoplan: AutoplanConfig;
}
