import { supabase } from './supabase';

const HEARTBEAT_MS = 5 * 60_000;

/**
 * Registra presencia, no eventos individuales. Si la migración todavía no fue
 * aplicada, falla en silencio para no bloquear el uso normal de la agenda.
 */
export function startActivityHeartbeat(): () => void {
  const client = supabase;
  if (!client) return () => {};
  let lastSentAt = 0;
  let stopped = false;

  const touch = async (force = false) => {
    if (stopped || document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (!force && now - lastSentAt < HEARTBEAT_MS - 5_000) return;
    lastSentAt = now;
    await client.rpc('touch_app_activity').then(() => {}, () => {});
  };

  const onVisible = () => { if (document.visibilityState === 'visible') void touch(); };
  const onFocus = () => void touch();
  const timer = window.setInterval(() => void touch(), HEARTBEAT_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onFocus);
  void touch(true);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onFocus);
  };
}
