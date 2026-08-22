interface Options {
  /** Qué hacer cuando el gesto se convierte en arrastre de verdad. */
  onDrag: (pointer: DragPointer) => void;
  /** Qué hacer si fue un toque/clic corto sin desplazamiento real. */
  onTap?: () => void;
  /** Cuánto hay que sostener el dedo antes de arrastrar, en ms (solo táctil). */
  holdMs?: number;
  /** Cuánto puede moverse el dedo antes de que se considere scroll, en px (táctil). */
  slopPx?: number;
  /** Cuánto tiene que moverse el mouse para que cuente como arrastre, en px. */
  mouseSlopPx?: number;
}

export interface DragPointer {
  clientX: number;
  clientY: number;
  pointerId: number;
  pointerType: string;
}

/**
 * Un clic (mouse) o un toque (dedo) nunca arrancan un arrastre por sí solos.
 * Con mouse hace falta moverlo unos píxeles de verdad: así un clic con la
 * mano temblando, o el jitter típico de un trackpad, no mueve nada por error.
 * Con el dedo además hay que sostenerlo, porque si arrastráramos al primer
 * toque el usuario no podría desplazar la agenda apoyando el dedo en un bloque.
 */
export function startPointerGesture(
  e: React.PointerEvent,
  { onDrag, onTap, holdMs = 380, slopPx = 10, mouseSlopPx = 4 }: Options
): void {
  const el = e.currentTarget as HTMLElement;
  const { pointerId, clientX: x, clientY: y, pointerType } = e;
  const t0 = Date.now();
  const isTouch = pointerType === 'touch';

  const capture = () => {
    try { el.setPointerCapture?.(pointerId); } catch { /* el puntero ya se soltó */ }
  };

  let moved = false;
  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };

  const beginDrag = (pointer: DragPointer) => {
    if (started) return;
    started = true;
    cleanup();
    capture();
    onDrag(pointer);
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    const dist = Math.hypot(ev.clientX - x, ev.clientY - y);
    if (isTouch) {
      if (dist > slopPx) { moved = true; cleanup(); } // el dedo se fue: es scroll, no lo tocamos
    } else if (dist > mouseSlopPx) {
      moved = true;
      beginDrag(ev); // entregamos este movimiento: no se pierde el primer frame
    }
  };

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    cleanup();
    if (moved) return;
    if (isTouch) { if (Date.now() - t0 < holdMs) onTap?.(); }
    else onTap?.();
  };

  if (isTouch) {
    timer = setTimeout(() => {
      cleanup();
      if (moved) return;
      navigator.vibrate?.(12);
      beginDrag({ clientX: x, clientY: y, pointerId, pointerType });
    }, holdMs);
  } else {
    e.preventDefault();
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}
