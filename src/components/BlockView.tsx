import { memo, useRef } from 'react';
import type { Block } from '../types';
import { useClock, useDrag, useStore, useUI } from '../store';
import { durationLabel, hhmm, minToPx, minutesOf } from '../lib/time';

interface Props {
  block: Block;
  dayIndex: number;
  dayStartMin: number;
  isToday: boolean;
  onOpen: (id: string) => void;
}

function BlockViewInner({ block, dayIndex, dayStartMin, isToday, onOpen }: Props) {
  const slotPx = useStore((s) => s.settings.slotPx);
  const toggleDone = useStore((s) => s.toggleDone);
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
  const tiny = height < 28;
  const compact = height < 44;

  const grab = (e: React.PointerEvent, mode: 'move' | 'resize') => {
    if (tool === 'box') return; // en modo caja el gesto es para seleccionar
    e.stopPropagation();
    e.preventDefault();
    // Sin esto, al estirar hacia abajo el bloque de al lado se queda con el gesto.
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    focusBlock(block.id);
    down.current = mode === 'move' ? { x: e.clientX, y: e.clientY, t: Date.now() } : null;
    begin({
      mode, blockId: block.id, title: block.title, color: block.color, kind: block.kind,
      grabOffsetMin: 0, durationMin, dayIndex, startMin,
      anchorMin: startMin, anchorDayIndex: dayIndex, moved: false,
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = down.current;
    down.current = null;
    if (!p) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5 && Date.now() - p.t < 400) onOpen(block.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${block.title}, ${hhmm(startMin)}, ${durationLabel(durationMin)}`}
      onPointerDown={(e) => grab(e, 'move')}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onOpen(block.id); }
        if (e.key === ' ') { e.preventDefault(); toggleDone(block.id); }
      }}
      className={[
        'group absolute select-none overflow-hidden rounded-lg border text-left transition-shadow',
        preview ? 'z-40 shadow-lg' : 'z-10',
        selected || focused ? 'ring-2 ring-offset-1' : '',
        isBreak ? 'break-fill border-dashed' : '',
        done ? 'opacity-45' : '',
      ].join(' ')}
      style={{
        top, height, left: 2, right: 2,
        touchAction: 'none',
        cursor: tool === 'box' ? 'crosshair' : 'grab',
        borderColor: overdue
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
        <div className={tiny ? 'contents' : 'flex items-start gap-1.5'}>
          <p
            className={[
              'min-w-0 flex-1 truncate font-medium leading-tight',
              tiny ? 'text-[10.5px]' : 'text-[12.5px]',
              done ? 'line-through' : '',
            ].join(' ')}
          >
            {block.title}
          </p>
          {tiny ? (
            <span className="tabular shrink-0 font-mono text-[9px] text-muted">{hhmm(startMin)}</span>
          ) : (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); toggleDone(block.id); }}
              aria-label={done ? 'Marcar como pendiente' : 'Marcar como hecho'}
              className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors"
              style={{
                borderColor: done ? block.color : overdue ? 'var(--now)' : 'color-mix(in oklab, var(--muted) 45%, transparent)',
                background: done ? block.color : 'transparent',
              }}
            >
              {done && (
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2.5 6.4 4.8 8.7 9.5 3.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          )}
        </div>
        {!compact && (
          <p className="tabular mt-0.5 font-mono text-[10px] text-muted">
            {hhmm(startMin)}–{hhmm(startMin + durationMin)}
            {overdue && <span style={{ color: 'var(--now)' }}> · sin cerrar</span>}
          </p>
        )}
      </div>

      <div
        onPointerDown={(e) => grab(e, 'resize')}
        className="absolute inset-x-0 bottom-0 z-50 flex h-3.5 cursor-ns-resize items-end justify-center pb-[3px]"
        style={{ touchAction: 'none' }}
      >
        <span className="h-[3px] w-8 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-35" />
      </div>
    </div>
  );
}

export const BlockView = memo(BlockViewInner);
