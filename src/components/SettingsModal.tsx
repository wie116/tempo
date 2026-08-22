import { useState } from 'react';
import { useStore } from '../store';
import { THEMES } from '../lib/themes';
import { CHIMES, playChime } from '../lib/audio';
import type { ChimeId } from '../lib/audio';
import { Btn, ConfirmModal, Modal, NumField, Row, Tabs, TimeField, inputCls } from './Modal';
import { GoogleCalendarSettings } from './GoogleCalendarSettings';
import { usePlannerLog } from '../lib/plannerLog';
import { useUI } from '../store';


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-b-0">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">{title}</h3>
      {children}
    </section>
  );
}

export function SettingsModal({
  open, onClose, integrationNotice,
}: { open: boolean; onClose: () => void; integrationNotice?: string | null }) {
  const s = useStore((st) => st.settings);
  const set = useStore((st) => st.updateSettings);
  const reset = useStore((st) => st.resetSettings);
  const resetAllData = useStore((st) => st.resetAllData);
  const [askReset, setAskReset] = useState(false);
  const [askErase, setAskErase] = useState(false);
  const [askEraseFinal, setAskEraseFinal] = useState(false);
  const [tab, setTab] = useState<'appearance' | 'planning' | 'notifications' | 'integrations' | 'account'>('appearance');

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustes"
      subtitle="Personalizá la experiencia sin mezclar opciones de contextos distintos."
      footer={
        <>
          {tab !== 'account' && <Btn variant="danger" onClick={() => setAskReset(true)}>
            Restaurar preferencias
          </Btn>}
          <Btn variant="primary" onClick={onClose}>Listo</Btn>
        </>
      }
    >
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'appearance' as const, label: 'Apariencia' },
        { id: 'planning' as const, label: 'Agenda' },
        { id: 'notifications' as const, label: 'Avisos' },
        { id: 'integrations' as const, label: 'Integraciones' },
        { id: 'account' as const, label: 'Cuenta' },
      ]} />

      {tab === 'appearance' && <Section title="Tema y densidad">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => set({ theme: t.id })}
              className="rounded-xl border p-2 text-left transition-transform hover:-translate-y-px"
              style={{
                borderColor: s.theme === t.id ? 'var(--accent)' : 'var(--border)',
                boxShadow: s.theme === t.id ? '0 0 0 1px var(--accent)' : undefined,
              }}
            >
              <div className="mb-1.5 flex h-7 overflow-hidden rounded-lg border border-line">
                {t.swatch.map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <p className="text-[12.5px] font-medium">{t.name}</p>
              <p className="text-[10.5px] leading-tight text-muted">{t.hint}</p>
            </button>
          ))}
        </div>
        <Row label="Densidad" hint="Alto de cada slot de 10 minutos">
          <input
            type="range" min={8} max={22} step={1} value={s.slotPx}
            onChange={(e) => set({ slotPx: Number(e.target.value) })}
            className="w-32 accent-[var(--accent)]"
          />
        </Row>
        <Row label="Estilo del reloj" hint="Podés cambiarlo también desde el panel Actividad">
          <select value={s.clockStyle} onChange={(e) => set({ clockStyle: e.target.value as typeof s.clockStyle })} className={`${inputCls} w-36`}>
            <option value="rings">Anillos</option>
            <option value="focus">Enfoque</option>
            <option value="stats">Resumen</option>
          </select>
        </Row>
      </Section>}

      {tab === 'planning' && <Section title="Jornada">
        <p className="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
          La agenda muestra siempre las 24 horas. La jornada sólo resalta tu horario habitual y define el rango que usa Organizar.
        </p>
        <Row label="Empieza a las" hint="Inicio sugerido para Organizar">
          <TimeField
            value={s.dayStartHour * 60}
            min={0}
            max={(s.dayEndHour - 1) * 60}
            step={60}
            onCommit={(minutes) => set({ dayStartHour: Math.min(s.dayEndHour - 1, minutes / 60) })}
          />
        </Row>
        <Row label="Termina a las" hint="Fin sugerido para Organizar">
          <TimeField
            value={s.dayEndHour * 60}
            min={(s.dayStartHour + 1) * 60}
            max={24 * 60}
            step={60}
            onCommit={(minutes) => set({ dayEndHour: Math.max(s.dayStartHour + 1, minutes / 60) })}
          />
        </Row>
        <Row label="Duración por defecto" hint="Para bloques nuevos y tareas sin duración fija">
          <NumField value={s.defaultBlockMin} onCommit={(v) => v !== null && set({ defaultBlockMin: v })} suffix="min" />
        </Row>
        <Row label="La semana empieza el lunes">
          <input type="checkbox" checked={s.weekStartsOnMonday}
            onChange={(e) => set({ weekStartsOnMonday: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]" />
        </Row>
      </Section>}

      {tab === 'integrations' && <Section title="Calendarios conectados">
        <GoogleCalendarSettings active={open} notice={integrationNotice} />
      </Section>}

      {tab === 'account' && <Section title="Cuenta y datos">
        <p className="mb-4 text-[12px] leading-relaxed text-muted">
          Administrá los datos guardados por Tempo. Las preferencias se pueden restaurar sin afectar tu agenda desde las demás pestañas.
        </p>
        <div className="rounded-xl border p-4" style={{ borderColor: 'color-mix(in oklab, var(--now) 55%, var(--border))' }}>
          <p className="text-[13px] font-semibold">Borrar todos mis datos</p>
          <p className="mb-3 mt-1 text-[11.5px] leading-relaxed text-muted">
            Elimina tareas, rutinas, clasificaciones, bloques, series, notas y pendientes de organización. Tempo queda completamente vacío.
          </p>
          <Btn variant="danger" onClick={() => setAskErase(true)}>Borrar todos los datos</Btn>
        </div>
      </Section>}

      {tab === 'notifications' && <><Section title="Comportamiento del reloj">
        <p className="mb-1 text-[11.5px] leading-snug text-muted">
          El reloj corre solo: no hay que arrancar nada. La agenda define los límites y Tempo te avisa
          cuando cruzás uno.
        </p>
        <Row label="Aviso al empezar un bloque">
          <input type="checkbox" checked={s.startChime}
            onChange={(e) => set({ startChime: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]" />
        </Row>
        <Row label="Preguntar al terminar" hint="Para cerrarlo o pedir más tiempo">
          <input type="checkbox" checked={s.closePrompt}
            onChange={(e) => set({ closePrompt: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]" />
        </Row>
      </Section>

      <Section title="Avisos">
        <Row label="Alertas sonoras">
          <input type="checkbox" checked={s.soundEnabled}
            onChange={(e) => set({ soundEnabled: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]" />
        </Row>
        <Row label="Fin de bloque de trabajo">
          <ChimeSelect value={s.chime} volume={s.volume} onChange={(v) => set({ chime: v })} />
        </Row>
        <Row label="Fin de pausa">
          <ChimeSelect value={s.breakChime} volume={s.volume} onChange={(v) => set({ breakChime: v })} />
        </Row>
        <Row label="Volumen">
          <input type="range" min={0} max={1} step={0.05} value={s.volume}
            onChange={(e) => set({ volume: Number(e.target.value) })}
            onMouseUp={() => playChime(s.chime, s.volume)}
            onTouchEnd={() => playChime(s.chime, s.volume)}
            className="w-32 accent-[var(--accent)]" />
        </Row>
      </Section></>}
    </Modal>

    <ConfirmModal
      open={askReset}
      onClose={() => setAskReset(false)}
      onConfirm={reset}
      title="Restaurar valores por defecto"
      message="Vuelven a fábrica el theme, el horario de la jornada, el zoom, la duración por defecto y los sonidos."
      detail="Tus bloques, tareas y clasificaciones no se tocan. La agenda seguirá mostrando las 24 horas."
      confirmLabel="Restaurar"
      danger={false}
    />
    <ConfirmModal
      open={askErase}
      onClose={() => setAskErase(false)}
      onConfirm={() => setAskEraseFinal(true)}
      title="Borrar todos los datos"
      message="Se van a eliminar todas tus tareas, rutinas, clasificaciones y bloques de la agenda."
      detail="Esta acción no se puede deshacer. Para evitar errores, todavía habrá una confirmación final."
      confirmLabel="Continuar"
    />
    <ConfirmModal
      open={askEraseFinal}
      onClose={() => setAskEraseFinal(false)}
      onConfirm={() => {
        resetAllData();
        usePlannerLog.getState().clear();
        useUI.getState().clearSelection();
        onClose();
      }}
      title="Confirmación final"
      message="¿Seguro que querés dejar Tempo completamente vacío?"
      detail="No quedarán tareas, rutinas, clasificaciones, notas ni eventos propios en la agenda."
      confirmLabel="Sí, borrar todo"
    />
    </>
  );
}

function ChimeSelect({
  value, volume, onChange,
}: { value: ChimeId; volume: number; onChange: (v: ChimeId) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={(e) => { const v = e.target.value as ChimeId; onChange(v); playChime(v, volume); }}
        className={`${inputCls} w-32`}
      >
        {CHIMES.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        onClick={() => playChime(value, volume)}
        aria-label="Probar sonido"
        className="rounded-lg border border-line p-1.5 text-muted hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M4 3.5v9l8-4.5-8-4.5Z" fill="currentColor" />
        </svg>
      </button>
    </div>
  );
}
