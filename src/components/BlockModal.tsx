import { useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore } from '../store';
import { PALETTE } from '../lib/themes';
import { clockLabel, dateKey, durationLabel, fmt, isoFor, minutesOf, snap } from '../lib/time';
import { UNTIL_PRESETS, WEEKDAY_LABELS, countSeries } from '../lib/repeat';
import { Btn, ColorPicker, ConfirmModal, Field, Modal, NumField, Segmented, Tabs, TimeField, inputCls } from './Modal';
import type { BlockStatus, RepeatMode } from '../types';
import { isReadOnlyBlock } from '../lib/planning';
import { IconPicker } from './EventIcon';
import { pick } from '../lib/i18n';

export function BlockModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const language = useStore((s) => s.settings.language);
  const block = useStore((s) => (id ? s.blocks[id] ?? null : null));
  const task = useStore((s) => (block?.taskId ? s.tasks.find((t) => t.id === block.taskId) ?? null : null));
  const groupName = useStore((s) => {
    if (block?.source === 'google-calendar') return 'Google Calendar';
    if (block?.kind === 'break') return pick(s.settings.language, 'Pausa', 'Break');
    const sourceTask = block?.taskId ? s.tasks.find((item) => item.id === block.taskId) : null;
    return sourceTask ? s.lists.find((list) => list.id === sourceTask.listId)?.name ?? pick(s.settings.language, 'Sin clasificar', 'Unsorted') : pick(s.settings.language, 'Sin clasificar', 'Unsorted');
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

  if (readOnly) return <Modal open onClose={onClose} title={block.title || pick(language, 'Evento de Google Calendar', 'Google Calendar event')}
    subtitle={`${fmt(day, language === 'en' ? 'EEEE, LLLL d' : "EEEE d 'de' LLLL")} · ${clockLabel(start)}–${clockLabel(start + block.durationMin)}`} size="sm"
    footer={<Btn variant="primary" onClick={onClose}>{pick(language, 'Listo', 'Done')}</Btn>}>
    <div className="space-y-3 p-5"><div className="rounded-lg border border-line bg-surface-2 p-3">
      <p className="text-[12.5px] font-semibold">{pick(language, 'Evento externo de solo lectura', 'Read-only external event')}</p>
      <p className="mt-1 text-[11.5px] text-muted">{pick(language, 'Se administra desde Google Calendar y Tempo lo respeta como tiempo ocupado.', 'It is managed in Google Calendar, and Tempo treats it as busy time.')}</p>
    </div>{block.notes && <p className="whitespace-pre-wrap text-[13px]">{block.notes}</p>}</div>
  </Modal>;

  const repeat = block.repeat ?? 'none';
  const weekdays = block.repeatWeekdays ?? null;
  const until = block.repeatUntil ?? null;
  const setRule = (next: RepeatMode, nextUntil = until, nextWeekdays = weekdays) =>
    setBlockRecurrence(block.id, next, nextUntil, nextWeekdays);

  return <>
    <Modal open onClose={onClose} title={isBreak ? pick(language, 'Pausa', 'Break') : block.title || pick(language, 'Bloque', 'Block')}
      subtitle={`${fmt(day, language === 'en' ? 'EEEE, LLLL d' : "EEEE d 'de' LLLL")} · ${clockLabel(start)}–${clockLabel(start + block.durationMin)} · ${groupName}`} size="sm"
      footer={<><Btn variant="danger" onClick={() => { removeBlock(block.id); onClose(); }}>{pick(language, 'Eliminar esta', 'Delete this')}</Btn>
        <Btn onClick={() => { duplicateBlock(block.id); onClose(); }}>{pick(language, 'Duplicar', 'Duplicate')}</Btn><Btn variant="primary" onClick={onClose}>{pick(language, 'Listo', 'Done')}</Btn></>}>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'general' as const, label: 'General' }, { id: 'details' as const, label: pick(language, 'Comentario', 'Notes') },
        { id: 'repeat' as const, label: block.seriesId ? pick(language, 'Serie', 'Series') : pick(language, 'Repetir', 'Repeat') },
      ]} />

      {tab === 'general' && <div className="space-y-4 p-5">
        {!isBreak && <Field label={pick(language, 'Título', 'Title')} hint={isLinkedAdhoc ? pick(language, 'Este título también se actualiza en el To-Do vinculado.', 'This title also updates the linked To-Do.') : task ? pick(language, `Esta ocurrencia nació de “${task.title}”; los cambios quedan en la agenda.`, `This occurrence came from “${task.title}”; changes stay in the schedule.`) : undefined}>
          <input autoFocus value={block.title} onChange={(e) => updateBlock(block.id, { title: e.target.value })} className={inputCls} />
        </Field>}
        {isLinkedAdhoc && task && <Field label={pick(language, 'Clasificación del To-Do', 'To-Do classification')} hint={pick(language, 'El bloque y su tarea seguirán vinculados.', 'The block and its task will remain linked.')}>
          <select value={task.listId} onChange={(e) => updateTask(task.id, { listId: e.target.value, inbox: false })} className={inputCls}>
            {todoLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
        </Field>}
        <div className="grid grid-cols-2 gap-3"><Field label={pick(language, 'Empieza', 'Starts')}><TimeField value={start} onCommit={(value) => updateBlock(block.id, { startsAt: isoFor(day, value) })} max={24 * 60 - block.durationMin} /></Field>
          <Field label={pick(language, 'Dura', 'Duration')}><NumField value={block.durationMin} onCommit={(v) => v && updateBlock(block.id, { durationMin: v })} suffix="min" /></Field></div>
        <div className="flex flex-wrap gap-1.5">{[10, 20, 30, 45, 60, 90, 120].map((m) => <button key={m} onClick={() => updateBlock(block.id, { durationMin: snap(m) })}
          className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-muted hover:text-ink">{durationLabel(snap(m))}</button>)}</div>
        {!isBreak && <Field label={pick(language, 'Color', 'Color')}><ColorPicker value={block.color} onChange={(c) => c && updateBlock(block.id, { color: c })} palette={PALETTE} /></Field>}
      </div>}

      {tab === 'details' && <div className="space-y-4 p-5">
        {!isBreak && <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{pick(language, 'Ícono de esta ocurrencia', 'Icon for this occurrence')}</span>
          <IconPicker value={block.icon} onChange={(icon) => updateBlock(block.id, { icon })} />
          <span className="mt-1 block text-[11px] leading-snug text-muted">{pick(language, 'Clasificá visualmente este evento sin modificar otras ocurrencias.', 'Visually classify this event without changing other occurrences.')}</span>
        </div>}
        <Field label={pick(language, 'Comentario de esta ocurrencia', 'Notes for this occurrence')}><textarea rows={4} value={block.notes} onChange={(e) => updateBlock(block.id, { notes: e.target.value })}
          placeholder={pick(language, 'Ej.: examen parcial, llevar documentación…', 'E.g. midterm exam, bring documents…')} className={`${inputCls} resize-y`} /></Field>
        <label className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5"><input type="checkbox" checked={block.pinned}
          onChange={(e) => setPinned([block.id], e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span><span className="block text-[13px]">{pick(language, 'Fijo en este horario', 'Pinned at this time')}</span><span className="block text-[11px] text-muted">{pick(language, 'No se mueve por arrastre, cadena ni Organizar.', 'It will not move by dragging, chaining, or Arrange.')}</span></span></label>
        <Field label={pick(language, 'Estado', 'Status')}><Segmented value={block.status} onChange={(v) => setStatus(block.id, v as BlockStatus)} options={[
          { id: 'planned', label: pick(language, 'Pendiente', 'Pending') }, { id: 'done', label: pick(language, 'Completado', 'Completed') }, { id: 'skipped', label: pick(language, 'Omitido', 'Skipped') },
        ]} /></Field>
      </div>}

      {tab === 'repeat' && <div className="space-y-4 p-5">
        <Field label={pick(language, 'Frecuencia', 'Frequency')} hint={isBreak ? pick(language, 'La repetición pertenece a esta pausa de la agenda.', 'The repeat rule belongs to this schedule break.') : pick(language, 'La repetición pertenece a este evento, no a la tarea de la lista.', 'The repeat rule belongs to this event, not the list task.')}><Segmented value={repeat} onChange={(v) => setRule(v as RepeatMode)} options={[
          { id: 'none', label: pick(language, 'No', 'None') }, { id: 'daily', label: pick(language, 'Diaria', 'Daily') }, { id: 'weekly', label: pick(language, 'Semanal', 'Weekly') }, { id: 'monthly', label: pick(language, 'Mensual', 'Monthly') }, { id: 'yearly', label: pick(language, 'Anual', 'Yearly') },
        ]} /></Field>
        {repeat === 'weekly' && <Field label={pick(language, 'Días de la semana', 'Days of the week')}><div className="flex flex-wrap gap-1.5">{WEEKDAY_LABELS.map((label, i) => {
          const on = (weekdays ?? []).includes(i); return <button key={i} onClick={() => { const next = on ? (weekdays ?? []).filter((x) => x !== i) : [...(weekdays ?? []), i].sort(); setRule(repeat, until, next.length ? next : null); }}
            className="rounded-md border px-2.5 py-1.5 text-[12px]" style={{ borderColor: on ? 'var(--accent)' : 'var(--border)', background: on ? 'var(--accent)' : undefined, color: on ? 'var(--accent-fg)' : 'var(--muted)' }}>{language === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i] : label}</button>;
        })}</div></Field>}
        {repeat !== 'none' && <Field label={pick(language, 'Hasta cuándo', 'Until')}><div className="flex flex-wrap gap-1.5">{UNTIL_PRESETS.map((p) => <button key={p.id} onClick={() => setRule(repeat, dateKey(p.add(day)), weekdays)}
          className="rounded-md border border-line px-2.5 py-1.5 text-[12px] text-muted">{language === 'en' ? ({ '1m': '1 month', '3m': '3 months', '1y': '1 year' } as Record<string, string>)[p.id] : p.label}</button>)}<button onClick={() => setRule(repeat, null, weekdays)} className="rounded-md border border-line px-2.5 py-1.5 text-[12px] text-muted">{pick(language, 'Siempre', 'Forever')}</button></div>
          <input type="date" value={until ?? ''} onChange={(e) => setRule(repeat, e.target.value || null, weekdays)} className={`${inputCls} mt-2 font-mono`} />
          <p className="mt-2 text-[11px] text-muted">{countSeries(day, repeat, until, weekdays)} {pick(language, 'ocurrencias previstas. Si existe un conflicto, Tempo busca el hueco libre más cercano.', 'planned occurrences. If there is a conflict, Tempo finds the nearest free gap.')}</p></Field>}
        {block.seriesId && <div className="rounded-xl border border-line bg-surface-2 p-3"><p className="text-[12px] font-semibold">{pick(language, 'Cambios de esta ocurrencia', 'Changes to this occurrence')}</p>
          <p className="mt-1 text-[11px] text-muted">{isBreak ? pick(language, 'Comentario, duración y hora pueden propagarse.', 'Notes, duration, and time can be propagated.') : pick(language, 'Título, ícono, comentario, color, duración y hora pueden propagarse.', 'Title, icon, notes, color, duration, and time can be propagated.')}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><Btn onClick={() => applyBlockToSeries(block.id, 'future')}>{pick(language, 'Aplicar desde hoy', 'Apply from today')}</Btn><Btn onClick={() => applyBlockToSeries(block.id, 'all')}>{pick(language, 'Aplicar a todas', 'Apply to all')}</Btn></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><Btn variant="danger" onClick={() => setConfirm('future')}>{pick(language, 'Borrar desde hoy', 'Delete from today')}</Btn><Btn variant="danger" onClick={() => setConfirm('all')}>{pick(language, 'Borrar toda la serie', 'Delete entire series')}</Btn></div></div>}
      </div>}
    </Modal>
    <ConfirmModal open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => { if (!block.seriesId) return; confirm === 'all' ? removeSeries(block.seriesId) : removeSeriesFrom(block.seriesId, block.startsAt); onClose(); }}
      title={confirm === 'all' ? pick(language, 'Eliminar toda la serie', 'Delete entire series') : pick(language, 'Eliminar desde esta fecha', 'Delete from this date')} message={confirm === 'all' ? pick(language, `Se borrarán todas las ocurrencias de “${block.title}”.`, `All occurrences of “${block.title}” will be deleted.`) : pick(language, `Se borrará “${block.title}” desde esta ocurrencia en adelante.`, `“${block.title}” will be deleted from this occurrence onward.`)}
      detail={isBreak ? pick(language, 'Las pausas eliminadas no podrán recuperarse.', 'Deleted breaks cannot be recovered.') : pick(language, 'La tarea plantilla seguirá disponible en su clasificación.', 'The template task will remain available in its classification.')} />
  </>;
}
