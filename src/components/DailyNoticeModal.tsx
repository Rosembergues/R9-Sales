import { BookOpen, CheckCircle2, Globe2, Sparkles, X } from 'lucide-react';

interface DailyNoticeModalProps {
  onDismiss: () => void;
}

export function DailyNoticeModal({ onDismiss }: DailyNoticeModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
      <section
        aria-labelledby="daily-notice-title"
        aria-describedby="daily-notice-description"
        aria-modal="true"
        role="dialog"
        className="relative my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-sky-600 px-6 pb-7 pt-6 text-white sm:px-8 sm:pt-7">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full border border-white/15 shadow-[0_0_0_28px_rgba(255,255,255,0.04),0_0_0_56px_rgba(255,255,255,0.03)]" />
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fechar aviso de novidades"
            title="Fechar"
            className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/80"
          >
            <X size={20} />
          </button>
          <div className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-sky-100">
            <Sparkles size={15} /> Novidades do R9Bot Mailer
          </div>
          <h2 id="daily-notice-title" className="relative mt-4 max-w-md text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            Agora seus modelos podem ajudar todas as unidades
          </h2>
          <p id="daily-notice-description" className="relative mt-3 max-w-lg text-sm leading-6 text-blue-50 sm:text-base">
            Fizemos algumas mudanças para facilitar o compartilhamento de modelos e deixar tudo organizado em um só lugar.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Por que agora tem login com e-mail?</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Precisamos identificar quem criou cada modelo e permitir que a equipe compartilhe materiais com segurança. Por isso, o acesso agora é feito com e-mail e senha.
              </p>
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
                <p className="text-sm font-semibold text-blue-950">Ainda não tem uma conta? Você pode criar a sua!</p>
                <p className="mt-1 text-sm leading-6 text-blue-900">
                  Qualquer funcionário pode se cadastrar: na tela de acesso, clique em “Não tem uma conta? Criar conta”, informe seu e-mail e escolha uma senha. Não precisa pedir a alguém para criar o login por você. Se for solicitado, confirme seu e-mail para concluir o cadastro.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">O que é a Biblioteca?</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                É um repositório online de modelos de e-mail. Em vez de cada pessoa guardar tudo só no próprio computador, os modelos publicados podem ser encontrados e usados por colegas de outras unidades.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Globe2 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Como você pode ajudar?</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Se algum colega ainda não tem acesso, peça que crie uma conta com e-mail e senha. Depois, publique na Biblioteca os modelos que possam ser úteis para outras pessoas. Ao salvar, informe um nome e uma descrição simples para que todos entendam o conteúdo e saibam quando usá-lo.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">O modelo só fica disponível para outras unidades quando é publicado na Biblioteca.</p>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Entendi, continuar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
