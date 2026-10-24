import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarRange, Database, Languages, Palette, Plug, RotateCcw } from 'lucide-react';
import { DEFAULT_SETTINGS, useStore, useToasts, useUI } from '../store';
import { THEMES } from '../lib/themes';
import { CHIMES, playChime } from '../lib/audio';
import type { ChimeId } from '../lib/audio';
import type { Settings } from '../types';
import {
  formatRegionalPreview, SUPPORTED_LANGUAGES, SUPPORTED_LOCALES, SUPPORTED_TIME_ZONES,
  timeZoneLabel, translate,
} from '../lib/i18n';
import { Btn, ConfirmModal, Modal, NumField, Row, Segmented, TimeField, inputCls } from './Modal';
import { GoogleCalendarSettings } from './GoogleCalendarSettings';
import { usePlannerLog } from '../lib/plannerLog';
import { PwaSettings } from './PwaSettings';
import { McpBridgeSettings } from './McpBridgeSettings';

type SettingsPage = 'language' | 'appearance' | 'planning' | 'notifications' | 'integrations' | 'account';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-3 overflow-hidden rounded-xl border border-line bg-surface last:mb-0">
    <h3 className="border-b border-line bg-surface-2/55 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted">{title}</h3>
    <div className="px-4 py-1.5">{children}</div>
  </section>;
}

function SelectRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="grid gap-2 border-b border-line py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,auto)] sm:items-center sm:gap-5">
    <div className="min-w-0"><p className="text-[13px]">{label}</p>{hint && <p className="mt-0.5 text-[11px] leading-snug text-muted">{hint}</p>}</div>
    <div className="min-w-0 sm:justify-self-end">{children}</div>
  </div>;
}

