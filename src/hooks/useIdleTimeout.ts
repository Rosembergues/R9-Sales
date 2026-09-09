import { useEffect, useRef, useCallback } from 'react';

export interface UseIdleTimeoutOptions {
  /** Se o monitoramento está ativado (normalmente quando há usuário autenticado) */
  enabled?: boolean;
  /** Tempo de inatividade em milissegundos antes de expirar a sessão (padrão: 3 horas) */
  timeoutMs?: number;
  /** Callback acionado ao atingir o tempo limite de inatividade */
  onIdle: () => void | Promise<void>;
  /** Intervalo de throttle para atualização do timer durante eventos de alta frequência (padrão: 1000ms) */
  throttleMs?: number;
}

/** 3 Horas em milissegundos: 3 * 60 * 60 * 1000 = 10.800.000 ms */
export const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

/**
 * Hook global para monitoramento de inatividade do usuário (Idle Timeout).
 * Monitora os eventos globais de interação ('mousemove', 'keydown', 'click', 'scroll', 'touchstart')
 * e executa logout seguro e aviso amigável quando expirar sem interação.
 */
export function useIdleTimeout({
  enabled = true,
  timeoutMs = THREE_HOURS_MS,
  onIdle,
  throttleMs = 1000,
}: UseIdleTimeoutOptions): void {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
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

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    clearExistingTimer();

    timerRef.current = setTimeout(() => {
      console.warn(`⏰ [Idle Timeout] Sessão expirada por inatividade (${Math.round(timeoutMs / 3600000)}h). Executando encerramento seguro...`);
      try {
        void onIdleRef.current();
      } catch (err) {
        console.error('💥 [Idle Timeout] Erro ao invocar onIdle:', err);
      }
    }, timeoutMs);
  }, [enabled, timeoutMs, clearExistingTimer]);

  useEffect(() => {
    if (!enabled) {
      clearExistingTimer();
      return;
    }

    // Inicializa o temporizador ao montar ou ao ativar
    lastActivityRef.current = Date.now();
    resetTimer();

    // Manipulador com throttle para prevenir sobrecarga da CPU em eventos como mousemove e scroll
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastActivityRef.current >= throttleMs) {
        lastActivityRef.current = now;
        resetTimer();
      }
    };

    const monitoredEvents = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart'
    ] as const;

    // Registra listeners com passive: true para máximo desempenho visual
    monitoredEvents.forEach(event => {
      window.addEventListener(event, handleUserInteraction, { passive: true });
    });

    // Limpeza rigorosa no ciclo de vida do componente
    return () => {
      clearExistingTimer();
      monitoredEvents.forEach(event => {
        window.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [enabled, resetTimer, clearExistingTimer, throttleMs]);
}
