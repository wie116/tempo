import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Btn, Row, TimeField, inputCls } from './Modal';

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; }

export function PwaSettings() {
  const settings = useStore((s) => s.settings);
  const set = useStore((s) => s.updateSettings);
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
      <div><p className="text-[12.5px] font-medium">Instalar Tempo</p><p className="text-[11px] leading-snug text-muted">Acceso desde el escritorio, apertura independiente y soporte básico sin conexión.</p></div>
      {installed ? <span className="rounded-full bg-surface-2 px-2 py-1 text-[10.5px] font-medium text-muted">Instalada</span> : <Btn disabled={!prompt} onClick={() => prompt && void prompt.prompt()}>{prompt ? 'Instalar' : 'Disponible al publicar'}</Btn>}
    </div>
    <Row label="Notificaciones del sistema" hint={permission === 'denied' ? 'Están bloqueadas en el navegador.' : 'Avisos aunque Tempo esté en segundo plano.'}>
      {permission === 'granted' ? <input type="checkbox" checked={settings.systemNotifications} onChange={(event) => set({ systemNotifications: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" /> : <Btn onClick={() => void requestNotifications()} disabled={permission === 'unsupported' || permission === 'denied'}>Permitir</Btn>}
    </Row>
    <Row label="Avisar antes de comenzar" hint="También conserva el aviso interno y el sonido configurado.">
      <select value={settings.notificationLeadMin} onChange={(event) => set({ notificationLeadMin: Number(event.target.value) })} className={`${inputCls} w-32`}><option value={0}>Al comenzar</option><option value={5}>5 minutos</option><option value={10}>10 minutos</option><option value={15}>15 minutos</option></select>
    </Row>
    <Row label="Recordar el cierre diario">
      <input type="checkbox" checked={settings.dailyReviewEnabled} onChange={(event) => set({ dailyReviewEnabled: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
    </Row>
    {settings.dailyReviewEnabled && <Row label="Hora del recordatorio"><TimeField value={settings.dailyReviewHour * 60} min={0} max={23 * 60} step={60} onCommit={(minutes) => set({ dailyReviewHour: Math.floor(minutes / 60) })} /></Row>}
  </div>;
}
