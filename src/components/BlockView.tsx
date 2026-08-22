import { memo, useState } from 'react';
import type { Block } from '../types';
import { useClock, useDrag, useStore, useUI } from '../store';
import { clamp, durationLabel, hhmm, minToPx, minutesOf, pxToMin } from '../lib/time';
import { startPointerGesture } from '../lib/gesture';
import { isReadOnlyBlock } from '../lib/planning';
import { ConfirmModal } from './Modal';

interface Props {
  block: Block;
  dayIndex: number;
  dayStartMin: number;
  isToday: boolean;
  lane: number;
  laneCount: number;
  onOpen: (id: string) => void;
}

function BlockViewInner({ block, dayIndex, dayStartMin, isToday, lane, laneCount, onOpen }: Props) {
  const slotPx = useStore((s) => s.settings.slotPx);
  const setPinned = useStore((s) => s.setPinned);
  const removeBlock = useStore((s) => s.removeBlock);
  const setStatus = useStore((s) => s.setStatus);
  const tool = useUI((s) => s.tool);
  const selected = useUI((s) => s.multi.includes(block.id));
  const focused = useUI((s) => s.focusedBlockId === block.id);
  const focusBlock = useUI((s) => s.focusBlock);
  const setMulti = useUI((s) => s.setMulti);
  const begin = useDrag((s) => s.begin);
  const activeDrag = useDrag((s) => s.drag);
  const anchorBlock = useStore((s) => activeDrag?.blockId ? s.blocks[activeDrag.blockId] ?? null : null);
  const preview = activeDrag?.blockId === block.id || (
    activeDrag?.mode === 'move' && activeDrag.groupIds?.includes(block.id) && activeDrag.dayIndex === activeDrag.anchorDayIndex
  ) ? activeDrag : null;
  const now = useClock((s) => s.now);
  const [askDelete, setAskDelete] = useState(false);

  const isAnchorPreview = preview?.blockId === block.id;
  const anchorOriginalMin = anchorBlock ? minutesOf(anchorBlock.startsAt) : 0;
  const groupDelta = preview && !isAnchorPreview ? preview.startMin - anchorOriginalMin : 0;
  const groupVisualDelta = preview && !isAnchorPreview ? (preview.visualStartMin ?? preview.startMin) - anchorOriginalMin : 0;
  const startMin = preview ? (isAnchorPreview ? preview.startMin : minutesOf(block.startsAt) + groupDelta) : minutesOf(block.startsAt);
  const durationMin = preview && isAnchorPreview ? preview.durationMin : block.durationMin;
  const visualStartMin = preview ? (isAnchorPreview ? preview.visualStartMin ?? startMin : minutesOf(block.startsAt) + groupVisualDelta) : startMin;
  const visualDurationMin = preview && isAnchorPreview ? preview.visualDurationMin ?? durationMin : durationMin;
  const top = minToPx(visualStartMin - dayStartMin, slotPx);
  const height = minToPx(visualDurationMin, slotPx);

  const d = new Date(now);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const live = isToday && nowMin >= startMin && nowMin < startMin + durationMin;
  const overdue = isToday && block.status === 'planned' && nowMin >= startMin + durationMin;
  const progress = live ? (nowMin - startMin) / durationMin : 0;

  const isBreak = block.kind === 'break';
  const done = block.status === 'done';
  const skipped = block.status === 'skipped';
  const readOnly = isReadOnlyBlock(block);
  const tiny = height < 32;
  const compact = height < 50;

  const grab = (e: React.PointerEvent, mode: 'move' | 'resize' | 'resizeTop') => {
    if (tool === 'box') return; // en modo caja el gesto es para seleccionar
    if (block.pinned || readOnly) { e.stopPropagation(); focusBlock(block.id); return; }
    e.stopPropagation();
    const modifier = e.ctrlKey || e.metaKey;
    // React limpia currentTarget al terminar este handler. El gesto recién se
    // convierte en drag unos píxeles después, así que capturamos la geometría
    // ahora y no dependemos del SyntheticEvent diferido.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pointerDownY = e.clientY;
    const grabOffsetMin = mode === 'move'
      ? clamp(pxToMin(pointerDownY - rect.top, slotPx), 0, Math.max(0, durationMin - 1))
      : 0;
    startPointerGesture(e, {
      onDrag: (pointer) => {
        // La selección puede haber cambiado apenas antes de empezar a mover.
        // Leemos el store en este instante en vez de usar el valor del render
        // anterior; así Ctrl+clic seguido de arrastre nunca pierde integrantes.
        const liveSelection = useUI.getState().multi;
        const groupIds = mode === 'move' && liveSelection.includes(block.id) ? liveSelection : [block.id];
        if (mode === 'move') setMulti(groupIds);
        focusBlock(block.id);
        begin({
          mode, blockId: block.id, title: block.title, color: block.color, kind: block.kind,
          grabOffsetMin, durationMin, dayIndex, startMin,
          visualStartMin: startMin, visualDurationMin: durationMin,
          pointerClientX: pointer.clientX, pointerClientY: pointer.clientY, overGrid: true,
          // Para estirar hacia arriba el ancla es el final: eso queda quieto.
          anchorMin: mode === 'resizeTop' ? startMin + durationMin : startMin,
          anchorDayIndex: dayIndex, moved: false,
          groupIds,
          copy: mode === 'move' && modifier,
        });
      },
      onTap: () => {
        if (mode !== 'move') { focusBlock(block.id); return; }
        if (modifier) {
          const liveSelection = useUI.getState().multi;
          setMulti(liveSelection.includes(block.id) ? liveSelection.filter((id) => id !== block.id) : [...liveSelection, block.id]);
        } else {
          // El primer clic también debe ser una selección real. Antes quedaba
          // sólo como "focused": se veía con aro, pero Ctrl+clic sobre otro
          // bloque construía un grupo de un único elemento.
          setMulti([block.id]);
          focusBlock(block.id);
        }
      },
    });
  };


  return (
    <>
    <div
      role="button"
      data-block-id={block.id}
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${block.title}, ${hhmm(startMin)}, ${durationLabel(durationMin)}`}
      onPointerDown={(e) => grab(e, 'move')}
      onDoubleClick={(e) => { e.stopPropagation(); onOpen(block.id); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onOpen(block.id); }
        if (e.key === ' ' && !readOnly) { e.preventDefault(); setStatus(block.id, done ? 'planned' : 'done'); }
      }}
      className={[
        'group absolute select-none overflow-hidden rounded-lg border text-left transition-shadow',
        preview ? 'z-40 scale-[1.01] cursor-grabbing shadow-lg' : 'z-10',
        selected || focused ? 'ring-2 ring-offset-1' : '',
        isBreak ? 'break-fill border-dashed' : '',
        skipped ? 'skipped-fill border-dashed opacity-60' : '',
        done ? 'opacity-45' : '',
      ].join(' ')}
      style={{
        top, height,
        left: `calc(${(lane / laneCount) * 100}% + 2px)`,
        width: `calc(${100 / laneCount}% - 4px)`,
        touchAction: 'pan-y',
        borderStyle: block.pinned ? 'dashed' : undefined,
        borderWidth: block.pinned ? 1.5 : undefined,
        cursor: block.pinned || readOnly ? 'default' : tool === 'box' ? 'crosshair' : 'grab',
        borderColor: block.pinned || readOnly
          ? 'var(--pin)'
          : skipped
          ? 'var(--muted)'
          : overdue
          ? 'var(--now)'
          : isBreak
            ? 'var(--border)'
            : `color-mix(in oklab, ${block.color} 45%, var(--border))`,
        background: isBreak ? undefined : `color-mix(in oklab, ${block.color} 13%, var(--surface))`,
        ['--tw-ring-color' as string]: 'var(--accent)',
        ['--tw-ring-offset-color' as string]: 'var(--bg)',
      }}
    >
      {/* Relleno que avanza con el reloj real: el bloque es su propio timer */}
      {live && !done && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0"
          style={{
            width: `${Math.min(100, progress * 100)}%`,
            background: `color-mix(in oklab, ${isBreak ? 'var(--muted)' : block.color} 16%, transparent)`,
          }}
        />
      )}
      {!isBreak && <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: block.color }} />}
      {live && <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: 'var(--now)' }} />}

      <div className={`relative h-full pl-2.5 ${tiny ? 'flex items-center gap-1.5 pr-1.5' : 'pr-2 py-1'}`}>
        <p
          className={[
            'min-w-0 flex-1 truncate pr-1 font-medium leading-tight',
            tiny ? 'text-[11.5px]' : 'text-[14px]',
            done ? 'line-through' : '',
          ].join(' ')}
        >
          {block.icon && <span className="mr-1" aria-hidden>{block.icon}</span>}{block.title}
        </p>
        {!tiny && block.notes.trim() && (
          <p className="mt-0.5 truncate pr-8 text-[10.5px] leading-tight text-muted" title={block.notes}>
            {block.notes}
          </p>
        )}
        {tiny && (
          <span className="tabular shrink-0 pr-5 font-mono text-[10px] text-muted">{hhmm(startMin)}</span>
        )}
        {!compact && (
          <p className="tabular mt-0.5 pr-8 font-mono text-[11px] text-muted">
            {hhmm(startMin)}–{hhmm(startMin + durationMin)}
            {overdue && <span style={{ color: 'var(--now)' }}> · sin cerrar</span>}
          </p>
        )}
      </div>

      {/* Estado: siempre visible, no le resta ancho al título porque flota. */}
      {!readOnly && <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setStatus(block.id, done ? 'skipped' : skipped ? 'planned' : 'done');
        }}
        aria-label={done ? 'Marcar como omitido' : skipped ? 'Marcar como pendiente' : 'Marcar como hecho'}
        title={done ? 'Hecho — clic para omitir' : skipped ? 'Omitido — clic para volver a pendiente' : 'Marcar como hecho'}
        className="absolute right-1 top-1 z-[55] grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors"
        style={{
          borderColor: done
            ? block.color
            : skipped
            ? 'var(--muted)'
            : overdue
            ? 'var(--now)'
            : 'color-mix(in oklab, var(--muted) 45%, transparent)',
          background: done
            ? block.color
            : 'color-mix(in oklab, var(--surface) 75%, transparent)',
        }}
      >
        {skipped && <span className="h-[1.5px] w-2.5 rounded-full bg-current opacity-70" />}
        {done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2.5 6.4 4.8 8.7 9.5 3.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>}

      {readOnly && (
        <span
          className="absolute right-1 top-1 z-[55] rounded-md border border-line bg-surface/85 px-1.5 py-0.5 text-[9px] font-semibold text-muted"
          title="Evento administrado por Google Calendar"
        >
          Google
        </span>
      )}

      {/* Candado, tachito y lápiz: flotan encima, solo al pasar el mouse o si está enfocado. */}
      {!readOnly && <div
        className={[
          'absolute right-1 top-7 z-[55] flex items-center gap-1 rounded-lg p-0.5 backdrop-blur-sm transition-opacity',
          focused ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100',
        ].join(' ')}
        style={{ background: 'color-mix(in oklab, var(--surface) 88%, transparent)', boxShadow: '0 1px 3px rgb(0 0 0 / .12)' }}
      >
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setPinned([block.id], !block.pinned); }}
          aria-label={block.pinned ? 'Soltar bloque' : 'Fijar bloque'}
          title={block.pinned ? 'Fijo: no se mueve. Clic para soltarlo.' : 'Fijar en este horario'}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
          style={block.pinned ? { background: 'var(--pin)', color: '#fff' } : { color: 'var(--muted)' }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="3.4" y="7" width="9.2" height="6.2" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d={block.pinned ? 'M5.7 7V5.2a2.3 2.3 0 0 1 4.6 0V7' : 'M5.7 7V5.2a2.3 2.3 0 0 1 4.4-.8'}
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setAskDelete(true); }}
          aria-label={`Eliminar ${block.title}`}
          title="Eliminar bloque"
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted hover:text-[var(--now)]"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 4.4h10M6.3 4.4V3.2h3.4v1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M4.4 4.4 5 13a.9.9 0 0 0 .9.8h4.2a.9.9 0 0 0 .9-.8l.6-8.6"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpen(block.id); }}
          aria-label={`Editar ${block.title}`}
          title="Editar bloque"
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted hover:text-ink"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M11.2 2.6a1.3 1.3 0 0 1 1.9 0l.3.3a1.3 1.3 0 0 1 0 1.9L6.2 12 3.5 12.5 4 9.8l7.2-7.2Z"
              stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </button>
      </div>}

      {/* Tirador de arriba: agranda el bloque hacia atrás empujando lo de encima */}
      {!readOnly && <div
        onPointerDown={(e) => grab(e, 'resizeTop')}
        role="button"
        aria-label={`Extender ${block.title} desde el inicio`}
        className="absolute inset-x-0 top-0 z-50 flex cursor-ns-resize items-start justify-center"
        style={{ touchAction: 'pan-y', height: Math.min(10, Math.max(3, height * 0.22)) }}
      >
        <span className="h-[3px] w-8 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-35" />
      </div>}

      {!readOnly && <div
        onPointerDown={(e) => grab(e, 'resize')}
        role="button"
        aria-label={`Extender ${block.title} desde el final`}
        className="absolute inset-x-0 bottom-0 z-50 flex cursor-ns-resize items-end justify-center"
        style={{ touchAction: 'pan-y', height: Math.min(10, Math.max(3, height * 0.22)) }}
      >
        <span className="h-[3px] w-8 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-35" />
      </div>}
    </div>
    <ConfirmModal
      open={askDelete}
      onClose={() => setAskDelete(false)}
      onConfirm={() => removeBlock(block.id)}
      title="Eliminar bloque"
      message={`¿Querés eliminar “${block.title}” de la agenda?`}
      detail={block.seriesId ? 'Se elimina únicamente esta ocurrencia. La serie y sus demás referencias no cambian.' : 'Esta acción no se puede deshacer.'}
      confirmLabel="Eliminar"
    />
    </>
  );
}

export const BlockView = memo(BlockViewInner);
