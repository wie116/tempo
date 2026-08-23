import { useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore } from '../store';
import { PALETTE } from '../lib/themes';
import { dateKey, durationLabel, fmt, hhmm, isoFor, minutesOf, snap } from '../lib/time';
import { UNTIL_PRESETS, WEEKDAY_LABELS, countSeries } from '../lib/repeat';
import { Btn, ColorPicker, ConfirmModal, Field, Modal, NumField, Segmented, Tabs, TimeField, inputCls } from './Modal';
import type { BlockStatus, RepeatMode } from '../types';
import { isReadOnlyBlock } from '../lib/planning';
import { IconPicker } from './EventIcon';

export function BlockModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const block = useStore((s) => (id ? s.blocks[id] ?? null : null));
  const task = useStore((s) => (block?.taskId ? s.tasks.find((t) => t.id === block.taskId) ?? null : null));
  const groupName = useStore((s) => {
    if (block?.source === 'google-calendar') return 'Google Calendar';
    if (block?.kind === 'break') return 'Pausa';
    const sourceTask = block?.taskId ? s.tasks.find((item) => item.id === block.taskId) : null;
    return sourceTask ? s.lists.find((list) => list.id === sourceTask.listId)?.name ?? 'Sin clasificar' : 'Sin clasificar';
  });
  const updateBlock = useStore((s) => s.updateBlock);
  const updateTask = useStore((s) => s.updateTask);
  const lists = useStore((s) => s.lists);
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
  const isLinkedAdhoc = block.kind === 'adhoc' && Boolean(task) && !block.seriesId;
  const todoLists = lists.filter((list) => list.scope === 'todo');
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
    <Modal open onClose={onClose} title={isBreak ? 'Pausa' : block.title || 'Bloque'}
      subtitle={`${fmt(day, "EEEE d 'de' LLLL")} · ${hhmm(start)}–${hhmm(start + block.durationMin)} · ${groupName}`} size="sm"
      footer={<><Btn variant="danger" onClick={() => { removeBlock(block.id); onClose(); }}>Eliminar esta</Btn>
        <Btn onClick={() => { duplicateBlock(block.id); onClose(); }}>Duplicar</Btn><Btn variant="primary" onClick={onClose}>Listo</Btn></>}>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'general' as const, label: 'General' }, { id: 'details' as const, label: 'Comentario' },
        { id: 'repeat' as const, label: block.seriesId ? 'Serie' : 'Repetir' },
      ]} />

      {tab === 'general' && <div className="space-y-4 p-5">
        {!isBreak && <Field label="Título" hint={isLinkedAdhoc ? 'Este título también se actualiza en el To-Do vinculado.' : task ? `Esta ocurrencia nació de “${task.title}”; los cambios quedan en la agenda.` : undefined}>
          <input autoFocus value={block.title} onChange={(e) => updateBlock(block.id, { title: e.target.value })} className={inputCls} />
        </Field>}
        {isLinkedAdhoc && task && <Field label="Clasificación del To-Do" hint="El bloque y su tarea seguirán vinculados.">
          <select value={task.listId} onChange={(e) => updateTask(task.id, { listId: e.target.value, inbox: false })} className={inputCls}>
            {todoLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
        </Field>}
        <div className="grid grid-cols-2 gap-3"><Field label="Empieza"><TimeField value={start} onCommit={(value) => updateBlock(block.id, { startsAt: isoFor(day, value) })} max={24 * 60 - block.durationMin} /></Field>
          <Field label="Dura"><NumField value={block.durationMin} onCommit={(v) => v && updateBlock(block.id, { durationMin: v })} suffix="min" /></Field></div>
        <div className="flex flex-wrap gap-1.5">{[10, 20, 30, 45, 60, 90, 120].map((m) => <button key={m} onClick={() => updateBlock(block.id, { durationMin: snap(m) })}
          className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-muted hover:text-ink">{durationLabel(snap(m))}</button>)}</div>
        {!isBreak && <Field label="Color"><ColorPicker value={block.color} onChange={(c) => c && updateBlock(block.id, { color: c })} palette={PALETTE} /></Field>}
      </div>}

      {tab === 'details' && <div className="space-y-4 p-5">
        {!isBreak && <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Ícono de esta ocurrencia</span>
          <IconPicker value={block.icon} onChange={(icon) => updateBlock(block.id, { icon })} />
          <span className="mt-1 block text-[11px] leading-snug text-muted">Clasificá visualmente este evento sin modificar otras ocurrencias.</span>
        </div>}
        <Field label="Comentario de esta ocurrencia"><textarea rows={4} value={block.notes} onChange={(e) => updateBlock(block.id, { notes: e.target.value })}
          placeholder="Ej.: examen parcial, llevar documentación…" className={`${inputCls} resize-y`} /></Field>
        <label className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5"><input type="checkbox" checked={block.pinned}
          onChange={(e) => setPinned([block.id], e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span><span className="block text-[13px]">Fijo en este horario</span><span className="block text-[11px] text-muted">No se mueve por arrastre, cadena ni Organizar.</span></span></label>
        <Field label="Estado"><Segmented value={block.status} onChange={(v) => setStatus(block.id, v as BlockStatus)} options={[
          { id: 'planned', label: 'Pendiente' }, { id: 'done', label: 'Completado' }, { id: 'skipped', label: 'Omitido' },
        ]} /></Field>
      </div>}

      {tab === 'repeat' && <div className="space-y-4 p-5">
        <Field label="Frecuencia" hint={isBreak ? 'La repetición pertenece a esta pausa de la agenda.' : 'La repetición pertenece a este evento, no a la tarea de la lista.'}><Segmented value={repeat} onChange={(v) => setRule(v as RepeatMode)} options={[
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
          <p className="mt-1 text-[11px] text-muted">{isBreak ? 'Comentario, duración y hora pueden propagarse.' : 'Título, ícono, comentario, color, duración y hora pueden propagarse.'}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><Btn onClick={() => applyBlockToSeries(block.id, 'future')}>Aplicar desde hoy</Btn><Btn onClick={() => applyBlockToSeries(block.id, 'all')}>Aplicar a todas</Btn></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><Btn variant="danger" onClick={() => setConfirm('future')}>Borrar desde hoy</Btn><Btn variant="danger" onClick={() => setConfirm('all')}>Borrar toda la serie</Btn></div></div>}
      </div>}
    </Modal>
    <ConfirmModal open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => { if (!block.seriesId) return; confirm === 'all' ? removeSeries(block.seriesId) : removeSeriesFrom(block.seriesId, block.startsAt); onClose(); }}
      title={confirm === 'all' ? 'Eliminar toda la serie' : 'Eliminar desde esta fecha'} message={confirm === 'all' ? `Se borrarán todas las ocurrencias de “${block.title}”.` : `Se borrará “${block.title}” desde esta ocurrencia en adelante.`}
      detail={isBreak ? 'Las pausas eliminadas no podrán recuperarse.' : 'La tarea plantilla seguirá disponible en su clasificación.'} />
  </>;
}
