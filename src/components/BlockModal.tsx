import { useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore } from '../store';
import { PALETTE } from '../lib/themes';
import { dateKey, durationLabel, fmt, hhmm, isoFor, minutesOf, snap } from '../lib/time';
import { UNTIL_PRESETS, WEEKDAY_LABELS, countSeries } from '../lib/repeat';
import { Btn, ColorPicker, ConfirmModal, Field, Modal, NumField, Segmented, Tabs, TimeField, inputCls } from './Modal';
import type { BlockStatus, RepeatMode } from '../types';
import { isReadOnlyBlock } from '../lib/planning';

const ICONS = ['🎓', '📝', '📞', '💪', '🧘', '🚗', '💡', '⭐', '📌', '🎯', '🩺', '✈️'];

export function BlockModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const block = useStore((s) => (id ? s.blocks[id] ?? null : null));
  const task = useStore((s) => (block?.taskId ? s.tasks.find((t) => t.id === block.taskId) ?? null : null));
  const updateBlock = useStore((s) => s.updateBlock);
  const removeBlock = useStore((s) => s.removeBlock);
  const removeSeries = useStore((s) => s.removeSeries);
  const removeSeriesFrom = useStore((s) => s.removeSeriesFrom);
  const setBlockRecurrence = useStore((s) => s.setBlockRecurrence);
  const applyBlockToSeries = useStore((s) => s.applyBlockToSeries);
  const duplicateBlock = useStore((s) => s.duplicateBlock);
  const setStatus = useStore((s) => s.setStatus);
  const setPinned = useStore((s) => s.setPinned);
  const [tab, setTab] = useState<'general' | 'details' | 'repeat'>('general');
  const [confirm, setConfirm] = useState<'all' | 'future' | null>(null);

  if (!block) return null;
  const day = parseISO(block.startsAt);
  const start = minutesOf(block.startsAt);
  const isBreak = block.kind === 'break';
  const readOnly = isReadOnlyBlock(block);

  if (readOnly) return <Modal open onClose={onClose} title={block.title || 'Evento de Google Calendar'}
    subtitle={`${fmt(day, "EEEE d 'de' LLLL")} · ${hhmm(start)}–${hhmm(start + block.durationMin)}`} size="sm"
    footer={<Btn variant="primary" onClick={onClose}>Listo</Btn>}>
    <div className="space-y-3 p-5"><div className="rounded-lg border border-line bg-surface-2 p-3">
      <p className="text-[12.5px] font-semibold">Evento externo de solo lectura</p>
      <p className="mt-1 text-[11.5px] text-muted">Se administra desde Google Calendar y Tempo lo respeta como tiempo ocupado.</p>
    </div>{block.notes && <p className="whitespace-pre-wrap text-[13px]">{block.notes}</p>}</div>
  </Modal>;

  const repeat = block.repeat ?? 'none';
  const weekdays = block.repeatWeekdays ?? null;
  const until = block.repeatUntil ?? null;
  const setRule = (next: RepeatMode, nextUntil = until, nextWeekdays = weekdays) =>
    setBlockRecurrence(block.id, next, nextUntil, nextWeekdays);

  return <>
    <Modal open onClose={onClose} title={isBreak ? 'Pausa' : `${block.icon ? `${block.icon} ` : ''}${block.title || 'Bloque'}`}
      subtitle={`${fmt(day, "EEEE d 'de' LLLL")} · ${hhmm(start)}–${hhmm(start + block.durationMin)}`} size="sm"
      footer={<><Btn variant="danger" onClick={() => { removeBlock(block.id); onClose(); }}>Eliminar esta</Btn>
        <Btn onClick={() => { duplicateBlock(block.id); onClose(); }}>Duplicar</Btn><Btn variant="primary" onClick={onClose}>Listo</Btn></>}>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'general' as const, label: 'General' }, { id: 'details' as const, label: 'Comentario' },
        ...(!isBreak ? [{ id: 'repeat' as const, label: block.seriesId ? 'Serie' : 'Repetir' }] : []),
      ]} />

      {tab === 'general' && <div className="space-y-4 p-5">
        {!isBreak && <Field label="Título" hint={task ? `Esta ocurrencia nació de “${task.title}”; los cambios quedan en la agenda.` : undefined}>
          <input autoFocus value={block.title} onChange={(e) => updateBlock(block.id, { title: e.target.value })} className={inputCls} />
        </Field>}
        <div className="grid grid-cols-2 gap-3"><Field label="Empieza"><TimeField value={start} onCommit={(value) => updateBlock(block.id, { startsAt: isoFor(day, value) })} max={24 * 60 - block.durationMin} /></Field>
          <Field label="Dura"><NumField value={block.durationMin} onCommit={(v) => v && updateBlock(block.id, { durationMin: v })} suffix="min" /></Field></div>
        <div className="flex flex-wrap gap-1.5">{[10, 20, 30, 45, 60, 90, 120].map((m) => <button key={m} onClick={() => updateBlock(block.id, { durationMin: snap(m) })}
          className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-muted hover:text-ink">{durationLabel(snap(m))}</button>)}</div>
        {!isBreak && <Field label="Color"><ColorPicker value={block.color} onChange={(c) => c && updateBlock(block.id, { color: c })} palette={PALETTE} /></Field>}
      </div>}

      {tab === 'details' && <div className="space-y-4 p-5">
        {!isBreak && <Field label="Ícono de esta ocurrencia" hint="Destacá examen, viaje, llamada u otro contexto puntual."><div className="flex flex-wrap gap-2">
          <button onClick={() => updateBlock(block.id, { icon: null })} className="grid h-9 min-w-9 place-items-center rounded-lg border border-line px-2 text-[11px] text-muted">Sin</button>
          {ICONS.map((icon) => <button key={icon} onClick={() => updateBlock(block.id, { icon })} aria-label={`Usar ${icon}`}
            className="grid h-9 w-9 place-items-center rounded-lg border text-lg" style={{ borderColor: block.icon === icon ? 'var(--accent)' : 'var(--border)', background: block.icon === icon ? 'var(--surface-2)' : undefined }}>{icon}</button>)}</div></Field>}
        <Field label="Comentario de esta ocurrencia"><textarea rows={4} value={block.notes} onChange={(e) => updateBlock(block.id, { notes: e.target.value })}
          placeholder="Ej.: examen parcial, llevar documentación…" className={`${inputCls} resize-y`} /></Field>
        <label className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5"><input type="checkbox" checked={block.pinned}
          onChange={(e) => setPinned([block.id], e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span><span className="block text-[13px]">Fijo en este horario</span><span className="block text-[11px] text-muted">No se mueve por arrastre, cadena ni Organizar.</span></span></label>
        <Field label="Estado"><Segmented value={block.status} onChange={(v) => setStatus(block.id, v as BlockStatus)} options={[
          { id: 'planned', label: 'Pendiente' }, { id: 'done', label: 'Completado' }, { id: 'skipped', label: 'Omitido' },
        ]} /></Field>
      </div>}

      {tab === 'repeat' && !isBreak && <div className="space-y-4 p-5">
        <Field label="Frecuencia" hint="La repetición pertenece a este evento, no a la tarea de la lista."><Segmented value={repeat} onChange={(v) => setRule(v as RepeatMode)} options={[
          { id: 'none', label: 'No' }, { id: 'daily', label: 'Diaria' }, { id: 'weekly', label: 'Semanal' }, { id: 'monthly', label: 'Mensual' }, { id: 'yearly', label: 'Anual' },
        ]} /></Field>
        {repeat === 'weekly' && <Field label="Días de la semana"><div className="flex flex-wrap gap-1.5">{WEEKDAY_LABELS.map((label, i) => {
          const on = (weekdays ?? []).includes(i); return <button key={i} onClick={() => { const next = on ? (weekdays ?? []).filter((x) => x !== i) : [...(weekdays ?? []), i].sort(); setRule(repeat, until, next.length ? next : null); }}
            className="rounded-md border px-2.5 py-1.5 text-[12px]" style={{ borderColor: on ? 'var(--accent)' : 'var(--border)', background: on ? 'var(--accent)' : undefined, color: on ? 'var(--accent-fg)' : 'var(--muted)' }}>{label}</button>;
        })}</div></Field>}
        {repeat !== 'none' && <Field label="Hasta cuándo"><div className="flex flex-wrap gap-1.5">{UNTIL_PRESETS.map((p) => <button key={p.id} onClick={() => setRule(repeat, dateKey(p.add(day)), weekdays)}
          className="rounded-md border border-line px-2.5 py-1.5 text-[12px] text-muted">{p.label}</button>)}<button onClick={() => setRule(repeat, null, weekdays)} className="rounded-md border border-line px-2.5 py-1.5 text-[12px] text-muted">Siempre</button></div>
          <input type="date" value={until ?? ''} onChange={(e) => setRule(repeat, e.target.value || null, weekdays)} className={`${inputCls} mt-2 font-mono`} />
          <p className="mt-2 text-[11px] text-muted">{countSeries(day, repeat, until, weekdays)} ocurrencias previstas. Si existe un conflicto, Tempo busca el hueco libre más cercano.</p></Field>}
        {block.seriesId && <div className="rounded-xl border border-line bg-surface-2 p-3"><p className="text-[12px] font-semibold">Cambios de esta ocurrencia</p>
          <p className="mt-1 text-[11px] text-muted">Título, ícono, comentario, color, duración y hora pueden propagarse.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><Btn onClick={() => applyBlockToSeries(block.id, 'future')}>Aplicar desde hoy</Btn><Btn onClick={() => applyBlockToSeries(block.id, 'all')}>Aplicar a todas</Btn></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><Btn variant="danger" onClick={() => setConfirm('future')}>Borrar desde hoy</Btn><Btn variant="danger" onClick={() => setConfirm('all')}>Borrar toda la serie</Btn></div></div>}
      </div>}
    </Modal>
    <ConfirmModal open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => { if (!block.seriesId) return; confirm === 'all' ? removeSeries(block.seriesId) : removeSeriesFrom(block.seriesId, block.startsAt); onClose(); }}
      title={confirm === 'all' ? 'Eliminar toda la serie' : 'Eliminar desde esta fecha'} message={confirm === 'all' ? `Se borrarán todas las ocurrencias de “${block.title}”.` : `Se borrará “${block.title}” desde esta ocurrencia en adelante.`}
      detail="La tarea plantilla seguirá disponible en su clasificación." />
  </>;
}
