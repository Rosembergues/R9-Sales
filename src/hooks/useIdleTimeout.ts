import { useEffect, useRef, useCallback } from 'react';

export interface UseIdleTimeoutOptions {
  /** Se o monitoramento está ativado (ativo durante toda a sessão autenticada) */
  enabled?: boolean;
  /** Tempo de inatividade em milissegundos antes de expirar a sessão (padrão: 3 horas = 10.800.000 ms) */
  timeoutMs?: number;
  /** Callback acionado ao atingir o tempo limite de inatividade */
  onIdle: () => void | Promise<void>;
  /** Intervalo mínimo em milissegundos para reagendar o timer durante eventos intensos como mousemove (padrão: 500ms) */
  throttleMs?: number;
}

/** 3 Horas em milissegundos: 3 * 60 * 60 * 1000 = 10.800.000 ms */
export const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

const STORAGE_LAST_ACTIVITY_KEY = 'r9_last_user_activity';

/**
 * Hook global para monitoramento de inatividade do usuário (Idle Timeout).
 * - Monitora os eventos globais no window e document ('mousemove', 'keydown', 'click', 'scroll', 'touchstart') com { passive: true }
 * - Reinicializa o timer de 3 horas a cada evento
 * - Dispara onIdle com limpeza e redirecionamento seguro ao atingir o tempo limite
 */
export function useIdleTimeout({
  enabled = true,
  timeoutMs = THREE_HOURS_MS,
  onIdle,
  throttleMs = 500,
}: UseIdleTimeoutOptions): void {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastResetRef = useRef<number>(0);
  const isLoggingOutRef = useRef<boolean>(false);
  const onIdleRef = useRef(onIdle);

  // Mantém a referência do callback sempre atualizada sem reiniciar listeners
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const clearExistingTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const triggerIdleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    clearExistingTimer();

    console.warn(`⏰ [Idle Timeout] Tempo limite de inatividade atingido (${Math.round(timeoutMs / 3600000)}h). Executando logout...`);
    try {
      await onIdleRef.current();
    } catch (err) {
      console.error('💥 [Idle Timeout] Erro ao executar logout por inatividade:', err);
    }
  }, [clearExistingTimer, timeoutMs]);

  const resetTimer = useCallback(() => {
    if (!enabled || isLoggingOutRef.current) return;

    // Limpa o temporizador anterior
    clearExistingTimer();

    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(STORAGE_LAST_ACTIVITY_KEY, String(now));
    } catch {
      // Ignora erro de cota ou navegação privada
    }

    // Reinicia para o tempo total estipulado (3 horas)
    timerRef.current = setTimeout(() => {
      void triggerIdleLogout();
    }, timeoutMs);
  }, [enabled, timeoutMs, clearExistingTimer, triggerIdleLogout]);

  useEffect(() => {
    if (!enabled) {
      clearExistingTimer();
      isLoggingOutRef.current = false;
      return;
    }

    isLoggingOutRef.current = false;

    // Recupera última atividade persistida caso a página tenha sido recarregada
    const storedLast = localStorage.getItem(STORAGE_LAST_ACTIVITY_KEY);
    const lastTimestamp = storedLast ? Number(storedLast) : Date.now();
    const elapsed = Date.now() - lastTimestamp;

    if (elapsed >= timeoutMs) {
      // Já se passaram 3 horas sem atividade prévia
      void triggerIdleLogout();
      return;
    }

    lastActivityRef.current = lastTimestamp;
    resetTimer();

    // Manipulador de atividade com throttle suave para preservar desempenho
    const handleUserInteraction = () => {
      if (isLoggingOutRef.current) return;

      const now = Date.now();
      // Se já transcorreu o tempo de inatividade enquanto o dispositivo dormia
      if (now - lastActivityRef.current >= timeoutMs) {
        void triggerIdleLogout();
        return;
      }

      // Reinicia o timer com throttle para evitar sobrecarga de setTimeout em movimento de mouse
      if (now - lastResetRef.current >= throttleMs) {
        lastResetRef.current = now;
        resetTimer();
      }
    };

    // Ouvintes obrigatórios conforme especificação
    const monitoredEvents = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart'
    ] as const;

    // Vincula os ouvintes ao window e document com { passive: true } para não bloquear a performance
    monitoredEvents.forEach(event => {
      window.addEventListener(event, handleUserInteraction, { passive: true });
      document.addEventListener(event, handleUserInteraction, { passive: true });
    });

    // Também verifica quando a aba volta a ficar visível ou ganha foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastActivityRef.current >= timeoutMs) {
          void triggerIdleLogout();
        } else {
          resetTimer();
        }
      }
    };

    // Sincronização multi-abas através do evento storage
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_LAST_ACTIVITY_KEY && e.newValue) {
        lastActivityRef.current = Number(e.newValue);
        resetTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    window.addEventListener('focus', handleVisibilityChange, { passive: true });
    window.addEventListener('storage', handleStorage);

    // Limpeza rigorosa no ciclo de vida do componente
    return () => {
      clearExistingTimer();
      monitoredEvents.forEach(event => {
        window.removeEventListener(event, handleUserInteraction);
        document.removeEventListener(event, handleUserInteraction);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [enabled, resetTimer, clearExistingTimer, triggerIdleLogout, timeoutMs, throttleMs]);
}

