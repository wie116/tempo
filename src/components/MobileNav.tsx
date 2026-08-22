export function MobileNav({ onPlan, onReview, onFocus, onActivity }: { onPlan: () => void; onReview: () => void; onFocus: () => void; onActivity: () => void }) {
  const items = [
    { label: 'Plan', icon: '☰', action: onPlan },
    { label: 'Revisar', icon: '✓', action: onReview },
    { label: 'Enfoque', icon: '◷', action: onFocus },
    { label: 'Actividad', icon: '•', action: onActivity },
  ];
  return <nav className="grid shrink-0 grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="Navegación principal móvil">{items.map((item) => <button key={item.label} onClick={item.action} className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[9.5px] font-medium text-muted active:bg-surface-2 active:text-ink"><span className="text-[16px] leading-none" aria-hidden>{item.icon}</span>{item.label}</button>)}</nav>;
}
