import { useState } from 'react';
import { Btn, Modal } from './Modal';

const STEPS = [
  { kicker: '1 · Capturá', title: 'Inbox, Hoy y fechas futuras', body: 'Escribí una tarea en lenguaje natural —por ejemplo “Preparar informe mañana 45m urgente”—. Podés dejarla en Inbox, asignarla a otro día o darle una fecha límite.' },
  { kicker: '2 · Planificá', title: 'Arrastrá, reordená y ajustá', body: 'Llevá una tarea a la agenda. Soltala en la mitad superior de otro bloque para ubicarla antes, o en la inferior para ubicarla después. Los bordes cambian su duración.' },
  { kicker: '3 · Repetí', title: 'Las series viven en la agenda', body: 'Abrí un bloque y entrá en Repetir. Una misma Rutina puede tener una serie diaria, otra semanal y también ocurrencias aisladas.' },
  { kicker: '4 · Recuperá', title: 'Nada pendiente desaparece', body: 'Lo que no entra al organizar queda en Actividad > Pendientes por ubicar. Podés ocultar la bandeja; el botón seguirá resaltado mientras haya algo.' },
];

export function OnboardingModal({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const item = STEPS[step];
  return <Modal open={open} onClose={onDone} title="Bienvenido a Tempo" subtitle="Una guía breve para empezar" size="sm"
    footer={<><Btn onClick={onDone}>Omitir</Btn>{step > 0 && <Btn onClick={() => setStep(step - 1)}>Atrás</Btn>}
      <Btn variant="primary" onClick={() => step === STEPS.length - 1 ? onDone() : setStep(step + 1)}>{step === STEPS.length - 1 ? 'Empezar' : 'Siguiente'}</Btn></>}>
    <div className="p-5">
      <div className="mb-5 flex gap-1.5">{STEPS.map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= step ? 'var(--accent)' : 'var(--surface-2)' }} />)}</div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{item.kicker}</p>
      <h3 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight">{item.title}</h3>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{item.body}</p>
    </div>
  </Modal>;
}
