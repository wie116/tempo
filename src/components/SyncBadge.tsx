import { useEffect, useState } from 'react';
import { fetchRemoteCounts, forcePushAll, pullAll, syncNow, useSync } from '../lib/sync';
import { cloudEnabled, supabase } from '../lib/supabase';
import { useStore } from '../store';
import { Btn, ConfirmModal } from './Modal';

export function SyncBadge() {
  const status = useSync((s) => s.status);
  const lastError = useSync((s) => s.lastError);
  const [open, setOpen] = useState(false);
  const [askOut, setAskOut] = useState(false);

  if (!cloudEnabled) return null;

  const color = status === 'error' ? 'var(--now)' : status === 'syncing' ? 'var(--muted)' : 'var(--accent)';
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
        style={status === 'error' ? { borderColor: 'var(--now)', color: 'var(--now)' } : undefined}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: color, animation: status === 'syncing' ? 'pulse 1.2s infinite' : undefined }}
        />
        <span className="hidden sm:inline">Cuenta</span>
      </button>

      {open && <AccountPanel onClose={() => setOpen(false)} onSignOut={() => { setOpen(false); setAskOut(true); }} />}

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

function AccountPanel({ onClose, onSignOut }: { onClose: () => void; onSignOut: () => void }) {
  const status = useSync((s) => s.status);
  const lastError = useSync((s) => s.lastError);
  const localBlocks = useStore((s) => Object.keys(s.blocks).length);
  const localTasks = useStore((s) => s.tasks.length);
  const [email, setEmail] = useState('');
  const [remote, setRemote] = useState<{ lists: number; tasks: number; blocks: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => void fetchRemoteCounts().then(setRemote);

  useEffect(() => {
    if (supabase) void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
    refresh();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    await fn();
    refresh();
    setBusy(false);
  };

  /* Si acá hay más de lo que hay en el servidor, algo no viajó. */
  const mismatch = remote !== null && (remote.blocks !== localBlocks || remote.tasks !== localTasks);

  return (
    <div
      className="scrim fixed inset-0 z-50 grid place-items-center p-5"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-panel w-full max-w-sm rounded-2xl border border-line bg-surface p-5" style={{ boxShadow: 'var(--shadow-modal)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">Cuenta</p>
        <p className="mt-1 truncate text-[14px] font-medium">{email || 'Cargando…'}</p>

        <p
          className="mt-2 flex items-center gap-2 text-[12.5px]"
          style={{ color: status === 'error' ? 'var(--now)' : 'var(--muted)' }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: status === 'error' ? 'var(--now)' : status === 'syncing' ? 'var(--muted)' : 'var(--accent)' }}
          />
          {status === 'error' ? 'Error al sincronizar' : status === 'syncing' ? 'Sincronizando…' : 'Sincronizado'}
        </p>
        {lastError && (
          <p className="mt-1.5 rounded-lg border border-dashed px-2.5 py-2 text-[11.5px] leading-snug"
            style={{ borderColor: 'var(--now)', color: 'var(--now)' }}>
            {lastError}
          </p>
        )}

        {/* Contraste entre lo que tenés acá y lo que hay realmente en el servidor */}
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-line p-2.5 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Bloques</p>
            <p className="tabular font-mono text-[14px] font-bold">
              {localBlocks} <span className="text-muted">/ {remote ? remote.blocks : '…'}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Tareas</p>
            <p className="tabular font-mono text-[14px] font-bold">
              {localTasks} <span className="text-muted">/ {remote ? remote.tasks : '…'}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Grupos</p>
            <p className="tabular font-mono text-[14px] font-bold text-muted">{remote ? remote.lists : '…'}</p>
          </div>
        </div>
        <p className="mt-1 text-center text-[10.5px] text-muted">acá / en la nube</p>

        {mismatch && (
          <p className="mt-2 rounded-lg border border-dashed px-2.5 py-2 text-[11.5px] leading-snug"
            style={{ borderColor: 'var(--now)', color: 'var(--now)' }}>
            Los números no coinciden. Usá <span className="font-semibold">Subir todo</span> para forzar la carga.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Btn onClick={() => void run(async () => { await syncNow(); })} disabled={busy}>Sincronizar</Btn>
          <Btn onClick={() => void run(forcePushAll)} disabled={busy}>Subir todo</Btn>
          <Btn onClick={() => void run(pullAll)} disabled={busy}>Bajar de la nube</Btn>
        </div>
        <div className="mt-2 flex justify-between gap-2">
          <Btn variant="danger" onClick={onSignOut}>Cerrar sesión</Btn>
          <Btn variant="primary" onClick={onClose}>Listo</Btn>
        </div>
      </div>
    </div>
  );
}
