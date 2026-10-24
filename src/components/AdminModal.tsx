import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarCheck, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { fetchAdminMetrics, type AdminMetrics } from '../lib/admin';
import { Btn, Modal } from './Modal';
import { useStore } from '../store';
import { pick } from '../lib/i18n';
import type { AppLanguage, RegionalLocale } from '../types';

const fmtNumber = (value: number, locale: RegionalLocale) => new Intl.NumberFormat(locale).format(value);
const compactNumber = (value: number, locale: RegionalLocale) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const fmtHours = (minutes: number, locale: RegionalLocale) => `${fmtNumber(Math.round(minutes / 60), locale)} h`;
const percent = (part: number, total: number) => total > 0 ? Math.round((part / total) * 100) : 0;

export function AdminModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const language = useStore((s) => s.settings.language);
  const locale = useStore((s) => s.settings.locale);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setMetrics(await fetchAdminMetrics());
    } catch (reason) {
      setError(language === 'en'
        ? 'Could not load the dashboard. Check that admin-analytics is deployed.'
        : reason instanceof Error ? reason.message : 'No se pudo cargar el panel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) void load(); }, [open]);

  return <Modal
    open={open}
    onClose={onClose}
    title={pick(language, 'Administración', 'Administration')}
    subtitle={pick(language, 'Uso agregado de Tempo · acceso privado', 'Aggregated Tempo usage · private access')}
    size="lg"
    footer={<><Btn onClick={() => void load()} disabled={loading}>{pick(language, 'Actualizar', 'Refresh')}</Btn><Btn variant="primary" onClick={onClose}>{pick(language, 'Listo', 'Done')}</Btn></>}
  >
    <div className="space-y-6 p-4 sm:p-5">
      {loading && !metrics && <LoadingState language={language} />}

      {error && <div className="rounded-xl border border-dashed p-4" style={{ borderColor: 'var(--now)' }}>
        <p className="text-[13px] font-semibold" style={{ color: 'var(--now)' }}>{pick(language, 'No se pudieron leer las estadísticas', 'Could not read statistics')}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">{error}</p>
        <button onClick={() => void load()} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold underline"><RefreshCw size={13} /> {pick(language, 'Reintentar', 'Retry')}</button>
      </div>}

      {metrics && <Dashboard metrics={metrics} refreshing={loading} language={language} locale={locale} />}
    </div>
  </Modal>;
}

function Dashboard({ metrics, refreshing, language, locale }: { metrics: AdminMetrics; refreshing: boolean; language: AppLanguage; locale: RegionalLocale }) {
  const { users, product } = metrics;
  const maxDaily = useMemo(() => Math.max(1, ...metrics.dailyActivity.map((point) => point.users)), [metrics.dailyActivity]);

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-[var(--accent)]"><ShieldCheck size={19} /></span>
        <div><p className="text-[13px] font-semibold">{pick(language, 'Estado general', 'Overview')}</p><p className="text-[10.5px] text-muted">{pick(language, 'Actualizado', 'Updated')} {new Date(metrics.generatedAt).toLocaleString(locale, { hour12: false })}</p></div>
      </div>
      {refreshing && <span className="inline-flex items-center gap-1.5 text-[11px] text-muted"><RefreshCw size={12} className="animate-spin" /> {pick(language, 'Actualizando', 'Refreshing')}</span>}
    </div>

    <section>
      <SectionTitle icon={<Activity size={15} />} title={pick(language, 'Usuarios activos', 'Active users')} detail={pick(language, 'Personas que abrieron Tempo dentro de cada período.', 'People who opened Tempo during each period.')} />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label={pick(language, 'Hoy', 'Today')} value={users.activeToday} foot={`${percent(users.activeToday, users.total)}% ${pick(language, 'del total', 'of total')}`} accent locale={locale} />
        <MetricCard label={pick(language, 'Esta semana', 'This week')} value={users.activeWeek} foot={`${percent(users.activeWeek, users.total)}% ${pick(language, 'del total', 'of total')}`} locale={locale} />
        <MetricCard label={pick(language, 'Este mes', 'This month')} value={users.activeMonth} foot={`${percent(users.activeMonth, users.total)}% ${pick(language, 'del total', 'of total')}`} locale={locale} />
        <MetricCard label={pick(language, 'Este año', 'This year')} value={users.activeYear} foot={`${percent(users.activeYear, users.total)}% ${pick(language, 'del total', 'of total')}`} locale={locale} />
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
      <div className="rounded-xl border border-line p-3.5 sm:p-4">
        <SectionTitle icon={<Users size={15} />} title={pick(language, 'Actividad diaria · 30 días', 'Daily activity · 30 days')} detail={pick(language, 'Usuarios únicos por día.', 'Unique users per day.')} />
        <div className="mt-4 flex h-36 items-end gap-1" role="img" aria-label={pick(language, 'Usuarios activos diarios durante los últimos 30 días', 'Daily active users over the last 30 days')}>
          {metrics.dailyActivity.map((point, index) => <div key={point.date} className="group relative flex h-full min-w-0 flex-1 items-end">
            <div
              className="w-full min-w-[3px] rounded-t-sm transition-opacity group-hover:opacity-75"
              style={{ height: `${Math.max(point.users ? 7 : 2, (point.users / maxDaily) * 100)}%`, background: point.users ? 'var(--accent)' : 'var(--surface-2)' }}
              title={`${new Date(`${point.date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}: ${point.users}`}
            />
            {(index === 0 || index === metrics.dailyActivity.length - 1) && <span className={`absolute -bottom-5 whitespace-nowrap font-mono text-[8.5px] text-muted ${index === 0 ? 'left-0' : 'right-0'}`}>{point.date.slice(5)}</span>}
          </div>)}
        </div>
        <div className="mt-7 flex items-center justify-between text-[10px] text-muted"><span>{pick(language, 'Hace 30 días', '30 days ago')}</span><span>{pick(language, 'Pico', 'Peak')}: {maxDaily}</span><span>{pick(language, 'Hoy', 'Today')}</span></div>
      </div>

      <div className="rounded-xl border border-line p-3.5 sm:p-4">
        <SectionTitle icon={<Users size={15} />} title={pick(language, 'Registros', 'Sign-ups')} detail={pick(language, 'Altas de cuentas por período.', 'Accounts created per period.')} />
        <p className="mt-4 font-mono text-[30px] font-bold tracking-tight">{fmtNumber(users.total, locale)}</p>
        <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted">{pick(language, 'usuarios registrados', 'registered users')}</p>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <SmallMetric label={pick(language, 'Hoy', 'Today')} value={users.newToday} locale={locale} />
          <SmallMetric label={pick(language, 'Semana', 'Week')} value={users.newWeek} locale={locale} />
          <SmallMetric label={pick(language, 'Mes', 'Month')} value={users.newMonth} locale={locale} />
          <SmallMetric label={pick(language, 'Año', 'Year')} value={users.newYear} locale={locale} />
        </div>
      </div>
    </section>

    <section>
      <SectionTitle icon={<CalendarCheck size={15} />} title={pick(language, 'Adopción', 'Adoption')} detail={pick(language, 'Cuántas cuentas ya utilizaron las funciones principales.', 'How many accounts used the main features.')} />
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <AdoptionCard label={pick(language, 'Crearon tareas', 'Created tasks')} value={users.withTasks} total={users.total} />
        <AdoptionCard label={pick(language, 'Agendaron bloques', 'Scheduled blocks')} value={users.withBlocks} total={users.total} />
        <AdoptionCard label={pick(language, 'Conectaron Calendar', 'Connected Calendar')} value={users.withCalendar} total={users.total} />
      </div>
    </section>

    <section>
      <SectionTitle icon={<Activity size={15} />} title={pick(language, 'Uso del producto', 'Product usage')} detail={pick(language, 'Totales agregados; el panel no muestra agendas individuales.', 'Aggregated totals; the dashboard does not show individual schedules.')} />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ProductCard label={pick(language, 'Tareas', 'Tasks')} value={product.tasks} detail={`${fmtNumber(product.todos, locale)} ${pick(language, 'únicas', 'one-time')} · ${fmtNumber(product.routines, locale)} ${pick(language, 'rutinas', 'routines')}`} locale={locale} />
        <ProductCard label={pick(language, 'Bloques', 'Blocks')} value={product.blocks} detail={`${product.blocksPerUser} ${pick(language, 'por usuario', 'per user')}`} locale={locale} />
        <ProductCard label={pick(language, 'Cumplimiento', 'Completion')} value={`${product.completionRate}%`} detail={`${fmtNumber(product.completedBlocks, locale)} ${pick(language, 'hechos', 'done')} · ${fmtNumber(product.skippedBlocks, locale)} ${pick(language, 'omitidos', 'skipped')}`} locale={locale} />
        <ProductCard label={pick(language, 'Tiempo planificado', 'Scheduled time')} value={fmtHours(product.scheduledMinutes, locale)} detail={`${fmtHours(product.completedMinutes, locale)} ${pick(language, 'completadas', 'completed')}`} locale={locale} />
        <ProductCard label={pick(language, 'Tareas archivadas', 'Archived tasks')} value={product.archivedTasks} detail={`${product.tasksPerUser} ${pick(language, 'tareas por usuario', 'tasks per user')}`} locale={locale} />
        <ProductCard label={pick(language, 'Pausas', 'Breaks')} value={product.breaks} detail={pick(language, 'bloques de descanso', 'break blocks')} locale={locale} />
        <ProductCard label={pick(language, 'Eventos Calendar', 'Calendar events')} value={product.calendarBlocks} detail={pick(language, 'importados a la agenda', 'imported into the schedule')} locale={locale} />
        <ProductCard label={pick(language, 'Bloques de tarea', 'Task blocks')} value={product.taskBlocks} detail={pick(language, 'sin contar pausas', 'excluding breaks')} locale={locale} />
      </div>
    </section>

    <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[10.5px] leading-relaxed text-muted">
      {pick(language, 'Privacidad: se registran presencia diaria y métricas agregadas. No se muestran nombres de tareas, horarios ni correos de otros usuarios.', 'Privacy: daily presence and aggregate metrics are recorded. Task names, schedules, and other users’ email addresses are not shown.')}
    </p>
  </>;
}

function LoadingState({ language }: { language: AppLanguage }) {
  return <div className="grid min-h-64 place-items-center text-center"><div><RefreshCw size={22} className="mx-auto animate-spin text-muted" /><p className="mt-3 text-[12px] text-muted">{pick(language, 'Calculando estadísticas…', 'Calculating statistics…')}</p></div></div>;
}

function SectionTitle({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flex items-start gap-2"><span className="mt-0.5 text-[var(--accent)]">{icon}</span><div><h3 className="text-[12.5px] font-semibold">{title}</h3><p className="text-[10.5px] leading-snug text-muted">{detail}</p></div></div>;
}

function MetricCard({ label, value, foot, accent = false, locale }: { label: string; value: number; foot: string; accent?: boolean; locale: RegionalLocale }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: accent ? 'var(--accent)' : 'var(--border)', background: accent ? 'color-mix(in oklab, var(--accent) 8%, var(--surface))' : undefined }}><p className="text-[10px] uppercase tracking-[0.1em] text-muted">{label}</p><p className="mt-1 font-mono text-[25px] font-bold">{compactNumber(value, locale)}</p><p className="text-[10px] text-muted">{foot}</p></div>;
}

function SmallMetric({ label, value, locale }: { label: string; value: number; locale: RegionalLocale }) {
  return <div><p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">{label}</p><p className="mt-0.5 font-mono text-[17px] font-semibold">+{fmtNumber(value, locale)}</p></div>;
}

function AdoptionCard({ label, value, total }: { label: string; value: number; total: number }) {
  const rate = percent(value, total);
  return <div className="rounded-xl border border-line p-3"><div className="flex items-baseline justify-between gap-2"><p className="text-[11.5px] font-medium">{label}</p><span className="font-mono text-[11px] text-muted">{value}/{total}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${rate}%` }} /></div><p className="mt-1.5 text-right font-mono text-[10px] text-muted">{rate}%</p></div>;
}

function ProductCard({ label, value, detail, locale }: { label: string; value: number | string; detail: string; locale: RegionalLocale }) {
  return <div className="rounded-xl border border-line p-3"><p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">{label}</p><p className="mt-1 font-mono text-[20px] font-bold tracking-tight">{typeof value === 'number' ? compactNumber(value, locale) : value}</p><p className="mt-0.5 truncate text-[9.5px] text-muted" title={detail}>{detail}</p></div>;
}
