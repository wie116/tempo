import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { isSameDay } from 'date-fns';
import { useClock, useDrag, useStore, useUI } from '../store';
import {
  SLOT_MIN, clamp, dateKey, durationLabel, fmt, hhmm, hourLabel, isoFor,
  labelEvery, minToPx, minorInterval, minutesOf, pxToMin, snap,
} from '../lib/time';
import { DayColumn } from './DayColumn';

export function Calendar({ days, onOpenBlock }: { days: Date[]; onOpenBlock: (id: string) => void }) {
  const settings = useStore((s) => s.settings);
  const updateBlock = useStore((s) => s.updateBlock);
  const blockFromTask = useStore((s) => s.blockFromTask);
  const addBreak = useStore((s) => s.addBreak);
  const moveChain = useStore((s) => s.moveChain);
  const resizeTop = useStore((s) => s.resizeTop);

  const tool = useUI((s) => s.tool);
  const range = useUI((s) => s.range);
  const setRange = useUI((s) => s.setRange);
  const clearSelection = useUI((s) => s.clearSelection);

  const drag = useDrag((s) => s.drag);
  const update = useDrag((s) => s.update);
  const end = useDrag((s) => s.end);
  const now = useClock((s) => s.now);

  const colsRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayStartMin = settings.dayStartHour * 60;
  const dayEndMin = settings.dayEndHour * 60;
  const totalMin = dayEndMin - dayStartMin;
  const bodyHeight = minToPx(totalMin, settings.slotPx);
  const hours = Array.from({ length: settings.dayEndHour - settings.dayStartHour }, (_, i) => settings.dayStartHour + i);
  const minor = minorInterval(settings.slotPx);
  const every = labelEvery(settings.slotPx);

  const nowDate = new Date(now);
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = minToPx(clamp(nowMin - dayStartMin - 90, 0, totalMin), settings.slotPx);
    // solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pointToGrid = (clientX: number, clientY: number) => {
    const el = colsRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const colW = r.width / days.length;
    const dayIndex = clamp(Math.floor((clientX - r.left) / colW), 0, days.length - 1);
    const min = dayStartMin + pxToMin(clientY - r.top, settings.slotPx);
    return { dayIndex, min: clamp(min, dayStartMin, dayEndMin) };
  };

  /* ---------- Arrastre global ---------- */
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const p = pointToGrid(e.clientX, e.clientY);
      if (!p) return;

      if (drag.mode === 'resizeTop') {
        // anchorMin guarda el final del bloque: crece hacia arriba sin moverlo.
        const start = clamp(snap(p.min), dayStartMin, drag.anchorMin - SLOT_MIN);
        update({ startMin: start, durationMin: drag.anchorMin - start, moved: true });
      } else if (drag.mode === 'resize') {
        update({ durationMin: clamp(snap(p.min - drag.startMin), SLOT_MIN, dayEndMin - drag.startMin), moved: true });
      } else if (drag.mode === 'new') {
        // Solo cuenta como arrastre si el puntero llegó de verdad a la grilla.
        const el = colsRef.current;
        const r = el?.getBoundingClientRect();
        const inside =
          !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        update({
          dayIndex: p.dayIndex,
          startMin: clamp(snap(p.min - drag.grabOffsetMin), dayStartMin, dayEndMin - drag.durationMin),
          moved: drag.moved || inside,
        });
      } else if (drag.mode === 'range') {
        // Crece hacia arriba o hacia abajo desde el punto donde apretaste
        const a = drag.anchorMin;
        const b = snap(p.min);
        update({
          startMin: Math.min(a, b),
          durationMin: Math.max(SLOT_MIN, Math.abs(b - a)),
          dayIndex: drag.anchorDayIndex,
          moved: true,
        });
      } else if (drag.mode === 'box') {
        update({
          startMin: Math.min(drag.anchorMin, snap(p.min)),
          durationMin: Math.max(SLOT_MIN, Math.abs(snap(p.min) - drag.anchorMin)),
          dayIndex: p.dayIndex,
          moved: true,
        });
      } else {
        update({
          dayIndex: p.dayIndex,
          startMin: clamp(snap(p.min - drag.grabOffsetMin), dayStartMin, dayEndMin - drag.durationMin),
          moved: true,
        });
      }
    };

    const onUp = () => {
      const d = useDrag.getState().drag;
      if (d) {
        const day = days[clamp(d.dayIndex, 0, days.length - 1)];

        if (d.mode === 'resizeTop' && d.blockId) {
          if (d.moved) resizeTop(day, d.blockId, d.startMin);
        } else if ((d.mode === 'move' || d.mode === 'resize') && d.blockId) {
          if (d.moved) {
            const chained =
              d.mode === 'move' &&
              settings.chainMove &&
              d.dayIndex === d.anchorDayIndex &&
              d.durationMin === (useStore.getState().blocks[d.blockId]?.durationMin ?? -1);
            if (chained) moveChain(day, d.blockId, d.startMin);
            else updateBlock(d.blockId, { startsAt: isoFor(day, d.startMin), durationMin: d.durationMin });
          }
        } else if (d.mode === 'new') {
          // Sin arrastre no se agenda nada: un clic en el panel solo selecciona.
          if (!d.moved) { /* nada */ }
          else if (d.kind === 'break') addBreak(day, d.startMin, d.durationMin);
          else if (d.taskId) blockFromTask(d.taskId, day, d.startMin, d.durationMin);
        } else if (d.mode === 'range') {
          // Marcamos la franja y vos elegís qué poner: bloque o pausa
          setRange({ dayKey: dateKey(day), dayIndex: d.dayIndex, startMin: d.startMin, durationMin: d.durationMin });
        } else if (d.mode === 'box') {
          const from = d.startMin;
          const to = d.startMin + d.durationMin;
          const lo = Math.min(d.anchorDayIndex, d.dayIndex);
          const hi = Math.max(d.anchorDayIndex, d.dayIndex);
          const keys = new Set(
            days.slice(lo, hi + 1).map((x) => dateKey(x))
          );
          const hits = Object.values(useStore.getState().blocks)
            .filter((b) => keys.has(b.startsAt.slice(0, 10)))
            .filter((b) => minutesOf(b.startsAt) < to && minutesOf(b.startsAt) + b.durationMin > from)
            .map((b) => b.id);
          // Herramienta de un solo uso: seleccionás y volvés al puntero normal.
          useUI.setState({ tool: 'select', multi: hits, range: null });
        }
      }
      end();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag?.mode, drag?.blockId, drag?.taskId, drag?.kind, days, settings.slotPx]);

  /* ---------- Apretar en zona vacía ---------- */
  const onEmptyPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = pointToGrid(e.clientX, e.clientY);
    if (!p) return;
    clearSelection();
    const start = clamp(snap(p.min), dayStartMin, dayEndMin - SLOT_MIN);

    if (tool === 'box') {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      useDrag.getState().begin({
        mode: 'box', title: '', color: 'var(--accent)', kind: 'adhoc',
        grabOffsetMin: 0, durationMin: SLOT_MIN,
        dayIndex: p.dayIndex, startMin: start, anchorMin: start, anchorDayIndex: p.dayIndex, moved: false,
      });
      return;
    }

    if (e.pointerType === 'touch') {
      // En táctil el arrastre pelearía con el scroll: marcamos la franja por defecto
      setRange({
        dayKey: dateKey(days[p.dayIndex]), dayIndex: p.dayIndex,
        startMin: clamp(start, dayStartMin, dayEndMin - settings.defaultBlockMin),
        durationMin: settings.defaultBlockMin,
      });
      return;
    }

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    useDrag.getState().begin({
      mode: 'range',
      title: 'Bloque',
      color: 'var(--accent)',
      kind: 'adhoc',
      grabOffsetMin: 0,
      durationMin: settings.defaultBlockMin,
      dayIndex: p.dayIndex, startMin: start,
      anchorMin: start, anchorDayIndex: p.dayIndex, moved: false,
    });
  };

  const ghost = drag && (drag.mode === 'new' || drag.mode === 'range') ? drag : null;
  const colW = 100 / days.length;

  /* Franja marcada, ya soltada */
  const rangeDayIndex = useMemo(
    () => (range ? days.findIndex((d) => dateKey(d) === range.dayKey) : -1),
    [range, days]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 border-b border-line">
        <div className="w-11 shrink-0 sm:w-14" />
        <div className="flex flex-1">
          {days.map((d) => {
            const today = isSameDay(d, nowDate);
            return (
              <div key={d.toISOString()} className="flex-1 px-1 py-2 text-center">
                <p className="text-[9.5px] uppercase tracking-[0.16em] text-muted">{fmt(d, 'EEE')}</p>
                <p
                  className="tabular mx-auto mt-0.5 grid h-6 w-6 place-items-center rounded-full font-mono text-[12.5px]"
                  style={{
                    background: today ? 'var(--accent)' : undefined,
                    color: today ? 'var(--accent-fg)' : undefined,
                    fontWeight: today ? 700 : 400,
                  }}
                >
                  {fmt(d, 'd')}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: bodyHeight }}>
          <div className="relative w-11 shrink-0 sm:w-14">
            {hours.filter((h) => h % every === 0).map((h) => (
              <div
                key={h}
                className="tabular absolute right-2 -translate-y-1/2 font-mono text-[10.5px] text-muted"
                style={{ top: minToPx(h * 60 - dayStartMin, settings.slotPx) }}
              >
                {hourLabel(h)}
              </div>
            ))}
          </div>

          <div
            ref={colsRef}
            className="relative flex flex-1"
            onPointerDown={onEmptyPointerDown}
            style={{ touchAction: 'pan-y', cursor: tool === 'box' ? 'crosshair' : undefined }}
          >
            <div className="pointer-events-none absolute inset-0">
              {hours.map((h) => (
                <div key={h}>
                  <div className="absolute inset-x-0 border-t border-[var(--grid-line-strong)]"
                    style={{ top: minToPx(h * 60 - dayStartMin, settings.slotPx) }} />
                  {minor > 0 &&
                    Array.from({ length: Math.floor(60 / minor) - 1 }, (_, i) => (i + 1) * minor).map((m) => (
                      <div key={m} className="absolute inset-x-0 border-t border-[var(--grid-line)]"
                        style={{ top: minToPx(h * 60 + m - dayStartMin, settings.slotPx) }} />
                    ))}
                </div>
              ))}
            </div>

            {days.map((d, i) => (
              <DayColumn key={d.toISOString()} day={d} dayIndex={i} onOpenBlock={onOpenBlock} />
            ))}

            {/* Franja marcada con sus acciones */}
            {range && rangeDayIndex >= 0 && (
              <RangeOverlay
                left={rangeDayIndex * colW}
                width={colW}
                top={minToPx(range.startMin - dayStartMin, settings.slotPx)}
                height={Math.max(minToPx(range.durationMin, settings.slotPx), 22)}
                day={days[rangeDayIndex]}
                startMin={range.startMin}
                durationMin={range.durationMin}
              />
            )}

            {/* La caja puede abarcar varios días: se dibuja aparte */}
            {drag?.mode === 'box' && (() => {
              const lo = Math.min(drag.anchorDayIndex, drag.dayIndex);
              const hi = Math.max(drag.anchorDayIndex, drag.dayIndex);
              return (
                <div
                  className="pointer-events-none absolute z-40 rounded-lg border-2 border-dashed"
                  style={{
                    borderColor: 'var(--accent)',
                    background: 'color-mix(in oklab, var(--accent) 10%, transparent)',
                    top: minToPx(drag.startMin - dayStartMin, settings.slotPx),
                    height: Math.max(minToPx(drag.durationMin, settings.slotPx), 18),
                    left: `calc(${lo * colW}% + 2px)`,
                    width: `calc(${(hi - lo + 1) * colW}% - 4px)`,
                  }}
                />
              );
            })()}

            {/* Fantasma del gesto en curso */}
            {ghost && (
              <div
                className="pointer-events-none absolute z-40 overflow-hidden rounded-lg border-2 border-dashed px-2 py-0.5"
                style={{
                  borderColor: ghost.kind === 'break' ? 'var(--muted)' : ghost.color,
                  background: `color-mix(in oklab, ${ghost.kind === 'break' ? 'var(--muted)' : ghost.color} 12%, var(--surface))`,
                  top: minToPx(ghost.startMin - dayStartMin, settings.slotPx),
                  height: Math.max(minToPx(ghost.durationMin, settings.slotPx), 18),
                  left: `calc(${ghost.dayIndex * colW}% + 2px)`,
                  width: `calc(${colW}% - 4px)`,
                }}
              >
                <p className="tabular truncate font-mono text-[10px] text-muted">
                  {hhmm(ghost.startMin)}–{hhmm(ghost.startMin + ghost.durationMin)} · {durationLabel(ghost.durationMin)}
                </p>
              </div>
            )}

            {days.some((d) => isSameDay(d, nowDate)) && nowMin >= dayStartMin && nowMin <= dayEndMin && (
              <div
                className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                style={{ top: minToPx(nowMin - dayStartMin, settings.slotPx) }}
              >
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: 'var(--now)' }} />
                <span className="h-px flex-1" style={{ background: 'var(--now)' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <MultiBar />
    </div>
  );
}

/* ---------- Acciones sobre la franja marcada ---------- */

function RangeOverlay({
  left, width, top, height, day, startMin, durationMin,
}: {
  left: number; width: number; top: number; height: number;
  day: Date; startMin: number; durationMin: number;
}) {
  const addAdhocBlock = useStore((s) => s.addAdhocBlock);
  const addBreak = useStore((s) => s.addBreak);
  const setRange = useUI((s) => s.setRange);
  const below = top < 90;

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{ top, height, left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)` }}
    >
      <div
        className="h-full rounded-lg border-2 border-dashed"
        style={{ borderColor: 'var(--accent)', background: 'color-mix(in oklab, var(--accent) 9%, transparent)' }}
      />
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute left-0 z-50 flex items-center gap-1.5 rounded-xl border border-line bg-surface p-1.5"
        style={{ boxShadow: 'var(--shadow-modal)', [below ? 'top' : 'bottom']: height + 8 }}
      >
        <span className="tabular px-1 font-mono text-[11.5px] text-muted">{durationLabel(durationMin)}</span>
        <button
          onClick={() => { addAdhocBlock(day, startMin, durationMin); setRange(null); }}
          className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          Bloque
        </button>
        <button
          onClick={() => { addBreak(day, startMin, durationMin); setRange(null); }}
          className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-medium text-muted hover:text-ink"
        >
          Pausa
        </button>
        <button
          onClick={() => setRange(null)}
          aria-label="Descartar selección"
          className="rounded-lg px-2 py-1.5 text-[13px] text-muted hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/* ---------- Acciones sobre varios bloques ---------- */

function MultiBar() {
  const multi = useUI((s) => s.multi);
  const clearSelection = useUI((s) => s.clearSelection);
  const removeBlocks = useStore((s) => s.removeBlocks);
  const shiftBlocks = useStore((s) => s.shiftBlocks);
  const setDone = useStore((s) => s.setDone);
  const setPinned = useStore((s) => s.setPinned);
  const blocks = useStore((s) => s.blocks);
  if (!multi.length) return null;

  const allPinned = multi.every((id) => blocks[id]?.pinned);

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2 border-t-2 px-3 py-2.5"
      style={{ borderTopColor: 'var(--accent)', background: 'color-mix(in oklab, var(--accent) 7%, var(--surface))' }}
    >
      <span className="tabular font-mono text-[13px] font-semibold">{multi.length} bloques</span>
      <span className="mx-0.5 h-5 w-px bg-[var(--border)]" />
      {[-30, -10, 10, 30].map((d) => (
        <button
          key={d}
          onClick={() => shiftBlocks(multi, d)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[13px] text-muted transition-colors hover:border-[var(--accent)] hover:text-ink"
        >
          {d > 0 ? `+${d}` : d}m
        </button>
      ))}
      <button
        onClick={() => setPinned(multi, !allPinned)}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink"
      >
        {allPinned ? 'Soltar' : 'Fijar'}
      </button>
      <button
        onClick={() => multi.forEach((id) => setDone(id, true))}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-ink"
      >
        Completar
      </button>
      <button
        onClick={() => { removeBlocks(multi); clearSelection(); }}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-[var(--now)] hover:text-[var(--now)]"
      >
        Eliminar
      </button>
      <button
        onClick={clearSelection}
        className="ml-auto rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted hover:text-ink"
      >
        Listo
      </button>
    </div>
  );
}
