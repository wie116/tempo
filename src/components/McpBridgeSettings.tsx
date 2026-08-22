import { useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore, useToasts } from '../store';
import { buildMcpContext, parseAiPlan, type AiPlan } from '../lib/mcpBridge';
import { Btn, inputCls } from './Modal';

export function McpBridgeSettings() {
  const [raw, setRaw] = useState('');
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const store = useStore();
  const copyContext = async () => {
    await navigator.clipboard.writeText(JSON.stringify(buildMcpContext(store.lists, store.tasks, store.blocks), null, 2));
    useToasts.getState().push({ title: 'Contexto MCP copiado', body: 'Podés pegarlo en una IA compatible.', kind: 'info', ttl: 2500 });
  };
  const preview = () => { try { setPlan(parseAiPlan(raw)); setError(null); } catch (e) { setPlan(null); setError(e instanceof Error ? e.message : 'Plan inválido'); } };
  const apply = () => {
    if (!plan) return;
    for (const action of plan.actions) {
      if (action.type === 'create-task') {
        const listId = store.ensureUnsortedList();
        store.addTask(listId, action.title, { plannedDate: action.plannedDate ?? null, estimatedMin: action.estimatedMin ?? null, inbox: true });
      } else {
        store.blockFromTask(action.taskId, parseISO(action.date), action.startMin, action.durationMin);
      }
    }
    useToasts.getState().push({ title: 'Plan de IA aplicado', body: `${plan.actions.length} acciones validadas.`, kind: 'info', ttl: 3000 });
    setRaw(''); setPlan(null);
  };
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[12.5px] font-medium">Puente IA / MCP</p><p className="text-[11px] leading-snug text-muted">Exporta contexto y acepta solamente un contrato de acciones validado. Nada se aplica sin vista previa.</p></div><Btn onClick={() => void copyContext()}>Copiar contexto</Btn></div>
    <textarea value={raw} onChange={(event) => { setRaw(event.target.value); setPlan(null); }} rows={4} placeholder='Pegá un plan con schema "tempo.ai-plan.v1"…' className={`${inputCls} resize-y font-mono text-[10.5px]`} />
    <div className="flex items-center justify-between gap-2"><p className="text-[10.5px] text-muted">Compatible con cualquier IA o servidor MCP capaz de devolver JSON.</p><Btn onClick={preview} disabled={!raw.trim()}>Revisar plan</Btn></div>
    {error && <p className="rounded-lg border px-2.5 py-2 text-[11px]" style={{ borderColor: 'var(--now)', color: 'var(--now)' }}>{error}</p>}
    {plan && <div className="rounded-xl border border-line bg-surface-2 p-3"><p className="text-[11.5px] font-semibold">Vista previa · {plan.actions.length} acciones</p>{plan.explanation && <p className="mt-1 text-[11px] text-muted">{plan.explanation}</p>}<ul className="my-2 space-y-1 text-[11px]">{plan.actions.map((action, index) => <li key={index}>• {action.type === 'create-task' ? `Crear “${action.title}”` : `Agendar ${action.taskId} el ${action.date}`}</li>)}</ul><Btn variant="primary" onClick={apply}>Aplicar acciones</Btn></div>}
  </div>;
}
