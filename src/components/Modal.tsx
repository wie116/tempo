import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Ancho máximo del panel. */
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };

export function Modal({ open, onClose, title, subtitle, size = 'md', footer, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="scrim fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal-panel flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface outline-none sm:rounded-2xl ${WIDTHS[size]}`}
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ---------- Piezas de formulario compartidas ---------- */

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px]">{label}</p>
        {hint && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export const inputCls =
  'w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted focus:border-[var(--accent)]';

export function Btn({
  children, onClick, variant = 'ghost', type = 'button', disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const base = 'rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-40';
  if (variant === 'primary')
    return (
      <button type={type} onClick={onClick} disabled={disabled} className={base}
        style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
        {children}
      </button>
    );
  if (variant === 'danger')
    return (
      <button type={type} onClick={onClick} disabled={disabled}
        className={`${base} border border-line text-muted hover:border-[var(--now)] hover:text-[var(--now)]`}>
        {children}
      </button>
    );
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} border border-line text-muted hover:text-ink`}>
      {children}
    </button>
  );
}

export function ColorPicker({
  value, onChange, palette, allowInherit,
}: {
  value: string | null;
  onChange: (c: string | null) => void;
  palette: string[];
  allowInherit?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowInherit && (
        <button
          onClick={() => onChange(null)}
          title="Usar el color del grupo"
          className="grid h-6 w-6 place-items-center rounded-full border-2 text-[9px]"
          style={{
            borderColor: value === null ? 'var(--text)' : 'var(--border)',
            background: allowInherit,
            color: '#fff',
          }}
        >
          ↩
        </button>
      )}
      {palette.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
          style={{ background: c, borderColor: value === c ? 'var(--text)' : 'transparent' }}
        />
      ))}
    </div>
  );
}


/**
 * Campo numérico que NO corrige mientras escribís.
 * Mantiene el texto crudo y recién normaliza al salir o con Enter,
 * así podés tipear "45" sin que el "4" se convierta en otra cosa.
 */
export function NumField({
  value, onCommit, min = 10, step = 10, placeholder, allowEmpty, suffix, className = '',
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  min?: number;
  step?: number;
  placeholder?: string;
  allowEmpty?: boolean;
  suffix?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value === null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const raw = draft.trim();
    if (raw === '') {
      if (allowEmpty) onCommit(null);
      else setDraft(value === null ? '' : String(value));
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) {
      setDraft(value === null ? '' : String(value));
      return;
    }
    const snapped = Math.max(min, Math.round(n / step) * step);
    onCommit(snapped);
    setDraft(String(snapped));
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        placeholder={placeholder}
        onFocus={(e) => { focused.current = true; e.currentTarget.select(); }}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={() => { focused.current = false; commit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur(); }
          if (e.key === 'Escape') { setDraft(value === null ? '' : String(value)); e.currentTarget.blur(); }
        }}
        className={`w-20 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-right font-mono text-[13px] outline-none focus:border-[var(--accent)] ${className}`}
      />
      {suffix && <span className="text-[12px] text-muted">{suffix}</span>}
    </span>
  );
}

export function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className="rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors"
          style={
            value === o.id
              ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 2px rgb(0 0 0 / .1)' }
              : { color: 'var(--muted)' }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Confirmación propia de la app. Reemplaza al confirm() del navegador,
 * que rompe el estilo y aparece pegado al borde de la ventana.
 */
export function ConfirmModal({
  open, onClose, onConfirm, title, message, detail, confirmLabel = 'Eliminar', danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Btn onClick={onClose}>Cancelar</Btn>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold"
            style={
              danger
                ? { background: 'var(--now)', color: '#fff' }
                : { background: 'var(--accent)', color: 'var(--accent-fg)' }
            }
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="p-5">
        <p className="text-[13.5px] leading-relaxed">{message}</p>
        {detail && (
          <p
            className="mt-3 rounded-lg border border-dashed px-3 py-2.5 text-[12.5px] leading-snug"
            style={{ borderColor: 'var(--now)', color: 'var(--now)' }}
          >
            {detail}
          </p>
        )}
      </div>
    </Modal>
  );
}
