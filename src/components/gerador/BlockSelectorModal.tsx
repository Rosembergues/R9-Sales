import React, { useEffect, useRef } from 'react';
import { BlockType } from '../../types';
import {
  Heading,
  Type,
  AlignLeft,
  FileText,
  MousePointerClick,
  Image as ImageIcon,
  Ticket,
  Minus,
  Share2,
  ShieldCheck,
  X,
  Sparkles,
  Columns3,
  Bookmark,
  Trash2,
} from 'lucide-react';
import type { SavedBlock } from '../../utils/personalLibraryStore';

interface BlockSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBlock: (type: BlockType, insertAfterIndex?: number) => void;
  insertAfterIndex?: number;
  savedBlocks?: SavedBlock[];
  savedBlocksError?: string | null;
  onInsertSavedBlock?: (saved: SavedBlock) => void;
  onDeleteSavedBlock?: (saved: SavedBlock) => void;
}

interface BlockOption {
  type: BlockType;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'header' | 'content' | 'action' | 'layout';
}

const BLOCK_OPTIONS: BlockOption[] = [
  // Header / Titles
  {
    type: 'header_text',
    name: 'Cabeçalho / Banner',
    description: 'Banner colorido com título e subtítulo',
    icon: <Heading className="w-4 h-4 text-blue-600" />,
    category: 'header',
  },
  {
    type: 'title',
    name: 'Título Principal',
    description: 'Heading de alto destaque para tópicos',
    icon: <Type className="w-4 h-4 text-indigo-600" />,
    category: 'header',
  },
  {
    type: 'subtitle',
    name: 'Subtítulo',
    description: 'Texto de apoio com tamanho intermediário',
    icon: <AlignLeft className="w-4 h-4 text-slate-600" />,
    category: 'header',
  },

  // Content
  {
    type: 'text',
    name: 'Parágrafo / Texto',
    description: 'Corpo da mensagem com suporte a {{variáveis}}',
    icon: <FileText className="w-4 h-4 text-slate-700" />,
    category: 'content',
  },
  {
    type: 'image',
    name: 'Banner / Imagem',
    description: 'Imagem ilustrativa com suporte a link',
    icon: <ImageIcon className="w-4 h-4 text-emerald-600" />,
    category: 'content',
  },
  {
    type: 'columns',
    name: 'Colunas',
    description: '2 ou 3 itens lado a lado (produtos, cursos)',
    icon: <Columns3 className="w-4 h-4 text-teal-600" />,
    category: 'content',
  },

  // Actions & Conversion
  {
    type: 'button',
    name: 'Botão CTA',
    description: 'Chamada para ação principal com link',
    icon: <MousePointerClick className="w-4 h-4 text-amber-600" />,
    category: 'action',
  },
  {
    type: 'coupon',
    name: 'Cupom de Desconto',
    description: 'Caixa de cupom promocional com código',
    icon: <Ticket className="w-4 h-4 text-rose-600" />,
    category: 'action',
  },

  // Structure / Footer
  {
    type: 'divider',
    name: 'Linha Divisória',
    description: 'Separador horizontal sutil entre seções',
    icon: <Minus className="w-4 h-4 text-slate-400" />,
    category: 'layout',
  },
  {
    type: 'social',
    name: 'Redes Sociais',
    description: 'Links para Instagram, LinkedIn e site',
    icon: <Share2 className="w-4 h-4 text-sky-600" />,
    category: 'layout',
  },
  {
    type: 'footer',
    name: 'Rodapé Legal',
    description: 'Texto de descadastro e direitos autorais',
    icon: <ShieldCheck className="w-4 h-4 text-slate-500" />,
    category: 'layout',
  },
];

export const BlockSelectorModal: React.FC<BlockSelectorModalProps> = ({
  isOpen,
  onClose,
  onAddBlock,
  insertAfterIndex,
  savedBlocks = [],
  savedBlocksError = null,
  onInsertSavedBlock,
  onDeleteSavedBlock,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = [
    { id: 'header', label: 'Cabeçalhos & Títulos' },
    { id: 'content', label: 'Conteúdo' },
    { id: 'action', label: 'Conversão & Ação' },
    { id: 'layout', label: 'Estrutura & Rodapé' },
  ];

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-2xs transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      {/* Floating Card Popover */}
      <div
        ref={menuRef}
        className="fixed top-24 left-4 sm:left-6 md:left-16 z-50 w-80 sm:w-88 bg-white border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-900/15 overflow-hidden flex flex-col max-h-[80vh] animate-slideDown select-none"
      >
        {/* Floating Menu Header */}
        <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">Adicionar Bloco</h3>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">
                Escolha o tipo de elemento para inserir
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Block Choices */}
        <div className="flex-grow overflow-y-auto p-3 space-y-3.5 divide-y divide-slate-100">
          {onInsertSavedBlock && (
            <div>
              <span className="text-[10px] font-black uppercase text-indigo-700/80 tracking-wider px-1 block mb-1.5">
                Meus blocos
              </span>
              {savedBlocksError ? (
                <p className="px-1 text-[11px] text-amber-700">{savedBlocksError}</p>
              ) : savedBlocks.length === 0 ? (
                <p className="px-1 text-[11px] text-slate-400">
                  Nenhum bloco salvo ainda. Selecione um bloco do e-mail e use o ícone de marcador no painel da direita.
                </p>
              ) : (
                <div className="space-y-1">
                  {savedBlocks.map((saved) => (
                    <div key={saved.id} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onInsertSavedBlock(saved);
                          onClose();
                        }}
                        className="flex-grow min-w-0 text-left p-2 rounded-xl hover:bg-indigo-50/80 border border-transparent hover:border-indigo-300 flex items-center gap-2.5 transition-all cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                          <Bookmark className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 truncate">{saved.name}</h4>
                          <p className="text-[11px] text-slate-400 truncate">{BLOCK_OPTIONS.find((o) => o.type === saved.block.type)?.name || 'Bloco'}</p>
                        </div>
                      </button>
                      {onDeleteSavedBlock && (
                        <button
                          type="button"
                          onClick={() => onDeleteSavedBlock(saved)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                          title={`Excluir "${saved.name}" de Meus blocos`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {categories.map((cat, catIdx) => {
            const items = BLOCK_OPTIONS.filter((b) => b.category === cat.id);
            if (items.length === 0) return null;

            return (
              <div key={cat.id} className={catIdx > 0 || onInsertSavedBlock ? 'pt-3' : ''}>
                <span className="text-[10px] font-black uppercase text-indigo-700/80 tracking-wider px-1 block mb-1.5">
                  {cat.label}
                </span>

                <div className="space-y-1">
                  {items.map((blockDef) => (
                    <button
                      key={blockDef.type}
                      type="button"
                      onClick={() => {
                        onAddBlock(blockDef.type, insertAfterIndex);
                        onClose();
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-indigo-50/80 hover:border-indigo-300 border border-transparent flex items-center gap-2.5 transition-all group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-2xs transition-colors shrink-0">
                        {blockDef.icon}
                      </div>
                      <div className="min-w-0 flex-grow">
                        <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 transition-colors">
                          {blockDef.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 group-hover:text-slate-600 truncate leading-tight">
                          {blockDef.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

