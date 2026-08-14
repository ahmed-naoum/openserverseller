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
  switch (type) {
    case 'header':
      return { text: 'MON ENTREPRISE', bgColor: '#0f172a', color: '#ffffff', paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 0 };
    case 'hero':
      return { title: 'Offre Spéciale !', subtitle: 'Découvrez notre produit exclusif.', bgColor: '#ffffff', titleColor: '#0f172a', subtitleColor: '#475569', paddingTop: 40, paddingBottom: 32, marginTop: 0, marginBottom: 16 };
    case 'image':
      return { url: '', height: 500, width: 100, paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0 };
    case 'text':
      return { text: 'Nouveau paragraphe de description.', isHeading: false, color: '#334155', align: 'left', verticalAlign: 'center', paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 0 };
    case 'button':
      return { text: 'COMMANDER MAINTENANT', bgColor: '#ea580c', textColor: '#ffffff', textSize: 16, buttonBorderRadius: 16, buttonPaddingY: 16, buttonPaddingX: 32, link: '', behavior: 'checkout', stickyMobile: false, stickyDesktop: false, animationLayout: 'none', paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 0 };
    case 'countdown':
      return { text: "🔥 L'offre flash expire bientôt !", paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 8 };
    case 'whatsapp':
      return { enableWidget: true, phoneNumber: '', headline: "Discutons sur WhatsApp", nickname: 'Service Client', welcomeMessage: 'Bonjour ! Comment pouvons-nous vous aider ?', headerBg: '#25D366', iconStyle: 'bubble', iconType: 'whatsapp', position: 'bottom-right' };
    case 'spacer':
      return { height: 32 };
    case 'slider':
      return {
        slides: [
          { title: 'Bénéfice 1', description: 'Description de la première caractéristique clé.', mediaUrl: '' },
          { title: 'Bénéfice 2', description: 'Description de la deuxième caractéristique clé.', mediaUrl: '' }
        ],
        cardsPerView: 1,
        cardGap: 16,
        autoPlay: true,
        autoPlaySpeed: 4000,
        showArrows: true,
        showDots: true,
        mediaHeight: 260,
        titleColor: '#0f172a',
        descColor: '#64748b',
        cardBg: '#ffffff',
        cardRadius: 20,
        cardBorderWidth: 1,
        cardBorderColor: '#e2e8f0',
        cardShadow: 'md',
        textAlign: 'center',
        dotColor: '#ea580c',
        paddingTop: 24,
        paddingBottom: 24,
        marginTop: 0,
        marginBottom: 0
      };
    case 'products':
      return { accountIds: ownerId ? [ownerId] : [], layoutType: 'grid', selectedProducts: [], gridCols: 3, cardBg: '#ffffff', cardRadius: 16, cardShadow: 'md', titleColor: '#0f172a', descColor: '#64748b', priceColor: '#ea580c', btnBg: '#ea580c', btnColor: '#ffffff', paddingTop: 32, paddingBottom: 32, marginTop: 0, marginBottom: 0 };
    case 'express_checkout':
      return {
        title: 'اطلب الآن (الدفع عند الاستلام)',
        subtitle: 'املأ النموذج أدناه لتأكيد طلبك. التوصيل مجاني والدفع عند الاستلام.',
        buttonText: 'تأكيد الطلب',
        themeColor: '#ea580c',
        formBgColor: '#ffffff',
        containerBgColor: '#ffffff',
        nameLabel: 'الاسم الكامل *',
        namePlaceholder: 'مثال: يوسف بن جلون',
        phoneLabel: 'رقم الهاتف *',
        phonePlaceholder: '06 XX XX XX XX',
        cityLabel: 'المدينة *',
        cityPlaceholder: 'مثال: الدار البيضاء',
        addressLabel: 'العنوان (اختياري)',
        addressPlaceholder: 'عنوانك الكامل لترهين التوصيل...',
        borderRadiusTL: 16,
        borderRadiusTR: 16,
        borderRadiusBL: 16,
        borderRadiusBR: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        priceColor: '#ea580c',
        priceSize: 32,
        showPrice: true,
        options: [],
        packColor: '#ea580c',
        packBorderWidth: 2,
        packBorderRadius: 16,
        paddingTop: 32,
        paddingBottom: 32,
        paddingLeft: 16,
        paddingRight: 16,
        marginTop: 0,
        marginBottom: 0
      };
    case 'audio':
      return {
        themeStyle: 'whatsapp',
        audios: [
          { id: '1', title: 'Avis Client', senderName: 'Fatima (Casablanca) 🇲🇦', time: '11:42', url: '', avatarUrl: '' }
        ],
        bubbleColor: '#ffffff',
        playBtnColor: '#25D366',
        activeWaveColor: '#34B7F1',
        showCheckmarks: true,
        showSpeedToggle: true,
        paddingTop: 16,
        paddingBottom: 16,
        marginTop: 0,
        marginBottom: 0
      };
    case 'video':
      return { url: '', redirectUrl: '', width: 100, autoplay: false, loop: false, muted: false, controls: true, showFullscreenBtn: true, paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 0 };
    default:
      return {};
  }
}
