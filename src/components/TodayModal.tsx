import { useMemo } from 'react';
import { useClock, useStore } from '../store';
import { computeStats } from '../lib/stats';
import { dateKey, durationLabel, hhmm, minutesOf } from '../lib/time';
import { Btn, Modal } from './Modal';

export function TodayModal({
  open, onClose, onOpenBlock, onAutoplan,
}: {
  open: boolean;
  onClose: () => void;
  onOpenBlock: (id: string) => void;
  onAutoplan: () => void;
}) {
  const blocks = useStore((s) => s.blocks);
  const setStatus = useStore((s) => s.setStatus);
  const now = useClock((s) => s.now);

  const stats = useMemo(() => computeStats(blocks, new Date(now)), [blocks, now]);
  const todayKey = dateKey(new Date(now));
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();

  const today = useMemo(
    () =>
      Object.values(blocks)
        .filter((b) => b.startsAt.slice(0, 10) === todayKey)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [blocks, todayKey]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resumen de hoy"
      subtitle={
        stats.todayPlanned === 0
          ? 'Todavía no planificaste el día'
          : `${stats.todayDone} de ${stats.todayPlanned} bloques cerrados · ${durationLabel(stats.todayDoneMin)} de ${durationLabel(stats.todayPlannedMin)}`
      }
      footer={<Btn variant="primary" onClick={onClose}>Cerrar</Btn>}
    >
      {/* Agenda del día */}
      <div className="border-b border-line p-5">
        {today.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[13px] text-muted">El día está vacío.</p>
            <div className="mt-3">
              <Btn variant="primary" onClick={() => { onClose(); onAutoplan(); }}>Planificar con la varita</Btn>
            </div>
          </div>
        ) : (
          <ul className="space-y-1">
            {today.map((b) => {
              const start = minutesOf(b.startsAt);
              const end = start + b.durationMin;
              const live = nowMin >= start && nowMin < end;
              const overdue = b.status === 'planned' && nowMin >= end;
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
                  style={{
                    borderColor: live ? 'var(--now)' : 'var(--border)',
                    background: live ? 'color-mix(in oklab, var(--now) 7%, transparent)' : undefined,
                    opacity: b.status === 'done' ? 0.5 : 1,
                  }}
                >
                  <span className="tabular w-20 shrink-0 font-mono text-[11px] text-muted">
                    {hhmm(start)}–{hhmm(end)}
                  </span>
                  <span
                    className="h-4 w-[3px] shrink-0 rounded-full"
                    style={{ background: b.kind === 'break' ? 'var(--muted)' : b.color }}
                  />
                  <button
                    onClick={() => { onClose(); onOpenBlock(b.id); }}
                    className={`min-w-0 flex-1 truncate text-left text-[12.5px] ${b.status === 'done' ? 'line-through' : ''}`}
                  >
                    {b.title}
                  </button>
                  {b.status === 'skipped' && (
                    <span className="shrink-0 text-[10px] text-muted">omitido</span>
                  )}
                  {overdue && (
                    <span className="shrink-0 text-[10px]" style={{ color: 'var(--now)' }}>sin cerrar</span>
                  )}
                  {b.kind !== 'break' && (
                    <button
                      onClick={() => setStatus(b.id, b.status === 'done' ? 'skipped' : b.status === 'skipped' ? 'planned' : 'done')}
                      aria-label="Alternar completado"
                      className="grid h-4 w-4 shrink-0 place-items-center rounded-full border"
                      style={{
                        borderColor: b.status === 'done' ? b.color : 'color-mix(in oklab, var(--muted) 45%, transparent)',
                        background: b.status === 'done' ? b.color : 'transparent',
                      }}
                    >
                      {b.status === 'done' && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden>
                          <path d="M2.5 6.4 4.8 8.7 9.5 3.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Números descriptivos, no un boletín de notas */}
      <div className="p-5">
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">Tus patrones</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat
            label="Arrancás cerca de"
            value={stats.typicalStartMin === null ? '—' : hhmm(stats.typicalStartMin)}
            note="Mediana de tus primeros bloques"
          />
          <Stat
            label="Tu bloque típico"
            value={stats.typicalBlockMin === null ? '—' : durationLabel(stats.typicalBlockMin)}
            note="Útil para planificar mejor"
          />
          <Stat
            label="Días seguidos"
            value={stats.streak === 0 ? '—' : String(stats.streak)}
            note="Con al menos un bloque cerrado"
          />
          <Stat
            label="Cerrados esta semana"
            value={stats.weekRate === null ? '—' : `${Math.round(stats.weekRate * 100)}%`}
            note="De lo que planificaste"
          />
          <Stat
            label="Sin cerrar hoy"
            value={String(stats.openPast)}
            note="Bloques que ya pasaron"
          />
          <Stat
            label="Omitidos hoy"
            value={String(stats.todaySkipped)}
            note="Los marcaste como no hechos"
          />
        </div>

        {stats.weakSpots.length > 0 && (
          <div className="mt-3 rounded-lg border border-line p-3">
            <p className="mb-1 text-[11.5px] font-semibold">Lo que más se te posterga</p>
            <ul className="space-y-0.5">
              {stats.weakSpots.map((w) => (
                <li key={w.title} className="flex items-baseline gap-2 text-[11.5px]">
                  <span className="min-w-0 flex-1 truncate">{w.title}</span>
                  <span className="tabular shrink-0 font-mono text-[10.5px] text-muted">{w.missed}×</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] leading-snug text-muted">
              Suele significar que el bloque quedó corto o en mal horario, no que te falte voluntad.
              Probá moverlo o darle más tiempo.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-line p-2.5">
      <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="tabular mt-0.5 font-mono text-[19px] font-bold leading-none tracking-tight">{value}</p>
      <p className="mt-1 text-[10px] leading-snug text-muted">{note}</p>
    </div>
  );
}
