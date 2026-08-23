import test from 'node:test';
import assert from 'node:assert/strict';
import type { AutoplanConfig, Block, List, Task } from '../src/types';
import { candidatesFromTasks } from '../src/lib/autoplan';
import { applyBlockPatches, insertionAroundTarget, layoutBlockLanes, normalizeBlock, overlaps, packDay } from '../src/lib/planning';
import { expandSeries } from '../src/lib/repeat';
import { findAvailableStart } from '../src/lib/conflicts';
import { parseTaskDraft } from '../src/lib/taskCapture';
import { parseAiPlan } from '../src/lib/mcpBridge';
import { fetchAllPages } from '../src/lib/pagination';

const block = (id: string, startsAt: string, durationMin = 30, pinned = false): Block => ({
  id, taskId: null, title: id, color: '#123456', startsAt, durationMin,
  kind: 'task', status: 'planned', closedAt: null, pinned, seriesId: null, notes: '',
});

test('normaliza datos antiguos y la grilla de diez minutos', () => {
  const result = normalizeBlock(block('a', '2026-08-22T09:07', 17));
  assert.equal(result.startsAt, '2026-08-22T09:10');
  assert.equal(result.durationMin, 20);
  assert.equal(result.source, 'tempo');
  assert.equal(result.external, null);
  assert.equal(result.syncStatus, 'local');
});

test('el bloque movido conserva prioridad y desplaza al anterior', () => {
  const blocks = {
    old: block('old', '2026-08-22T09:00'),
    moved: block('moved', '2026-08-22T09:00'),
  };
  const result = packDay(blocks, '2026-08-22', ['moved'], 23 * 60);
  assert.equal(result.moved.startsAt, '2026-08-22T09:00');
  assert.equal(result.old.startsAt, '2026-08-22T09:30');
});

test('un bloque fijo manda sobre el bloque movido', () => {
  const blocks = {
    fixed: block('fixed', '2026-08-22T09:30', 30, true),
    moved: block('moved', '2026-08-22T09:30'),
  };
  const result = packDay(blocks, '2026-08-22', ['moved'], 23 * 60);
  assert.equal(result.fixed.startsAt, '2026-08-22T09:30');
  assert.equal(result.moved.startsAt, '2026-08-22T10:00');
});

test('un evento externo de solo lectura actúa como obstáculo y no acepta parches', () => {
  const external: Block = {
    ...block('google', '2026-08-22T09:00'),
    source: 'google-calendar',
    syncStatus: 'synced',
    external: {
      provider: 'google-calendar', accountId: 'account', calendarId: 'primary',
      eventId: 'event', etag: 'v1', updatedAt: null, readOnly: true,
    },
  };
  const moved = block('moved', '2026-08-22T09:00');
  const packed = packDay({ google: external, moved }, '2026-08-22', ['moved'], 23 * 60);
  assert.equal(packed.google.startsAt, '2026-08-22T09:00');
  assert.equal(packed.moved.startsAt, '2026-08-22T09:30');
  const patched = applyBlockPatches(packed, [
    { id: 'google', patch: { startsAt: '2026-08-22T12:00' } },
  ], 23 * 60);
  assert.equal(patched.google.startsAt, '2026-08-22T09:00');
});

test('al final del día busca un hueco anterior en vez de volver a superponer', () => {
  const blocks = {
    fixed: block('fixed', '2026-08-22T22:30', 30, true),
    moved: block('moved', '2026-08-22T22:30'),
  };
  const result = packDay(blocks, '2026-08-22', ['moved'], 23 * 60);
  assert.equal(result.fixed.startsAt, '2026-08-22T22:30');
  assert.equal(result.moved.startsAt, '2026-08-22T22:00');
});

test('la agenda de día completo conserva bloques posteriores a la jornada habitual', () => {
  const result = packDay({ late: block('late', '2026-08-22T23:30', 30) }, '2026-08-22', ['late'], 24 * 60);
  assert.equal(result.late.startsAt, '2026-08-22T23:30');
  assert.equal(result.late.durationMin, 30);
});

test('una operación múltiple se aplica de forma atómica y sin solaparse', () => {
  const blocks = {
    a: block('a', '2026-08-22T09:00'),
    b: block('b', '2026-08-22T10:00'),
  };
  const result = applyBlockPatches(blocks, [
    { id: 'a', patch: { startsAt: '2026-08-22T10:00' } },
    { id: 'b', patch: { startsAt: '2026-08-22T10:00' } },
  ], 23 * 60);
  const a = new Date(result.a.startsAt).getHours() * 60 + new Date(result.a.startsAt).getMinutes();
  const b = new Date(result.b.startsAt).getHours() * 60 + new Date(result.b.startsAt).getMinutes();
  assert.equal(overlaps(a, result.a.durationMin, b, result.b.durationMin), false);
  assert.equal(result.a.startsAt, '2026-08-22T10:00');
  assert.equal(result.b.startsAt, '2026-08-22T10:30');
});

test('las operaciones múltiples no mueven bloques fijados', () => {
  const blocks = { fixed: block('fixed', '2026-08-22T09:00', 30, true) };
  const result = applyBlockPatches(blocks, [
    { id: 'fixed', patch: { startsAt: '2026-08-22T12:00' } },
  ], 23 * 60);
  assert.equal(result.fixed.startsAt, '2026-08-22T09:00');
});

