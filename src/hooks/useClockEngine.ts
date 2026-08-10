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

      for (const b of Object.values(blocks)) {
        if (b.startsAt.slice(0, 10) !== key) continue;
        const start = minutesOf(b.startsAt);
        const end = start + b.durationMin;

        if (settings.startChime && start > prev && start <= nowMin) {
          if (settings.soundEnabled) playChime(b.kind === 'break' ? settings.breakChime : settings.chime, settings.volume * 0.7, 1);
          useToasts.getState().push({
            kind: 'info',
            title: b.kind === 'break' ? 'Empieza la pausa' : `Empieza: ${b.title}`,
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
              title: `Terminó: ${b.title}`,
              body: '¿Lo cerrás o necesitaste más tiempo?',
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
