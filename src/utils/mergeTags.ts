/*
 * Merge tags ("variáveis") written for other e-mail platforms. Imported templates
 * often carry them; the R9 sender only understands {{nome}}, {{email}} and
 * {{var1}}–{{var3}}, so anything else would reach the recipient literally.
 */

const NAME_KEYS = new Set([
  'fname', 'firstname', 'first_name', 'first-name', 'nome', 'primeiro_nome', 'primeironome', 'name', 'nome_completo', 'full_name', 'fullname',
]);
const EMAIL_KEYS = new Set(['email', 'e-mail', 'e_mail', 'emailaddr', 'email_address', 'emailaddress']);

function mapKey(rawKey: string): string | null {
  const key = rawKey.trim().toLowerCase();
  if (NAME_KEYS.has(key)) return '{{nome}}';
  if (EMAIL_KEYS.has(key)) return '{{email}}';
  return null;
}

const PATTERNS: RegExp[] = [
  /\*\|\s*([A-Za-z0-9_-]+)\s*\|\*/g, // Mailchimp: *|FNAME|*
  /%%\s*([A-Za-z0-9_-]+)\s*%%/g, // Salesforce Marketing Cloud: %%first_name%%
  /\{\{\s*(?:contact|lead|person|subscriber|customer|user)\.([A-Za-z0-9_-]+)\s*(?:\|[^}]*)?\}\}/gi, // Brevo, HubSpot, RD Station, Klaviyo
  /\{\{\s*([A-Za-z_][A-Za-z0-9_-]*)\s*(?:\|[^}]*)?\}\}/g, // Klaviyo {{ first_name }}, "{{ nome }}" with spaces or filters
  /\{contactfield=([A-Za-z0-9_-]+)[^}]*\}/gi, // Mautic
  /%([A-Z][A-Z0-9_]*)%/g, // ActiveCampaign: %FIRSTNAME% (upper case only)
];

/** Converts the name/e-mail tags of other platforms into {{nome}} / {{email}}; other tags are kept. */
export function convertForeignMergeTags(value: string): string {
  if (!value || !/[*%{]/.test(value)) return value;
  return PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, (match, key: string) => mapKey(key) ?? match),
    value,
  );
}

const FOREIGN_TAG = /\*\|[A-Za-z0-9_:-]+\|\*|%%[A-Za-z0-9_-]+%%|\{contactfield=[^}]+\}/g;

/** Lists merge tags from other platforms that the R9 sender would not replace. */
export function findForeignMergeTags(value: string): string[] {
  return Array.from(new Set(String(value ?? '').match(FOREIGN_TAG) || []));
}
