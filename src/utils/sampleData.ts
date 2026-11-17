import { escapeHtml } from './security';

export interface EmailVariable {
  key: 'nome' | 'email' | 'var1' | 'var2' | 'var3';
  tag: string;
  label: string;
  description: string;
  example: string;
}

/**
 * Única fonte de verdade das variáveis do disparador.
 * Usada pela barra do editor HTML, pelo painel de Ajuda e pela prévia com dados de exemplo.
 */
export const EMAIL_VARIABLES: EmailVariable[] = [
  { key: 'nome', tag: '{{nome}}', label: 'Nome', description: 'Nome do destinatário', example: 'Maria Silva Santos' },
  { key: 'email', tag: '{{email}}', label: 'E-mail', description: 'E-mail do destinatário', example: 'maria.santos@email.com' },
  { key: 'var1', tag: '{{var1}}', label: 'Var1', description: 'Campo livre 1 (link do boleto, CPF, curso...)', example: 'https://exemplo.com.br/boleto/12345' },
  { key: 'var2', tag: '{{var2}}', label: 'Var2', description: 'Campo livre 2 (valor, vencimento...)', example: 'R$ 299,00' },
  { key: 'var3', tag: '{{var3}}', label: 'Var3', description: 'Campo livre 3 (unidade, código...)', example: 'Unidade Exemplo' },
];

const VARIABLE_PATTERN = /\{\{\s*(nome|email|var1|var2|var3)\s*\}\}/gi;

const EXAMPLES: Record<string, string> = Object.fromEntries(
  EMAIL_VARIABLES.map((variable) => [variable.key, variable.example])
);

/**
 * Troca {{nome}}, {{email}}, {{var1..3}} por valores de exemplo.
 * Por padrão escapa o valor para uso seguro dentro de HTML (texto e atributos).
 * Variáveis desconhecidas, como {{empresa}}, ficam como estão.
 */
export function applySampleVariables(text: string, options: { escape?: boolean } = {}): string {
  const shouldEscape = options.escape !== false;
  return String(text ?? '').replace(VARIABLE_PATTERN, (_match, key: string) => {
    const value = EXAMPLES[key.toLowerCase()] ?? '';
    return shouldEscape ? escapeHtml(value) : value;
  });
}

const ANY_VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

/**
 * Lista as variáveis {{...}} que o disparador não reconhece (por exemplo {{empresa}}).
 * Elas chegariam literalmente ao destinatário.
 */
export function findUnknownVariables(text: string): string[] {
  const known = new Set(EMAIL_VARIABLES.map((variable) => variable.key as string));
  const unknown = new Set<string>();
  for (const match of String(text ?? '').matchAll(ANY_VARIABLE_PATTERN)) {
    if (!known.has(match[1].toLowerCase())) unknown.add(`{{${match[1]}}}`);
  }
  return Array.from(unknown);
}
