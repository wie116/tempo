import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const files = [
  'supabase/functions/_shared/google.ts',
  'supabase/functions/google-calendar-auth-url/index.ts',
  'supabase/functions/google-calendar-callback/index.ts',
  'supabase/functions/google-calendar-calendars/index.ts',
  'supabase/functions/google-calendar-selection/index.ts',
  'supabase/functions/google-calendar-sync/index.ts',
];

for (const file of files) {
  await transform(await readFile(file, 'utf8'), { loader: 'ts', target: 'es2022', sourcefile: file });
}

console.log(`Edge Functions: ${files.length} archivos analizados correctamente.`);
