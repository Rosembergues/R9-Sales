import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Screen, TransitionType, EmailData } from './types';
import { DEFAULT_TEMPLATES } from './data/templates';
import type { TemplateDocument } from './utils/templateStore';

import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { DailyNoticeModal } from './components/DailyNoticeModal';

import { GeradorProScreen } from './screens/GeradorProScreen';
import { InicioScreen } from './screens/InicioScreen';
import { BibliotecaScreen } from './screens/BibliotecaScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/auth/LoginScreen';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { supabase, isSupabaseConfigured } from './lib/supabase';

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [showDailyNotice, setShowDailyNotice] = useState(false);
  const [passwordResetMode, setPasswordResetMode] = useState(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return search.get('auth') === 'password-reset' || hash.get('type') === 'recovery';
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) { setAuthReady(true); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setAuthenticated(Boolean(data.session));
      setAuthUserId(data.session?.user.id ?? null);
      setAuthReady(true);
    }).catch(() => { if (alive) setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordResetMode(true);
      setAuthenticated(Boolean(session));
      setAuthUserId(session?.user.id ?? null);
      setAuthReady(true);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!authReady) {
      setShowDailyNotice(false);
      return;
    }

    // The announcement must also be available before login, so its daily
    // dismissal is tracked with a browser-wide key. This keeps it from opening
    // a second time immediately after a user signs in.
    const today = getLocalDateKey();
    const globalStorageKey = 'r9bot-mailer-daily-notice:v2:global';
    const accountStorageKey = authUserId
      ? `r9bot-mailer-daily-notice:v1:${authUserId}`
      : null;
    try {
      const dismissedGlobally = window.localStorage.getItem(globalStorageKey) === today;
      const dismissedForAccount = accountStorageKey
        ? window.localStorage.getItem(accountStorageKey) === today
        : false;
      setShowDailyNotice(!dismissedGlobally && !dismissedForAccount);
    } catch {
      // If browser storage is unavailable, show the notice for this session.
      setShowDailyNotice(true);
    }
  }, [authReady, authenticated, authUserId]);

  const handleDismissDailyNotice = () => {
    const today = getLocalDateKey();
    try {
      // Works on the login page too, when no user ID is available yet.
      window.localStorage.setItem('r9bot-mailer-daily-notice:v2:global', today);
      if (authUserId) {
        window.localStorage.setItem(`r9bot-mailer-daily-notice:v1:${authUserId}`, today);
      }
    } catch {
      // Closing still works when browser storage is blocked.
    }
    setShowDailyNotice(false);
  };

  const [currentScreen, setCurrentScreen] = useState<Screen>('inicio');
  const [transitionType, setTransitionType] = useState<TransitionType>('none');
  const [openLibraryOnEditor, setOpenLibraryOnEditor] = useState(false);
  const [homeLibraryTemplate, setHomeLibraryTemplate] = useState<TemplateDocument | null>(null);
  const [homeLibraryTemplateToEdit, setHomeLibraryTemplateToEdit] = useState<TemplateDocument | null>(null);

  const defaultTmpl = DEFAULT_TEMPLATES[0];

  const [emailData, setEmailData] = useState<EmailData>({
    headerTitle: defaultTmpl.headerTitle,
    greeting: defaultTmpl.greeting,
    buttonText: defaultTmpl.buttonText,
    buttonUrl: defaultTmpl.buttonUrl,
    bodyText: defaultTmpl.bodyText,
    footerText: defaultTmpl.footerText,
    primaryColor: defaultTmpl.primaryColor,
    activeTemplateId: defaultTmpl.id,
    subject: defaultTmpl.headerTitle,
    contentSource: 'html',
    customCodeHtml: defaultTmpl.customCodeHtml,
  });

  const handleNavigate = (screen: Screen, transition: TransitionType = 'none') => {
    setTransitionType(transition);
    setCurrentScreen(screen);
  };

  const handleSignOut = async () => {
    if (!supabase || !isSupabaseConfigured) {
      setAuthenticated(false);
      setPasswordResetMode(false);
      setOpenLibraryOnEditor(false);
      setCurrentScreen('inicio');
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Não foi possível sair da conta: ${error.message}`);

    setAuthenticated(false);
    setPasswordResetMode(false);
    setOpenLibraryOnEditor(false);
    setCurrentScreen('inicio');
  };

  const handleSelectHomeLibraryTemplate = (template: TemplateDocument) => {
    setHomeLibraryTemplateToEdit(null);
    setHomeLibraryTemplate(template);
    handleNavigate('gerador_pro', 'push');
  };

  const getVariants = () => {
    if (transitionType === 'push') {
      return {
        initial: { x: '100%', opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: '-100%', opacity: 0 },
      };
    }
    if (transitionType === 'push_back') {
      return {
        initial: { x: '-100%', opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: '100%', opacity: 0 },
      };
    }
    // 'none' transition
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  };

  const getSubtitle = () => {
    switch (currentScreen) {
      case 'inicio':
        return '/ inicio-guia.html';
      case 'gerador_pro':
        return '/ gerador-pro-blocos.html';
      case 'biblioteca':
        return '/ biblioteca.html';
      default:
        return '/ modelo-de-email.html';
    }
  };

  if (!authReady) return <div className="min-h-screen flex items-center justify-center bg-white text-slate-500 text-sm">Carregando acesso seguro...</div>;
  if (passwordResetMode) {
    return <ResetPasswordScreen
      onContinue={() => setPasswordResetMode(false)}
      onBackToLogin={() => { setPasswordResetMode(false); setAuthenticated(false); }}
    />;
  }
  if (!authenticated) return <>
    <LoginScreen onAuthenticated={() => setAuthenticated(true)} />
    {showDailyNotice && <DailyNoticeModal onDismiss={handleDismissDailyNotice} />}
  </>;

  return (
    <ErrorBoundary fallbackTitle="R9Bot Mailer" fallbackMessage="O aplicativo encontrou um erro inesperado. Seus rascunhos e modelos ficam na nuvem quando o salvamento é confirmado. Tente novamente." resetLabel="Tentar novamente">
      <div className={`flex flex-col bg-background text-on-surface font-body-md ${currentScreen === 'gerador_pro' ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Shared navigation is hidden inside the editor workspace to avoid duplicate headers. */}
      {currentScreen !== 'gerador_pro' && (
        <Header
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          subtitle={getSubtitle()}
          onSignOut={handleSignOut}
        />
      )}

      {/* Screen Content Container with Motion Animations */}
      <main className="flex-grow flex flex-col relative w-full min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            variants={getVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: transitionType === 'none' ? 0.15 : 0.35, ease: 'easeInOut' }}
            className="flex-grow flex flex-col w-full min-h-0"
          >
            {currentScreen === 'inicio' && (
              <InicioScreen
                onNavigate={handleNavigate}
                onSelectLibraryTemplate={handleSelectHomeLibraryTemplate}
                onOpenLibrary={() => {
                  handleNavigate('biblioteca', 'push');
                }}
              />
            )}

            {currentScreen === 'biblioteca' && (
              <BibliotecaScreen
                onUseTemplate={(template) => {
                  setHomeLibraryTemplate(template);
                  setHomeLibraryTemplateToEdit(null);
                  handleNavigate('gerador_pro', 'push');
                }}
                onEditTemplate={(template) => {
                  setHomeLibraryTemplate(null);
                  setHomeLibraryTemplateToEdit(template);
                  handleNavigate('gerador_pro', 'push');
                }}
                onCreateTemplate={() => {
                  setHomeLibraryTemplate(null);
                  setHomeLibraryTemplateToEdit(null);
                  handleNavigate('gerador_pro', 'push');
                }}
              />
            )}

            {currentScreen === 'gerador_pro' && (
              <GeradorProScreen
                emailData={emailData}
                setEmailData={setEmailData}
                onNavigate={handleNavigate}
                openLibraryOnStart={openLibraryOnEditor}
                onLibraryStartHandled={() => setOpenLibraryOnEditor(false)}
                initialTemplateToUse={homeLibraryTemplate}
                onInitialTemplateHandled={() => setHomeLibraryTemplate(null)}
                initialTemplateToEdit={homeLibraryTemplateToEdit}
                onInitialTemplateEditHandled={() => setHomeLibraryTemplateToEdit(null)}
                onSignOut={handleSignOut}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Shared Footer - hidden on gerador_pro to avoid overlapping full-height workspace */}
      {currentScreen !== 'gerador_pro' && <Footer />}
      {showDailyNotice && <DailyNoticeModal onDismiss={handleDismissDailyNotice} />}
      </div>
    </ErrorBoundary>
  );
}
