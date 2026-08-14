import React, { useState } from 'react';
import { 
  Plus, ArrowUp, ArrowDown, Copy, Trash2, LayoutTemplate, 
  Smartphone, Tablet, Monitor, Sparkles, Check
} from 'lucide-react';
import { EditorBlock, BlockType, PageSettings, ViewportMode } from './types';
import BlockRenderer from '../BlockRenderer';
import WhatsAppWidget from '../../../public/WhatsAppWidget';

interface CanvasViewportProps {
  blocks: EditorBlock[];
  pageSettings: PageSettings;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onAddBlock: (type: BlockType, index?: number) => void;
  onMoveBlock: (index: number, direction: 'up' | 'down') => void;
  onDuplicateBlock: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  viewport: ViewportMode;
  zoom: number;
  isPreviewMode: boolean;
  productData?: any;
}

export default function CanvasViewport({
  blocks,
  pageSettings,
  selectedBlockId,
  onSelectBlock,
  onAddBlock,
  onMoveBlock,
  onDuplicateBlock,
  onRemoveBlock,
  viewport,
  zoom,
  isPreviewMode,
  productData
}: CanvasViewportProps) {
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState<number | null>(null);
  const [quickInsertPopoverIndex, setQuickInsertPopoverIndex] = useState<number | null>(null);

  // Viewport container width & styling
  const getViewportStyles = () => {
    switch (viewport) {
      case 'mobile':
        return {
          width: '390px',
          minHeight: '844px',
          borderRadius: '44px',
          border: '12px solid #0f172a',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        };
      case 'tablet':
        return {
          width: '768px',
          minHeight: '1024px',
          borderRadius: '32px',
          border: '14px solid #1e293b',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        };
      case 'desktop':
      default:
        return {
          width: '100%',
          maxWidth: `${pageSettings.maxWidth || 960}px`,
          minHeight: '100%',
          borderRadius: '16px',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.08)',
        };
    }
  };

  const quickBlockTypes: { type: BlockType; label: string; icon: string }[] = [
    { type: 'hero', label: 'Titre Hero', icon: '📝' },
    { type: 'image', label: 'Image', icon: '🖼️' },
    { type: 'video', label: 'Vidéo HD', icon: '🎬' },
    { type: 'slider', label: 'Slider', icon: '✨' },
    { type: 'button', label: 'Bouton CTA', icon: '👉' },
    { type: 'express_checkout', label: 'Checkout COD', icon: '⚡' },
    { type: 'countdown', label: 'Compteur', icon: '⏳' },
    { type: 'whatsapp', label: 'WhatsApp', icon: '💬' }
  ];

  return (
    <div 
      className="flex-1 overflow-y-auto bg-slate-950/90 p-4 sm:p-8 flex justify-center items-start relative select-none"
      onClick={() => onSelectBlock('page')}
    >
      {/* Zoom Scale Wrapper */}
      <div 
        style={{ 
          transform: `scale(${zoom / 100})`, 
          transformOrigin: 'top center',
          transition: 'transform 0.2s ease-out'
        }}
        className="w-full flex justify-center py-4"
      >
        {/* Device Mockup Shell */}
        <div 
          className="relative bg-white flex flex-col transition-all duration-300 overflow-hidden"
          style={{
            ...getViewportStyles(),
            backgroundColor: pageSettings.backgroundColor || '#ffffff'
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectBlock('page');
          }}
        >
          {/* Mobile Speaker & Dynamic Island Mockup */}
          {viewport === 'mobile' && (
            <div className="w-full pt-3 pb-2 flex items-center justify-center bg-transparent z-20 pointer-events-none">
              <div className="w-24 h-5 rounded-full bg-slate-900 flex items-center justify-center gap-1.5 shadow-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-800" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
              </div>
            </div>
          )}

          {/* Tablet Camera Bezel Mockup */}
          {viewport === 'tablet' && (
            <div className="w-full pt-2 pb-1 flex items-center justify-center bg-transparent z-20 pointer-events-none">
              <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-800" />
            </div>
          )}

          {/* Canvas Content Area */}
          <div className="w-full flex-1 flex flex-col relative">
            {blocks.length === 0 ? (
              /* Empty Canvas State */
              <div className="flex-1 min-h-[500px] flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/20 text-orange-600 flex items-center justify-center mb-4">
                  <LayoutTemplate className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-1">Votre page est vide</h3>
                <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                  Ajoutez votre premier composant depuis le panneau de gauche ou cliquez ci-dessous pour insérer un élément.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 max-w-md">
                  {quickBlockTypes.slice(0, 4).map(item => (
                    <button
                      key={item.type}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddBlock(item.type);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      <span>{item.icon}</span>
                      <span>+ {item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : isPreviewMode ? (
              /* Live Interactive Preview Mode */
              <div className="w-full h-full relative">
                <BlockRenderer 
                  isEditor={false}
                  blocks={blocks}
                />
              </div>
            ) : (
              /* Edit Mode with Visual Selection & Insert Dropzones */
              <div className="w-full flex flex-col">
                {/* Top Insertion Zone */}
                <div 
                  className="relative group/insert py-1 flex items-center justify-center"
                  onMouseEnter={() => setHoveredInsertIndex(-1)}
                  onMouseLeave={() => setHoveredInsertIndex(null)}
                >
                  <div className={`h-0.5 w-full bg-orange-400 transition-all ${hoveredInsertIndex === -1 ? 'opacity-100' : 'opacity-0'}`} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuickInsertPopoverIndex(quickInsertPopoverIndex === -1 ? null : -1);
                    }}
                    className={`absolute z-20 flex items-center gap-1 px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded-full text-[11px] font-bold shadow-md transition-all ${
                      hoveredInsertIndex === -1 || quickInsertPopoverIndex === -1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Insérer au début</span>
                  </button>

                  {/* Popover */}
                  {quickInsertPopoverIndex === -1 && (
                    <div 
                      className="absolute top-8 z-30 bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-slate-800 grid grid-cols-4 gap-2 w-72 animate-in fade-in zoom-in-95"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {quickBlockTypes.map(item => (
                        <button
                          key={item.type}
                          onClick={() => {
                            onAddBlock(item.type, 0);
                            setQuickInsertPopoverIndex(null);
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800 hover:bg-orange-600 text-slate-200 hover:text-white transition-all text-center"
                        >
                          <span className="text-base mb-1">{item.icon}</span>
                          <span className="text-[10px] font-bold leading-tight truncate w-full">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Blocks with Dropzones */}
                {blocks.map((block, index) => {
                  const isSelected = selectedBlockId === block.id;

                  return (
                    <React.Fragment key={block.id}>
                      {/* Block Container */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBlock(block.id);
                        }}
                        className={`relative group/block transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-orange-500 ring-offset-2 z-10'
                            : 'hover:outline-1 hover:outline-dashed hover:outline-orange-300'
                        }`}
                      >
                        {/* Block Content Rendered */}
                        <div className="pointer-events-none">
                          <BlockRenderer 
                            isEditor={true}
                            blocks={[block]}
                          />
                        </div>

                        {/* Floating Action Badge on Selection & Hover */}
                        <div className={`absolute top-2 right-2 bg-slate-900/95 backdrop-blur-xs text-white shadow-xl rounded-2xl flex items-center p-1 gap-1 border border-slate-700/80 transition-all ${
                          isSelected ? 'opacity-100 scale-100' : 'opacity-0 group-hover/block:opacity-100 scale-95'
                        }`}>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg ${
                            block.type === 'audio' 
                              ? 'text-emerald-400 bg-emerald-950/60 flex items-center gap-1' 
                              : 'text-orange-400 bg-orange-950/40'
                          }`}>
                            {block.type === 'audio' ? '💬 Note Vocale WhatsApp' : block.type}
                          </span>

                          <div className="w-px h-3.5 bg-slate-700 mx-0.5" />

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveBlock(index, 'up');
                            }}
                            disabled={index === 0}
                            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg disabled:opacity-20 transition-all"
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
                            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg disabled:opacity-20 transition-all"
                            title="Descendre"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateBlock(block.id);
                            }}
                            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-all"
                            title="Dupliquer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <div className="w-px h-3.5 bg-slate-700 mx-0.5" />

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveBlock(block.id);
                            }}
                            className="p-1.5 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-all"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Dropzone Between Blocks */}
                      <div 
                        className="relative group/insert py-1 flex items-center justify-center"
                        onMouseEnter={() => setHoveredInsertIndex(index)}
                        onMouseLeave={() => setHoveredInsertIndex(null)}
                      >
                        <div className={`h-0.5 w-full bg-orange-400 transition-all ${hoveredInsertIndex === index ? 'opacity-100' : 'opacity-0'}`} />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickInsertPopoverIndex(quickInsertPopoverIndex === index ? null : index);
                          }}
                          className={`absolute z-20 flex items-center gap-1 px-3 py-0.5 bg-orange-600 hover:bg-orange-500 text-white rounded-full text-[10px] font-bold shadow-md transition-all ${
                            hoveredInsertIndex === index || quickInsertPopoverIndex === index ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>Insérer un bloc</span>
                        </button>

                        {/* Quick Insert Popover */}
                        {quickInsertPopoverIndex === index && (
                          <div 
                            className="absolute top-6 z-30 bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-slate-800 grid grid-cols-4 gap-2 w-72 animate-in fade-in zoom-in-95"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {quickBlockTypes.map(item => (
                              <button
                                key={item.type}
                                onClick={() => {
                                  onAddBlock(item.type, index + 1);
                                  setQuickInsertPopoverIndex(null);
                                }}
                                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800 hover:bg-orange-600 text-slate-200 hover:text-white transition-all text-center"
                              >
                                <span className="text-base mb-1">{item.icon}</span>
                                <span className="text-[10px] font-bold leading-tight truncate w-full">{item.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Floating WhatsApp Widget in Canvas */}
            {(() => {
              const whatsappBlock = blocks.find(b => b.type === 'whatsapp');
              if (whatsappBlock) {
                if (whatsappBlock.content.enableWidget !== false) {
                  return <WhatsAppWidget settings={{ enabled: true, ...whatsappBlock.content }} isEditorPreview={true} />;
                }
              } else if (pageSettings.whatsappWidget?.enabled) {
                return <WhatsAppWidget settings={pageSettings.whatsappWidget} isEditorPreview={true} />;
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
