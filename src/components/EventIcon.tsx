import { useEffect, useRef, useState } from 'react';
import {
  BookOpen, Brain, Briefcase, CalendarDays, Car, Check, ClipboardCheck, Coffee,
  Dumbbell, Flag, GraduationCap, HeartPulse, House, Laptop, Lightbulb, MapPin,
  Moon, Music2, Phone, Plane, Presentation, ShoppingCart, Sparkles, Star,
  Stethoscope, Target, Trees, Users, Utensils, X,
  type LucideIcon,
} from 'lucide-react';

type IconOption = { id: string; label: string; Icon: LucideIcon };
type IconGroup = { label: string; options: IconOption[] };

const GROUPS: IconGroup[] = [
  {
    label: 'Trabajo y estudio',
    options: [
      { id: 'briefcase', label: 'Trabajo', Icon: Briefcase },
      { id: 'graduation-cap', label: 'Estudio', Icon: GraduationCap },
      { id: 'clipboard-check', label: 'Gestión', Icon: ClipboardCheck },
      { id: 'presentation', label: 'Presentación', Icon: Presentation },
      { id: 'phone', label: 'Llamada', Icon: Phone },
      { id: 'laptop', label: 'Computadora', Icon: Laptop },
      { id: 'book-open', label: 'Lectura', Icon: BookOpen },
      { id: 'users', label: 'Reunión', Icon: Users },
    ],
  },
  {
    label: 'Vida diaria',
    options: [
      { id: 'house', label: 'Hogar', Icon: House },
      { id: 'calendar-days', label: 'Evento', Icon: CalendarDays },
      { id: 'shopping-cart', label: 'Compras', Icon: ShoppingCart },
      { id: 'utensils', label: 'Comida', Icon: Utensils },
      { id: 'car', label: 'Traslado', Icon: Car },
      { id: 'plane', label: 'Viaje', Icon: Plane },
      { id: 'map-pin', label: 'Lugar', Icon: MapPin },
      { id: 'sparkles', label: 'Especial', Icon: Sparkles },
    ],
  },
  {
    label: 'Enfoque y bienestar',
    options: [
      { id: 'target', label: 'Objetivo', Icon: Target },
      { id: 'lightbulb', label: 'Idea', Icon: Lightbulb },
      { id: 'flag', label: 'Importante', Icon: Flag },
      { id: 'star', label: 'Destacado', Icon: Star },
      { id: 'dumbbell', label: 'Ejercicio', Icon: Dumbbell },
      { id: 'heart-pulse', label: 'Salud', Icon: HeartPulse },
      { id: 'stethoscope', label: 'Consulta', Icon: Stethoscope },
      { id: 'brain', label: 'Bienestar', Icon: Brain },
      { id: 'coffee', label: 'Descanso', Icon: Coffee },
      { id: 'moon', label: 'Sueño', Icon: Moon },
      { id: 'music', label: 'Música', Icon: Music2 },
      { id: 'trees', label: 'Aire libre', Icon: Trees },
    ],
  },
];

const OPTIONS = GROUPS.flatMap((group) => group.options);
const OPTION_BY_ID = new Map(OPTIONS.map((option) => [option.id, option]));

export function EventIcon({ value, size = 15, className = '' }: { value: string | null | undefined; size?: number; className?: string }) {
  if (!value) return null;
  const option = OPTION_BY_ID.get(value);
  if (!option) return <span className={className} aria-hidden>{value}</span>;
  const Icon = option.Icon;
  return <Icon size={size} strokeWidth={1.9} className={className} aria-hidden />;
}

export function IconPicker({ value, onChange }: { value: string | null | undefined; onChange: (value: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = value ? OPTION_BY_ID.get(value) : null;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape, true);
    };
  }, [open]);

  return <div ref={rootRef} className="relative">
    <button
      type="button"
      onClick={() => setOpen((current) => !current)}
      aria-expanded={open}
      aria-label={selected ? `Cambiar ícono: ${selected.label}` : value ? 'Cambiar ícono anterior' : 'Elegir ícono'}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left text-[13px] outline-none hover:border-[var(--accent)]"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-surface text-muted">
          {value ? <EventIcon value={value} size={16} /> : <Sparkles size={16} strokeWidth={1.8} />}
        </span>
        <span className="truncate">{selected?.label ?? (value ? 'Ícono anterior' : 'Sin ícono')}</span>
      </span>
      <span className="text-[11px] text-muted">{open ? 'Cerrar' : 'Elegir'}</span>
    </button>

    {open && <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-[310px] overflow-y-auto rounded-xl border border-line bg-surface p-2.5" style={{ boxShadow: 'var(--shadow-modal)' }}>
      <button
        type="button"
        onClick={() => { onChange(null); setOpen(false); }}
        className="mb-2 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[12px] text-muted hover:bg-surface-2 hover:text-ink"
      >
        <span className="flex items-center gap-2"><X size={15} /> Sin ícono</span>
        {!value && <Check size={15} style={{ color: 'var(--accent)' }} />}
      </button>
      {GROUPS.map((group) => <section key={group.label} className="mb-3 last:mb-0">
        <p className="mb-1.5 px-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">{group.label}</p>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
          {group.options.map((option) => {
            const active = value === option.id;
            const Icon = option.Icon;
            return <button
              key={option.id}
              type="button"
              onClick={() => { onChange(option.id); setOpen(false); }}
              aria-label={option.label}
              title={option.label}
              className="relative grid aspect-square place-items-center rounded-lg border transition-colors hover:bg-surface-2"
              style={{ borderColor: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accent)' : 'var(--muted)' }}
            >
              <Icon size={19} strokeWidth={1.8} />
              {active && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />}
            </button>;
          })}
        </div>
      </section>)}
    </div>}
  </div>;
}
