import { addDays } from 'date-fns';
import type { TaskPriority } from '../types';
import { dateKey } from './time';

export interface TaskDraft {
  title: string;
  estimatedMin: number | null;
  plannedDate: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  classification: string | null;
}

const parseShortDate = (value: string, now: Date): string | null => {
  const [day, month, year] = value.split('/').map(Number);
  if (!day || !month) return null;
  const date = new Date(year || now.getFullYear(), month - 1, day);
  return Number.isNaN(date.getTime()) ? null : dateKey(date);
};

/** Captura natural, determinista y privada. Deja preparado el mismo contrato
 * que más adelante puede completar un conector MCP/IA. */
export function parseTaskDraft(raw: string, now = new Date()): TaskDraft | null {
  let text = raw.trim();
  if (!text) return null;

  const duration = text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(m|min|h|hs|hora(?:s)?)\b/i);
  const amount = duration ? Number(duration[1].replace(',', '.')) : 0;
  const estimatedMin = duration
    ? Math.max(10, Math.round((/^(h|hs|hora)/i.test(duration[2]) ? amount * 60 : amount) / 10) * 10)
    : null;

  let plannedDate: string | null = null;
  if (/\bmañana\b/i.test(text)) plannedDate = dateKey(addDays(now, 1));
  else if (/\bhoy\b/i.test(text)) plannedDate = dateKey(now);
  const plannedMatch = text.match(/\b(?:para|el)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i);
  if (plannedMatch) plannedDate = parseShortDate(plannedMatch[1], now);

  const dueMatch = text.match(/\b(?:vence|vencimiento)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i);
  const dueDate = dueMatch ? parseShortDate(dueMatch[1], now) : null;

  let priority: TaskPriority = 'normal';
  if (/\b(?:urgente|prioridad\s+urgente)\b|!!/i.test(text)) priority = 'urgent';
  else if (/\bprioridad\s+alta\b|(?:^|\s)!\s*$/i.test(text)) priority = 'high';
  else if (/\bprioridad\s+baja\b/i.test(text)) priority = 'low';

  const tag = text.match(/(?:^|\s)#([^#]+?)(?=\s(?:\d|hoy|mañana|prioridad|vence|$)|$)/i);
  const classification = tag?.[1]?.trim() ?? null;

  text = text
    .replace(/(?:^|\s)\d+(?:[.,]\d+)?\s*(?:m|min|h|hs|hora(?:s)?)\b/i, ' ')
    .replace(/\b(?:para|el)\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i, ' ')
    .replace(/\b(?:vence|vencimiento)\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i, ' ')
    .replace(/\b(?:hoy|mañana)\b/i, ' ')
    .replace(/\b(?:urgente|prioridad\s+(?:urgente|alta|baja))\b|!!|(?:^|\s)!\s*$/i, ' ')
    .replace(/(?:^|\s)#[^#]+?(?=\s(?:\d|$)|$)/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { title: text || raw.trim(), estimatedMin, plannedDate, dueDate, priority, classification };
}
