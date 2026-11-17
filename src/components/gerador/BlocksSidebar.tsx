import React, { useState } from 'react';
import { EmailBlock, BlockType } from '../../types';
import { BlockSelectorModal } from './BlockSelectorModal';
import {
  PlusCircle,
  Layers,
  Heading,
  Type,
  AlignLeft,
  Image as ImageIcon,
  MousePointerClick,
  Ticket,
  Minus,
  Share2,
  PanelBottom,
  GripVertical,
  Columns3,
} from 'lucide-react';
import type { SavedBlock } from '../../utils/personalLibraryStore';

interface BlocksSidebarProps {
  blocks: EmailBlock[];
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string) => void;
  onAddBlock: (type: BlockType, insertAfterIndex?: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  savedBlocks?: SavedBlock[];
  savedBlocksError?: string | null;
  onInsertSavedBlock?: (saved: SavedBlock) => void;
  onDeleteSavedBlock?: (saved: SavedBlock) => void;
  onOpenAddBlock?: () => void;
}

interface BlockDefinition {
  type: BlockType;
  name: string;
  description: string;
  category: 'text' | 'media' | 'cta' | 'structure';
  icon: React.ReactNode;
  badgeColor: string;
}

const AVAILABLE_BLOCKS: BlockDefinition[] = [
  {
    type: 'header_text',
    name: 'Cabeçalho / Banner',
    description: 'Faixa colorida com título e subtítulo',
    category: 'structure',
    icon: <Heading className="w-4 h-4 text-blue-600" />,
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    type: 'title',
    name: 'Título Principal',
    description: 'Texto de destaque para seções e novidades',
    category: 'text',
    icon: <Heading className="w-4 h-4 text-indigo-600" />,
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    type: 'subtitle',
    name: 'Subtítulo',
    description: 'Complemento de apoio ao título',
    category: 'text',
    icon: <Type className="w-4 h-4 text-purple-600" />,
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    type: 'text',
    name: 'Parágrafo / Texto',
    description: 'Corpo da mensagem e conteúdo principal',
    category: 'text',
    icon: <AlignLeft className="w-4 h-4 text-slate-600" />,
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
  },
  {
    type: 'image',
    name: 'Imagem / Banner',
    description: 'Foto do produto, hero banner ou anúncio',
    category: 'media',
    icon: <ImageIcon className="w-4 h-4 text-emerald-600" />,
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    type: 'columns',
    name: 'Colunas',
    description: 'Itens lado a lado',
    category: 'media',
    icon: <Columns3 className="w-4 h-4 text-teal-600" />,
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    type: 'button',
    name: 'Botão CTA',
    description: 'Botão de clique para ação e links externos',
    category: 'cta',
    icon: <MousePointerClick className="w-4 h-4 text-amber-600" />,
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    type: 'coupon',
    name: 'Cupom de Desconto',
    description: 'Caixa de oferta com código promocional',
    category: 'cta',
    icon: <Ticket className="w-4 h-4 text-rose-600" />,
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    type: 'divider',
    name: 'Linha Divisória',
    description: 'Separação visual entre blocos de conteúdo',
    category: 'structure',
    icon: <Minus className="w-4 h-4 text-slate-500" />,
    badgeColor: 'bg-slate-50 text-slate-600 border-slate-200',
  },
  {
    type: 'social',
    name: 'Redes Sociais',
    description: 'Links para Instagram, WhatsApp, LinkedIn',
    category: 'structure',
    icon: <Share2 className="w-4 h-4 text-sky-600" />,
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    type: 'footer',
    name: 'Rodapé Legal',
    description: 'Assinatura, copyright e links de descadastro',
    category: 'structure',
    icon: <PanelBottom className="w-4 h-4 text-slate-600" />,
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
  },
];

export const BlocksSidebar: React.FC<BlocksSidebarProps> = ({
  blocks,
  selectedBlockId,
  setSelectedBlockId,
  onAddBlock,
  onReorder,
  savedBlocks,
  savedBlocksError,
  onInsertSavedBlock,
  onDeleteSavedBlock,
  onOpenAddBlock,
}) => {
  const [isAddBlockModalOpen, setIsAddBlockModalOpenState] = useState(false);
  const setIsAddBlockModalOpen = (open: boolean) => {
    if (open) onOpenAddBlock?.();
    setIsAddBlockModalOpenState(open);
  };

  // Drag and drop state for layers list
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-slate-200/90 select-none relative">
      {/* Floating Add Block Modal/Popover */}
      <BlockSelectorModal
        isOpen={isAddBlockModalOpen}
        onClose={() => setIsAddBlockModalOpen(false)}
        onAddBlock={(type) => {
          onAddBlock(type);
          setIsAddBlockModalOpen(false);
        }}
        savedBlocks={savedBlocks}
        savedBlocksError={savedBlocksError}
        onInsertSavedBlock={onInsertSavedBlock}
        onDeleteSavedBlock={onDeleteSavedBlock}
      />

      {/* Sidebar title */}
      <div className="px-3 py-2.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
        <span className="font-semibold text-slate-700">Blocos ({blocks.length})</span>
        <span className="text-[11px] text-slate-400">Arraste para reordenar</span>
      </div>

      <div className="flex-grow flex flex-col min-h-0 overflow-hidden">
          {/* Prominent Action Button to Open Floating Block Menu */}
          <div className="p-3 border-b border-slate-200/80 bg-white shrink-0">
            <button
              type="button"
              onClick={() => setIsAddBlockModalOpen(true)}
              className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Adicionar Bloco</span>
            </button>
          </div>

          <div className="flex-grow overflow-y-auto p-3 space-y-2 min-h-0">
            {blocks.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl space-y-3">
                <Layers className="w-8 h-8 mx-auto text-slate-300" />
                <div>
                  <p className="font-bold text-slate-700">Nenhum bloco no e-mail</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Comece adicionando o primeiro bloco</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddBlockModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Adicionar primeiro bloco</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {blocks.map((block, idx) => {
                  const isSelected = block.id === selectedBlockId;
                  const isBeingDragged = draggedIdx === idx;
                  const isTargeted = dragOverIdx === idx && draggedIdx !== idx;
                  const def = AVAILABLE_BLOCKS.find((b) => b.type === block.type);

                  return (
                    <div
                      key={block.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedIdx(idx);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(idx));
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverIdx !== idx) setDragOverIdx(idx);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        if (dragOverIdx !== idx) setDragOverIdx(idx);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedIdx !== null && draggedIdx !== idx) {
                          onReorder(draggedIdx, idx);
                        }
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                      }}
                      onDragEnd={() => {
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                      }}
                      onClick={() => setSelectedBlockId(block.id)}
                      className={`group p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                        isBeingDragged
                          ? 'opacity-40 border-dashed border-indigo-500 bg-indigo-50/50'
                          : isTargeted
                          ? 'bg-indigo-100/90 border-indigo-600 ring-2 ring-indigo-500/40 shadow-xs'
                          : isSelected
                          ? 'bg-indigo-50/90 border-indigo-500 ring-1 ring-indigo-500/30 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200/90'
                      }`}
                    >
                      {/* A lista serve apenas para selecionar e arrastar os blocos. */}
                      <div className="flex items-center gap-2 min-w-0 flex-grow">
                        <div className="text-slate-400 group-hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0">
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                        <p className={`text-xs font-semibold truncate ${isSelected ? 'text-indigo-950 font-bold' : 'text-slate-800'}`}>
                          {def?.name || block.type}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

    </div>
  );
};
