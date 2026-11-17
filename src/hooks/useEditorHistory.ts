import { useCallback, useRef, useState } from 'react';
import type { EmailBlock } from '../types';

const MAX_HISTORY = 50;

export function useEditorHistory(initialBlocks: EmailBlock[]) {
  const [history, setHistory] = useState<EmailBlock[][]>([initialBlocks]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyRef = useRef<EmailBlock[][]>([initialBlocks]);
  const historyIndexRef = useRef(0);
  const lastPushWasCoalescedRef = useRef(false);

  const push = useCallback((newBlocks: EmailBlock[], options?: { coalesce?: boolean }) => {
    const coalesce = options?.coalesce === true;
    const current = historyRef.current.slice(0, historyIndexRef.current + 1);

    // Continuous text editing should occupy one undo step instead of one
    // history entry per keystroke. The first edit creates a new snapshot;
    // subsequent coalesced edits replace that snapshot until a normal action
    // (toolbar, block operation, import, etc.) is pushed.
    const isCoalescingExistingEdit = coalesce && lastPushWasCoalescedRef.current && current.length > 1;
    const next = isCoalescingExistingEdit
      ? [...current.slice(0, -1), newBlocks].slice(-MAX_HISTORY)
      : [...current, newBlocks].slice(-MAX_HISTORY);
    lastPushWasCoalescedRef.current = coalesce;
    const nextIndex = next.length - 1;
    historyRef.current = next;
    historyIndexRef.current = nextIndex;
    setHistory(next);
    setHistoryIndex(nextIndex);
  }, []);

  const undo = useCallback(() => {
    const index = historyIndexRef.current;
    if (index <= 0) return null;
    const nextIndex = index - 1;
    historyIndexRef.current = nextIndex;
    lastPushWasCoalescedRef.current = false;
    setHistoryIndex(nextIndex);
    return historyRef.current[nextIndex];
  }, []);

  const reset = useCallback((newBlocks: EmailBlock[]) => {
    historyRef.current = [newBlocks];
    historyIndexRef.current = 0;
    lastPushWasCoalescedRef.current = false;
    setHistory([newBlocks]);
    setHistoryIndex(0);
  }, []);

  const redo = useCallback(() => {
    const index = historyIndexRef.current;
    if (index >= historyRef.current.length - 1) return null;
    const nextIndex = index + 1;
    historyIndexRef.current = nextIndex;
    lastPushWasCoalescedRef.current = false;
    setHistoryIndex(nextIndex);
    return historyRef.current[nextIndex];
  }, []);

  return {
    push,
    undo,
    redo,
    reset,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  };
}
