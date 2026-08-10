import { useState } from 'react';
import { authErrorMessage, supabase } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'reset';

const input =
  'w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[14px] outline-none placeholder:text-muted focus:border-[var(--accent)]';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (!supabase || busy) return;
    setError(null);
    setNotice(null);

    if (!email.trim()) return setError('Escribí tu email.');
    if (mode !== 'reset' && password.length < 6) return setError('La contraseña necesita al menos 6 caracteres.');

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(authErrorMessage(error.message));
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) setError(authErrorMessage(error.message));
        else if (!data.session) setNotice('Cuenta creada. Confirmá el email para poder entrar.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + window.location.pathname,
        });
        if (error) setError(authErrorMessage(error.message));
        else setNotice('Te mandamos un link para cambiar la contraseña.');
      }
    } catch (e: any) {
      setError(authErrorMessage(e?.message ?? 'Algo salió mal'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full place-items-center bg-bg p-5 text-ink">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--now)' }} />
          <span className="font-mono text-[17px] font-bold tracking-tight">tempo</span>
        </div>

        <h1 className="text-[24px] font-semibold leading-tight tracking-tight">
          {mode === 'signin' ? 'Entrá a tu agenda' : mode === 'signup' ? 'Creá tu cuenta' : 'Recuperar contraseña'}
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-snug text-muted">
          {mode === 'signin'
            ? 'Tus bloques te siguen entre la compu y el celular.'
            : mode === 'signup'
              ? 'Con esto tus tareas y bloques dejan de vivir solo en este navegador.'
              : 'Te mandamos un link al email para que elijas una nueva.'}
        </p>

        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="vos@ejemplo.com"
              className={input}
            />
          </label>

          {mode !== 'reset' && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                Contraseña
              </span>
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Mínimo 6 caracteres"
                className={input}
              />
            </label>
          )}

          {error && (
            <p
              className="rounded-lg border border-dashed px-3 py-2.5 text-[12.5px] leading-snug"
              style={{ borderColor: 'var(--now)', color: 'var(--now)' }}
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              className="rounded-lg border px-3 py-2.5 text-[12.5px] leading-snug"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              {notice}
            </p>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="w-full rounded-lg py-2.5 text-[14px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            {busy ? 'Un momento…' : mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar link'}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
          {mode !== 'signin' && (
            <button onClick={() => { setMode('signin'); setError(null); setNotice(null); }} className="text-muted hover:text-ink">
              Ya tengo cuenta
            </button>
          )}
          {mode !== 'signup' && (
            <button onClick={() => { setMode('signup'); setError(null); setNotice(null); }} className="text-muted hover:text-ink">
              Crear una cuenta
            </button>
          )}
          {mode !== 'reset' && (
            <button onClick={() => { setMode('reset'); setError(null); setNotice(null); }} className="text-muted hover:text-ink">
              Olvidé la contraseña
            </button>
          )}
        </div>

        <p className="mt-8 text-[11.5px] leading-snug text-muted">
          Si ya venías usando Tempo en este navegador, la primera vez que entres tus tareas y bloques
          se suben solos a tu cuenta.
        </p>
      </div>
    </div>
  );
}
