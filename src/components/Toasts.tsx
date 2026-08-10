import { useState } from 'react';
import { useStore, useToasts } from '../store';
import { NumField } from './Modal';

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-16 right-3 z-40 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 sm:bottom-16 sm:right-4">
      {toasts.slice(-3).map((t) => (
        <ToastCard key={t.id} id={t.id} />
      ))}
    </div>
  );
}

function ToastCard({ id }: { id: string }) {
  const toast = useToasts((s) => s.toasts.find((t) => t.id === id));
  const dismiss = useToasts((s) => s.dismiss);
  const setStatus = useStore((s) => s.setStatus);
  const extendBlock = useStore((s) => s.extendBlock);
  const [extending, setExtending] = useState(false);
  const [extra, setExtra] = useState<number | null>(20);

  if (!toast) return null;
  const isPrompt = toast.kind === 'close-prompt';

  return (
    <div
      className="modal-panel pointer-events-auto rounded-xl border border-line bg-surface p-3"
      style={{ boxShadow: 'var(--shadow-modal)' }}
      role="status"
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{ background: isPrompt ? 'var(--now)' : 'var(--accent)' }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold leading-snug">{toast.title}</p>
          {toast.body && <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{toast.body}</p>}
        </div>
        <button
          onClick={() => dismiss(toast.id)}
          aria-label="Descartar"
          className="-mr-0.5 -mt-0.5 shrink-0 rounded p-1 text-muted hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {toast.onUndo && (
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() => { toast.onUndo!(); dismiss(toast.id); }}
            className="flex-1 rounded-lg border border-line py-1.5 text-[12px] font-medium text-muted hover:text-ink"
          >
            Deshacer
          </button>
          <button
            onClick={() => dismiss(toast.id)}
            className="flex-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            Aceptar
          </button>
        </div>
      )}

      {isPrompt && toast.blockId && (
        <div className="mt-2.5">
          {extending ? (
            <div className="flex items-center gap-2">
              <NumField value={extra} onCommit={setExtra} min={10} step={10} suffix="min más" />
              <button
                onClick={() => { extendBlock(toast.blockId!, extra ?? 20); dismiss(toast.id); }}
                className="ml-auto rounded-lg px-2.5 py-1.5 text-[12px] font-semibold"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Agendar
              </button>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={() => { setStatus(toast.blockId!, 'done'); dismiss(toast.id); }}
                className="flex-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                Completado
              </button>
              <button
                onClick={() => setExtending(true)}
                className="rounded-lg border border-line px-2 py-1.5 text-[12px] text-muted hover:text-ink"
              >
                Más tiempo
              </button>
              <button
                onClick={() => { setStatus(toast.blockId!, 'skipped'); dismiss(toast.id); }}
                title="Queda como omitido y la tarea vuelve a pendientes"
                className="rounded-lg border border-line px-2 py-1.5 text-[12px] text-muted hover:text-ink"
              >
                No lo hice
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
