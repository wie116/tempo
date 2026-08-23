import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarCheck, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { fetchAdminMetrics, type AdminMetrics } from '../lib/admin';
import { Btn, Modal } from './Modal';

const number = new Intl.NumberFormat('es-AR');
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

const fmtNumber = (value: number) => number.format(value);
const fmtHours = (minutes: number) => `${number.format(Math.round(minutes / 60))} h`;
const percent = (part: number, total: number) => total > 0 ? Math.round((part / total) * 100) : 0;

export function AdminModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setMetrics(await fetchAdminMetrics());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el panel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) void load(); }, [open]);

  return <Modal
    open={open}
    onClose={onClose}
    title="Administración"
    subtitle="Uso agregado de Tempo · acceso privado"
    size="lg"
    footer={<><Btn onClick={() => void load()} disabled={loading}>Actualizar</Btn><Btn variant="primary" onClick={onClose}>Listo</Btn></>}
  >
    <div className="space-y-6 p-4 sm:p-5">
      {loading && !metrics && <LoadingState />}

      {error && <div className="rounded-xl border border-dashed p-4" style={{ borderColor: 'var(--now)' }}>
        <p className="text-[13px] font-semibold" style={{ color: 'var(--now)' }}>No se pudieron leer las estadísticas</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">{error}</p>
        <button onClick={() => void load()} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold underline"><RefreshCw size={13} /> Reintentar</button>
      </div>}

      {metrics && <Dashboard metrics={metrics} refreshing={loading} />}
    </div>
  </Modal>;
}