test('los eventos externos superpuestos reciben carriles visuales sin cambiar de hora', () => {
  const a = block('a', '2026-08-22T09:00', 60);
  const b = block('b', '2026-08-22T09:30', 30);
  const c = block('c', '2026-08-22T10:00', 30);
  const lanes = layoutBlockLanes([a, b, c]);
  assert.deepEqual(lanes.a, { lane: 0, laneCount: 2 });
  assert.deepEqual(lanes.b, { lane: 1, laneCount: 2 });
  assert.deepEqual(lanes.c, { lane: 0, laneCount: 1 });
});

test('las rutinas mensuales y anuales expanden una serie desde la fecha ancla', () => {
  const monthly = expandSeries(new Date(2026, 0, 15), 'monthly', '2026-04-30');
  assert.deepEqual(monthly.map((date) => [date.getFullYear(), date.getMonth(), date.getDate()]), [
    [2026, 0, 15], [2026, 1, 15], [2026, 2, 15], [2026, 3, 15],
  ]);
  const yearly = expandSeries(new Date(2026, 7, 22), 'yearly', '2028-08-22');
  assert.deepEqual(yearly.map((date) => date.getFullYear()), [2026, 2027, 2028]);
});

test('un conflicto recurrente encuentra el próximo hueco sin mover lo existente', () => {
  const date = new Date(2026, 7, 22);
  const existing = [
    block('occupied', '2026-08-22T09:00', 30),
    block('later', '2026-08-22T10:00', 30),
  ];
  assert.equal(findAvailableStart(date, 9 * 60, 30, existing, 6 * 60, 23 * 60), 9 * 60 + 30);
  assert.equal(existing[0].startsAt, '2026-08-22T09:00');
});

test('la mitad de un bloque decide si la inserción va antes o después', () => {
  assert.deepEqual(insertionAroundTarget(9 * 60 + 10, 9 * 60, 60, 30), {
    position: 'before', startMin: 8 * 60 + 30,
  });
  assert.deepEqual(insertionAroundTarget(9 * 60 + 40, 9 * 60, 60, 30), {
    position: 'after', startMin: 10 * 60,
  });
});

test('la captura natural interpreta fecha futura, duración, prioridad y clasificación', () => {
  const parsed = parseTaskDraft('Preparar informe mañana 45m prioridad alta #Trabajo', new Date(2026, 7, 22));
  assert.deepEqual(parsed, {
    title: 'Preparar informe', estimatedMin: 50, plannedDate: '2026-08-23', dueDate: null,
    priority: 'high', classification: 'Trabajo',
  });
});

test('la captura natural separa el día previsto de la fecha límite', () => {
  const parsed = parseTaskDraft('Pagar matrícula para 25/8 vence 30/8 urgente', new Date(2026, 7, 22));
  assert.equal(parsed?.plannedDate, '2026-08-25');
  assert.equal(parsed?.dueDate, '2026-08-30');
  assert.equal(parsed?.priority, 'urgent');
  assert.equal(parsed?.title, 'Pagar matrícula');
});

test('el organizador prioriza urgencia y luego fecha límite', () => {
  const list: List = { id: 'l', name: 'Trabajo', color: '#123456', order: 0, collapsed: false, scope: 'todo' };
  const task = (id: string, priority: Task['priority'], dueDate: string | null, order: number): Task => ({
    id, listId: list.id, title: id, estimatedMin: 30, color: null, recurring: false,
    repeat: 'none', repeatUntil: null, repeatWeekdays: null, priority, plannedDate: null,
    dueDate, inbox: false, archived: false, notes: '', order,
  });
  const cfg: AutoplanConfig = {
    source: 'pending', order: 'list', from: 'dayStart', customFromMin: 540, untilMin: 1200,
    defaultMin: 30, gapMin: 0, listIds: null, includeRecurring: true, reassign: 'none', reassignMin: 30,
  };
  const result = candidatesFromTasks([
    task('normal', 'normal', '2026-08-23', 0),
    task('alta-tarde', 'high', '2026-08-30', 1),
    task('alta-pronto', 'high', '2026-08-24', 2),
    task('urgente', 'urgent', null, 3),
  ], [list], new Set(), cfg, '2026-08-22');
  assert.deepEqual(result.map((item) => item.taskId), ['urgente', 'alta-pronto', 'alta-tarde', 'normal']);
});

test('el puente MCP acepta únicamente planes versionados y acciones conocidas', () => {
  const plan = parseAiPlan(JSON.stringify({
    schema: 'tempo.ai-plan.v1', explanation: 'Preparar mañana',
    actions: [{ type: 'create-task', title: 'Informe', plannedDate: '2026-08-23', estimatedMin: 40 }],
  }));
  assert.equal(plan.actions.length, 1);
  assert.deepEqual(plan.actions[0], { type: 'create-task', title: 'Informe', plannedDate: '2026-08-23', estimatedMin: 40 });
  assert.throws(() => parseAiPlan(JSON.stringify({ schema: 'otro', actions: [] })));
  assert.throws(() => parseAiPlan(JSON.stringify({ schema: 'tempo.ai-plan.v1', actions: [{ type: 'delete-everything' }] })));
});

test('la sincronización reúne más de mil filas mediante páginas inclusivas', async () => {
  const source = Array.from({ length: 1118 }, (_, index) => ({ id: index }));
  const ranges: Array<[number, number]> = [];
  const result = await fetchAllPages(async (from, to) => {
    ranges.push([from, to]);
    return source.slice(from, to + 1);
  }, 500);

  assert.equal(result.length, 1118);
  assert.deepEqual(result.map((row) => row.id), source.map((row) => row.id));
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
});
