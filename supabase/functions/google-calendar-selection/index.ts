import { authenticatedUser, corsHeaders, json, serviceClient } from '../_shared/google.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await authenticatedUser(req);
    const input = await req.json();
    const calendarIds = Array.isArray(input.calendarIds)
      ? [...new Set(input.calendarIds.filter((id: unknown) => typeof id === 'string' && id.length <= 512))].slice(0, 50)
      : [];
    const { error } = await serviceClient().from('calendar_connections')
      .update({ selected_calendar_ids: calendarIds, updated_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('provider', 'google-calendar');
    if (error) throw error;
    return json({ ok: true, calendarIds });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo guardar la selección' }, 400);
  }
});
