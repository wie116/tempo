import type { ExternalBlockRef } from '../types';

export interface ExternalCalendarAccount {
  id: string;
  provider: 'google-calendar';
  email: string;
  connectedAt: string;
}

export interface ExternalCalendarInfo {
  id: string;
  name: string;
  color: string | null;
  timeZone: string | null;
  selected: boolean;
  readOnly: boolean;
}

export interface ExternalCalendarEvent {
  ref: ExternalBlockRef;
  title: string;
  startsAt: string;
  durationMin: number;
  notes: string;
  color: string | null;
  cancelled: boolean;
}

export interface CalendarSyncPage {
  events: ExternalCalendarEvent[];
  deletedEventIds: string[];
  nextPageToken: string | null;
  nextSyncToken: string | null;
}

/** Contrato independiente de Google: la UI y el store nunca llaman APIs directamente. */
export interface CalendarProvider {
  listCalendars(accountId: string): Promise<ExternalCalendarInfo[]>;
  pullEvents(input: {
    accountId: string;
    calendarId: string;
    pageToken?: string;
    syncToken?: string;
  }): Promise<CalendarSyncPage>;
  disconnect(accountId: string): Promise<void>;
}
