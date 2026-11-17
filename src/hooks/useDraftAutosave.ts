import { useEffect, useState } from 'react';
import type { EmailBlock, EmailData } from '../types';
import { saveDraft } from '../utils/templateStore';

export type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error';

export function useDraftAutosave(
  blocks: EmailBlock[],
  emailData: EmailData,
  documentId: string,
  delay = 700,
  enabled = true,
  sourceTemplateId: string | null = null,
) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('dirty');
  const [lastSavedTime, setLastSavedTime] = useState('');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setSaveStatus('dirty');
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      setSaveStatus('saving');
      try {
        await saveDraft(blocks, { ...emailData, documentId, contentSource: 'blocks' }, documentId, sourceTemplateId);
        if (cancelled) return;
        setSaveStatus('saved');
        setLastSavedTime(`às ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      } catch {
        if (!cancelled) setSaveStatus('error');
      }
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [blocks, emailData, documentId, delay, enabled, sourceTemplateId]);

  return { saveStatus, setSaveStatus, lastSavedTime, setLastSavedTime };
}
