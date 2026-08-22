import { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore } from '../store';
import { autoplan, candidatesFromDay, candidatesFromTasks, findGaps } from '../lib/autoplan';
import { undo } from '../lib/history';
import type { PlanCandidate } from '../lib/autoplan';
import type { AutoplanConfig, PlanOrder, PlanSource } from '../types';
import { dateKey, durationLabel, fmt, hhmm, snap } from '../lib/time';
import { usePlannerLog } from '../lib/plannerLog';
import { useToasts } from '../store';
import { Btn, Field, Modal, NumField, Segmented, Tabs, TimeField } from './Modal';

const ORDERS: { id: PlanOrder; label: string }[] = [
  { id: 'list', label: 'Orden de lista' },
  { id: 'random', label: 'Al azar' },
  { id: 'longest', label: 'Largas primero' },
  { id: 'shortest', label: 'Cortas primero' },
];

export function AutoplanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'setup' | 'preview'>('setup');
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

  const cfg = cfgSaved;
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
      candidates: candidatesFromTasks(tasks, lists, scheduled, cfg, cursor),
      obstacles: dayBlocks,
    };
  }, [cfg, dayBlocks, fromMin, tasks, lists, scheduled, cursor]);

  /**
   * "Reasignar tiempo": para esta tanda nada más, sin tocar lo guardado en
   * cada tarea. Manual pisa la duración de todos por la que elijas. Automático
   * prueba duraciones de a 10 minutos, de mayor a menor, usando el mismo motor
   * de colocación real (respeta huecos partidos y el aire entre bloques tal
   * cual), hasta encontrar la más grande donde entran todas.
   */
  // Lo que sacaste a mano queda totalmente afuera del cálculo, no solo de
  // la aplicación final: así el tiempo que le tocaba se reparte entre las
  // que quedan, en vez de perderse.
  const activeCandidates = useMemo(
    () => candidates.filter((c) => !dropped.includes(c.key)),
    [candidates, dropped]
  );
  const excludedCandidates = useMemo(
    () => candidates.filter((c) => dropped.includes(c.key)),
    [candidates, dropped]
  );

  const reassignedCandidates = useMemo(() => {
    if (cfg.reassign === 'manual') {
      const d = Math.max(10, snap(cfg.reassignMin));
      return activeCandidates.map((c) => ({ ...c, durationMin: d }));
    }
    if (cfg.reassign === 'auto' && activeCandidates.length > 0) {
      const gaps = findGaps(obstacles, fromMin, cfg.untilMin);
      const freeMin = gaps.reduce((n, g) => n + (g.end - g.start), 0);
      const usable = Math.max(0, freeMin - cfg.gapMin * Math.max(0, activeCandidates.length - 1));
      const start = Math.max(10, Math.floor(usable / activeCandidates.length / 10) * 10);
      for (let d = start; d >= 10; d -= 10) {
        const test = activeCandidates.map((c) => ({ ...c, durationMin: d }));
        if (autoplan(test, obstacles, cfg, fromMin, seed).leftover.length === 0) return test;
      }
      return activeCandidates.map((c) => ({ ...c, durationMin: 10 })); // ni al mínimo entran todas
    }
    return activeCandidates;
  }, [activeCandidates, obstacles, cfg.reassign, cfg.reassignMin, cfg.gapMin, cfg.untilMin, fromMin, seed]);

  const autoFitMin = cfg.reassign === 'auto' ? reassignedCandidates[0]?.durationMin ?? null : null;

  const result = useMemo(
    () => autoplan(reassignedCandidates, obstacles, cfg, fromMin, seed),
    [reassignedCandidates, obstacles, cfg, fromMin, seed]
  );

  // Ya no hay que filtrar dropped acá: activeCandidates se encargó antes.
  const keep = result.placed;

  const apply = () => {
    const todayKey = dateKey(new Date());
    const isTodayView = cursor === todayKey;
    const leftoverAll = [
      ...result.leftover.map((p) => ({
        title: p.title, durationMin: p.durationMin, reason: p.reason,
        taskId: p.taskId, color: p.color,
      })),
      ...excludedCandidates.map((p) => ({
        title: p.title, durationMin: p.durationMin, reason: 'la sacaste vos',
        taskId: p.taskId, color: p.color,
      })),
    ];

    if (cfg.source === 'today') {
      applyReorder(
        day,
        keep.filter((p) => p.blockId).map((p) => ({ blockId: p.blockId!, startMin: p.startMin }))
      );
      const out = [...result.leftover, ...excludedCandidates]
        .map((p) => p.blockId)
        .filter((x): x is string => Boolean(x));
      if (out.length) unscheduleBlocks(out);
    } else {
      applyPlan(
        day,
        keep.filter((p) => p.taskId)
      );
    }

    // La bandeja del panel derecho evita tener que volver a encontrar estas
    // tareas en listas grandes, sin importar de qué modo del organizador vienen.
    if (isTodayView) usePlannerLog.getState().set(todayKey, leftoverAll);
    useToasts.getState().push({
      kind: 'info',
      title: leftoverAll.length
        ? `Organizador: agendó ${keep.length}, ${leftoverAll.length} no entraron`
        : `Organizador: agendó ${keep.length} sin problemas`,
      body: leftoverAll.length ? 'Quedaron listadas en Tareas y en el panel de la derecha.' : undefined,
      ttl: leftoverAll.length ? 0 : 6000,
      onUndo: undo,
    });

    setDropped([]);
    onClose();
  };

  const reordering = cfg.source === 'today';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Organizar día"
      subtitle={
        reordering
          ? 'Reacomoda los bloques del día. Lo completado, lo que ya arrancó y las pausas no se mueven.'
          : 'Agenda tus tareas pendientes en los huecos libres, sin mover nada de lo que ya está.'
      }
      footer={
        <>
          {cfg.order === 'random' && (
            <Btn onClick={() => setSeed(Date.now())}>Mezclar de nuevo</Btn>
          )}
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={apply} disabled={keep.length === 0 && result.leftover.length === 0}>
            {reordering ? 'Reacomodar' : `Agendar ${keep.length || ''}`}
          </Btn>
        </>
      }
    >
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'setup' as const, label: 'Configuración' },
        { id: 'preview' as const, label: `Vista previa (${keep.length})` },
      ]} />
      {tab === 'setup' && <div className="space-y-4 p-5">
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

        <Field label="Empezar">
          <Segmented
            value={cfg.from}
            onChange={(v) => setCfg({ from: v })}
            options={[
              { id: 'now' as const, label: 'Ahora' },
              { id: 'dayStart' as const, label: 'Inicio de jornada' },
              { id: 'custom' as const, label: 'Hora puntual' },
            ]}
          />
          {cfg.from === 'custom' && (
            <div className="mt-2">
              <TimeField value={cfg.customFromMin} onCommit={(value) => setCfg({ customFromMin: value })} />
            </div>
          )}
          {cfg.from === 'dayStart' && (
            <p className="mt-1 text-[11px] leading-snug text-muted">
              Útil para planificar un día que no es hoy: arranca al inicio de tu jornada en vez de "ahora".
            </p>
          )}
        </Field>

        <ReassignTimeField
          cfg={cfg}
          setCfg={setCfg}
          candidateCount={candidates.length}
          placedCount={result.placed.length}
          autoFitMin={autoFitMin}
        />

        <Field label="Orden">
          <Segmented value={cfg.order} onChange={(v) => setCfg({ order: v })} options={ORDERS} />
        </Field>

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

        {/* Las clasificaciones solo tienen sentido cuando salimos a buscar tareas nuevas */}
        {!reordering && (
          <>
            <Field label="Clasificaciones">
              <div className="rounded-lg border border-line">
                <label className="flex items-center gap-2.5 border-b border-line px-3 py-2 text-[13px] font-medium">
                  <input
                    type="checkbox"
                    checked={cfg.listIds === null}
                    ref={(el) => { if (el) el.indeterminate = cfg.listIds !== null && cfg.listIds.length > 0; }}
                    onChange={(e) => setCfg({ listIds: e.target.checked ? null : [] })}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Todas las clasificaciones
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
      </div>}

      {/* Vista previa */}
      {tab === 'preview' && <div className="p-5">
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
            {result.placed.map((p) => (
              <li key={p.key} className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-1.5">
                <span className="tabular w-12 shrink-0 font-mono text-[11px] text-muted">{hhmm(p.startMin)}</span>
                <span className="h-4 w-[3px] shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{p.title}</span>
                <span className="tabular shrink-0 font-mono text-[10.5px] text-muted">
                  {durationLabel(p.durationMin)}
                </span>
                <button
                  onClick={() => setDropped((d) => [...d, p.key])}
                  className="shrink-0 rounded px-1.5 text-[11px] text-muted hover:text-ink"
                >
                  Sacar
                </button>
              </li>
            ))}
          </ul>
        )}

        <Leftovers
          items={result.leftover}
          dropped={excludedCandidates}
          onInclude={(key) => setDropped((d) => d.filter((x) => x !== key))}
          reordering={reordering}
        />
      </div>}
    </Modal>
  );
}

