import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const targets = [
  resolve(root, 'src/lib/database.types.ts'),
  resolve(root, 'supabase/functions/_shared/database.types.ts'),
];
const local = process.argv.includes('--local');
const check = process.argv.includes('--check');
const executable = process.execPath;
const cliEntry = resolve(root, 'node_modules/supabase/dist/supabase.js');

const parseEnv = (raw) => Object.fromEntries(raw
  .split(/\r?\n/)
  .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
  .filter(Boolean)
  .map((match) => {
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return [match[1], value];
  }));

const env = { ...process.env };
let localDbUrl = '';
if (local) {
  const statusResult = spawnSync(executable, [cliEntry, 'status', '--output', 'json'], {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (statusResult.error) throw statusResult.error;
  if (statusResult.status !== 0) {
    throw new Error(statusResult.stderr.trim() || statusResult.stdout.trim() || 'Supabase local no está iniciado.');
  }
  const status = JSON.parse(statusResult.stdout);
  localDbUrl = status.DB_URL;
  if (!localDbUrl) throw new Error('Supabase status no informó DB_URL para la base local.');
}
if (!local) {
  const fileEnv = await readFile(resolve(root, '.env.local'), 'utf8').then(parseEnv).catch(() => ({}));
  env.SUPABASE_ACCESS_TOKEN ||= fileEnv.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF || fileEnv.SUPABASE_PROJECT_REF || (() => {
    const url = env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
    try { return url ? new URL(url).hostname.split('.')[0] : ''; } catch { return ''; }
  })();
  if (!env.SUPABASE_ACCESS_TOKEN || !projectRef) {
    throw new Error('Faltan SUPABASE_ACCESS_TOKEN o SUPABASE_PROJECT_REF para generar tipos remotos.');
  }
  env.SUPABASE_PROJECT_REF = projectRef;
}

const args = [
  cliEntry,
  'gen',
  'types',
  '--schema',
  'public',
  local ? '--db-url' : '--project-id',
  local ? localDbUrl : env.SUPABASE_PROJECT_REF,
];
const result = spawnSync(executable, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(result.stderr.trim() || result.stdout.trim() || 'Supabase no pudo generar los tipos.');
}

const stdout = result.stdout.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
const terminalMarker = '} as const';
const terminalIndex = stdout.lastIndexOf(terminalMarker);
if (!stdout.includes('export type Database') || terminalIndex < 0) {
  throw new Error('La salida no contiene un contrato Database válido.');
}
const generated = `${stdout.slice(0, terminalIndex + terminalMarker.length).trim()}\n`;

if (check) {
  const stale = [];
  for (const target of targets) {
    const current = await readFile(target, 'utf8').then((value) => value.replace(/\r\n/g, '\n')).catch(() => '');
    if (current !== generated) stale.push(target.slice(root.length + 1));
  }
  if (stale.length) throw new Error(`Tipos desactualizados: ${stale.join(', ')}. Ejecutá npm run db:types:local.`);
  console.log('Supabase types: contrato local y archivos generados coinciden.');
} else {
  await Promise.all(targets.map((target) => writeFile(target, generated, 'utf8')));
  console.log(`Supabase types: ${targets.length} contratos actualizados desde ${local ? 'la base local' : 'el proyecto remoto'}.`);
}
