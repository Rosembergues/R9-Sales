import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { sanitizeRichText } from '../utils/security';

export interface RichTextEditorRef {
  focus: () => void;
  execCommand: (command: string, value?: string) => void;
  insertHtml: (html: string) => void;
  insertText: (text: string) => void;
  getSelectionText: () => string;
  hasSelection: () => boolean;
  saveSelection: () => void;
  restoreSelection: () => boolean;
  hasSavedSelection: () => boolean;
  clearSavedSelection: () => void;
  applyInlineStyle: (property: string, value: string) => boolean;
}

interface RichTextEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  minHeight?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onSelectionChange?: (selectedText: string) => void;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  (
    {
      value,
      onChange,
      placeholder = 'Digite o texto aqui...',
      className = '',
      style,
      minHeight = '110px',
      onFocus,
      onBlur,
      onSelectionChange,
    },
    ref
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastHtmlRef = useRef<string | null>(null);
    const savedSelectionRef = useRef<Range | null>(null);

    // Synchronize innerHTML when value prop changes externally or on mount
    useEffect(() => {
      if (editorRef.current) {
        if (value !== lastHtmlRef.current) {
          let displayHtml = value || '';
          if (displayHtml.includes('\n') && !/<[a-z][\s\S]*>/i.test(displayHtml)) {
            displayHtml = displayHtml.replace(/\n/g, '<br/>');
          }
          displayHtml = sanitizeRichText(displayHtml);
          editorRef.current.innerHTML = displayHtml;
          lastHtmlRef.current = displayHtml;
        }
      }
    }, [value]);

    // Handle plain-text paste only (strip all incoming HTML, styles, fonts, etc.)
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const plainText = e.clipboardData.getData('text/plain');
      if (!plainText) return;

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();

        // Convert newline characters into text nodes or break lines cleanly
        const textNode = document.createTextNode(plainText);
        range.insertNode(textNode);

        // Move cursor right after the newly inserted plain text
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else if (editorRef.current) {
        editorRef.current.innerText += plainText;
      }
      handleInput();
    };

    // Handle user input
    const handleInput = () => {
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        const sanitized = sanitizeRichText(html);
        lastHtmlRef.current = sanitized;
        onChange(sanitized);
      }
    };

    // Check and preserve selection so toolbar clicks do not destroy the range.
    const handleSelection = () => {
      if (!window.getSelection || !editorRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current.contains(sel.anchorNode)) {
        savedSelectionRef.current = null;
        onSelectionChange?.('');
        return;
      }

      const range = sel.getRangeAt(0);
      if (range.collapsed || !sel.toString()) {
        savedSelectionRef.current = null;
        onSelectionChange?.('');
        return;
      }

      savedSelectionRef.current = range.cloneRange();
      onSelectionChange?.(sel.toString());
    };

    const isSavedSelectionValid = () => {
      const range = savedSelectionRef.current;
      const editor = editorRef.current;
      if (!range || !editor) return false;
      try {
        return editor.contains(range.commonAncestorContainer) && !range.collapsed;
      } catch {
        return false;
      }
    };

    // Expose imperative handle for toolbar execution
    useImperativeHandle(ref, () => ({
      focus: () => {
        if (editorRef.current) {
          editorRef.current.focus();
        }
      },
      execCommand: (command: string, value: string = '') => {
        if (!editorRef.current) return;

        editorRef.current.focus();
        const sel = window.getSelection();
        if (sel && savedSelectionRef.current) {
          try {
            sel.removeAllRanges();
            sel.addRange(savedSelectionRef.current);
          } catch {
            // The DOM may have been rebuilt; keep the current caret in that case.
          }
        }

        document.execCommand(command, false, value);
        handleInput();
        handleSelection();
      },
      insertHtml: (html: string) => {
        if (editorRef.current) {
          editorRef.current.focus();
          const sel = window.getSelection();
          if (sel && savedSelectionRef.current) {
            try {
              sel.removeAllRanges();
              sel.addRange(savedSelectionRef.current);
            } catch {
              // The DOM may have changed; fall back to the current caret.
            }
          }
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const el = document.createElement('div');
            el.innerHTML = sanitizeRichText(html);
            const frag = document.createDocumentFragment();
            let node;
            let lastNode;
            while ((node = el.firstChild)) {
              lastNode = frag.appendChild(node);
            }
            range.insertNode(frag);
            if (lastNode) {
              range.setStartAfter(lastNode);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              savedSelectionRef.current = range.cloneRange();
            }
          } else {
            editorRef.current.innerHTML += sanitizeRichText(html);
          }
          handleInput();
        }
      },
      insertText: (text: string) => {
        if (editorRef.current) {
          editorRef.current.focus();
          const sel = window.getSelection();
          if (sel && savedSelectionRef.current) {
            try {
              sel.removeAllRanges();
              sel.addRange(savedSelectionRef.current);
            } catch {
              // The DOM may have changed; keep the current caret.
            }
          }
          document.execCommand('insertText', false, text);
          handleInput();
          handleSelection();
        }
      },
      getSelectionText: () => {
        const sel = window.getSelection();
        return sel ? sel.toString() : '';
      },
      hasSelection: () => {
        const sel = window.getSelection();
        return Boolean(sel && sel.toString().length > 0);
      },
      saveSelection: () => {
        handleSelection();
      },
      restoreSelection: () => {
        if (!editorRef.current || !savedSelectionRef.current) return false;
        try {
          if (!editorRef.current.contains(savedSelectionRef.current.commonAncestorContainer)) return false;
          const sel = window.getSelection();
          if (!sel) return false;
          editorRef.current.focus();
          sel.removeAllRanges();
          sel.addRange(savedSelectionRef.current);
          return true;
        } catch {
          return false;
        }
      },
      hasSavedSelection: () => isSavedSelectionValid(),
      clearSavedSelection: () => {
        savedSelectionRef.current = null;
        onSelectionChange?.('');
      },
      applyInlineStyle: (property: string, value: string) => {
        if (!editorRef.current || !isSavedSelectionValid()) return false;
        try {
          const sel = window.getSelection();
          if (!sel || !savedSelectionRef.current) return false;
          editorRef.current.focus();
          sel.removeAllRanges();
          sel.addRange(savedSelectionRef.current);
          const range = sel.getRangeAt(0);
          const wrapper = document.createElement('span');
          wrapper.style.setProperty(property, value);
          const fragment = range.extractContents();
          wrapper.appendChild(fragment);
          range.insertNode(wrapper);
          const nextRange = document.createRange();
          nextRange.selectNodeContents(wrapper);
          sel.removeAllRanges();
          sel.addRange(nextRange);
          savedSelectionRef.current = nextRange.cloneRange();
          handleInput();
          return true;
        } catch {
          return false;
        }
      },
    }));

    return (
      <div className="relative w-full group">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onBlur={() => {
            handleInput();
            if (onBlur) onBlur();
          }}
          onFocus={onFocus}
          onKeyUp={handleSelection}
          onMouseUp={handleSelection}
          onSelect={handleSelection}
          style={{ minHeight, ...style }}
          className={`w-full p-3 text-xs leading-relaxed border border-slate-300 rounded-xl bg-white text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-sans overflow-y-auto ${className}`}
        />
        {(!value || value.trim() === '' || value.trim() === '<br>' || value.trim() === '<br/>') && (
          <div
            onClick={() => editorRef.current?.focus()}
            className="absolute top-3 left-3 text-xs text-slate-400 pointer-events-none select-none font-sans"
          >
            {placeholder}
          </div>
        )}
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';
