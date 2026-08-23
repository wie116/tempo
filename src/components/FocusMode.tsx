import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useClock, useStore } from '../store';
import { dateKey, hhmm, minutesOf } from '../lib/time';

const pad = (value: number) => String(Math.floor(value)).padStart(2, '0');

export function FocusMode({
  open, onClose, onOpenBlock, portalWindow = null,
}: {
  open: boolean;
  onClose: () => void;
  onOpenBlock: (id: string) => void;
  portalWindow?: Window | null;
}) {
  const blocks = useStore((s) => s.blocks);
  const setStatus = useStore((s) => s.setStatus);
  const extendBlock = useStore((s) => s.extendBlock);
  const theme = useStore((s) => s.settings.theme);
  const fontFamily = useStore((s) => s.settings.fontFamily);
  const now = useClock((s) => s.now);
  const date = new Date(now);
  const nowMin = date.getHours() * 60 + date.getMinutes();
  const nowSec = nowMin * 60 + date.getSeconds();
  const today = useMemo(() => Object.values(blocks).filter((block) => block.startsAt.slice(0, 10) === dateKey(date)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [blocks, now]);
  const current = today.find((block) => nowMin >= minutesOf(block.startsAt) && nowMin < minutesOf(block.startsAt) + block.durationMin);
  const next = today.find((block) => minutesOf(block.startsAt) > nowMin);
  const endSec = current ? (minutesOf(current.startsAt) + current.durationMin) * 60 : 0;
  const remaining = current ? Math.max(0, endSec - nowSec) : 0;
  const progress = current ? 1 - remaining / (current.durationMin * 60) : 0;

  useEffect(() => {
    if (!open) return;
    const eventWindow = portalWindow ?? window;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    eventWindow.addEventListener('keydown', onKey);
    let lock: { release: () => Promise<void> } | null = null;
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (wakeLock) void wakeLock.request('screen').then((value) => { lock = value; }).catch(() => {});
    return () => { eventWindow.removeEventListener('keydown', onKey); void lock?.release(); };
  }, [open, onClose, portalWindow]);

  useEffect(() => {
    if (!portalWindow) return;
    portalWindow.document.documentElement.dataset.theme = theme;
    portalWindow.document.documentElement.dataset.font = fontFamily;
  }, [portalWindow, theme, fontFamily]);

  if (!open) return null;
  const floating = Boolean(portalWindow);
  const portalDocument = portalWindow?.document ?? document;
  return createPortal(<div className="fixed inset-0 z-[70] flex flex-col bg-bg text-ink">
    <header className={`flex items-center justify-between border-b border-line ${floating ? 'px-4 py-2.5' : 'px-5 py-3'}`}><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Tempo</p><h2 className="text-[14px] font-semibold">{floating ? 'Concentración' : 'Modo Enfoque'}</h2></div><button onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-[12px] text-muted hover:text-ink">Salir · Esc</button></header>
    <main className={`mx-auto grid min-h-0 w-full max-w-5xl flex-1 place-items-center overflow-y-auto ${floating ? 'p-4' : 'p-6'}`}>
      <div className="w-full max-w-2xl text-center">
        <p className="font-mono text-[clamp(54px,12vw,112px)] font-bold leading-none tracking-[-0.08em]">
          {pad(date.getHours())}:{pad(date.getMinutes())}
          <span className="ml-3 inline-block min-w-[2.5ch] align-top font-mono text-[clamp(14px,2vw,22px)] font-medium tracking-normal text-muted">
            {pad(date.getSeconds())}s
          </span>
        </p>
        {current ? <>
          <button onClick={() => onOpenBlock(current.id)} className="mt-8 max-w-full truncate text-[clamp(24px,5vw,44px)] font-semibold tracking-tight hover:underline">{current.icon && <span className="mr-2">{current.icon}</span>}{current.kind === 'break' ? 'Pausa' : current.title}</button>
          {current.notes && <p className="mx-auto mt-3 max-w-xl whitespace-pre-wrap text-[14px] leading-relaxed text-muted">{current.notes}</p>}
          <div className="mt-9 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progress * 100}%`, background: current.color }} /></div>
          <div className="mt-3 flex items-baseline justify-between gap-3"><span className="font-mono text-[12px] text-muted">{hhmm(minutesOf(current.startsAt))}</span><span className="font-mono text-[clamp(30px,6vw,54px)] font-bold" style={{ color: current.color }}>{pad(remaining / 60)}:{pad(remaining % 60)}</span><span className="font-mono text-[12px] text-muted">{hhmm(minutesOf(current.startsAt) + current.durationMin)}</span></div>
          {current.kind !== 'break' && <div className="mt-9 flex flex-wrap justify-center gap-2"><button onClick={() => setStatus(current.id, 'done')} className="rounded-xl px-6 py-3 text-[14px] font-semibold" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>Completar</button><button onClick={() => extendBlock(current.id, 10)} className="rounded-xl border border-line px-5 py-3 text-[14px] font-medium">+10 minutos</button><button onClick={() => setStatus(current.id, 'skipped')} className="rounded-xl border border-line px-5 py-3 text-[14px] font-medium text-muted">Omitir</button></div>}
        </> : <div className="mt-10"><p className="text-[24px] font-semibold">Un momento libre</p><p className="mt-2 text-[14px] text-muted">{next ? `${next.title} comienza a las ${hhmm(minutesOf(next.startsAt))}.` : 'No quedan más bloques hoy.'}</p></div>}
      </div>
    </main>
    <footer className="border-t border-line px-5 py-3 text-center text-[11px] text-muted">{next ? `Después · ${next.title} · ${hhmm(minutesOf(next.startsAt))}` : 'Último bloque del día'}</footer>
  </div>, portalDocument.body);
}
