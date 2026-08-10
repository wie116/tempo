import { memo, useRef } from 'react';
import type { Block } from '../types';
import { useClock, useDrag, useStore, useUI } from '../store';
import { durationLabel, hhmm, minToPx, minutesOf } from '../lib/time';
import { startPointerGesture } from '../lib/gesture';

interface Props {
  block: Block;
  dayIndex: number;
  dayStartMin: number;
  isToday: boolean;
  onOpen: (id: string) => void;
}

function BlockViewInner({ block, dayIndex, dayStartMin, isToday, onOpen }: Props) {
  const slotPx = useStore((s) => s.settings.slotPx);
  const setPinned = useStore((s) => s.setPinned);
  const removeBlock = useStore((s) => s.removeBlock);
  const setStatus = useStore((s) => s.setStatus);
  const tool = useUI((s) => s.tool);
  const selected = useUI((s) => s.multi.includes(block.id));
  const focused = useUI((s) => s.focusedBlockId === block.id);
  const focusBlock = useUI((s) => s.focusBlock);
  const begin = useDrag((s) => s.begin);
  const preview = useDrag((s) => (s.drag?.blockId === block.id ? s.drag : null));
  const now = useClock((s) => s.now);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);

  const startMin = preview ? preview.startMin : minutesOf(block.startsAt);
  const durationMin = preview ? preview.durationMin : block.durationMin;
  const top = minToPx(startMin - dayStartMin, slotPx);
  const height = minToPx(durationMin, slotPx);

  const d = new Date(now);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const live = isToday && nowMin >= startMin && nowMin < startMin + durationMin;
  const overdue = isToday && block.status === 'planned' && nowMin >= startMin + durationMin;
  const progress = live ? (nowMin - startMin) / durationMin : 0;

  const isBreak = block.kind === 'break';
  const done = block.status === 'done';
  const skipped = block.status === 'skipped';
  const tiny = height < 32;
  const compact = height < 50;

  const grab = (e: React.PointerEvent, mode: 'move' | 'resize' | 'resizeTop') => {
    if (tool === 'box') return; // en modo caja el gesto es para seleccionar
    if (block.pinned) { e.stopPropagation(); focusBlock(block.id); return; } // fijo es fijo
    e.stopPropagation();
    focusBlock(block.id);
    down.current = null;

    startPointerGesture(e, {
      onDrag: () => {
        // Con mouse todavía distinguimos clic de arrastre por desplazamiento;
        // con el dedo ya lo resolvió la pulsación sostenida.
        down.current =
          e.pointerType !== 'touch' && mode === 'move'
            ? { x: e.clientX, y: e.clientY, t: Date.now() }
            : null;
        begin({
          mode, blockId: block.id, title: block.title, color: block.color, kind: block.kind,
          grabOffsetMin: 0, durationMin, dayIndex, startMin,
          // Para estirar hacia arriba el ancla es el final: eso queda quieto.
          anchorMin: mode === 'resizeTop' ? startMin + durationMin : startMin,
          anchorDayIndex: dayIndex, moved: false,
        });
      },
    });
  };


  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${block.title}, ${hhmm(startMin)}, ${durationLabel(durationMin)}`}
      onPointerDown={(e) => grab(e, 'move')}
      onDoubleClick={(e) => { e.stopPropagation(); onOpen(block.id); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onOpen(block.id); }
        if (e.key === ' ') { e.preventDefault(); setStatus(block.id, done ? 'planned' : 'done'); }
      }}
      className={[
        'group absolute select-none overflow-hidden rounded-lg border text-left transition-shadow',
        preview ? 'z-40 shadow-lg' : 'z-10',
        selected || focused ? 'ring-2 ring-offset-1' : '',
        isBreak ? 'break-fill border-dashed' : '',
        skipped ? 'skipped-fill border-dashed opacity-60' : '',
        done ? 'opacity-45' : '',
      ].join(' ')}
      style={{
        top, height, left: 2, right: 2,
        touchAction: 'pan-y',
        borderStyle: block.pinned ? 'dashed' : undefined,
        borderWidth: block.pinned ? 1.5 : undefined,
        cursor: block.pinned ? 'default' : tool === 'box' ? 'crosshair' : 'grab',
        borderColor: block.pinned
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
        <div className={`relative z-[60] ${tiny ? 'contents' : 'flex items-start gap-1.5'}`}>
          <p
            className={[
              'min-w-0 flex-1 truncate font-medium leading-tight',
              tiny ? 'text-[11.5px]' : 'text-[14px]',
              done ? 'line-through' : '',
            ].join(' ')}
          >
            {block.title}
          </p>
          {tiny ? (
            <>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setPinned([block.id], !block.pinned); }}
              aria-label={block.pinned ? 'Soltar bloque' : 'Fijar bloque'}
              title={block.pinned ? 'Fijo: no se mueve. Clic para soltarlo.' : 'Fijar en este horario'}
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition-opacity ${
                block.pinned ? 'opacity-100' : focused ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'
              }`}
              style={
                block.pinned
                  ? { background: 'var(--pin)', color: '#fff' }
                  : { color: 'var(--muted)' }
              }
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                <rect x="3.4" y="7" width="9.2" height="6.2" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d={block.pinned ? 'M5.7 7V5.2a2.3 2.3 0 0 1 4.6 0V7' : 'M5.7 7V5.2a2.3 2.3 0 0 1 4.4-.8'}
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
              aria-label={`Eliminar ${block.title}`}
              title="Eliminar bloque"
              className={`grid h-5 w-5 shrink-0 place-items-center rounded text-muted transition-opacity hover:text-[var(--now)] ${
                focused ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'
              }`}
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
              className={`grid h-5 w-5 shrink-0 place-items-center rounded text-muted transition-opacity hover:text-ink ${focused ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'}`}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M11.2 2.6a1.3 1.3 0 0 1 1.9 0l.3.3a1.3 1.3 0 0 1 0 1.9L6.2 12 3.5 12.5 4 9.8l7.2-7.2Z"
                  stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </button>
              <span className="tabular shrink-0 font-mono text-[10px] text-muted">{hhmm(startMin)}</span>
            </>
          ) : (
            <>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setPinned([block.id], !block.pinned); }}
              aria-label={block.pinned ? 'Soltar bloque' : 'Fijar bloque'}
              title={block.pinned ? 'Fijo: no se mueve. Clic para soltarlo.' : 'Fijar en este horario'}
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition-opacity ${
                block.pinned ? 'opacity-100' : focused ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'
              }`}
              style={
                block.pinned
                  ? { background: 'var(--pin)', color: '#fff' }
                  : { color: 'var(--muted)' }
              }
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                <rect x="3.4" y="7" width="9.2" height="6.2" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d={block.pinned ? 'M5.7 7V5.2a2.3 2.3 0 0 1 4.6 0V7' : 'M5.7 7V5.2a2.3 2.3 0 0 1 4.4-.8'}
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
              aria-label={`Eliminar ${block.title}`}
              title="Eliminar bloque"
              className={`grid h-5 w-5 shrink-0 place-items-center rounded text-muted transition-opacity hover:text-[var(--now)] ${
                focused ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'
              }`}
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
              className={`grid h-5 w-5 shrink-0 place-items-center rounded text-muted transition-opacity hover:text-ink ${focused ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'}`}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M11.2 2.6a1.3 1.3 0 0 1 1.9 0l.3.3a1.3 1.3 0 0 1 0 1.9L6.2 12 3.5 12.5 4 9.8l7.2-7.2Z"
                  stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setStatus(block.id, done ? 'skipped' : skipped ? 'planned' : 'done');
              }}
              aria-label={done ? 'Marcar como omitido' : skipped ? 'Marcar como pendiente' : 'Marcar como hecho'}
              title={done ? 'Hecho — clic para omitir' : skipped ? 'Omitido — clic para volver a pendiente' : 'Marcar como hecho'}
              className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors"
              style={{
                borderColor: done
                  ? block.color
                  : skipped
                  ? 'var(--muted)'
                  : overdue
                  ? 'var(--now)'
                  : 'color-mix(in oklab, var(--muted) 45%, transparent)',
                background: done ? block.color : 'transparent',
              }}
            >
              {skipped && <span className="h-[1.5px] w-2.5 rounded-full bg-current opacity-70" />}
              {done && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2.5 6.4 4.8 8.7 9.5 3.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            </>
          )}
        </div>
        {!compact && (
          <p className="tabular mt-0.5 font-mono text-[11px] text-muted">
            {hhmm(startMin)}–{hhmm(startMin + durationMin)}
            {overdue && <span style={{ color: 'var(--now)' }}> · sin cerrar</span>}
          </p>
        )}
      </div>

      {/* Tirador de arriba: agranda el bloque hacia atrás empujando lo de encima */}
      <div
        onPointerDown={(e) => grab(e, 'resizeTop')}
        className="absolute inset-x-0 top-0 z-50 flex h-3.5 cursor-ns-resize items-start justify-center pt-[3px]"
        style={{ touchAction: 'pan-y' }}
      >
        <span className="h-[3px] w-8 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-35" />
      </div>

      <div
        onPointerDown={(e) => grab(e, 'resize')}
        className="absolute inset-x-0 bottom-0 z-50 flex h-3.5 cursor-ns-resize items-end justify-center pb-[3px]"
        style={{ touchAction: 'pan-y' }}
      >
        <span className="h-[3px] w-8 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-35" />
      </div>
    </div>
  );
}

export const BlockView = memo(BlockViewInner);
