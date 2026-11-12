import type { Goal, Profile, Sale } from '../types';

/**
 * Cache no navegador (localStorage). O Supabase é sempre a fonte oficial; aqui fica só:
 * - a fila de vendas lançadas sem conexão (enviadas quando a conexão volta);
 * - o perfil logado e a lista de perfis, para a tela abrir enquanto o servidor responde;
 * - as metas individuais, como reserva se a consulta ao servidor falhar.
 *
 * A lista completa de vendas NÃO é guardada (tinha nome de alunos e ficava no computador).
 * Os nomes das chaves começam com "salesflow_" por histórico: trocar apagaria a fila
 * de vendas pendentes de quem estiver offline.
 */
const KEYS = {
  profiles: 'salesflow_profiles_v4',
  pendingSales: 'salesflow_pending_sales_v1',
  currentUser: 'salesflow_current_user_v4',
  goals: 'salesflow_goals_v1',
};

/** Chaves de versões antigas, apagadas na primeira leitura. */
const LEGACY_KEYS = [
  'salesflow_sales_v1', 'salesflow_sales_v2', 'salesflow_sales_v3',
  'salesflow_profiles_v1', 'salesflow_profiles_v2', 'salesflow_profiles_v3',
  'salesflow_current_user_v1', 'salesflow_current_user_v2', 'salesflow_current_user_v3',
  'salesflow_deleted_sales_v1', 'salesflow_campaigns_v1', 'salesflow_supabase_config',
];

let purged = false;
function purgeLegacy() {
  if (purged) return;
  purged = true;
  try {
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
  } catch {
    // navegador sem localStorage (modo privado): nada a limpar
  }
}

function read<T>(key: string, fallback: T): T {
  purgeLegacy();
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[cache local] não foi possível gravar ${key}`, e);
  }
}

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const LocalSyncEngine = {
  getProfiles: (): Profile[] => asArray<Profile>(read(KEYS.profiles, [])),
  saveProfiles: (profiles: Profile[]) => write(KEYS.profiles, profiles),

  getCurrentUser: (): Profile | null => {
    const p = read<Profile | null>(KEYS.currentUser, null);
    return p && p.id && p.email ? p : null;
  },
  setCurrentUser: (profile: Profile | null) => write(KEYS.currentUser, profile),

  /** Vendas lançadas sem conexão, ainda não confirmadas no servidor. */
  getPendingSales: (): Sale[] => asArray<Sale>(read(KEYS.pendingSales, [])),
  savePendingSales: (sales: Sale[]) => write(KEYS.pendingSales, sales),
  clearPendingSale: (saleId: string) =>
    write(KEYS.pendingSales, LocalSyncEngine.getPendingSales().filter(s => s.id !== saleId)),

  getGoals: (): Goal[] => asArray<Goal>(read(KEYS.goals, [])),
  /** Uma meta por (pessoa, tipo, início do período), como no banco. */
  saveGoals: (goals: Goal[]) => {
    const unique = new Map<string, Goal>();
    goals.forEach(g => unique.set(`${g.user_id}_${g.type}_${g.reference_start || ''}`, g));
    write(KEYS.goals, [...unique.values()]);
  },
};
