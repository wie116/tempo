import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

export const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
};

export const serviceClient = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function authenticatedUser(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization) throw new Error('Sesión requerida');
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Sesión inválida');
  return data.user;
}

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

const decodeBase64 = (value: string) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
};

export const randomToken = (size = 32) => base64Url(crypto.getRandomValues(new Uint8Array(size)));

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

export const pkceChallenge = sha256;

export const googleRedirectUri = () =>
  Deno.env.get('GOOGLE_REDIRECT_URI') ?? `${env('SUPABASE_URL')}/functions/v1/google-calendar-callback`;

export function safeReturnTo(raw: unknown): string {
  const fallback = Deno.env.get('APP_DEFAULT_RETURN_URL') ?? 'http://localhost:5173/tempo/';
  const candidate = typeof raw === 'string' ? raw : fallback;
  const allowed = (Deno.env.get('APP_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  try {
    const url = new URL(candidate);
    if (!allowed.includes(url.origin)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

async function encryptionKey() {
  const raw = decodeBase64(env('GOOGLE_TOKEN_ENCRYPTION_KEY'));
  if (raw.byteLength !== 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY debe tener 32 bytes en base64');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), new TextEncoder().encode(token));
  return { encrypted: base64Url(new Uint8Array(encrypted)), iv: base64Url(iv) };
}

export async function decryptToken(encrypted: string, iv: string) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(iv) },
    await encryptionKey(),
    decodeBase64(encrypted),
  );
  return new TextDecoder().decode(plain);
}

export async function googleAccessFor(userId: string) {
  const db = serviceClient();
  const { data: connection, error } = await db.from('calendar_connections')
    .select('*').eq('user_id', userId).eq('provider', 'google-calendar').maybeSingle();
  if (error) throw error;
  if (!connection) return null;

  const refreshToken = await decryptToken(connection.encrypted_refresh_token, connection.token_iv);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tokens = await response.json();
  if (!response.ok || !tokens.access_token) throw new Error('Google rechazó la renovación de la conexión');
  return { connection, accessToken: tokens.access_token as string };
}
