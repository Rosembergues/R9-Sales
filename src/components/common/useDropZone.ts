import type React from 'react';
import { useRef, useState } from 'react';

interface Options {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}

/**
 * Comportamento de uma área "arraste o arquivo aqui ou clique": arrastar e soltar,
 * clique, e teclado (Enter/Espaço), com o <input type="file"> escondido.
 * Espalhe `zoneProps` na área e `inputProps` no input.
 */
export function useDropZone({ accept, multiple = false, disabled = false, onFiles }: Options) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const entregar = (lista: FileList | null | undefined) => {
    const files = Array.from(lista ?? []);
    if (!files.length || disabled) return;
    onFiles(multiple ? files : files.slice(0, 1));
  };
  const abrir = () => {
    if (!disabled) inputRef.current?.click();
  };

  const zoneProps = {
    role: 'button',
    tabIndex: disabled ? -1 : 0,
    'aria-disabled': disabled || undefined,
    onClick: abrir,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrir();
      }
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragging(true);
    },
    // Só sai do estado "arrastando" quando o cursor deixa a área (não ao passar por um filho dela).
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      entregar(e.dataTransfer.files);
    },
  } as const;

  const inputProps = {
    ref: inputRef,
    type: 'file',
    accept,
    multiple,
    hidden: true,
    tabIndex: -1,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      entregar(e.target.files);
      e.target.value = '';
    },
  } as const;

  return { dragging, zoneProps, inputProps };
}
