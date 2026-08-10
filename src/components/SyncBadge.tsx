import { useEffect, useState } from 'react';
import { syncNow, useSync } from '../lib/sync';
import { cloudEnabled, supabase } from '../lib/supabase';
import { Btn, ConfirmModal } from './Modal';

export function SyncBadge() {
  const status = useSync((s) => s.status);
  const lastError = useSync((s) => s.lastError);
  const [open, setOpen] = useState(false);
  const [askOut, setAskOut] = useState(false);

  if (!cloudEnabled) return null;

  const color =
    status === 'error' ? 'var(--now)' : status === 'syncing' ? 'var(--muted)' : 'var(--accent)';
  const label =
    status === 'error' ? 'Error al sincronizar'
    : status === 'syncing' ? 'Sincronizando…'
    : status === 'idle' ? 'Sincronizado'
    : 'Sin conexión';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={lastError ?? label}
        aria-label={label}
        className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[12px] text-muted transition-colors hover:text-ink"
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: color, animation: status === 'syncing' ? 'pulse 1.2s infinite' : undefined }}
        />
        <span className="hidden sm:inline">Cuenta</span>
      </button>

      {open && (
        <div className="scrim fixed inset-0 z-50 grid place-items-center p-5" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal-panel w-full max-w-xs rounded-2xl border border-line bg-surface p-5" style={{ boxShadow: 'var(--shadow-modal)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">Cuenta</p>
            <p className="mt-1 truncate text-[14px] font-medium">
              <AccountEmail />
            </p>
            <p className="mt-2 flex items-center gap-2 text-[12.5px]" style={{ color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              {label}
            </p>
            {lastError && <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{lastError}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              <Btn onClick={() => void syncNow()}>Sincronizar ahora</Btn>
              <Btn variant="danger" onClick={() => { setOpen(false); setAskOut(true); }}>Cerrar sesión</Btn>
              <Btn variant="primary" onClick={() => setOpen(false)}>Listo</Btn>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={askOut}
        onClose={() => setAskOut(false)}
        onConfirm={() => void supabase?.auth.signOut()}
        title="Cerrar sesión"
        message="Vas a volver a la pantalla de ingreso."
        detail="Tus datos quedan guardados en tu cuenta. Al volver a entrar aparecen igual."
        confirmLabel="Cerrar sesión"
        danger={false}
      />
    </>
  );
}

function AccountEmail() {
  const [email, setEmail] = useState<string>('');
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
  }, []);
  return <>{email || 'Cargando…'}</>;
}
