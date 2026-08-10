import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Si no hay credenciales, la app sigue funcionando entera pero solo en este
 * navegador. Así podés probarla sin backend y sumarlo cuando quieras.
 */
export const cloudEnabled = Boolean(url && key);

export const supabase = cloudEnabled
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Traduce los errores de Supabase a algo que se entienda. */
export function authErrorMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Falta confirmar el email. Revisá tu bandeja de entrada.';
  if (m.includes('user already registered')) return 'Ya existe una cuenta con ese email. Probá iniciar sesión.';
  if (m.includes('password should be at least')) return 'La contraseña necesita al menos 6 caracteres.';
  if (m.includes('unable to validate email')) return 'Ese email no parece válido.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos seguidos. Esperá un minuto.';
  if (m.includes('failed to fetch')) return 'No se pudo contactar al servidor. Revisá tu conexión.';
  return raw;
}
