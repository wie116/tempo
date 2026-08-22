import {
  authenticatedUser, corsHeaders, env, json, pkceChallenge, googleRedirectUri,
  randomToken, safeReturnTo, serviceClient, sha256,
} from '../_shared/google.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await authenticatedUser(req);
    const input = await req.json().catch(() => ({}));
    const returnTo = safeReturnTo(input.returnTo);
    const state = randomToken(32);
    const verifier = randomToken(48);
    const db = serviceClient();
    await db.from('calendar_oauth_states').delete().lt('expires_at', new Date().toISOString());
    const { error } = await db.from('calendar_oauth_states').insert({
      state_hash: await sha256(state),
      user_id: user.id,
      code_verifier: verifier,
      return_to: returnTo,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) throw error;

    const params = new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      redirect_uri: googleRedirectUri(),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope: [
        'openid', 'email',
        'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly',
      ].join(' '),
      state,
      code_challenge: await pkceChallenge(verifier),
      code_challenge_method: 'S256',
    });
    return json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo iniciar Google Calendar' }, 400);
  }
});
