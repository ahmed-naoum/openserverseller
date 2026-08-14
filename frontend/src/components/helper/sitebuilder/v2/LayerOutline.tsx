import React from 'react';
import { 
  GripVertical, ArrowUp, ArrowDown, Copy, Trash2, Layers, 
  ShoppingCart, Video, Layers as SliderIcon, Image, Music, 
  Heading, Type, Clock, MessageSquare, Space, ShoppingBag, Eye, EyeOff
} from 'lucide-react';
import { EditorBlock, BlockType } from './types';

interface LayerOutlineProps {
  blocks: EditorBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onMoveBlock: (index: number, direction: 'up' | 'down') => void;
  onDuplicateBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
}

const getBlockIcon = (type: BlockType) => {
  switch (type) {
    case 'express_checkout': return <ShoppingCart className="w-3.5 h-3.5 text-orange-500" />;
    case 'video': return <Video className="w-3.5 h-3.5 text-rose-500" />;
    case 'slider': return <SliderIcon className="w-3.5 h-3.5 text-purple-500" />;
    case 'image': return <Image className="w-3.5 h-3.5 text-blue-500" />;
    case 'audio': return <Music className="w-3.5 h-3.5 text-indigo-500" />;
    case 'hero': return <Heading className="w-3.5 h-3.5 text-amber-500" />;
    case 'header': return <Type className="w-3.5 h-3.5 text-slate-700" />;
    case 'text': return <Type className="w-3.5 h-3.5 text-slate-500" />;
    case 'countdown': return <Clock className="w-3.5 h-3.5 text-rose-500" />;
    case 'whatsapp': return <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />;
    case 'products': return <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />;
    case 'spacer': return <Space className="w-3.5 h-3.5 text-slate-400" />;
    default: return <Layers className="w-3.5 h-3.5 text-slate-400" />;
  }
};

const getBlockTitle = (block: EditorBlock) => {
  const { type, content } = block;
  switch (type) {
    case 'express_checkout': return content.title || 'Checkout Express (COD)';
    case 'header': return content.text || 'En-tête de marque';
    case 'hero': return content.title || 'Hero Titre';
    case 'button': return content.text || 'Bouton d\'action';
    case 'image': return content.url ? 'Image personnalisée' : 'Image (Placeholder)';
    case 'video': return content.url ? 'Vidéo intégrée' : 'Lecteur Vidéo';
    case 'text': return content.text ? (content.text.length > 25 ? content.text.slice(0, 25) + '...' : content.text) : 'Bloc Texte';
    case 'slider': return `Slider (${content.slides?.length || 0} cartes)`;
    case 'audio': return `Lecteur Audio (${content.audios?.length || 1} pistes)`;
    case 'countdown': return content.text || 'Compteur d\'urgence';
    case 'whatsapp': return 'Widget WhatsApp';
    case 'products': return 'Propositions Produits';
    case 'spacer': return `Espacement (${content.height || 32}px)`;
    default: return type;
  }
};

export default function LayerOutline({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onMoveBlock,
  onDuplicateBlock,
  onRemoveBlock
}: LayerOutlineProps) {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-800">Arborescence des Blocs</span>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
          {blocks.length} bloc{blocks.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {blocks.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs px-4">
            Aucun bloc sur la page. Ajoutez-en depuis la bibliothèque.
          </div>
        ) : (
          blocks.map((block, index) => {
            const isSelected = selectedBlockId === block.id;

            return (
              <div
                key={block.id}
                onClick={() => onSelectBlock(block.id)}
                className={`group flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-orange-50/80 border-orange-500 text-orange-950 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {/* Index / Grabber */}
                <div className="flex items-center gap-1 text-slate-400">
                  <span className="text-[10px] font-mono w-4 text-right font-semibold">{index + 1}</span>
                  <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>

                {/* Icon */}
                <div className={`p-1.5 rounded-lg border shrink-0 ${
                  isSelected ? 'bg-white border-orange-200 shadow-2xs' : 'bg-slate-50 border-slate-100'
                }`}>
                  {getBlockIcon(block.type)}
                </div>

                {/* Title & Type */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold truncate leading-tight">
                    {getBlockTitle(block)}
                  </h4>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5">
                    {block.type}
                  </span>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveBlock(index, 'up');
                    }}
                    disabled={index === 0}
                    className="p-1 hover:bg-white rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-all"
                    title="Monter"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveBlock(index, 'down');
                    }}
                    disabled={index === blocks.length - 1}
                    className="p-1 hover:bg-white rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-all"
                    title="Descendre"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateBlock(block.id);
                    }}
                    className="p-1 hover:bg-white rounded text-slate-400 hover:text-slate-700 transition-all"
                    title="Dupliquer le bloc"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBlock(block.id);
                    }}
                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-all"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
