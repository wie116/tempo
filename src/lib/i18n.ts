import { enGB, enUS, es } from 'date-fns/locale';
import type { AppLanguage, RegionalLocale, Settings, TimeFormat } from '../types';

export const SUPPORTED_LANGUAGES: { id: AppLanguage; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
];

export const SUPPORTED_LOCALES: { id: RegionalLocale; label: string }[] = [
  { id: 'es-AR', label: 'Argentina · Español' },
  { id: 'es-ES', label: 'España · Español' },
  { id: 'en-US', label: 'United States · English' },
  { id: 'en-GB', label: 'United Kingdom · English' },
];

export const SUPPORTED_TIME_ZONES: { id: string; city: string }[] = [
  { id: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires' },
  { id: 'America/Santiago', city: 'Santiago' },
  { id: 'America/New_York', city: 'New York' },
  { id: 'America/Los_Angeles', city: 'Los Angeles' },
  { id: 'Europe/Madrid', city: 'Madrid' },
  { id: 'Europe/London', city: 'London' },
  { id: 'Europe/Berlin', city: 'Berlin' },
  { id: 'Europe/Paris', city: 'Paris' },
  { id: 'Europe/Rome', city: 'Rome' },
  { id: 'UTC', city: 'UTC' },
];

const COPY = {
  es: {
    settings: 'Ajustes', languageRegion: 'Idioma y región', appearance: 'Apariencia', planning: 'Agenda',
    notifications: 'Avisos', integrations: 'Integraciones', account: 'Cuenta y datos',
    languageRegionSubtitle: 'Personalizá cómo Tempo muestra fechas y horarios.', appLanguage: 'Idioma de la aplicación',
    languageHelp: 'Cambia los textos de la interfaz.', regionalFormat: 'Formato regional',
    regionalHelp: 'Define cómo se muestran fechas y números.', timeZone: 'Zona horaria',
    timeZoneHelp: 'Se guarda por separado para calendarios e integraciones.', timeFormat: 'Formato de hora',
    weekStarts: 'La semana comienza', monday: 'Lunes', sunday: 'Domingo', preview: 'Vista previa',
    noChanges: 'No hay cambios pendientes', unsaved: 'Cambios sin guardar', discard: 'Descartar',
    save: 'Guardar cambios', saved: 'Preferencias guardadas', reset: 'Restaurar preferencias', done: 'Listo',
    previous: 'Anterior', next: 'Siguiente', today: 'Hoy', day: 'Día', week: 'Semana', month: 'Mes',
    review: 'Revisar', tasks: 'Tareas', search: 'Buscar', searchTitle: 'Buscar o ejecutar · Ctrl+K',
    openTasks: 'Abrir tareas', openActivity: 'Abrir actividad y pendientes', settingsTitle: 'Ajustes',
    admin: 'Administración', goToday: 'Ir al día de hoy', reviewTitle: 'Revisión, cierre y semana',
    tasksTitle: 'Tareas y rutinas', mobileNav: 'Navegación principal móvil', plan: 'Plan', focus: 'Enfoque',
    activity: 'Actividad', openingAgenda: 'Abriendo tu agenda…',
  },
  en: {
    settings: 'Settings', languageRegion: 'Language & region', appearance: 'Appearance', planning: 'Schedule',
    notifications: 'Notifications', integrations: 'Integrations', account: 'Account & data',
    languageRegionSubtitle: 'Customize how Tempo displays dates and times.', appLanguage: 'App language',
    languageHelp: 'Changes text throughout the interface.', regionalFormat: 'Regional format',
    regionalHelp: 'Controls how dates and numbers are displayed.', timeZone: 'Time zone',
    timeZoneHelp: 'Stored separately for calendars and integrations.', timeFormat: 'Time format',
    weekStarts: 'Week starts on', monday: 'Monday', sunday: 'Sunday', preview: 'Preview',
    noChanges: 'No pending changes', unsaved: 'Unsaved changes', discard: 'Discard',
    save: 'Save changes', saved: 'Preferences saved', reset: 'Restore preferences', done: 'Done',
    previous: 'Previous', next: 'Next', today: 'Today', day: 'Day', week: 'Week', month: 'Month',
    review: 'Review', tasks: 'Tasks', search: 'Search', searchTitle: 'Search or run · Ctrl+K',
    openTasks: 'Open tasks', openActivity: 'Open activity and pending tasks', settingsTitle: 'Settings',
    admin: 'Administration', goToday: 'Go to today', reviewTitle: 'Review, close, and week',
    tasksTitle: 'Tasks and routines', mobileNav: 'Main mobile navigation', plan: 'Plan', focus: 'Focus',
    activity: 'Activity', openingAgenda: 'Opening your schedule…',
  },
} as const;

export type TranslationKey = keyof typeof COPY.es;

export function translate(language: AppLanguage, key: TranslationKey): string {
  return COPY[language][key] ?? COPY.es[key];
}

/** Pick small, component-local copy without turning every sentence into a global key. */
export function pick(language: AppLanguage, spanish: string, english: string): string {
  return language === 'en' ? english : spanish;
}

export function dateFnsLocale(locale: RegionalLocale) {
  if (locale === 'en-GB') return enGB;
  if (locale === 'en-US') return enUS;
  return es;
}

export function timeZoneLabel(id: string, locale: RegionalLocale): string {
  const city = SUPPORTED_TIME_ZONES.find((zone) => zone.id === id)?.city ?? id;
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: id,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
    }).formatToParts(new Date());
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value;
    return offset ? `${city} (${offset.replace('GMT', 'UTC')})` : city;
  } catch {
    return city;
  }
}

export function formatRegionalPreview(settings: Pick<Settings, 'locale' | 'timeZone' | 'timeFormat'>): string {
  try {
    return new Intl.DateTimeFormat(settings.locale, {
      timeZone: settings.timeZone,
      dateStyle: 'full',
      timeStyle: 'short',
      hour12: settings.timeFormat === '12h',
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat(settings.locale, {
      dateStyle: 'full',
      timeStyle: 'short',
      hour12: settings.timeFormat === '12h',
    }).format(new Date());
  }
}

export function formatClock(minutes: number, format: TimeFormat): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  if (format === '24h') return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const suffix = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}
