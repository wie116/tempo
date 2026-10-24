import { useState } from 'react';
import { authErrorMessage, supabase } from '../lib/supabase';
import { useStore } from '../store';
import { pick } from '../lib/i18n';

type Mode = 'signin' | 'signup' | 'reset';

const input =
  'w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[14px] outline-none placeholder:text-muted focus:border-[var(--accent)]';

export function AuthScreen() {
  const language = useStore((s) => s.settings.language);
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

    if (!email.trim()) return setError(pick(language, 'Escribí tu email.', 'Enter your email.'));
    if (mode !== 'reset' && password.length < 6) return setError(pick(language, 'La contraseña necesita al menos 6 caracteres.', 'Your password must be at least 6 characters.'));

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(authErrorMessage(error.message, language));
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) setError(authErrorMessage(error.message, language));
        else if (!data.session) setNotice(pick(language, 'Cuenta creada. Confirmá el email para poder entrar.', 'Account created. Confirm your email to sign in.'));
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + window.location.pathname,
        });
        if (error) setError(authErrorMessage(error.message, language));
        else setNotice(pick(language, 'Te mandamos un link para cambiar la contraseña.', 'We sent you a password reset link.'));
      }
    } catch (e: any) {
      setError(authErrorMessage(e?.message ?? pick(language, 'Algo salió mal', 'Something went wrong'), language));
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
          {mode === 'signin' ? pick(language, 'Entrá a tu agenda', 'Open your schedule') : mode === 'signup' ? pick(language, 'Creá tu cuenta', 'Create your account') : pick(language, 'Recuperar contraseña', 'Reset your password')}
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-snug text-muted">
          {mode === 'signin'
            ? pick(language, 'Tus bloques te siguen entre la compu y el celular.', 'Your blocks stay in sync across desktop and mobile.')
            : mode === 'signup'
              ? pick(language, 'Con esto tus tareas y bloques dejan de vivir solo en este navegador.', 'Your tasks and blocks will no longer live only in this browser.')
              : pick(language, 'Te mandamos un link al email para que elijas una nueva.', 'We will email you a link to choose a new password.')}
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
              placeholder={pick(language, 'vos@ejemplo.com', 'you@example.com')}
              className={input}
            />
          </label>

          {mode !== 'reset' && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                {pick(language, 'Contraseña', 'Password')}
              </span>
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder={pick(language, 'Mínimo 6 caracteres', 'At least 6 characters')}
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
            {busy ? pick(language, 'Un momento…', 'One moment…') : mode === 'signin' ? pick(language, 'Entrar', 'Sign in') : mode === 'signup' ? pick(language, 'Crear cuenta', 'Create account') : pick(language, 'Enviar link', 'Send link')}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
          {mode !== 'signin' && (
            <button onClick={() => { setMode('signin'); setError(null); setNotice(null); }} className="text-muted hover:text-ink">
              {pick(language, 'Ya tengo cuenta', 'I have an account')}
            </button>
          )}
          {mode !== 'signup' && (
            <button onClick={() => { setMode('signup'); setError(null); setNotice(null); }} className="text-muted hover:text-ink">
              {pick(language, 'Crear una cuenta', 'Create an account')}
            </button>
          )}
          {mode !== 'reset' && (
            <button onClick={() => { setMode('reset'); setError(null); setNotice(null); }} className="text-muted hover:text-ink">
              {pick(language, 'Olvidé la contraseña', 'Forgot password')}
            </button>
          )}
        </div>

        <p className="mt-8 text-[11.5px] leading-snug text-muted">
          {pick(language, 'Si ya venías usando Tempo en este navegador, la primera vez que entres tus tareas y bloques se suben solos a tu cuenta.', 'If you already used Tempo in this browser, your tasks and blocks will upload to your account the first time you sign in.')}
        </p>
      </div>
    </div>
  );
}