function Leftovers({
  items, dropped, onInclude, reordering,
}: {
  items: (PlanCandidate & { reason: string })[];
  dropped: PlanCandidate[];
  onInclude: (key: string) => void;
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
            <button onClick={() => onInclude(l.key)} className="shrink-0 rounded px-1.5 text-[11px] text-muted hover:text-ink">
              Incluir
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        {dropped.length > 0 && 'Si volvés a incluir alguna, se recalcula el reparto de tiempo con la nueva cantidad. '}
        {reordering
          ? 'Lo que quede afuera se saca de la agenda y vuelve al panel de tareas como pendiente.'
          : 'Siguen pendientes en su clasificación y también quedan visibles en Actividad. Podés correr la hora de fin o dejarlas para mañana.'}
      </p>
    </div>
  );
}


/** La sección de "reasignar tiempo": mueve acá "Terminar antes de" y agrega Manual/Automático. */
function ReassignTimeField({
  cfg, setCfg, candidateCount, placedCount, autoFitMin,
}: {
  cfg: AutoplanConfig;
  setCfg: (patch: Partial<AutoplanConfig>) => void;
  candidateCount: number;
  placedCount: number;
  autoFitMin: number | null;
}) {
  return (
    <Field
      label="Reasignar tiempo"
      hint="Cambia la duración solo para esta tanda; no toca lo guardado en cada tarea."
    >
      <div className="space-y-2.5 rounded-lg border border-line p-3">
        <div className="flex items-center gap-2.5">
          <span className="w-28 shrink-0 text-[12.5px] text-muted">Terminar antes de</span>
          <TimeField value={cfg.untilMin} onCommit={(value) => setCfg({ untilMin: value })} />
        </div>

        <Segmented
          value={cfg.reassign}
          onChange={(v) => setCfg({ reassign: v })}
          options={[
            { id: 'none', label: 'Como estaba' },
            { id: 'manual', label: 'Manual' },
            { id: 'auto', label: 'Automático' },
          ]}
        />

        {cfg.reassign === 'manual' && (
          <div className="flex items-center gap-2">
            <NumField value={cfg.reassignMin} onCommit={(v) => setCfg({ reassignMin: v ?? 30 })} suffix="min cada una" />
          </div>
        )}

        {cfg.reassign === 'manual' && candidateCount > 0 && (
          <p className="text-[11.5px] leading-snug text-muted">
            {placedCount >= candidateCount
              ? `Entran las ${candidateCount} tareas seleccionadas.`
              : `Con ${cfg.reassignMin} min cada una entran ${placedCount} de ${candidateCount}. Achicá la duración o el rango si querés que entren todas.`}
          </p>
        )}

        {cfg.reassign === 'auto' && candidateCount > 0 && (
          <p className="text-[11.5px] leading-snug text-muted">
            {autoFitMin && placedCount >= candidateCount ? (
              <>Le va a tocar <span className="font-semibold text-ink">{autoFitMin} min</span> a cada una de las {candidateCount}, para que entren todas.</>
            ) : (
              <>Ni con 10 min cada una entran las {candidateCount}: van a quedar {candidateCount - placedCount} afuera.</>
            )}
          </p>
        )}

        {cfg.reassign === 'none' && (
          <p className="text-[11.5px] leading-snug text-muted">
            Cada tarea conserva su duración de siempre (o la de por defecto, si no tiene una fija).
          </p>
        )}
      </div>
    </Field>
  );
}
