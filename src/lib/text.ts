/**
 * Texto sem acentos (e sem variações de compatibilidade, como espaço não separável),
 * para comparar nomes e cabeçalhos vindos de planilhas, PDFs e do banco.
 * Não muda caixa nem espaços: cada chamador decide isso.
 */
export const stripAccents = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
