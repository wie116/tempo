import { useStore } from '../store';
import { THEMES } from '../lib/themes';
import { playChime } from '../lib/audio';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px]">{label}</p>
        {hint && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const num = 'w-16 rounded-md border border-line bg-surface-2 px-2 py-1 text-right font-mono text-[12px] outline-none';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useStore((st) => st.settings);
  const set = useStore((st) => st.updateSettings);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-sm flex-col bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">Ajustes</h2>
          <button onClick={onClose} className="text-[13px] text-muted hover:text-ink">Cerrar</button>
        </header>

        <div className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto px-4">
          <section className="py-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Apariencia</h3>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => set({ theme: t.id })}
                  className="rounded-lg border p-2 text-left"
                  style={{ borderColor: s.theme === t.id ? 'var(--accent)' : 'var(--border)' }}
                >
                  <div className="mb-1.5 flex h-6 overflow-hidden rounded">
                    {t.swatch.map((c) => (
                      <span key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-[12px] font-medium">{t.name}</p>
                  <p className="text-[10px] leading-tight text-muted">{t.hint}</p>
                </button>
              ))}
            </div>
            <Row label="Densidad" hint="Alto de cada slot de 10 minutos">
              <input
                type="range" min={8} max={20} step={1} value={s.slotPx}
                onChange={(e) => set({ slotPx: Number(e.target.value) })}
                className="w-28 accent-[var(--accent)]"
              />
            </Row>
          </section>

          <section className="py-3">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Jornada</h3>
            <Row label="Empieza a las">
              <input type="number" min={0} max={12} value={s.dayStartHour}
                onChange={(e) => set({ dayStartHour: Number(e.target.value) })} className={num} />
            </Row>
            <Row label="Termina a las">
              <input type="number" min={13} max={24} value={s.dayEndHour}
                onChange={(e) => set({ dayEndHour: Number(e.target.value) })} className={num} />
            </Row>
            <Row label="La semana empieza el lunes">
              <input type="checkbox" checked={s.weekStartsOnMonday}
                onChange={(e) => set({ weekStartsOnMonday: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]" />
            </Row>
          </section>

          <section className="py-3">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Temporizador</h3>
            <Row label="Foco (min)">
              <input type="number" min={5} max={120} value={s.pomodoroMin}
                onChange={(e) => set({ pomodoroMin: Number(e.target.value) })} className={num} />
            </Row>
            <Row label="Pausa corta (min)">
              <input type="number" min={1} max={30} value={s.breakMin}
                onChange={(e) => set({ breakMin: Number(e.target.value) })} className={num} />
            </Row>
            <Row label="Pausa larga (min)" hint="Cada 4 bloques de foco">
              <input type="number" min={5} max={60} value={s.longBreakMin}
                onChange={(e) => set({ longBreakMin: Number(e.target.value) })} className={num} />
            </Row>
            <Row label="Encadenar la pausa" hint="Arranca sola al terminar el foco">
              <input type="checkbox" checked={s.autoStartBreak}
                onChange={(e) => set({ autoStartBreak: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]" />
            </Row>
          </section>

          <section className="py-3 pb-8">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Sonido</h3>
            <Row label="Alertas sonoras">
              <input type="checkbox" checked={s.soundEnabled}
                onChange={(e) => set({ soundEnabled: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]" />
            </Row>
            <Row label="Campanita al cerrar un bloque" hint="Aunque no haya pomodoro corriendo">
              <input type="checkbox" checked={s.blockEndChime}
                onChange={(e) => set({ blockEndChime: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]" />
            </Row>
            <Row label="Tono">
              <select
                value={s.chime}
                onChange={(e) => { const v = e.target.value as typeof s.chime; set({ chime: v }); playChime(v, s.volume); }}
                className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[12px] outline-none"
              >
                <option value="bell">Campana</option>
                <option value="soft">Suave</option>
                <option value="blip">Bip</option>
              </select>
            </Row>
            <Row label="Volumen">
              <input type="range" min={0} max={1} step={0.05} value={s.volume}
                onChange={(e) => set({ volume: Number(e.target.value) })}
                onMouseUp={() => playChime(s.chime, s.volume)}
                className="w-28 accent-[var(--accent)]" />
            </Row>
            <button
              onClick={() => playChime(s.chime, s.volume)}
              className="mt-2 w-full rounded-lg border border-line py-2 text-[12.5px] text-muted hover:text-ink"
            >
              Probar sonido
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
}
