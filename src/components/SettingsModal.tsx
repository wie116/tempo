import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { THEMES } from '../lib/themes';
import { CHIMES, playChime } from '../lib/audio';
import type { ChimeId } from '../lib/audio';
import { Btn, ConfirmModal, Modal, NumField, Row, inputCls } from './Modal';
import { hhmm, minutesOf } from '../lib/time';


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-b-0">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">{title}</h3>
      {children}
    </section>
  );
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore((st) => st.settings);
  const set = useStore((st) => st.updateSettings);
  const blocks = useStore((st) => st.blocks);
  const reset = useStore((st) => st.resetSettings);
  const [note, setNote] = useState<string | null>(null);
  const [askReset, setAskReset] = useState(false);

  /* La jornada no puede achicarse por encima de lo que ya tenés agendado:
     el bloque quedaría fuera de la grilla, invisible pero vivo. */
  const bounds = useMemo(() => {
    let earliest = 24 * 60;
    let latest = 0;
    for (const b of Object.values(blocks)) {
      earliest = Math.min(earliest, minutesOf(b.startsAt));
      latest = Math.max(latest, minutesOf(b.startsAt) + b.durationMin);
    }
    return Object.keys(blocks).length
      ? { minStartHour: Math.floor(earliest / 60), maxEndHour: Math.ceil(latest / 60), earliest, latest }
      : null;
  }, [blocks]);

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustes"
      subtitle="Apariencia, jornada y avisos"
      footer={
        <>
          <Btn variant="danger" onClick={() => setAskReset(true)}>
            Restaurar valores por defecto
          </Btn>
          <Btn variant="primary" onClick={onClose}>Listo</Btn>
        </>
      }
    >
      <Section title="Theme">
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
      </Section>

      <Section title="Jornada">
        <Row label="Empieza a las">
          <NumField
            value={s.dayStartHour}
            min={0}
            step={1}
            suffix="h"
            onCommit={(v) => {
              if (v === null) return;
              const wanted = Math.min(12, v);
              const floor = bounds ? bounds.minStartHour : 0;
              if (wanted > floor) {
                setNote(`Tenés un bloque que empieza ${hhmm(bounds!.earliest)}. La jornada no puede arrancar después.`);
                set({ dayStartHour: floor });
              } else {
                setNote(null);
                set({ dayStartHour: wanted });
              }
            }}
          />
        </Row>
        <Row label="Termina a las">
          <NumField
            value={s.dayEndHour}
            min={13}
            step={1}
            suffix="h"
            onCommit={(v) => {
              if (v === null) return;
              const wanted = Math.min(24, Math.max(13, v));
              const ceil = bounds ? Math.max(13, bounds.maxEndHour) : 13;
              if (wanted < ceil) {
                setNote(`Tenés un bloque que termina ${hhmm(bounds!.latest)}. Movelo o acortalo antes de recortar la jornada.`);
                set({ dayEndHour: ceil });
              } else {
                setNote(null);
                set({ dayEndHour: wanted });
              }
            }}
          />
        </Row>
        {note && (
          <p className="mt-1 rounded-lg border border-dashed px-2.5 py-2 text-[11.5px] leading-snug"
            style={{ borderColor: 'var(--now)', color: 'var(--now)' }}>
            {note}
          </p>
        )}
        <Row label="Duración por defecto" hint="Para bloques nuevos y tareas sin duración fija">
          <NumField value={s.defaultBlockMin} onCommit={(v) => v !== null && set({ defaultBlockMin: v })} suffix="min" />
        </Row>
        <Row label="La semana empieza el lunes">
          <input type="checkbox" checked={s.weekStartsOnMonday}
            onChange={(e) => set({ weekStartsOnMonday: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]" />
        </Row>
      </Section>

      <Section title="Avisos del reloj">
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
      </Section>
    </Modal>

    <ConfirmModal
      open={askReset}
      onClose={() => setAskReset(false)}
      onConfirm={() => { reset(); setNote(null); }}
      title="Restaurar valores por defecto"
      message="Vuelven a fábrica el theme, el horario de la jornada, el zoom, la duración por defecto y los sonidos."
      detail="Tus bloques, tareas y grupos no se tocan. Si tenés bloques fuera del horario por defecto, la jornada se abre lo necesario para que sigan visibles."
      confirmLabel="Restaurar"
      danger={false}
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
