import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Btn, Row, TimeField, inputCls } from './Modal';
import type { Settings } from '../types';

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; }

export function PwaSettings({ value, onChange }: { value?: Settings; onChange?: (patch: Partial<Settings>) => void } = {}) {
  const storedSettings = useStore((s) => s.settings);
  const updateStoredSettings = useStore((s) => s.updateSettings);
  const settings = value ?? storedSettings;
  const set = onChange ?? updateStoredSettings;
  const text = (es: string, en: string) => settings.language === 'en' ? en : es;
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

  useEffect(() => {
    const before = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', before);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', done); };
  }, []);

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    set({ systemNotifications: result === 'granted' });
  };

  return <div>
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-line p-3">
      <div><p className="text-[12.5px] font-medium">{text('Instalar Tempo', 'Install Tempo')}</p><p className="text-[11px] leading-snug text-muted">{text('Acceso desde el escritorio, apertura independiente y soporte básico sin conexión.', 'Desktop access, a standalone window, and basic offline support.')}</p></div>
      {installed ? <span className="rounded-full bg-surface-2 px-2 py-1 text-[10.5px] font-medium text-muted">{text('Instalada', 'Installed')}</span> : <Btn disabled={!prompt} onClick={() => prompt && void prompt.prompt()}>{prompt ? text('Instalar', 'Install') : text('Disponible al publicar', 'Available after publishing')}</Btn>}
    </div>
    <Row label={text('Notificaciones del sistema', 'System notifications')} hint={permission === 'denied' ? text('Están bloqueadas en el navegador.', 'They are blocked in the browser.') : text('Avisos aunque Tempo esté en segundo plano.', 'Alerts while Tempo is in the background.')}>
      {permission === 'granted' ? <input type="checkbox" checked={settings.systemNotifications} onChange={(event) => set({ systemNotifications: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" /> : <Btn onClick={() => void requestNotifications()} disabled={permission === 'unsupported' || permission === 'denied'}>{text('Permitir', 'Allow')}</Btn>}
    </Row>
    <Row label={text('Avisar antes de comenzar', 'Alert before starting')} hint={text('También conserva el aviso interno y el sonido configurado.', 'Keeps the in-app alert and configured sound too.')}>
      <select value={settings.notificationLeadMin} onChange={(event) => set({ notificationLeadMin: Number(event.target.value) })} className={`${inputCls} w-32`}><option value={0}>{text('Al comenzar', 'At start')}</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option></select>
    </Row>
    <Row label={text('Recordar el cierre diario', 'Daily review reminder')}>
      <input type="checkbox" checked={settings.dailyReviewEnabled} onChange={(event) => set({ dailyReviewEnabled: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
    </Row>
    {settings.dailyReviewEnabled && <Row label={text('Hora del recordatorio', 'Reminder time')}><TimeField value={settings.dailyReviewHour * 60} min={0} max={23 * 60} step={60} onCommit={(minutes) => set({ dailyReviewHour: Math.floor(minutes / 60) })} /></Row>}
  </div>;
}
