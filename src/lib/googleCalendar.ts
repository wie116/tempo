import { cloudEnabled, supabase } from './supabase';

export const googleCalendarEnabled = import.meta.env.VITE_GOOGLE_CALENDAR_ENABLED === 'true';

export interface GoogleCalendarInfo {
  id: string;
  name: string;
  color: string | null;
  timeZone: string | null;
  primary: boolean;
  selected: boolean;
  readOnly: true;
}

export interface GoogleCalendarState {
  connected: boolean;
  email?: string;
  calendars: GoogleCalendarInfo[];
}

const requireCloud = () => {
  if (!googleCalendarEnabled) throw new Error('Google Calendar está reservado para la activación final.');
  if (!cloudEnabled || !supabase) throw new Error('Primero configurá Supabase para conectar Google Calendar.');
  return supabase;
};

const invoke = async <T>(name: string, body?: Record<string, unknown>): Promise<T> => {
  const client = requireCloud();
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) throw new Error(error.message || 'La función de Supabase respondió con un error.');
  if (data?.error) throw new Error(data.error);
  return data as T;
};

export async function getGoogleCalendarState(): Promise<GoogleCalendarState> {
  return invoke<GoogleCalendarState>('google-calendar-calendars');
}

export async function connectGoogleCalendar(): Promise<void> {
  const returnTo = new URL(window.location.href);
  returnTo.searchParams.delete('google_calendar');
  const result = await invoke<{ authUrl: string }>('google-calendar-auth-url', { returnTo: returnTo.toString() });
  window.location.assign(result.authUrl);
}

export async function saveGoogleCalendarSelection(calendarIds: string[]): Promise<void> {
  await invoke('google-calendar-selection', { calendarIds });
}
