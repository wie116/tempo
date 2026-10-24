import { useState } from 'react';
import { parseISO } from 'date-fns';
import { useStore, useToasts } from '../store';
import { buildMcpContext, parseAiPlan, type AiPlan } from '../lib/mcpBridge';
import { Btn, inputCls } from './Modal';
import { pick } from '../lib/i18n';

export function McpBridgeSettings() {
  const [raw, setRaw] = useState('');
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const store = useStore();
  const language = store.settings.language;
  const copyContext = async () => {
    await navigator.clipboard.writeText(JSON.stringify(buildMcpContext(store.lists, store.tasks, store.blocks, language), null, 2));
    useToasts.getState().push({ title: pick(language, 'Contexto MCP copiado', 'MCP context copied'), body: pick(language, 'Podés pegarlo en una IA compatible.', 'Paste it into a compatible AI.'), kind: 'info', ttl: 2500 });
  };
  const preview = () => { try { setPlan(parseAiPlan(raw, language)); setError(null); } catch (e) { setPlan(null); setError(e instanceof Error ? e.message : pick(language, 'Plan inválido', 'Invalid plan')); } };
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
    useToasts.getState().push({ title: pick(language, 'Plan de IA aplicado', 'AI plan applied'), body: `${plan.actions.length} ${pick(language, 'acciones validadas.', 'validated actions.')}`, kind: 'info', ttl: 3000 });
    setRaw(''); setPlan(null);
  };
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[12.5px] font-medium">{pick(language, 'Puente IA / MCP', 'AI / MCP bridge')}</p><p className="text-[11px] leading-snug text-muted">{pick(language, 'Exporta contexto y acepta solamente un contrato de acciones validado. Nada se aplica sin vista previa.', 'Exports context and accepts only a validated action contract. Nothing is applied without a preview.')}</p></div><Btn onClick={() => void copyContext()}>{pick(language, 'Copiar contexto', 'Copy context')}</Btn></div>
    <textarea value={raw} onChange={(event) => { setRaw(event.target.value); setPlan(null); }} rows={4} placeholder={pick(language, 'Pegá un plan con schema "tempo.ai-plan.v1"…', 'Paste a plan using the "tempo.ai-plan.v1" schema…')} className={`${inputCls} resize-y font-mono text-[10.5px]`} />
    <div className="flex items-center justify-between gap-2"><p className="text-[10.5px] text-muted">{pick(language, 'Compatible con cualquier IA o servidor MCP capaz de devolver JSON.', 'Compatible with any AI or MCP server that can return JSON.')}</p><Btn onClick={preview} disabled={!raw.trim()}>{pick(language, 'Revisar plan', 'Review plan')}</Btn></div>
    {error && <p className="rounded-lg border px-2.5 py-2 text-[11px]" style={{ borderColor: 'var(--now)', color: 'var(--now)' }}>{error}</p>}
    {plan && <div className="rounded-xl border border-line bg-surface-2 p-3"><p className="text-[11.5px] font-semibold">{pick(language, 'Vista previa', 'Preview')} · {plan.actions.length} {pick(language, 'acciones', 'actions')}</p>{plan.explanation && <p className="mt-1 text-[11px] text-muted">{plan.explanation}</p>}<ul className="my-2 space-y-1 text-[11px]">{plan.actions.map((action, index) => <li key={index}>• {action.type === 'create-task' ? `${pick(language, 'Crear', 'Create')} “${action.title}”` : `${pick(language, 'Agendar', 'Schedule')} ${action.taskId} ${pick(language, 'el', 'on')} ${action.date}`}</li>)}</ul><Btn variant="primary" onClick={apply}>{pick(language, 'Aplicar acciones', 'Apply actions')}</Btn></div>}
  </div>;
}