export function SettingsModal({
  open, onClose, integrationNotice,
}: { open: boolean; onClose: () => void; integrationNotice?: string | null }) {
  const saved = useStore((state) => state.settings);
  const updateSettings = useStore((state) => state.updateSettings);
  const resetAllData = useStore((state) => state.resetAllData);
  const [draft, setDraft] = useState<Settings>(saved);
  const [page, setPage] = useState<SettingsPage>('language');
  const [askReset, setAskReset] = useState(false);
  const [askErase, setAskErase] = useState(false);
  const [askEraseFinal, setAskEraseFinal] = useState(false);
  const openRef = useRef(false);

  useEffect(() => {
    if (open && !openRef.current) {
      setDraft(saved);
      setPage(integrationNotice ? 'integrations' : 'language');
    }
    openRef.current = open;
  }, [open, saved, integrationNotice]);

  const language = draft.language;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const text = (es: string, en: string) => language === 'en' ? en : es;
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const patchDraft = (patch: Partial<Settings>) => setDraft((current) => ({ ...current, ...patch }));
  const closeAndDiscard = () => { setDraft(saved); onClose(); };

  const save = () => {
    updateSettings(draft);
    useToasts.getState().push({
      title: t('saved'),
      body: text('Se guardaron localmente y se sincronizarán con tu cuenta.', 'Saved locally and queued for account sync.'),
      kind: 'info', ttl: 2600,
    });
  };

  const navItems: { id: SettingsPage; label: string; icon: React.ReactNode }[] = [
    { id: 'language', label: t('languageRegion'), icon: <Languages size={17} aria-hidden /> },
    { id: 'appearance', label: t('appearance'), icon: <Palette size={17} aria-hidden /> },
    { id: 'planning', label: t('planning'), icon: <CalendarRange size={17} aria-hidden /> },
    { id: 'notifications', label: t('notifications'), icon: <Bell size={17} aria-hidden /> },
    { id: 'integrations', label: t('integrations'), icon: <Plug size={17} aria-hidden /> },
    { id: 'account', label: t('account'), icon: <Database size={17} aria-hidden /> },
  ];

  return <>
    <Modal
      open={open}
      onClose={closeAndDiscard}
      title={t('settings')}
      subtitle={page === 'language' ? t('languageRegionSubtitle') : text('Preferencias de Tempo', 'Tempo preferences')}
      closeLabel={text('Cerrar', 'Close')}
      size="lg"
      footer={<>
        {page !== 'account' && <button type="button" onClick={() => setAskReset(true)} className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted hover:text-ink"><RotateCcw size={13} aria-hidden /> {t('reset')}</button>}
        <span className="hidden text-[11px] text-muted sm:inline" aria-live="polite">{dirty ? t('unsaved') : t('noChanges')}</span>
        <Btn onClick={() => setDraft(saved)} disabled={!dirty}>{t('discard')}</Btn>
        <Btn variant="primary" onClick={save} disabled={!dirty}>{t('save')}</Btn>
      </>}
    >
      <div className="grid min-h-[34rem] sm:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="border-b border-line bg-surface-2/45 p-2 sm:border-b-0 sm:border-r sm:p-3">
          <nav className="flex gap-1 overflow-x-auto sm:grid" aria-label={text('Secciones de ajustes', 'Settings sections')}>
            {navItems.map((item) => <button
              key={item.id} type="button" onClick={() => setPage(item.id)} aria-current={page === item.id ? 'page' : undefined}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium transition-colors sm:w-full"
              style={page === item.id ? { background: 'color-mix(in oklab, var(--accent) 12%, var(--surface))', color: 'var(--accent)' } : { color: 'var(--muted)' }}
            >{item.icon}<span>{item.label}</span></button>)}
          </nav>
        </aside>

        <div className="min-w-0 bg-bg/45 p-3 sm:p-5">
          {page === 'language' && <LanguageRegionPage draft={draft} patch={patchDraft} text={text} t={t} />}

          {page === 'appearance' && <Section title={text('Tema, tipografía y densidad', 'Theme, typography, and density')}>
            <div className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-3">
              {THEMES.map((theme) => <button
                key={theme.id} type="button" onClick={() => patchDraft({ theme: theme.id })}
                className="rounded-xl border p-2 text-left transition-transform hover:-translate-y-px"
                style={{ borderColor: draft.theme === theme.id ? 'var(--accent)' : 'var(--border)', boxShadow: draft.theme === theme.id ? '0 0 0 1px var(--accent)' : undefined }}
              >
                <div className="mb-1.5 flex h-7 overflow-hidden rounded-lg border border-line">{theme.swatch.map((color) => <span key={color} className="flex-1" style={{ background: color }} />)}</div>
                <p className="text-[12.5px] font-medium">{language === 'en' ? theme.nameEn : theme.name}</p><p className="text-[10.5px] leading-tight text-muted">{language === 'en' ? theme.hintEn : theme.hint}</p>
              </button>)}
            </div>
            <div className="border-t border-line py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{text('Tipografía', 'Typography')}</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'modern' as const, name: text('Moderna', 'Modern'), sample: text('Agenda clara', 'Clear schedule'), stack: "'Segoe UI', ui-sans-serif, system-ui, sans-serif" },
                  { id: 'editorial' as const, name: 'Editorial', sample: text('Agenda serena', 'Calm schedule'), stack: "Georgia, 'Times New Roman', serif" },
                  { id: 'rounded' as const, name: text('Redondeada', 'Rounded'), sample: text('Agenda amable', 'Friendly schedule'), stack: "'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif" },
                ]).map((font) => <button
                  key={font.id} type="button" onClick={() => patchDraft({ fontFamily: font.id })}
                  className="min-w-0 rounded-xl border px-2.5 py-2.5 text-left transition-transform hover:-translate-y-px"
                  style={{ borderColor: draft.fontFamily === font.id ? 'var(--accent)' : 'var(--border)', boxShadow: draft.fontFamily === font.id ? '0 0 0 1px var(--accent)' : undefined, fontFamily: font.stack }}
                ><p className="truncate text-[15px] font-semibold">Aa</p><p className="truncate text-[11.5px] font-medium">{font.name}</p><p className="truncate text-[9.5px] text-muted">{font.sample}</p></button>)}
              </div>
            </div>
            <Row label={text('Densidad', 'Density')} hint={text('Alto de cada slot de 10 minutos', 'Height of each 10-minute slot')}><input type="range" min={8} max={22} step={1} value={draft.slotPx} onChange={(event) => patchDraft({ slotPx: Number(event.target.value) })} className="w-32 accent-[var(--accent)]" /></Row>
            <Row label={text('Estilo del reloj', 'Clock style')} hint={text('También disponible en Actividad', 'Also available in Activity')}><select value={draft.clockStyle} onChange={(event) => patchDraft({ clockStyle: event.target.value as Settings['clockStyle'] })} className={`${inputCls} w-36`}><option value="rings">{text('Anillos', 'Rings')}</option><option value="focus">{t('focus')}</option><option value="stats">Digital</option></select></Row>
          </Section>}

          {page === 'planning' && <Section title={text('Jornada', 'Working day')}>
            <p className="my-2 rounded-lg bg-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-muted">{text('La agenda muestra siempre las 24 horas. La jornada resalta tu horario habitual y define el rango que usa Organizar.', 'The schedule always shows 24 hours. Your working day highlights the usual range and guides automatic planning.')}</p>
            <Row label={text('Empieza a las', 'Starts at')} hint={text('Inicio sugerido para Organizar', 'Suggested start for automatic planning')}><TimeField value={draft.dayStartHour * 60} min={0} max={(draft.dayEndHour - 1) * 60} step={60} onCommit={(minutes) => patchDraft({ dayStartHour: Math.min(draft.dayEndHour - 1, minutes / 60) })} /></Row>
            <Row label={text('Termina a las', 'Ends at')} hint={text('Fin sugerido para Organizar', 'Suggested end for automatic planning')}><TimeField value={draft.dayEndHour * 60} min={(draft.dayStartHour + 1) * 60} max={24 * 60} step={60} onCommit={(minutes) => patchDraft({ dayEndHour: Math.max(draft.dayStartHour + 1, minutes / 60) })} /></Row>
            <Row label={text('Duración por defecto', 'Default duration')} hint={text('Para bloques nuevos y tareas sin duración fija', 'For new blocks and tasks without a fixed duration')}><NumField value={draft.defaultBlockMin} onCommit={(value) => value !== null && patchDraft({ defaultBlockMin: value })} suffix="min" /></Row>
          </Section>}

          {page === 'integrations' && <><Section title={text('Calendarios conectados', 'Connected calendars')}><GoogleCalendarSettings active={open} notice={integrationNotice} /></Section><Section title={text('Inteligencia artificial', 'Artificial intelligence')}><McpBridgeSettings /></Section></>}

          {page === 'account' && <Section title={t('account')}>
            <p className="my-3 text-[12px] leading-relaxed text-muted">{text('Administrá los datos guardados por Tempo. Las preferencias se restauran sin afectar tu agenda.', 'Manage the data stored by Tempo. Preferences can be restored without affecting your schedule.')}</p>
            <div className="mb-3 rounded-xl border p-4" style={{ borderColor: 'color-mix(in oklab, var(--now) 55%, var(--border))' }}><p className="text-[13px] font-semibold">{text('Borrar todos mis datos', 'Delete all my data')}</p><p className="mb-3 mt-1 text-[11.5px] leading-relaxed text-muted">{text('Elimina tareas, rutinas, clasificaciones, bloques, series, notas y pendientes de organización.', 'Deletes tasks, routines, classifications, blocks, series, notes, and planning backlog.')}</p><Btn variant="danger" onClick={() => setAskErase(true)}>{text('Borrar todos los datos', 'Delete all data')}</Btn></div>
          </Section>}

          {page === 'notifications' && <>
            <Section title={text('Aplicación y notificaciones', 'App and notifications')}><PwaSettings value={draft} onChange={patchDraft} /></Section>
            <Section title={text('Comportamiento del reloj', 'Clock behavior')}><p className="my-2 text-[11.5px] leading-snug text-muted">{text('El reloj corre solo: la agenda define los límites y Tempo te avisa cuando cruzás uno.', 'The clock runs automatically: the schedule defines boundaries and Tempo alerts you when you cross one.')}</p><Row label={text('Aviso al empezar un bloque', 'Alert when a block starts')}><input type="checkbox" checked={draft.startChime} onChange={(event) => patchDraft({ startChime: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" /></Row><Row label={text('Preguntar al terminar', 'Ask when a block ends')} hint={text('Para cerrarlo o pedir más tiempo', 'Close it or request more time')}><input type="checkbox" checked={draft.closePrompt} onChange={(event) => patchDraft({ closePrompt: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" /></Row></Section>
            <Section title={text('Sonidos', 'Sounds')}><Row label={text('Alertas sonoras', 'Sound alerts')}><input type="checkbox" checked={draft.soundEnabled} onChange={(event) => patchDraft({ soundEnabled: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" /></Row><Row label={text('Fin de bloque de trabajo', 'End of work block')}><ChimeSelect language={draft.language} value={draft.chime} volume={draft.volume} onChange={(value) => patchDraft({ chime: value })} /></Row><Row label={text('Fin de pausa', 'End of break')}><ChimeSelect language={draft.language} value={draft.breakChime} volume={draft.volume} onChange={(value) => patchDraft({ breakChime: value })} /></Row><Row label={text('Volumen', 'Volume')}><input type="range" min={0} max={1} step={0.05} value={draft.volume} onChange={(event) => patchDraft({ volume: Number(event.target.value) })} onMouseUp={() => playChime(draft.chime, draft.volume)} onTouchEnd={() => playChime(draft.chime, draft.volume)} className="w-32 accent-[var(--accent)]" /></Row></Section>
          </>}
        </div>
      </div>
    </Modal>

    <ConfirmModal open={askReset} onClose={() => setAskReset(false)} onConfirm={() => setDraft(DEFAULT_SETTINGS)} title={text('Restaurar valores por defecto', 'Restore defaults')} message={text('Todas las preferencias volverán a sus valores iniciales cuando guardes los cambios.', 'All preferences will return to their initial values when you save the changes.')} detail={text('Tus bloques, tareas y clasificaciones no se tocan.', 'Your blocks, tasks, and classifications are not affected.')} confirmLabel={text('Preparar restauración', 'Prepare restore')} danger={false} />
    <ConfirmModal open={askErase} onClose={() => setAskErase(false)} onConfirm={() => setAskEraseFinal(true)} title={text('Borrar todos los datos', 'Delete all data')} message={text('Se eliminarán todas tus tareas, rutinas, clasificaciones y bloques.', 'All your tasks, routines, classifications, and blocks will be deleted.')} detail={text('Esta acción no se puede deshacer. Todavía habrá una confirmación final.', 'This cannot be undone. There will still be one final confirmation.')} confirmLabel={text('Continuar', 'Continue')} />
    <ConfirmModal open={askEraseFinal} onClose={() => setAskEraseFinal(false)} onConfirm={() => { resetAllData(); usePlannerLog.getState().clear(); useUI.getState().clearSelection(); onClose(); }} title={text('Confirmación final', 'Final confirmation')} message={text('¿Seguro que querés dejar Tempo completamente vacío?', 'Are you sure you want to leave Tempo completely empty?')} detail={text('No quedarán tareas, rutinas, clasificaciones, notas ni eventos propios.', 'No tasks, routines, classifications, notes, or personal events will remain.')} confirmLabel={text('Sí, borrar todo', 'Yes, delete everything')} />
  </>;
}

function LanguageRegionPage({ draft, patch, text, t }: {
  draft: Settings; patch: (patch: Partial<Settings>) => void;
  text: (es: string, en: string) => string;
  t: (key: Parameters<typeof translate>[1]) => string;
}) {
  return <>
    <Section title={t('languageRegion')}>
      <SelectRow label={t('appLanguage')} hint={t('languageHelp')}><select value={draft.language} onChange={(event) => patch({ language: event.target.value as Settings['language'] })} className={`${inputCls} min-w-52`}>{SUPPORTED_LANGUAGES.map((language) => <option key={language.id} value={language.id}>{language.label}</option>)}</select></SelectRow>
      <SelectRow label={t('regionalFormat')} hint={t('regionalHelp')}><select value={draft.locale} onChange={(event) => patch({ locale: event.target.value as Settings['locale'] })} className={`${inputCls} min-w-52`}>{SUPPORTED_LOCALES.map((locale) => <option key={locale.id} value={locale.id}>{locale.label}</option>)}</select></SelectRow>
    </Section>
    <Section title={text('Hora y calendario', 'Time and calendar')}>
      <SelectRow label={t('timeZone')} hint={t('timeZoneHelp')}><select value={draft.timeZone} onChange={(event) => patch({ timeZone: event.target.value })} className={`${inputCls} min-w-52`}>{SUPPORTED_TIME_ZONES.map((zone) => <option key={zone.id} value={zone.id}>{timeZoneLabel(zone.id, draft.locale)}</option>)}</select></SelectRow>
      <SelectRow label={t('timeFormat')}><Segmented value={draft.timeFormat} options={[{ id: '24h', label: '24 h' }, { id: '12h', label: '12 h' }]} onChange={(timeFormat) => patch({ timeFormat })} /></SelectRow>
      <SelectRow label={t('weekStarts')}><Segmented value={draft.weekStartsOnMonday ? 'monday' : 'sunday'} options={[{ id: 'monday', label: t('monday') }, { id: 'sunday', label: t('sunday') }]} onChange={(value) => patch({ weekStartsOnMonday: value === 'monday' })} /></SelectRow>
    </Section>
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3"><CalendarRange size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden /><div><p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">{t('preview')}</p><p className="mt-1 text-[13px] font-medium capitalize">{formatRegionalPreview(draft)}</p></div></div>
  </>;
}

function ChimeSelect({ language, value, volume, onChange }: { language: Settings['language']; value: ChimeId; volume: number; onChange: (value: ChimeId) => void }) {
  const englishNames: Partial<Record<ChimeId, string>> = { bell: 'Bell', chime: 'Chime', bowl: 'Bowl', soft: 'Soft', blip: 'Blip', gong: 'Deep gong', wood: 'Wood', sparkle: 'Sparkle' };
  return <div className="flex items-center gap-1.5"><select value={value} onChange={(event) => { const next = event.target.value as ChimeId; onChange(next); playChime(next, volume); }} className={`${inputCls} w-32`}>{CHIMES.map((chime) => <option key={chime.id} value={chime.id}>{language === 'en' ? englishNames[chime.id] ?? chime.name : chime.name}</option>)}</select><button type="button" onClick={() => playChime(value, volume)} aria-label={language === 'en' ? 'Test sound' : 'Probar sonido'} className="rounded-lg border border-line p-1.5 text-muted hover:text-ink"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M4 3.5v9l8-4.5-8-4.5Z" fill="currentColor" /></svg></button></div>;
}
