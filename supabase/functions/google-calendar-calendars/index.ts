import { authenticatedUser, corsHeaders, googleAccessFor, json } from '../_shared/google.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await authenticatedUser(req);
    const google = await googleAccessFor(user.id);
    if (!google) return json({ connected: false, calendars: [] });

    const calendars: unknown[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
      url.searchParams.set('maxResults', '250');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${google.accessToken}` } });
      const page = await response.json();
      if (!response.ok) throw new Error('No se pudieron leer los calendarios de Google');
      calendars.push(...(page.items ?? []).map((item: Record<string, unknown>) => ({
        id: item.id,
        name: item.summaryOverride ?? item.summary ?? 'Calendario',
        color: item.backgroundColor ?? null,
        timeZone: item.timeZone ?? null,
        primary: Boolean(item.primary),
        selected: google.connection.selected_calendar_ids.includes(item.id),
        readOnly: true,
      })));
      pageToken = page.nextPageToken;
    } while (pageToken);

    return json({ connected: true, email: google.connection.email, calendars });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo consultar Google Calendar' }, 400);
  }
});
