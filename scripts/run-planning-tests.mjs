import { build } from 'esbuild';

const result = await build({
  entryPoints: ['tests/planning.test.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  write: false,
  logLevel: 'silent',
});

const code = result.outputFiles[0].text;
await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
