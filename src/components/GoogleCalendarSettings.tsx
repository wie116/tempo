import { useEffect, useState } from 'react';
import { cloudEnabled } from '../lib/supabase';
import {
  connectGoogleCalendar, getGoogleCalendarState, saveGoogleCalendarSelection, syncGoogleCalendar,
  googleCalendarEnabled, type GoogleCalendarState,
} from '../lib/googleCalendar';
import { useStore } from '../store';
import { pick } from '../lib/i18n';

export function GoogleCalendarSettings({ active, notice }: { active: boolean; notice?: string | null }) {
  const language = useStore((s) => s.settings.language);
  const [state, setState] = useState<GoogleCalendarState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const refresh = async () => {
    if (!cloudEnabled || !googleCalendarEnabled) return;
    setLoading(true);
    setError(null);
    try { setState(await getGoogleCalendarState()); }
    catch (e) { setError(language === 'en' ? 'Could not check Google Calendar.' : e instanceof Error ? e.message : 'No se pudo consultar Google Calendar.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (active) void refresh(); }, [active]);

  const toggle = async (id: string) => {
    if (!state) return;
    const next = state.calendars.map((calendar) =>
      calendar.id === id ? { ...calendar, selected: !calendar.selected } : calendar
    );
    setState({ ...state, calendars: next });
    setSaving(true);
    setError(null);
    try { await saveGoogleCalendarSelection(next.filter((calendar) => calendar.selected).map((calendar) => calendar.id)); }
    catch (e) {
      setState(state);
      setError(language === 'en' ? 'Could not save the selection.' : e instanceof Error ? e.message : 'No se pudo guardar la selección.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      {notice === 'connected' && (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px]">{pick(language, 'Google Calendar quedó conectado.', 'Google Calendar is connected.')}</p>
      )}
      {notice === 'error' && (
        <p className="rounded-lg border px-3 py-2 text-[12px]" style={{ borderColor: 'var(--now)', color: 'var(--now)' }}>
          {pick(language, 'Google no pudo completar la conexión.', 'Google could not complete the connection.')}
        </p>
      )}

      {!googleCalendarEnabled ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-medium">Google Calendar</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
              {pick(language, 'La integración está completa. Falta cargar los secretos y desplegar las funciones para activarla.', 'The integration is ready. Add the secrets and deploy the functions to activate it.')}
            </p>
          </div>
          <span className="rounded-full border border-line px-2 py-1 text-[10px] font-semibold text-muted">{pick(language, 'Lista para activar', 'Ready to activate')}</span>
        </div>
      ) : !cloudEnabled ? (
        <p className="text-[12px] leading-relaxed text-muted">
          {pick(language, 'Google Calendar necesita una cuenta de Tempo con Supabase configurado.', 'Google Calendar requires a Tempo account with Supabase configured.')}
        </p>
      ) : loading ? (
        <p className="text-[12px] text-muted">{pick(language, 'Consultando la conexión…', 'Checking connection…')}</p>
      ) : state?.connected ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium">{pick(language, 'Conectado', 'Connected')}</p>
              <p className="text-[11px] text-muted">{state.email || pick(language, 'Cuenta de Google', 'Google account')}</p>
            </div>
            {saving && <span className="text-[10.5px] text-muted">{pick(language, 'Guardando…', 'Saving…')}</span>}
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-1.5">
            {state.calendars.map((calendar) => (
              <label key={calendar.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={calendar.selected}
                  disabled={saving}
                  onChange={() => void toggle(calendar.id)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: calendar.color ?? 'var(--muted)' }} />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{calendar.name}</span>
                {calendar.primary && <span className="text-[10px] text-muted">{pick(language, 'principal', 'primary')}</span>}
              </label>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-muted">
            {pick(language, 'Los calendarios marcados se importan como bloques protegidos de solo lectura. Tempo organiza alrededor de ellos.', 'Selected calendars are imported as protected read-only blocks. Tempo plans around them.')}
          </p>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
            <p className="text-[11px] text-muted">{syncResult ?? pick(language, 'Sincronizá cuando quieras traer los últimos cambios.', 'Sync whenever you want to fetch the latest changes.')}</p>
            <button disabled={saving || !state.calendars.some((calendar) => calendar.selected)} onClick={() => { setSaving(true); setError(null); void syncGoogleCalendar().then((result) => setSyncResult(`${result.imported} ${pick(language, 'eventos actualizados', 'events updated')}`)).catch((e) => setError(language === 'en' ? 'Could not sync Google Calendar.' : e.message)).finally(() => setSaving(false)); }} className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-medium disabled:opacity-40">{pick(language, 'Sincronizar ahora', 'Sync now')}</button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-[12px] leading-relaxed text-muted">{pick(language, 'Usá tus eventos como tiempo ocupado para planificar alrededor.', 'Use your events as busy time and plan around them.')}</p>
          <button
            onClick={() => { setError(null); void connectGoogleCalendar().catch((e) => setError(language === 'en' ? 'Could not connect Google Calendar.' : e.message)); }}
            className="shrink-0 rounded-lg px-3 py-2 text-[12.5px] font-semibold"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            {pick(language, 'Conectar Google', 'Connect Google')}
          </button>
        </div>
      )}
      {error && <p className="text-[11.5px] leading-snug" style={{ color: 'var(--now)' }}>{error}</p>}
    </div>
  );
}
