import {
  encryptToken, env, googleRedirectUri, safeReturnTo, serviceClient, sha256,
} from '../_shared/google.ts';

const finishUrl = (returnTo: string, result: 'connected' | 'error') => {
  const url = new URL(safeReturnTo(returnTo));
  url.searchParams.set('google_calendar', result);
  return url.toString();
};

Deno.serve(async (req) => {
  const requestUrl = new URL(req.url);
  const state = requestUrl.searchParams.get('state');
  const code = requestUrl.searchParams.get('code');
  const db = serviceClient();
  let returnTo = Deno.env.get('APP_DEFAULT_RETURN_URL') ?? 'http://localhost:5173/tempo/';

  try {
    if (!state || !code || requestUrl.searchParams.get('error')) throw new Error('Autorización cancelada o incompleta');
    const stateHash = await sha256(state);
    const { data: saved, error } = await db.from('calendar_oauth_states')
      .select('*').eq('state_hash', stateHash).maybeSingle();
    if (error || !saved) throw new Error('El estado OAuth no es válido o ya fue usado');
    returnTo = saved.return_to;
    await db.from('calendar_oauth_states').delete().eq('state_hash', stateHash);
    if (new Date(saved.expires_at).getTime() < Date.now()) throw new Error('La autorización venció');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env('GOOGLE_CLIENT_ID'),
        client_secret: env('GOOGLE_CLIENT_SECRET'),
        code,
        code_verifier: saved.code_verifier,
        grant_type: 'authorization_code',
        redirect_uri: googleRedirectUri(),
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new Error('Google no pudo completar el intercambio de tokens');

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileResponse.ok ? await profileResponse.json() : {};

    let encrypted: string;
    let iv: string;
    if (tokens.refresh_token) {
      const protectedToken = await encryptToken(tokens.refresh_token);
      encrypted = protectedToken.encrypted;
      iv = protectedToken.iv;
    } else {
      const { data: existing } = await db.from('calendar_connections')
        .select('encrypted_refresh_token,token_iv')
        .eq('user_id', saved.user_id).eq('provider', 'google-calendar').maybeSingle();
      if (!existing) throw new Error('Google no entregó un refresh token');
      encrypted = existing.encrypted_refresh_token;
      iv = existing.token_iv;
    }

    const { error: upsertError } = await db.from('calendar_connections').upsert({
      user_id: saved.user_id,
      provider: 'google-calendar',
      email: profile.email ?? '',
      encrypted_refresh_token: encrypted,
      token_iv: iv,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    if (upsertError) throw upsertError;
    return Response.redirect(finishUrl(returnTo, 'connected'), 302);
  } catch {
    return Response.redirect(finishUrl(returnTo, 'error'), 302);
  }
});
