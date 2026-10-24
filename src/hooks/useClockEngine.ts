import { useEffect, useRef } from 'react';
import { useClock, useStore, useToasts } from '../store';
import { playChime } from '../lib/audio';
import { dateKey, minutesOf } from '../lib/time';

/**
 * El corazón de la app: no hay que apretar nada para que corra.
 * La agenda ya define los límites; esto solo mira el reloj y avisa
 * cuando cruzás uno.
 */
export function useClockEngine() {
  const tick = useClock((s) => s.tick);
  const lastMin = useRef<number>(-1);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    const run = () => {
      tick();
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin === lastMin.current) return;
      const prev = lastMin.current;
      lastMin.current = nowMin;
      if (prev < 0) return; // primer ciclo: no disparamos nada retroactivo
      // Si la pestaña estuvo dormida un rato largo, resincronizamos en silencio
      // en vez de vomitar avisos de todo lo que pasó mientras no estabas.
      if (nowMin - prev > 5 || nowMin < prev) return;

      const { blocks, settings } = useStore.getState();
      const key = dateKey(now);

      const systemNotice = (id: string, title: string, body: string) => {
        if (!settings.systemNotifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const noticeKey = `${key}-${id}`;
        if (notified.current.has(noticeKey)) return;
        notified.current.add(noticeKey);
        new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icon.svg`, tag: noticeKey });
      };

      if (settings.dailyReviewEnabled && nowMin === settings.dailyReviewHour * 60) {
        const unresolved = Object.values(blocks).filter((block) => block.startsAt.slice(0, 10) === key && block.kind !== 'break' && block.status !== 'done').length;
        systemNotice('daily-review', settings.language === 'en' ? 'Time to close the day' : 'Momento de cerrar el día', unresolved ? (settings.language === 'en' ? `${unresolved} tasks need a decision.` : `${unresolved} tareas necesitan una decisión.`) : (settings.language === 'en' ? 'Your schedule is up to date.' : 'Tu agenda está al día.'));
      }

      for (const b of Object.values(blocks)) {
        if (b.startsAt.slice(0, 10) !== key) continue;
        const start = minutesOf(b.startsAt);
        const end = start + b.durationMin;

        const noticeAt = start - settings.notificationLeadMin;
        if (noticeAt > prev && noticeAt <= nowMin) {
          systemNotice(`start-${b.id}`, settings.notificationLeadMin ? (settings.language === 'en' ? `${b.title} starts soon` : `${b.title} empieza pronto`) : (settings.language === 'en' ? `Starts: ${b.title}` : `Empieza: ${b.title}`), settings.notificationLeadMin ? (settings.language === 'en' ? `In ${settings.notificationLeadMin} minutes · ${b.startsAt.slice(11, 16)}` : `En ${settings.notificationLeadMin} minutos · ${b.startsAt.slice(11, 16)}`) : (settings.language === 'en' ? `Until ${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}` : `Hasta las ${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`));
        }

        if (settings.startChime && start > prev && start <= nowMin) {
          if (settings.soundEnabled) playChime(b.kind === 'break' ? settings.breakChime : settings.chime, settings.volume * 0.7, 1);
          useToasts.getState().push({
            kind: 'info',
            title: b.kind === 'break' ? (settings.language === 'en' ? 'Break starts' : 'Empieza la pausa') : (settings.language === 'en' ? `Starts: ${b.title}` : `Empieza: ${b.title}`),
            blockId: b.id,
            ttl: 8000,
          });
        }

        if (end > prev && end <= nowMin) {
          if (settings.soundEnabled) {
            playChime(b.kind === 'break' ? settings.breakChime : settings.chime, settings.volume, b.kind === 'break' ? 1 : 2);
          }
          if (settings.closePrompt && b.status === 'planned' && b.kind !== 'break') {
            useToasts.getState().push({
              kind: 'close-prompt',
              title: settings.language === 'en' ? `Ended: ${b.title}` : `Terminó: ${b.title}`,
              body: settings.language === 'en' ? 'Close it, or did you need more time?' : '¿Lo cerrás o necesitaste más tiempo?',
              blockId: b.id,
              ttl: 0,
            });
          }
        }
      }
    };

    run();
    const t = setInterval(run, 1000);
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tick]);
}
