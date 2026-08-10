import { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore } from '../store';
import { autoplan, candidatesFromDay, candidatesFromTasks } from '../lib/autoplan';
import type { PlanCandidate } from '../lib/autoplan';
import type { PlanOrder, PlanSource } from '../types';
import { dateKey, durationLabel, fmt, hhmm, snap } from '../lib/time';
import { Btn, Field, Modal, NumField, Segmented } from './Modal';

const ORDERS: { id: PlanOrder; label: string }[] = [
  { id: 'list', label: 'Orden de lista' },
  { id: 'random', label: 'Al azar' },
  { id: 'longest', label: 'Largas primero' },
  { id: 'shortest', label: 'Cortas primero' },
];

export function AutoplanModal({
  open, onClose, preset,
}: { open: boolean; onClose: () => void; preset: 'wand' | 'dice' }) {
  const cfgSaved = useStore((s) => s.settings.autoplan);
  const updateSettings = useStore((s) => s.updateSettings);
  const tasks = useStore((s) => s.tasks);
  const lists = useStore((s) => s.lists);
  const blocks = useStore((s) => s.blocks);
  const cursor = useStore((s) => s.cursor);
  const setCursor = useStore((s) => s.setCursor);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const applyPlan = useStore((s) => s.applyPlan);
  const applyReorder = useStore((s) => s.applyReorder);
  const unscheduleBlocks = useStore((s) => s.unscheduleBlocks);

  const [seed, setSeed] = useState(() => Date.now());
  const [dropped, setDropped] = useState<string[]>([]);

  const cfg = useMemo(
    () => ({ ...cfgSaved, order: preset === 'dice' ? ('random' as PlanOrder) : cfgSaved.order }),
    [cfgSaved, preset]
  );
  const setCfg = (patch: Partial<typeof cfg>) => updateSettings({ autoplan: { ...cfgSaved, ...patch } });

  const day = parseISO(cursor);
  const isToday = cursor === dateKey(new Date());
  const nowMin = snap(new Date().getHours() * 60 + new Date().getMinutes());

  const fromMin =
    cfg.from === 'now' ? (isToday ? nowMin : dayStartHour * 60)
    : cfg.from === 'dayStart' ? dayStartHour * 60
    : cfg.customFromMin;

  const dayBlocks = useMemo(
    () => Object.values(blocks).filter((b) => b.startsAt.slice(0, 10) === cursor),
    [blocks, cursor]
  );

  const scheduled = useMemo(() => {
    const s = new Set<string>();
    for (const b of Object.values(blocks)) if (b.taskId && b.status !== 'skipped') s.add(b.taskId);
    return s;
  }, [blocks]);

  /* Según la fuente cambia qué se acomoda y qué queda fijo. */
  const { candidates, obstacles } = useMemo(() => {
    if (cfg.source === 'today') return candidatesFromDay(dayBlocks, fromMin);
    return {
      candidates: candidatesFromTasks(tasks, lists, scheduled, cfg),
      obstacles: dayBlocks,
    };
  }, [cfg, dayBlocks, fromMin, tasks, lists, scheduled]);

  const result = useMemo(
    () => autoplan(candidates, obstacles, cfg, fromMin, seed),
    [candidates, obstacles, cfg, fromMin, seed]
  );

  const keep = result.placed.filter((p) => !dropped.includes(p.key));
  const droppedItems = result.placed.filter((p) => dropped.includes(p.key));

  const apply = () => {
    if (cfg.source === 'today') {
      applyReorder(
        day,
        keep.filter((p) => p.blockId).map((p) => ({ blockId: p.blockId!, startMin: p.startMin }))
      );
      // Lo que no entró vuelve al panel de tareas en vez de quedar escondido.
      const out = [...result.leftover, ...droppedItems]
        .map((p) => p.blockId)
        .filter((x): x is string => Boolean(x));
      if (out.length) unscheduleBlocks(out);
    } else {
      applyPlan(
        day,
        keep.filter((p) => p.taskId)
      );
    }
    setDropped([]);
    onClose();
  };

  const reordering = cfg.source === 'today';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={preset === 'dice' ? 'Dado' : 'Varita'}
      subtitle={
        reordering
          ? 'Reacomoda los bloques del día. Lo completado, lo que ya arrancó y las pausas no se mueven.'
          : 'Agenda tus tareas pendientes en los huecos libres, sin mover nada de lo que ya está.'
      }
      footer={
        <>
          {(preset === 'dice' || cfg.order === 'random') && (
            <Btn onClick={() => setSeed(Date.now())}>Volver a tirar</Btn>
          )}
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={apply} disabled={keep.length === 0 && result.leftover.length === 0}>
            {reordering ? 'Reacomodar' : `Agendar ${keep.length || ''}`}
          </Btn>
        </>
      }
    >
      <div className="space-y-4 border-b border-line p-5">
        <Field label="Qué acomodar">
          <Segmented
            value={cfg.source}
            onChange={(v) => { setCfg({ source: v as PlanSource }); setDropped([]); }}
            options={[
              { id: 'today', label: 'Bloques del día' },
              { id: 'pending', label: 'Tareas pendientes' },
            ]}
          />
        </Field>

        <Field label="Día" hint="También cambia el día que estás viendo en la agenda">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={cursor}
              onChange={(e) => e.target.value && setCursor(e.target.value)}
              className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[13px] outline-none"
            />
            <button
              onClick={() => setCursor(dateKey(new Date()))}
              className="rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] text-muted hover:text-ink"
            >
              Hoy
            </button>
            <span className="text-[12px] capitalize text-muted">{fmt(day, "EEEE d 'de' LLLL")}</span>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Empezar">
            <Segmented
              value={cfg.from}
              onChange={(v) => setCfg({ from: v })}
              options={[
                { id: 'now' as const, label: 'Ahora' },
                { id: 'dayStart' as const, label: 'Inicio' },
                { id: 'custom' as const, label: 'Hora' },
              ]}
            />
            {cfg.from === 'custom' && (
              <div className="mt-2">
                <input
                  type="time"
                  step={600}
                  value={hhmm(cfg.customFromMin)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    if (!Number.isNaN(h)) setCfg({ customFromMin: snap(h * 60 + m) });
                  }}
                  className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 font-mono text-[13px] outline-none"
                />
              </div>
            )}
          </Field>

          <Field label="Terminar antes de">
            <input
              type="time"
              step={600}
              value={hhmm(cfg.untilMin)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (!Number.isNaN(h)) setCfg({ untilMin: snap(h * 60 + m) });
              }}
              className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 font-mono text-[13px] outline-none"
            />
          </Field>
        </div>

        {preset !== 'dice' && (
          <Field label="Orden">
            <Segmented value={cfg.order} onChange={(v) => setCfg({ order: v })} options={ORDERS} />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {!reordering && (
            <Field label="Sin duración propia" hint="Cuánto dura una tarea que dejaste libre">
              <NumField value={cfg.defaultMin} onCommit={(v) => setCfg({ defaultMin: v ?? 30 })} suffix="min" />
            </Field>
          )}
          <Field label="Aire entre bloques" hint="Múltiplos de 10 para que todo caiga en la grilla">
            <Segmented
              value={String(cfg.gapMin)}
              onChange={(v) => setCfg({ gapMin: Number(v) })}
              options={[
                { id: '0', label: 'Pegados' },
                { id: '10', label: '10m' },
                { id: '20', label: '20m' },
                { id: '30', label: '30m' },
              ]}
            />
          </Field>
        </div>

        {/* Los grupos solo tienen sentido cuando salimos a buscar tareas nuevas */}
        {!reordering && (
          <>
            <Field label="Grupos">
              <div className="rounded-lg border border-line">
                <label className="flex items-center gap-2.5 border-b border-line px-3 py-2 text-[13px] font-medium">
                  <input
                    type="checkbox"
                    checked={cfg.listIds === null}
                    ref={(el) => { if (el) el.indeterminate = cfg.listIds !== null && cfg.listIds.length > 0; }}
                    onChange={(e) => setCfg({ listIds: e.target.checked ? null : [] })}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Todos los grupos
                </label>
                <div className="max-h-40 overflow-y-auto p-1">
                  {lists.map((l) => {
                    const on = cfg.listIds === null || cfg.listIds.includes(l.id);
                    return (
                      <label key={l.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-2">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            const cur = cfg.listIds === null ? lists.map((x) => x.id) : cfg.listIds;
                            const next = on ? cur.filter((x) => x !== l.id) : [...cur, l.id];
                            setCfg({ listIds: next.length === lists.length ? null : next });
                          }}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
                        <span className="min-w-0 flex-1 truncate">{l.name}</span>
                        <span className="tabular font-mono text-[11px] text-muted">
                          {tasks.filter((t) => t.listId === l.id && !t.archived).length}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </Field>

            <label className="flex items-center gap-2.5 text-[13px]">
              <input
                type="checkbox"
                checked={cfg.includeRecurring}
                onChange={(e) => setCfg({ includeRecurring: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Incluir tareas recurrentes ↻
            </label>
          </>
        )}
      </div>

      {/* Vista previa */}
      <div className="p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">Va a quedar así</h3>
          <span className="tabular font-mono text-[10.5px] text-muted">
            {durationLabel(result.freeMin)} libres desde {hhmm(fromMin)}
          </span>
        </div>

        {result.placed.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] leading-snug text-muted">
            {reordering
              ? 'No hay bloques por delante para reacomodar en este día.'
              : 'No hay tareas pendientes que entren con esta configuración.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {result.placed.map((p) => {
              const off = dropped.includes(p.key);
              return (
                <li
                  key={p.key}
                  className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-1.5"
                  style={{ opacity: off ? 0.4 : 1 }}
                >
                  <span className="tabular w-12 shrink-0 font-mono text-[11px] text-muted">{hhmm(p.startMin)}</span>
                  <span className="h-4 w-[3px] shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className={`min-w-0 flex-1 truncate text-[12.5px] ${off ? 'line-through' : ''}`}>{p.title}</span>
                  <span className="tabular shrink-0 font-mono text-[10.5px] text-muted">
                    {durationLabel(p.durationMin)}
                  </span>
                  <button
                    onClick={() => setDropped((d) => (off ? d.filter((x) => x !== p.key) : [...d, p.key]))}
                    className="shrink-0 rounded px-1.5 text-[11px] text-muted hover:text-ink"
                  >
                    {off ? 'Incluir' : 'Sacar'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <Leftovers items={result.leftover} dropped={droppedItems} reordering={reordering} />
      </div>
    </Modal>
  );
}

function Leftovers({
  items, dropped, reordering,
}: {
  items: (PlanCandidate & { reason: string })[];
  dropped: PlanCandidate[];
  reordering: boolean;
}) {
  const total = items.length + dropped.length;
  if (total === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-dashed border-line p-3">
      <p className="mb-1.5 text-[11.5px] font-semibold" style={{ color: 'var(--now)' }}>
        {total} {total === 1 ? 'queda' : 'quedan'} afuera
      </p>
      <ul className="space-y-0.5">
        {items.map((l) => (
          <li key={l.key} className="flex items-baseline gap-2 text-[11.5px]">
            <span className="min-w-0 flex-1 truncate">{l.title}</span>
            <span className="tabular shrink-0 font-mono text-[10px] text-muted">
              {durationLabel(l.durationMin)} · {l.reason}
            </span>
          </li>
        ))}
        {dropped.map((l) => (
          <li key={l.key} className="flex items-baseline gap-2 text-[11.5px]">
            <span className="min-w-0 flex-1 truncate">{l.title}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted">la sacaste vos</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        {reordering
          ? 'Se van a sacar de la agenda y vuelven al panel de tareas como pendientes.'
          : 'Siguen pendientes en su grupo. Podés correr la hora de fin o dejarlas para mañana.'}
      </p>
    </div>
  );
}
