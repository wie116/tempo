import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Si no hay credenciales, la app sigue funcionando entera pero solo en este
 * navegador. Así podés probarla sin backend y sumarlo cuando quieras.
 */
export const cloudEnabled = Boolean(url && key);

export const supabase = cloudEnabled
  ? createClient<Database>(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Traduce los errores de Supabase a algo que se entienda. */
export function authErrorMessage(raw: string, language: 'es' | 'en' = 'es'): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return language === 'en' ? 'Incorrect email or password.' : 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return language === 'en' ? 'Email not confirmed. Check your inbox.' : 'Falta confirmar el email. Revisá tu bandeja de entrada.';
  if (m.includes('user already registered')) return language === 'en' ? 'An account with that email already exists. Try signing in.' : 'Ya existe una cuenta con ese email. Probá iniciar sesión.';
  if (m.includes('password should be at least')) return language === 'en' ? 'Your password must be at least 6 characters.' : 'La contraseña necesita al menos 6 caracteres.';
  if (m.includes('unable to validate email')) return language === 'en' ? 'That email does not look valid.' : 'Ese email no parece válido.';
  if (m.includes('rate limit') || m.includes('too many')) return language === 'en' ? 'Too many attempts. Wait a minute.' : 'Demasiados intentos seguidos. Esperá un minuto.';
  if (m.includes('failed to fetch')) return language === 'en' ? 'Could not reach the server. Check your connection.' : 'No se pudo contactar al servidor. Revisá tu conexión.';
  return raw;
}
