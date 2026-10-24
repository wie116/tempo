import { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore } from '../store';
import { autoplan, candidatesFromDay, candidatesFromTasks, findGaps } from '../lib/autoplan';
import { undo } from '../lib/history';
import type { PlanCandidate } from '../lib/autoplan';
import type { AutoplanConfig, PlanOrder, PlanSource } from '../types';
import { clockLabel, dateKey, durationLabel, fmt, snap } from '../lib/time';
import { usePlannerLog } from '../lib/plannerLog';
import { useToasts } from '../store';
import { Btn, Field, Modal, NumField, Segmented, Tabs, TimeField } from './Modal';
import { pick } from '../lib/i18n';
import type { AppLanguage } from '../types';

const ordersFor = (language: AppLanguage): { id: PlanOrder; label: string }[] => [
  { id: 'list', label: pick(language, 'Orden de lista', 'List order') },
  { id: 'random', label: pick(language, 'Al azar', 'Random') },
  { id: 'longest', label: pick(language, 'Largas primero', 'Longest first') },
  { id: 'shortest', label: pick(language, 'Cortas primero', 'Shortest first') },
];

export function AutoplanModal({ open, onClose, initialSource }: { open: boolean; onClose: () => void; initialSource?: PlanSource }) {
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
  const language = useStore((s) => s.settings.language);

  const [seed, setSeed] = useState(() => Date.now());
  const [dropped, setDropped] = useState<string[]>([]);

  const cfg = initialSource ? { ...cfgSaved, source: initialSource } : cfgSaved;
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
        title: p.title, durationMin: p.durationMin, reason: pick(language, 'la sacaste vos', 'removed manually'),
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
        ? pick(language, `Organizador: agendó ${keep.length}, ${leftoverAll.length} no entraron`, `Arrange: scheduled ${keep.length}; ${leftoverAll.length} did not fit`)
        : pick(language, `Organizador: agendó ${keep.length} sin problemas`, `Arrange: scheduled ${keep.length} successfully`),
      body: leftoverAll.length ? pick(language, 'Quedaron listadas en Tareas y en el panel de la derecha.', 'They remain listed in Tasks and in the right panel.') : undefined,
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
      title={pick(language, 'Organizar día', 'Arrange day')}
      subtitle={
        reordering
          ? pick(language, 'Reacomoda los bloques del día. Lo completado, lo que ya arrancó y las pausas no se mueven.', 'Rearrange the day’s blocks. Completed, started, and break blocks stay in place.')
          : pick(language, 'Agenda tus tareas pendientes en los huecos libres, sin mover nada de lo que ya está.', 'Schedule pending tasks in free gaps without moving existing blocks.')
      }
      footer={
        <>
          {cfg.order === 'random' && (
            <Btn onClick={() => setSeed(Date.now())}>{pick(language, 'Mezclar de nuevo', 'Shuffle again')}</Btn>
          )}
          <Btn onClick={onClose}>{pick(language, 'Cancelar', 'Cancel')}</Btn>
          <Btn variant="primary" onClick={apply} disabled={keep.length === 0 && result.leftover.length === 0}>
            {reordering ? pick(language, 'Reacomodar', 'Rearrange') : `${pick(language, 'Agendar', 'Schedule')} ${keep.length || ''}`}
          </Btn>
        </>
      }
    >
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'setup' as const, label: pick(language, 'Configuración', 'Setup') },
        { id: 'preview' as const, label: `${pick(language, 'Vista previa', 'Preview')} (${keep.length})` },
      ]} />
      {tab === 'setup' && <div className="space-y-4 p-5">
        <Field label={pick(language, 'Qué acomodar', 'What to arrange')}>
          <Segmented
            value={cfg.source}
            onChange={(v) => { setCfg({ source: v as PlanSource }); setDropped([]); }}
            options={[
              { id: 'today', label: pick(language, 'Bloques del día', 'Day blocks') },
              { id: 'pending', label: pick(language, 'Tareas pendientes', 'Pending tasks') },
            ]}
          />
        </Field>

        <Field label={pick(language, 'Día', 'Day')} hint={pick(language, 'También cambia el día que estás viendo en la agenda', 'Also changes the day shown in the schedule')}>
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
              {pick(language, 'Hoy', 'Today')}
            </button>
            <span className="text-[12px] capitalize text-muted">{fmt(day, language === 'en' ? 'EEEE, LLLL d' : "EEEE d 'de' LLLL")}</span>
          </div>
        </Field>

        <Field label={pick(language, 'Empezar', 'Start')}>
          <Segmented
            value={cfg.from}
            onChange={(v) => setCfg({ from: v })}
            options={[
              { id: 'now' as const, label: pick(language, 'Ahora', 'Now') },
              { id: 'dayStart' as const, label: pick(language, 'Inicio de jornada', 'Start of day') },
              { id: 'custom' as const, label: pick(language, 'Hora puntual', 'Specific time') },
            ]}
          />
          {cfg.from === 'custom' && (
            <div className="mt-2">
              <TimeField value={cfg.customFromMin} onCommit={(value) => setCfg({ customFromMin: value })} />
            </div>
          )}
          {cfg.from === 'dayStart' && (
            <p className="mt-1 text-[11px] leading-snug text-muted">
              {pick(language, 'Útil para planificar un día que no es hoy: arranca al inicio de tu jornada en vez de "ahora".', 'Useful when planning another day: starts at the beginning of your working day instead of “now”.')}
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

        <Field label={pick(language, 'Orden', 'Order')}>
          <Segmented value={cfg.order} onChange={(v) => setCfg({ order: v })} options={ordersFor(language)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {!reordering && (
            <Field label={pick(language, 'Sin duración propia', 'No set duration')} hint={pick(language, 'Cuánto dura una tarea que dejaste libre', 'Duration for a task left flexible')}>
              <NumField value={cfg.defaultMin} onCommit={(v) => setCfg({ defaultMin: v ?? 30 })} suffix="min" />
            </Field>
          )}
          <Field label={pick(language, 'Aire entre bloques', 'Space between blocks')} hint={pick(language, 'Múltiplos de 10 para que todo caiga en la grilla', 'Multiples of 10 so everything aligns to the grid')}>
            <Segmented
              value={String(cfg.gapMin)}
              onChange={(v) => setCfg({ gapMin: Number(v) })}
              options={[
                { id: '0', label: pick(language, 'Pegados', 'None') },
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
            <Field label={pick(language, 'Clasificaciones', 'Classifications')}>
              <div className="rounded-lg border border-line">
                <label className="flex items-center gap-2.5 border-b border-line px-3 py-2 text-[13px] font-medium">
                  <input
                    type="checkbox"
                    checked={cfg.listIds === null}
                    ref={(el) => { if (el) el.indeterminate = cfg.listIds !== null && cfg.listIds.length > 0; }}
                    onChange={(e) => setCfg({ listIds: e.target.checked ? null : [] })}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {pick(language, 'Todas las clasificaciones', 'All classifications')}
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
              {pick(language, 'Incluir tareas recurrentes', 'Include recurring tasks')} ↻
            </label>
          </>
        )}
      </div>}

      {/* Vista previa */}
      {tab === 'preview' && <div className="p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">{pick(language, 'Va a quedar así', 'The result')}</h3>
          <span className="tabular font-mono text-[10.5px] text-muted">
            {durationLabel(result.freeMin)} {pick(language, 'libres desde', 'free from')} {clockLabel(fromMin)}
          </span>
        </div>

        {result.placed.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] leading-snug text-muted">
            {reordering
              ? pick(language, 'No hay bloques por delante para reacomodar en este día.', 'There are no upcoming blocks to rearrange on this day.')
              : pick(language, 'No hay tareas pendientes que entren con esta configuración.', 'No pending tasks fit with this setup.')}
          </p>
        ) : (
          <ul className="space-y-1">
            {result.placed.map((p) => (
              <li key={p.key} className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-1.5">
                <span className="tabular w-16 shrink-0 font-mono text-[11px] text-muted">{clockLabel(p.startMin)}</span>
                <span className="h-4 w-[3px] shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{p.title}</span>
                <span className="tabular shrink-0 font-mono text-[10.5px] text-muted">
                  {durationLabel(p.durationMin)}
                </span>
                <button
                  onClick={() => setDropped((d) => [...d, p.key])}
                  className="shrink-0 rounded px-1.5 text-[11px] text-muted hover:text-ink"
                >
                  {pick(language, 'Sacar', 'Remove')}
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
  const language = useStore((s) => s.settings.language);
  const total = items.length + dropped.length;
  if (total === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-dashed border-line p-3">
      <p className="mb-1.5 text-[11.5px] font-semibold" style={{ color: 'var(--now)' }}>
        {total} {total === 1 ? pick(language, 'queda afuera', 'left out') : pick(language, 'quedan afuera', 'left out')}
      </p>
      <ul className="space-y-0.5">
        {items.map((l) => (
          <li key={l.key} className="flex items-baseline gap-2 text-[11.5px]">
            <span className="min-w-0 flex-1 truncate">{l.title}</span>
            <span className="tabular shrink-0 font-mono text-[10px] text-muted">
              {durationLabel(l.durationMin)} · {language === 'en' ? l.reason.replace('No queda espacio libre', 'No free space remains').replace(/El hueco más grande es de (\d+) min/, 'The largest gap is $1 min') : l.reason}
            </span>
          </li>
        ))}
        {dropped.map((l) => (
          <li key={l.key} className="flex items-baseline gap-2 text-[11.5px]">
            <span className="min-w-0 flex-1 truncate">{l.title}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted">{pick(language, 'la sacaste vos', 'removed manually')}</span>
            <button onClick={() => onInclude(l.key)} className="shrink-0 rounded px-1.5 text-[11px] text-muted hover:text-ink">
              {pick(language, 'Incluir', 'Include')}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        {dropped.length > 0 && pick(language, 'Si volvés a incluir alguna, se recalcula el reparto de tiempo con la nueva cantidad. ', 'If you include one again, time is recalculated for the new count. ')}
        {reordering
          ? pick(language, 'Lo que quede afuera se saca de la agenda y vuelve al panel de tareas como pendiente.', 'Anything left out is removed from the schedule and returned to the task panel as pending.')
          : pick(language, 'Siguen pendientes en su clasificación y también quedan visibles en Actividad. Podés correr la hora de fin o dejarlas para mañana.', 'They remain pending in their classification and visible in Activity. Extend the end time or leave them for tomorrow.')}
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
  const language = useStore((s) => s.settings.language);
  return (
    <Field
      label={pick(language, 'Reasignar tiempo', 'Reassign time')}
      hint={pick(language, 'Cambia la duración solo para esta tanda; no toca lo guardado en cada tarea.', 'Changes duration only for this run; saved task durations are untouched.')}
    >
      <div className="space-y-2.5 rounded-lg border border-line p-3">
        <div className="flex items-center gap-2.5">
          <span className="w-28 shrink-0 text-[12.5px] text-muted">{pick(language, 'Terminar antes de', 'Finish before')}</span>
          <TimeField value={cfg.untilMin} onCommit={(value) => setCfg({ untilMin: value })} />
        </div>

        <Segmented
          value={cfg.reassign}
          onChange={(v) => setCfg({ reassign: v })}
          options={[
            { id: 'none', label: pick(language, 'Como estaba', 'Keep current') },
            { id: 'manual', label: 'Manual' },
            { id: 'auto', label: pick(language, 'Automático', 'Automatic') },
          ]}
        />

        {cfg.reassign === 'manual' && (
          <div className="flex items-center gap-2">
            <NumField value={cfg.reassignMin} onCommit={(v) => setCfg({ reassignMin: v ?? 30 })} suffix={pick(language, 'min cada una', 'min each')} />
          </div>
        )}

        {cfg.reassign === 'manual' && candidateCount > 0 && (
          <p className="text-[11.5px] leading-snug text-muted">
            {placedCount >= candidateCount
              ? pick(language, `Entran las ${candidateCount} tareas seleccionadas.`, `All ${candidateCount} selected tasks fit.`)
              : pick(language, `Con ${cfg.reassignMin} min cada una entran ${placedCount} de ${candidateCount}. Achicá la duración o el rango si querés que entren todas.`, `At ${cfg.reassignMin} min each, ${placedCount} of ${candidateCount} fit. Shorten the duration or expand the range to fit all.`)}
          </p>
        )}

        {cfg.reassign === 'auto' && candidateCount > 0 && (
          <p className="text-[11.5px] leading-snug text-muted">
            {autoFitMin && placedCount >= candidateCount ? (
              <>{pick(language, 'Le va a tocar', 'Each gets')} <span className="font-semibold text-ink">{autoFitMin} min</span> {pick(language, `a cada una de las ${candidateCount}, para que entren todas.`, `across all ${candidateCount} so they fit.`)}</>
            ) : (
              <>{pick(language, `Ni con 10 min cada una entran las ${candidateCount}: van a quedar ${candidateCount - placedCount} afuera.`, `Even at 10 min each, all ${candidateCount} do not fit: ${candidateCount - placedCount} will be left out.`)}</>
            )}
          </p>
        )}

        {cfg.reassign === 'none' && (
          <p className="text-[11.5px] leading-snug text-muted">
            {pick(language, 'Cada tarea conserva su duración de siempre (o la de por defecto, si no tiene una fija).', 'Each task keeps its usual duration, or the default if it has no fixed duration.')}
          </p>
        )}
      </div>
    </Field>
  );
}
