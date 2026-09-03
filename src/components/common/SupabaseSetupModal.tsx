import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SUPABASE_SQL_SCHEMA } from '../../lib/supabase';
import { Database, Copy, Check, ExternalLink, X, ShieldAlert, CheckCircle2, Sparkles, Terminal } from 'lucide-react';

interface SupabaseSetupModalProps {
  onClose: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({ onClose }) => {
  const { supabaseConfig, updateSupabaseCredentials, isSupabaseConnected } = useAuth();
  const [url, setUrl] = useState(supabaseConfig.url || '');
  const [anonKey, setAnonKey] = useState(supabaseConfig.anonKey || '');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    const result = await updateSupabaseCredentials(url.trim(), anonKey.trim());
    setIsSaving(false);
    if (result.success) {
      setSaveStatus({
        success: true,
        message: 'Configurações atualizadas! Sincronização com Supabase ativada.',
      });
    } else {
      setSaveStatus({
        success: false,
        message: result.error || 'Não foi possível conectar.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-['Space_Grotesk']">
                Integração com Supabase (Database & Auth)
              </h2>
              <p className="text-xs text-slate-500">
                Tabelas <code className="text-indigo-600">profiles</code>, <code className="text-indigo-600">campaigns</code> e <code className="text-indigo-600">sales</code> com RLS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Status banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            isSupabaseConnected 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}>
            <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${isSupabaseConnected ? 'text-emerald-600' : 'text-indigo-600'}`} />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-slate-900">
                {isSupabaseConnected 
                  ? 'Conexão Ativa com o Supabase' 
                  : 'Motor Local Híbrido em Execução com Suporte a Supabase'}
              </p>
              <p className="text-slate-600 leading-relaxed">
                A aplicação está 100% funcional. Ao criar contas, os perfis são associados ao Auth ID do usuário com role <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-amber-700 font-medium">'seller'</code> ou <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-700 font-medium">'admin'</code>. Execute o script abaixo no seu painel do Supabase para manter tudo sincronizado na nuvem.
              </p>
            </div>
          </div>

          {/* SQL Migration Script Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-slate-900">Script SQL para o Supabase SQL Editor</span>
              </div>
              <button
                id="copy-sql-btn"
                onClick={handleCopySQL}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Copiado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Script SQL</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Copia e cola este script no <strong>Supabase Dashboard &gt; SQL Editor &gt; New query &gt; Run</strong>. Ele cria a tabela <code className="text-indigo-600">profiles</code> com trigger automático no <code className="text-indigo-600">auth.users</code>, políticas RLS e tabelas de vendas.
            </p>

            <div className="relative rounded-xl bg-slate-900 border border-slate-800 p-3 font-mono text-xs text-slate-200 max-h-56 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{SUPABASE_SQL_SCHEMA}</pre>
            </div>
          </div>

          {/* Connect Custom Credentials Form */}
          <form onSubmit={handleSaveCredentials} className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Conectar Projeto Supabase Próprio
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  URL do Projeto Supabase (VITE_SUPABASE_URL)
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Chave Anônima (VITE_SUPABASE_ANON_KEY)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {saveStatus && (
              <div className={`p-3 rounded-lg text-xs font-medium ${
                saveStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {saveStatus.message}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Abrir Supabase Dashboard
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar & Sincronizar'}
                </button>
              </div>
            </div>
          </form>

        </div>

      </div>
    </div>
  );
};
