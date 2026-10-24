import { useState } from 'react';
import { Btn, Modal } from './Modal';
import { useStore } from '../store';
import { pick } from '../lib/i18n';
import type { AppLanguage } from '../types';

const stepsFor = (language: AppLanguage) => [
  { kicker: pick(language, '1 · Capturá', '1 · Capture'), title: pick(language, 'Inbox, Hoy y fechas futuras', 'Inbox, Today, and future dates'), body: pick(language, 'Escribí una tarea en lenguaje natural —por ejemplo “Preparar informe mañana 45m urgente”—. Podés dejarla en Inbox, asignarla a otro día o darle una fecha límite.', 'Write a task in natural language—for example, “Prepare report tomorrow 45m urgent.” Leave it in Inbox, assign it to another day, or add a deadline.') },
  { kicker: pick(language, '2 · Planificá', '2 · Plan'), title: pick(language, 'Arrastrá, reordená y ajustá', 'Drag, reorder, and adjust'), body: pick(language, 'Llevá una tarea a la agenda. Soltala en la mitad superior de otro bloque para ubicarla antes, o en la inferior para ubicarla después. Los bordes cambian su duración.', 'Drag a task into the schedule. Drop it on the top half of another block to place it before, or the bottom half to place it after. Drag its edges to change the duration.') },
  { kicker: pick(language, '3 · Repetí', '3 · Repeat'), title: pick(language, 'Las series viven en la agenda', 'Series live in the schedule'), body: pick(language, 'Abrí un bloque y entrá en Repetir. Una misma Rutina puede tener una serie diaria, otra semanal y también ocurrencias aisladas.', 'Open a block and choose Repeat. The same routine can have a daily series, a weekly series, and individual occurrences.') },
  { kicker: pick(language, '4 · Recuperá', '4 · Recover'), title: pick(language, 'Nada pendiente desaparece', 'Pending work never disappears'), body: pick(language, 'Lo que no entra al organizar queda en Actividad > Pendientes por ubicar. Podés ocultar la bandeja; el botón seguirá resaltado mientras haya algo.', 'Anything that does not fit stays under Activity > Unscheduled. You can hide the tray; the button remains highlighted while items are waiting.') },
];

export function OnboardingModal({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const language = useStore((s) => s.settings.language);
  const steps = stepsFor(language);
  const item = steps[step];
  return <Modal open={open} onClose={onDone} title={pick(language, 'Bienvenido a Tempo', 'Welcome to Tempo')} subtitle={pick(language, 'Una guía breve para empezar', 'A quick guide to get started')} size="sm"
    footer={<><Btn onClick={onDone}>{pick(language, 'Omitir', 'Skip')}</Btn>{step > 0 && <Btn onClick={() => setStep(step - 1)}>{pick(language, 'Atrás', 'Back')}</Btn>}
      <Btn variant="primary" onClick={() => step === steps.length - 1 ? onDone() : setStep(step + 1)}>{step === steps.length - 1 ? pick(language, 'Empezar', 'Get started') : pick(language, 'Siguiente', 'Next')}</Btn></>}>
    <div className="p-5">
      <div className="mb-5 flex gap-1.5">{steps.map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= step ? 'var(--accent)' : 'var(--surface-2)' }} />)}</div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{item.kicker}</p>
      <h3 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight">{item.title}</h3>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{item.body}</p>
    </div>
  </Modal>;
}
