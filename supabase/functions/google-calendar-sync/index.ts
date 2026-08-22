import { authenticatedUser, corsHeaders, googleAccessFor, json, serviceClient } from '../_shared/google.ts';

type GoogleEvent = { id: string; status?: string; summary?: string; description?: string; etag?: string; updated?: string; start?: { dateTime?: string }; end?: { dateTime?: string } };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await authenticatedUser(req);
    const google = await googleAccessFor(user.id);
    if (!google) return json({ error: 'Google Calendar no está conectado' }, 400);
    const db = serviceClient();
    const from = new Date(); from.setDate(from.getDate() - 30);
    const until = new Date(); until.setDate(until.getDate() + 180);
    let imported = 0;

    for (const calendarId of google.connection.selected_calendar_ids as string[]) {
      const events: GoogleEvent[] = [];
      let pageToken: string | undefined;
      do {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('showDeleted', 'true');
        url.searchParams.set('maxResults', '2500');
        url.searchParams.set('timeMin', from.toISOString());
        url.searchParams.set('timeMax', until.toISOString());
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const response = await fetch(url, { headers: { Authorization: `Bearer ${google.accessToken}` } });
        const page = await response.json();
        if (!response.ok) throw new Error(`No se pudo sincronizar el calendario ${calendarId}`);
        events.push(...(page.items ?? []));
        pageToken = page.nextPageToken;
      } while (pageToken);

      for (const event of events) {
        const base = { provider: 'google-calendar', accountId: google.connection.id, calendarId, eventId: event.id };
        const { data: existing } = await db.from('blocks').select('id').eq('user_id', user.id)
          .contains('external_ref', base).maybeSingle();
        if (event.status === 'cancelled' || !event.start?.dateTime || !event.end?.dateTime) {
          if (existing?.id) await db.from('blocks').delete().eq('id', existing.id);
          continue;
        }
        const duration = Math.max(10, Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 600000) * 10);
        const row = {
          id: existing?.id ?? crypto.randomUUID(), user_id: user.id, task_id: null,
          title: event.summary || 'Evento de Google', color: '#5B6C78', starts_at: event.start.dateTime.slice(0, 16),
          duration_min: duration, kind: 'task', status: 'planned', closed_at: null, pinned: true,
          series_id: null, notes: event.description ?? '', icon: 'G', repeat: 'none', repeat_until: null,
          repeat_weekdays: null, source: 'google-calendar', sync_status: 'synced',
          external_ref: { ...base, etag: event.etag ?? null, updatedAt: event.updated ?? null, readOnly: true },
          updated_at: new Date().toISOString(),
        };
        const { error } = await db.from('blocks').upsert(row);
        if (error) throw error;
        imported++;
      }
    }

    await db.from('calendar_sync_state').upsert((google.connection.selected_calendar_ids as string[]).map((calendarId) => ({ connection_id: google.connection.id, calendar_id: calendarId, last_synced_at: new Date().toISOString() })));
    return json({ imported, syncedAt: new Date().toISOString() });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo sincronizar Google Calendar' }, 400);
  }
});
