// Gera o app.zip para publicação SEM segredos nem arquivos gerados.
//
// Fica de fora: node_modules, dist, .env de qualquer pasta (só os .env.example vão),
// __pycache__, .claude, zips antigos e logs. Uso: npm run empacotar
import { zipSync } from 'fflate';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const SAIDA = 'app.zip';

const PASTAS_FORA = new Set(['node_modules', 'dist', 'build', 'coverage', '__pycache__', '.claude', '.git', '.vercel']);
const arquivoFora = (nome) =>
  (nome.startsWith('.env') && !nome.endsWith('.example')) ||
  /\.(zip|log|pyc)$/i.test(nome) ||
  nome === '.DS_Store';

const arquivos = {};
const visitar = (dir) => {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (!PASTAS_FORA.has(nome)) visitar(caminho);
    } else if (!arquivoFora(nome)) {
      arquivos[relative(root, caminho).split(sep).join('/')] = readFileSync(caminho);
    }
  }
};
visitar(root);

// Trava de segurança: nunca empacota um arquivo que pareça conter a chave secreta.
for (const [nome, bytes] of Object.entries(arquivos)) {
  const texto = /\.(ts|tsx|js|mjs|py|sql|json|md|txt|ps1|example)$/i.test(nome) ? bytes.toString('utf8') : '';
  if (/SERVICE_ROLE_KEY[ \t]*=[ \t]*[^\s#]/.test(texto) || /"role"\s*:\s*"service_role"/.test(texto)) {
    console.error(`Abortado: "${nome}" parece conter a chave service_role.`);
    process.exit(1);
  }
}

writeFileSync(join(root, SAIDA), zipSync(arquivos, { level: 9 }));
console.log(`${SAIDA}: ${Object.keys(arquivos).length} arquivos.`);
