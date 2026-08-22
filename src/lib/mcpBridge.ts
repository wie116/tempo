import type { Block, List, Task } from '../types';

export type AiAction =
  | { type: 'create-task'; title: string; plannedDate?: string | null; estimatedMin?: number | null }
  | { type: 'schedule-task'; taskId: string; date: string; startMin: number; durationMin?: number };

export interface AiPlan { explanation?: string; actions: AiAction[]; }

export function buildMcpContext(lists: List[], tasks: Task[], blocks: Record<string, Block>) {
  return {
    schema: 'tempo.mcp-context.v1',
    generatedAt: new Date().toISOString(),
    instructions: 'Proponé cambios; no asumas que se aplicaron. Respondé con tempo.ai-plan.v1.',
    lists: lists.map(({ id, name, scope }) => ({ id, name, scope })),
    tasks: tasks.filter((task) => !task.archived).map(({ id, listId, title, estimatedMin, priority, plannedDate, dueDate, recurring }) => ({ id, listId, title, estimatedMin, priority, plannedDate, dueDate, recurring })),
    blocks: Object.values(blocks).map(({ id, taskId, title, startsAt, durationMin, status, pinned, source }) => ({ id, taskId, title, startsAt, durationMin, status, pinned, source: source ?? 'tempo' })),
    responseExample: { schema: 'tempo.ai-plan.v1', explanation: 'Resumen breve', actions: [{ type: 'create-task', title: 'Preparar informe', plannedDate: '2026-08-24', estimatedMin: 40 }] },
  };
}

export function parseAiPlan(raw: string): AiPlan {
  const parsed = JSON.parse(raw);
  if (parsed?.schema !== 'tempo.ai-plan.v1' || !Array.isArray(parsed.actions)) throw new Error('El JSON debe usar schema tempo.ai-plan.v1 y contener actions.');
  const actions: AiAction[] = parsed.actions.map((action: Record<string, unknown>) => {
    if (action.type === 'create-task' && typeof action.title === 'string' && action.title.trim()) return { type: 'create-task', title: action.title.trim(), plannedDate: typeof action.plannedDate === 'string' ? action.plannedDate : null, estimatedMin: typeof action.estimatedMin === 'number' ? action.estimatedMin : null };
    if (action.type === 'schedule-task' && typeof action.taskId === 'string' && typeof action.date === 'string' && typeof action.startMin === 'number') return { type: 'schedule-task', taskId: action.taskId, date: action.date, startMin: action.startMin, durationMin: typeof action.durationMin === 'number' ? action.durationMin : undefined };
    throw new Error('El plan contiene una acción desconocida o incompleta.');
  });
  return { explanation: typeof parsed.explanation === 'string' ? parsed.explanation : undefined, actions };
}
