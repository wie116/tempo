import { supabase } from './supabase';

export const ADMIN_EMAIL = 'wiescudero@gmail.com';

export const isAdminEmail = (email: string | null | undefined) =>
  email?.trim().toLowerCase() === ADMIN_EMAIL;

export interface AdminMetrics {
  generatedAt: string;
  users: {
    total: number;
    activeToday: number;
    activeWeek: number;
    activeMonth: number;
    activeYear: number;
    newToday: number;
    newWeek: number;
    newMonth: number;
    newYear: number;
    withTasks: number;
    withBlocks: number;
    withCalendar: number;
  };
  product: {
    tasks: number;
    todos: number;
    routines: number;
    archivedTasks: number;
    blocks: number;
    taskBlocks: number;
    completedBlocks: number;
    skippedBlocks: number;
    breaks: number;
    calendarBlocks: number;
    scheduledMinutes: number;
    completedMinutes: number;
    completionRate: number;
    tasksPerUser: number;
    blocksPerUser: number;
  };
  dailyActivity: { date: string; users: number }[];
}

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.functions.invoke('admin-analytics', { method: 'GET' });
  if (error) throw new Error('No se pudo consultar el panel. Revisá que la función admin-analytics esté desplegada.');
  if (!data?.stats) throw new Error(data?.error ?? 'La respuesta del panel no es válida.');
  return data.stats as AdminMetrics;
}
