import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../../../contexts/SocketContext';
import { helperApi, publicApi, adminApi } from '../../../../lib/api';
import { EditorBlock, BlockType, PageSettings, ViewportMode } from './types';
import BuilderNavbar from './BuilderNavbar';
import ComponentLibrary from './ComponentLibrary';
import LayerOutline from './LayerOutline';
import CanvasViewport from './CanvasViewport';
import PropertyInspector from './PropertyInspector';
import PageSettingsModal from './PageSettingsModal';
import QrCodeModal from './QrCodeModal';
import { DEMO_SHOWCASE_TEMPLATE } from './templates';
import { buildReferralUrl } from '../../../../utils/referral';
import { Loader2, Layers, PlusCircle, Settings2, Sparkles, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { defaultsFor } from '@shared/blocks/index.js';

interface SiteBuilderV2Props {
  initialBlocks?: EditorBlock[];
  initialSettings?: PageSettings;
  onCloseDemo: () => void;
  referralCode?: string | null;
  ownerSubdomain?: string | null;
  ownerCustomDomain?: string | null;
  ownerCustomDomainStatus?: string | null;
  accounts?: any[];
  ownerId?: number | null;
  productData?: any;
  onSave?: () => Promise<void>;
}

export default function SiteBuilderV2({
  initialBlocks,
  initialSettings,
  onCloseDemo,
  referralCode,
  ownerSubdomain,
  ownerCustomDomain,
  ownerCustomDomainStatus,
  accounts = [],
  ownerId,
  productData,
  onSave
}: SiteBuilderV2Props) {
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize with demo template if no custom blocks provided
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => {
    if (initialBlocks && initialBlocks.length > 1) return initialBlocks;
    return DEMO_SHOWCASE_TEMPLATE.blocks;
  });

  const [pageSettings, setPageSettings] = useState<PageSettings>(() => {
    if (initialSettings && initialSettings.backgroundColor) return initialSettings;
    return DEMO_SHOWCASE_TEMPLATE.settings;
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportMode>('mobile');
  const [zoom, setZoom] = useState<number>(100);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [leftTab, setLeftTab] = useState<'library' | 'layers'>('library');

  // Modals
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Undo / Redo History
  type HistoryEntry = { blocks: EditorBlock[]; pageSettings: PageSettings };
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const skipHistoryRef = useRef<number>(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((b: EditorBlock[], ps: PageSettings) => {
    if (skipHistoryRef.current > 0) {
      skipHistoryRef.current -= 1;
      return;
    }
    const snap: HistoryEntry = { 
      blocks: JSON.parse(JSON.stringify(b)), 
      pageSettings: JSON.parse(JSON.stringify(ps)) 
    };
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(snap);
    if (newHistory.length > 50) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
    setHasUnsavedChanges(true);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    skipHistoryRef.current += 1;
    historyIndexRef.current -= 1;
    const snap = historyRef.current[historyIndexRef.current];
    setBlocks(JSON.parse(JSON.stringify(snap.blocks)));
    setPageSettings(JSON.parse(JSON.stringify(snap.pageSettings)));
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    skipHistoryRef.current += 1;
    historyIndexRef.current += 1;
    const snap = historyRef.current[historyIndexRef.current];
    setBlocks(JSON.parse(JSON.stringify(snap.blocks)));
    setPageSettings(JSON.parse(JSON.stringify(snap.pageSettings)));
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      pushHistory(blocks, pageSettings);
    }, 400);
    return () => { if (historyTimerRef.current) clearTimeout(historyTimerRef.current); };
  }, [blocks, pageSettings, pushHistory]);

  const activeBlock = blocks.find(b => b.id === selectedBlockId) || null;

  const addBlock = (type: BlockType, targetIndex?: number) => {
    const newBlock: EditorBlock = {
      id: crypto.randomUUID(),
      type,
      content: getDefaultBlockContent(type, ownerId)
    };

    setBlocks(prev => {
      const updated = [...prev];
      if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= updated.length) {
        updated.splice(targetIndex, 0, newBlock);
      } else if (type == "site_header") {
        // A header appended to the bottom of the page is not a header. An
        // explicit drop position still wins — the branch above.
        updated.unshift(newBlock);
      } else {
        updated.push(newBlock);
      }
      return updated;
    });

    setSelectedBlockId(newBlock.id);
    toast.success(`Bloc ${type} ajouté`);
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
    toast.success('Bloc supprimé');
  };

  const duplicateBlock = (id: string) => {
    const blockToCopy = blocks.find(b => b.id === id);
    if (!blockToCopy) return;

    const clonedBlock: EditorBlock = {
      ...JSON.parse(JSON.stringify(blockToCopy)),
      id: crypto.randomUUID()
    };

    const index = blocks.findIndex(b => b.id === id);
    setBlocks(prev => {
      const updated = [...prev];
      updated.splice(index + 1, 0, clonedBlock);
      return updated;
    });

    setSelectedBlockId(clonedBlock.id);
    toast.success('Bloc dupliqué');
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    if (direction === 'up' && index > 0) {
      const temp = newBlocks[index];
      newBlocks[index] = newBlocks[index - 1];
      newBlocks[index - 1] = temp;
    } else if (direction === 'down' && index < newBlocks.length - 1) {
      const temp = newBlocks[index];
      newBlocks[index] = newBlocks[index + 1];
      newBlocks[index + 1] = temp;
    }
    setBlocks(newBlocks);
  };

  const updateBlockContent = (key: string, value: any) => {
    setBlocks(prev => prev.map(b => {
      if (b.id === selectedBlockId) {
        return { ...b, content: { ...b.content, [key]: value } };
      }
      return b;
    }));
  };

  const applyTemplate = (newBlocks: EditorBlock[], newSettings: PageSettings) => {
    setBlocks(newBlocks);
    setPageSettings(newSettings);
    setSelectedBlockId(null);
    toast.success('Modèle appliqué avec succès !');
  };

  const handleSaveWrapper = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave();
        setHasUnsavedChanges(false);
      } catch (err) {
        toast.error('Erreur lors de la sauvegarde');
      } finally {
        setSaving(false);
      }
    } else {
      toast.success('Mode Démo : Modifications validées !');
      setHasUnsavedChanges(false);
    }
  };

  const liveUrl = referralCode 
    ? buildReferralUrl(referralCode, ownerSubdomain, ownerCustomDomain, ownerCustomDomainStatus)
    : '';

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 overflow-hidden font-sans">
      {/* Demo Banner */}
      <div className="h-9 bg-gradient-to-r from-orange-600 via-amber-600 to-emerald-600 px-4 flex items-center justify-between text-white text-xs font-bold shrink-0 z-40">
        <div className="flex items-center gap-2">
          <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase font-black">Mode Démo Studio V2</span>
          <span>Vous testez actuellement la nouvelle interface Studio V2 avec tous ses composants interactifs !</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => applyTemplate(DEMO_SHOWCASE_TEMPLATE.blocks, DEMO_SHOWCASE_TEMPLATE.settings)}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg transition-all"
            title="Recharger la démo complète"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Réinitialiser Démo</span>
          </button>
          <button
            type="button"
            onClick={onCloseDemo}
            className="flex items-center gap-1 bg-slate-900 hover:bg-black text-white px-3 py-1 rounded-lg shadow-sm transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour au Constructeur Original (V1)</span>
          </button>
        </div>
      </div>

      {/* 1. TOP STUDIO NAVBAR */}
      <BuilderNavbar
        onBack={onCloseDemo}
        viewport={viewport}
        setViewport={setViewport}
        zoom={zoom}
        setZoom={setZoom}
        isPreviewMode={isPreviewMode}
        setIsPreviewMode={setIsPreviewMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onSave={handleSaveWrapper}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenQrCode={() => setIsQrModalOpen(true)}
        onPreviewLive={() => liveUrl && window.open(liveUrl, '_blank')}
        referralCode={referralCode}
      />

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT STUDIO PANEL */}
        <div className="w-80 bg-white border-r border-slate-200/80 flex flex-col shrink-0 z-20 shadow-sm">
          <div className="p-2 border-b border-slate-100 flex items-center gap-1 bg-slate-50/70">
            <button
              onClick={() => setLeftTab('library')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                leftTab === 'library'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5 text-orange-500" />
              <span>Bibliothèque</span>
            </button>

            <button
              onClick={() => setLeftTab('layers')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                leftTab === 'layers'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              <span>Arborescence</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700">
                {blocks.length}
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {leftTab === 'library' ? (
              <ComponentLibrary
                onAddBlock={addBlock}
                onApplyTemplate={applyTemplate}
              />
            ) : (
              <LayerOutline
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={(bId) => setSelectedBlockId(bId)}
                onMoveBlock={moveBlock}
                onDuplicateBlock={duplicateBlock}
                onRemoveBlock={removeBlock}
              />
            )}
          </div>
        </div>

        {/* CENTER INTERACTIVE CANVAS */}
        <CanvasViewport
          blocks={blocks}
          pageSettings={pageSettings}
          selectedBlockId={selectedBlockId}
          onSelectBlock={(bId) => setSelectedBlockId(bId)}
          onAddBlock={addBlock}
          onMoveBlock={moveBlock}
          onDuplicateBlock={duplicateBlock}
          onRemoveBlock={removeBlock}
          viewport={viewport}
          zoom={zoom}
          isPreviewMode={isPreviewMode}
          productData={productData}
        />

        {/* RIGHT PROPERTY INSPECTOR */}
        <div className="w-80 bg-white border-l border-slate-200/80 flex flex-col shrink-0 z-20 shadow-sm">
          <PropertyInspector
            block={activeBlock}
            onUpdateContent={updateBlockContent}
            onClose={() => setSelectedBlockId(null)}
            socketId={socket?.id}
            accounts={accounts}
            ownerId={ownerId}
            ownerSubdomain={ownerSubdomain}
            ownerCustomDomain={ownerCustomDomain}
            ownerCustomDomainStatus={ownerCustomDomainStatus}
            buildReferralUrlFn={buildReferralUrl}
          />
        </div>
      </div>

      {/* 3. MODALS */}
      <PageSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        pageSettings={pageSettings}
        setPageSettings={setPageSettings}
        blocks={blocks}
        setBlocks={setBlocks}
      />

      <QrCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        url={liveUrl}
        linkCode={referralCode}
      />
    </div>
  );
}

function getDefaultBlockContent(type: BlockType, ownerId?: number | null): any {
  // Defaults live in the shared block registry, beside the schema each block
  // is validated against, so this builder, the V1 builder and the compiler
  // cannot disagree about what a fresh block carries.
  const content = defaultsFor(type);
  if (type === 'products' && ownerId) {
    // The one default that depends on who is building: a product grid starts
    // scoped to the owner's own catalogue.
    (content as any).accountIds = [ownerId];
  }
  return content;
}