function Dashboard({ metrics, refreshing }: { metrics: AdminMetrics; refreshing: boolean }) {
  const { users, product } = metrics;
  const maxDaily = useMemo(() => Math.max(1, ...metrics.dailyActivity.map((point) => point.users)), [metrics.dailyActivity]);

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2 text-[var(--accent)]"><ShieldCheck size={19} /></span>
        <div><p className="text-[13px] font-semibold">Estado general</p><p className="text-[10.5px] text-muted">Actualizado {new Date(metrics.generatedAt).toLocaleString('es-AR', { hour12: false })}</p></div>
      </div>
      {refreshing && <span className="inline-flex items-center gap-1.5 text-[11px] text-muted"><RefreshCw size={12} className="animate-spin" /> Actualizando</span>}
    </div>

    <section>
      <SectionTitle icon={<Activity size={15} />} title="Usuarios activos" detail="Personas que abrieron Tempo dentro de cada período." />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="Hoy" value={users.activeToday} foot={`${percent(users.activeToday, users.total)}% del total`} accent />
        <MetricCard label="Esta semana" value={users.activeWeek} foot={`${percent(users.activeWeek, users.total)}% del total`} />
        <MetricCard label="Este mes" value={users.activeMonth} foot={`${percent(users.activeMonth, users.total)}% del total`} />
        <MetricCard label="Este año" value={users.activeYear} foot={`${percent(users.activeYear, users.total)}% del total`} />
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
      <div className="rounded-xl border border-line p-3.5 sm:p-4">
        <SectionTitle icon={<Users size={15} />} title="Actividad diaria · 30 días" detail="Usuarios únicos por día." />
        <div className="mt-4 flex h-36 items-end gap-1" role="img" aria-label="Usuarios activos diarios durante los últimos 30 días">
          {metrics.dailyActivity.map((point, index) => <div key={point.date} className="group relative flex h-full min-w-0 flex-1 items-end">
            <div
              className="w-full min-w-[3px] rounded-t-sm transition-opacity group-hover:opacity-75"
              style={{ height: `${Math.max(point.users ? 7 : 2, (point.users / maxDaily) * 100)}%`, background: point.users ? 'var(--accent)' : 'var(--surface-2)' }}
              title={`${new Date(`${point.date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}: ${point.users}`}
            />
            {(index === 0 || index === metrics.dailyActivity.length - 1) && <span className={`absolute -bottom-5 whitespace-nowrap font-mono text-[8.5px] text-muted ${index === 0 ? 'left-0' : 'right-0'}`}>{point.date.slice(5)}</span>}
          </div>)}
        </div>
        <div className="mt-7 flex items-center justify-between text-[10px] text-muted"><span>Hace 30 días</span><span>Pico: {maxDaily}</span><span>Hoy</span></div>
      </div>

      <div className="rounded-xl border border-line p-3.5 sm:p-4">
        <SectionTitle icon={<Users size={15} />} title="Registros" detail="Altas de cuentas por período." />
        <p className="mt-4 font-mono text-[30px] font-bold tracking-tight">{fmtNumber(users.total)}</p>
        <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted">usuarios registrados</p>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <SmallMetric label="Hoy" value={users.newToday} />
          <SmallMetric label="Semana" value={users.newWeek} />
          <SmallMetric label="Mes" value={users.newMonth} />
          <SmallMetric label="Año" value={users.newYear} />
        </div>
      </div>
    </section>

    <section>
      <SectionTitle icon={<CalendarCheck size={15} />} title="Adopción" detail="Cuántas cuentas ya utilizaron las funciones principales." />
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <AdoptionCard label="Crearon tareas" value={users.withTasks} total={users.total} />
        <AdoptionCard label="Agendaron bloques" value={users.withBlocks} total={users.total} />
        <AdoptionCard label="Conectaron Calendar" value={users.withCalendar} total={users.total} />
      </div>
    </section>

    <section>
      <SectionTitle icon={<Activity size={15} />} title="Uso del producto" detail="Totales agregados; el panel no muestra agendas individuales." />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ProductCard label="Tareas" value={product.tasks} detail={`${fmtNumber(product.todos)} únicas · ${fmtNumber(product.routines)} rutinas`} />
        <ProductCard label="Bloques" value={product.blocks} detail={`${product.blocksPerUser} por usuario`} />
        <ProductCard label="Cumplimiento" value={`${product.completionRate}%`} detail={`${fmtNumber(product.completedBlocks)} hechos · ${fmtNumber(product.skippedBlocks)} omitidos`} />
        <ProductCard label="Tiempo planificado" value={fmtHours(product.scheduledMinutes)} detail={`${fmtHours(product.completedMinutes)} completadas`} />
        <ProductCard label="Tareas archivadas" value={product.archivedTasks} detail={`${product.tasksPerUser} tareas por usuario`} />
        <ProductCard label="Pausas" value={product.breaks} detail="bloques de descanso" />
        <ProductCard label="Eventos Calendar" value={product.calendarBlocks} detail="importados a la agenda" />
        <ProductCard label="Bloques de tarea" value={product.taskBlocks} detail="sin contar pausas" />
      </div>
    </section>

    <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[10.5px] leading-relaxed text-muted">
      Privacidad: se registran presencia diaria y métricas agregadas. No se muestran nombres de tareas, horarios ni correos de otros usuarios.
    </p>
  </>;
}

function LoadingState() {
  return <div className="grid min-h-64 place-items-center text-center"><div><RefreshCw size={22} className="mx-auto animate-spin text-muted" /><p className="mt-3 text-[12px] text-muted">Calculando estadísticas…</p></div></div>;
}

function SectionTitle({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flex items-start gap-2"><span className="mt-0.5 text-[var(--accent)]">{icon}</span><div><h3 className="text-[12.5px] font-semibold">{title}</h3><p className="text-[10.5px] leading-snug text-muted">{detail}</p></div></div>;
}

function MetricCard({ label, value, foot, accent = false }: { label: string; value: number; foot: string; accent?: boolean }) {
  return <div className="rounded-xl border p-3" style={{ borderColor: accent ? 'var(--accent)' : 'var(--border)', background: accent ? 'color-mix(in oklab, var(--accent) 8%, var(--surface))' : undefined }}><p className="text-[10px] uppercase tracking-[0.1em] text-muted">{label}</p><p className="mt-1 font-mono text-[25px] font-bold">{compact.format(value)}</p><p className="text-[10px] text-muted">{foot}</p></div>;
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">{label}</p><p className="mt-0.5 font-mono text-[17px] font-semibold">+{fmtNumber(value)}</p></div>;
}

function AdoptionCard({ label, value, total }: { label: string; value: number; total: number }) {
  const rate = percent(value, total);
  return <div className="rounded-xl border border-line p-3"><div className="flex items-baseline justify-between gap-2"><p className="text-[11.5px] font-medium">{label}</p><span className="font-mono text-[11px] text-muted">{value}/{total}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${rate}%` }} /></div><p className="mt-1.5 text-right font-mono text-[10px] text-muted">{rate}%</p></div>;
}

function ProductCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return <div className="rounded-xl border border-line p-3"><p className="text-[9.5px] uppercase tracking-[0.1em] text-muted">{label}</p><p className="mt-1 font-mono text-[20px] font-bold tracking-tight">{typeof value === 'number' ? compact.format(value) : value}</p><p className="mt-0.5 truncate text-[9.5px] text-muted" title={detail}>{detail}</p></div>;
}
