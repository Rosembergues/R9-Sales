// Roda os testes automáticos (arquivos src/**/*.test.ts) com o executor nativo do Node.
//
// Cada teste é empacotado com o esbuild (que já vem instalado junto com o Vite),
// então não há dependência extra. Uso: npm test
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const root = process.cwd();
const findTests = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return findTests(path);
  return /\.test\.ts$/.test(name) ? [path] : [];
});

const tests = findTests(join(root, 'src'));
if (!tests.length) {
  console.log('Nenhum teste encontrado.');
  process.exit(0);
}

const outDir = mkdtempSync(join(tmpdir(), 'r9-tests-'));
try {
  const outputs = [];
  for (const file of tests) {
    const out = join(outDir, relative(root, file).replace(/[\\/]/g, '__').replace(/\.ts$/, '.mjs'));
    await build({
      entryPoints: [file],
      outfile: out,
      bundle: true,
      platform: 'node',
      format: 'esm',
      logLevel: 'error',
      // Variáveis do Vite não existem fora do navegador: usam o padrão do código.
      define: { 'import.meta.env': '{}' },
      // Bibliotecas que só fazem sentido no navegador ficam de fora.
      external: ['xlsx', 'canvas-confetti'],
    });
    outputs.push(out);
  }
  const result = spawnSync(process.execPath, ['--test', ...outputs], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
