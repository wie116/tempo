import { useStore } from '../store';
import { translate } from '../lib/i18n';

export function MobileNav({ onPlan, onReview, onFocus, onActivity }: { onPlan: () => void; onReview: () => void; onFocus: () => void; onActivity: () => void }) {
  const language = useStore((s) => s.settings.language);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const items = [
    { label: t('plan'), icon: '☰', action: onPlan },
    { label: t('review'), icon: '✓', action: onReview },
    { label: t('focus'), icon: '◷', action: onFocus },
    { label: t('activity'), icon: '•', action: onActivity },
  ];
  return <nav className="grid shrink-0 grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label={t('mobileNav')}>{items.map((item) => <button key={item.label} onClick={item.action} className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[9.5px] font-medium text-muted active:bg-surface-2 active:text-ink"><span className="text-[16px] leading-none" aria-hidden>{item.icon}</span>{item.label}</button>)}</nav>;
}
