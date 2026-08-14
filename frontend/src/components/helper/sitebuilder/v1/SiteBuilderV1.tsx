import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import { useSocket } from '../../../../contexts/SocketContext';
import { helperApi, publicApi, uploadApi, adminApi } from '../../../../lib/api';
import BlockRenderer, { EditorBlock, BlockType } from '../BlockRenderer';
import WhatsAppWidget, { IconRenderer } from '../../../public/WhatsAppWidget';
import { 
  Type, Image as ImageIcon, Heading, LayoutTemplate, Link as LinkIcon, 
  ShoppingCart, ArrowUp, ArrowDown, Trash2, Save, ChevronLeft, Loader2,
  Clock, Space, Upload, ShieldCheck, ShieldAlert, Plus, ExternalLink, Code, Copy, Download, MessageSquare,
  Layers, GripVertical, Undo2, Redo2, ShoppingBag, Music, Video, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { buildReferralUrl } from '../../../../utils/referral';
import { currentBasePath } from '../../../../lib/dashboardBase';

interface SiteBuilderV1Props {
  builderVersion?: 'v1' | 'v2';
  onSwitchVersion?: (v: 'v1' | 'v2') => void;
}

export default function SiteBuilderV1({ builderVersion = 'v1', onSwitchVersion }: SiteBuilderV1Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Block influencer if they do not have builder permission enabled
  useEffect(() => {
    const role = user?.roleName || user?.role;
    if (role === 'INFLUENCER' && !user?.canManageInfluencerLinks) {
      toast.error("Vous n'avez pas l'autorisation d'accéder au constructeur de page.");
      navigate('/influencer/links');
    }
  }, [user, navigate]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [pageSettings, setPageSettings] = useState<any>({ 
    backgroundColor: '#ffffff',
    whatsappWidget: {
      enabled: false,
      phoneNumber: '',
      showOnDesktop: true,
      showOnMobile: true,
      iconColor: '#25D366',
      iconStyle: 'bubble',
      hoverText: 'WhatsApp',
      preSetMessage: '',
      useWhatsappWebOnDesktop: true,
      welcomeMessage: 'How can I help you? 😊',
      openOnLoad: false,
      headline: "Let's chat on WhatsApp",
      headerBg: '#25D366',
      nickname: 'Nitso',
      profileImage: ''
    }
  });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [productData, setProductData] = useState<any>(null);
  const { socket } = useSocket();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPipelineStage, setUploadPipelineStage] = useState<'vps_upload' | 'vps_compress' | 'idle'>('idle');
  const [stagePercentages, setStagePercentages] = useState({
    vpsUpload: 0,
    vpsCompress: 0,
  });

  const [uploadProgressMsg, setUploadProgressMsg] = useState<string>('');
  const [uploadingAudioId, setUploadingAudioId] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [ownerSubdomain, setOwnerSubdomain] = useState<string | null>(null);
  const [ownerCustomDomain, setOwnerCustomDomain] = useState<string | null>(null);
  const [ownerCustomDomainStatus, setOwnerCustomDomainStatus] = useState<string | null>(null);

  // Undo / Redo history
  type Snapshot = { blocks: EditorBlock[]; pageSettings: any };
  const historyRef = useRef<Snapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const skipHistoryRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((b: EditorBlock[], ps: any) => {
    if (skipHistoryRef.current > 0) {
      skipHistoryRef.current -= 1;
      return;
    }
    const snap: Snapshot = { blocks: JSON.parse(JSON.stringify(b)), pageSettings: JSON.parse(JSON.stringify(ps)) };
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(snap);
    if (newHistory.length > 50) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
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
    if (loading) return;
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      pushHistory(blocks, pageSettings);
    }, 400);
    return () => { if (historyTimerRef.current) clearTimeout(historyTimerRef.current); };
  }, [blocks, pageSettings, loading, pushHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // JSON States
  const [jsonInput, setJsonInput] = useState('');

  const handleCopyJSON = () => {
    try {
      const layoutData = { blocks, settings: pageSettings };
      navigator.clipboard.writeText(JSON.stringify(layoutData, null, 2));
      toast.success('Layout JSON copié !');
    } catch (err) {
      toast.error('Impossible de copier.');
    }
  };

  const handleImportJSON = () => {
    if (!jsonInput.trim()) {
      toast.error('Le champ JSON est vide');
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput);
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        setBlocks(parsed.blocks);
        if (parsed.settings) setPageSettings(parsed.settings);
        toast.success('Layout importé avec succès !');
      } else if (Array.isArray(parsed)) {
        setBlocks(parsed);
        toast.success('Blocks importés avec succès !');
      } else {
        toast.error('Format de layout invalide');
      }
    } catch (err) {
      toast.error('JSON invalide. Veuillez vérifier le code.');
    }
  };

  const activeBlock = blocks.find(b => b.id === selectedBlockId);

  // Load existing data
  useEffect(() => {
    if (id) {
      loadLandingPage();
    }
  }, [id]);

  const loadLandingPage = async () => {
    try {
      const res = await helperApi.getLandingPage(Number(id));
      const landingPage = res.data.status === 'success' ? res.data.data : res.data;
      
      if (landingPage?.customStructure) {
        if (Array.isArray(landingPage.customStructure)) {
          setBlocks(landingPage.customStructure as EditorBlock[]);
        } else if (landingPage.customStructure.blocks) {
          setBlocks(landingPage.customStructure.blocks);
          if (landingPage.customStructure.settings) {
            setPageSettings({
              backgroundColor: '#ffffff',
              ...landingPage.customStructure.settings,
              whatsappWidget: {
                enabled: false,
                phoneNumber: '',
                showOnDesktop: true,
                showOnMobile: true,
                iconColor: '#25D366',
                iconStyle: 'bubble',
                hoverText: 'WhatsApp',
                preSetMessage: '',
                useWhatsappWebOnDesktop: true,
                welcomeMessage: 'How can I help you? 😊',
                openOnLoad: false,
                headline: "Let's chat on WhatsApp",
                headerBg: '#25D366',
                nickname: 'Nitso',
                profileImage: '',
                ...(landingPage.customStructure.settings.whatsappWidget || {})
              }
            });
          }
        }
      } else {
        setBlocks([
          { id: crypto.randomUUID(), type: 'express_checkout', content: { title: 'Commander Maintenant', buttonText: 'Confirmer ma commande' } }
        ]);
      }

      const product = landingPage?.referralLink?.product;
      if (product) setProductData(product);
      if (landingPage?.referralLink?.code) setReferralCode(landingPage.referralLink.code);

      const ownerUserId = landingPage?.referralLink?.influencerId || landingPage?.referralLink?.influencer?.id;
      if (ownerUserId) setOwnerId(ownerUserId);

      const ownerSub = landingPage?.referralLink?.influencer?.subdomain;
      if (ownerSub) setOwnerSubdomain(ownerSub);

      const ownerCustomDom = landingPage?.referralLink?.influencer?.customDomain;
      if (ownerCustomDom) setOwnerCustomDomain(ownerCustomDom);

      const ownerCustomDomStatus = landingPage?.referralLink?.influencer?.customDomainStatus;
      if (ownerCustomDomStatus) setOwnerCustomDomainStatus(ownerCustomDomStatus);

      try {
        const uRes = await adminApi.users({ limit: 1000 });
        const usersList = uRes.data?.status === 'success' ? uRes.data.data.users : uRes.data?.users || [];
        setAccounts(usersList);
      } catch (uErr) {
        console.error('Failed to load accounts in SiteBuilder:', uErr);
      }
    } catch (err) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await helperApi.updateLandingPage(Number(id), {
        customStructure: {
          blocks,
          settings: pageSettings
        }
      });
      toast.success('Paramètres sauvegardés avec succès !');
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: BlockType) => {
    const defaultContent = getDefaultContentForType(type) as any;
    if (type === 'products' && ownerId) {
      defaultContent.accountIds = [ownerId];
    }
    const newBlock: EditorBlock = {
      id: crypto.randomUUID(),
      type,
      content: defaultContent
    };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const removeBlock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const moveBlock = (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
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

  const getDefaultContentForType = (type: BlockType) => {
    switch (type) {
      case 'header': return { text: 'Mon Entreprise', bgColor: '#ffffff', color: '#111827', paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 4 };
      case 'hero': return { title: 'Offre Spéciale !', subtitle: 'Découvrez notre produit exclusif.', bgColor: '#f9fafb', titleColor: '#111827', subtitleColor: '#4b5563', paddingTop: 48, paddingBottom: 48, marginTop: 0, marginBottom: 24 };
      case 'image': return { url: '', height: 500, paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0 };
      case 'text': return { text: 'Nouveau paragraphe', isHeading: false, color: '#374151', align: 'left', verticalAlign: 'center', paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 0 };
      case 'button': return { text: 'Commander Maintenant', bgColor: '#f97316', link: '', behavior: 'link', stickyMobile: false, stickyDesktop: false, animationLayout: 'none', animationTiming: 'ease-in-out', paddingTop: 24, paddingBottom: 24, marginTop: 0, marginBottom: 0 };
      case 'countdown': return { text: "L'offre expire bientôt !", paddingTop: 24, paddingBottom: 24, marginTop: 0, marginBottom: 0 };
      case 'whatsapp': return {
        enableWidget: true,
        phoneNumber: '',
        headline: "Let's chat on WhatsApp",
        nickname: 'Nitso',
        welcomeMessage: 'How can I help you? 😊',
        headerBg: '#25D366',
        iconStyle: 'bubble',
        hoverText: 'WhatsApp',
        preSetMessage: '',
        profileImage: '',
        showOnDesktop: true,
        showOnMobile: true,
        openOnLoad: false,
        useWhatsappWebOnDesktop: true
      };
      case 'spacer': return { height: 32 };
      case 'slider': return {
        slides: [
          { title: 'Carte 1', description: 'Description de la première carte.', mediaUrl: '' },
          { title: 'Carte 2', description: 'Description de la deuxième carte.', mediaUrl: '' }
        ],
        cardsPerView: 1,
        cardGap: 16,
        autoPlay: true,
        autoPlaySpeed: 4000,
        showArrows: true,
        showDots: true,
        mediaHeight: 280,
        titleColor: '#111827',
        descColor: '#6b7280',
        cardBg: '#ffffff',
        cardRadius: 20,
        cardBorderWidth: 0,
        cardBorderColor: '#e5e7eb',
        cardShadow: 'md',
        textAlign: 'left',
        dotColor: '#f97316',
        paddingTop: 24, paddingBottom: 24, marginTop: 0, marginBottom: 0
      };
      case 'products': return {
        accountIds: [],
        layoutType: 'grid',
        selectedProducts: [],
        gridCols: 3,
        cardBg: '#ffffff',
        cardRadius: 16,
        cardShadow: 'md',
        titleColor: '#111827',
        descColor: '#4b5563',
        priceColor: '#f97316',
        btnBg: '#f97316',
        btnColor: '#ffffff',
        paddingTop: 32, paddingBottom: 32, marginTop: 0, marginBottom: 0
      };
      case 'express_checkout': return {
        title: 'اطلب الآن',
        subtitle: 'املأ النموذج أدناه لحجز منتجك. الدفع عند الاستلام.',
        buttonText: 'تأكيد الطلب',
        themeColor: '#f97316',
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
        borderRadiusTL: 0,
        borderRadiusTR: 0,
        borderRadiusBL: 0,
        borderRadiusBR: 0,
        borderWidth: 0,
        borderColor: '#f3f4f6',
        priceColor: '#f97316',
        priceSize: 30,
        showPrice: true,
        options: [],
        packColor: '#f64444',
        packBorderWidth: 2,
        packBorderRadius: 16,
        paddingTop: 32, paddingBottom: 32, paddingLeft: 16, paddingRight: 16, marginTop: 0, marginBottom: 0
      };
      case 'audio': return {
        themeStyle: 'whatsapp',
        audios: [
          { id: '1', title: 'Avis Client', senderName: 'Fatima (Casablanca)', time: '11:42', url: '', avatarUrl: '' }
        ],
        bubbleColor: '#ffffff',
        playBtnColor: '#25D366',
        activeWaveColor: '#34B7F1',
        showCheckmarks: true,
        showSpeedToggle: true,
        controls: true,
        autoplay: false,
        loop: false,
        bgColor: '#ffffff',
        borderColor: '#f3f4f6',
        paddingTop: 16,
        paddingBottom: 16,
        marginTop: 0,
        marginBottom: 0
      };
      case 'video': return { url: '', redirectUrl: '', width: 100, autoplay: false, loop: false, muted: false, controls: true, showFullscreenBtn: true, paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 0 };
      default: return {};
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 overflow-hidden font-sans">
      {/* Top Navbar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              const role = user?.roleName || user?.role;
              if (role === 'SUPER_ADMIN') {
                navigate('/admin/links');
              } else if (role === 'HELPER') {
                navigate('/helper/links');
              } else if (role === 'VENDOR' || role === 'VENDOR_HELPER') {
                navigate(`${currentBasePath(role)}/links`);
              } else if (role === 'INFLUENCER') {
                navigate('/influencer/links');
              } else {
                navigate(-1);
              }
            }} 
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-purple-600">
              <LayoutTemplate className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-gray-900 text-sm hidden sm:inline">Constructeur de Page (BETA)</span>
          </div>

          {/* Builder Version Switcher */}
          {onSwitchVersion && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs gap-1 ml-2">
              <button
                type="button"
                onClick={() => onSwitchVersion('v1')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  builderVersion === 'v1'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>🛠️ V1 (Classique)</span>
              </button>
              <button
                type="button"
                onClick={() => onSwitchVersion('v2')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  builderVersion === 'v2'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>⚡ V2 (Studio)</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-2 rounded-md hover:bg-white hover:shadow-sm text-gray-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
              title="Annuler (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-2 rounded-md hover:bg-white hover:shadow-sm text-gray-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
              title="Refaire (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {referralCode && (
            <button 
              onClick={() => window.open(buildReferralUrl(referralCode, ownerSubdomain, ownerCustomDomain, ownerCustomDomainStatus), '_blank')}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Prévisualiser</span>
            </button>
          )}

          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Sauvegarder</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Toolbar */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col z-10 shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Composants</h3>
            <div className="space-y-2">
              <ToolButton fullWidth icon={<ImageIcon className="w-4 h-4" />} label="Image" onClick={() => addBlock('image')} />
              <ToolButton fullWidth icon={<Layers className="w-4 h-4 text-purple-500" />} label="Slider / Carrousel" onClick={() => addBlock('slider')} />
              <ToolButton fullWidth icon={<ShoppingBag className="w-4 h-4 text-orange-500" />} label="Propositions Produits" onClick={() => addBlock('products')} />
              <ToolButton fullWidth icon={<Music className="w-4 h-4 text-emerald-500" />} label="Note Vocale (Audio)" onClick={() => addBlock('audio')} badge="WhatsApp" />
              <ToolButton fullWidth icon={<Video className="w-4 h-4 text-rose-500" />} label="Vidéo" onClick={() => addBlock('video')} />
            </div>
          </div>
          
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Conversion</h3>
            <div className="grid grid-cols-2 gap-2">
              <ToolButton icon={<LinkIcon className="w-4 h-4" />} label="Button" onClick={() => addBlock('button')} />
              <ToolButton icon={<MessageSquare className="w-4 h-4 text-emerald-500" />} label="WhatsApp" onClick={() => addBlock('whatsapp')} />
            </div>
            <div className="mt-2">
              <ToolButton fullWidth icon={<ShoppingCart className="w-4 h-4 text-orange-500" />} label="Express Checkout" onClick={() => addBlock('express_checkout')} />
            </div>
          </div>
        </div>

        {/* Center Canvas */}
        <div 
          className="flex-1 overflow-y-auto bg-gray-100/50 p-4 sm:p-8 flex justify-center items-start"
          onClick={() => setSelectedBlockId('page')}
        >
          <div 
            className="w-full max-w-4xl min-h-full bg-white shadow-xl shadow-gray-200/50 rounded-lg flex flex-col relative pb-32 transition-colors duration-300"
            style={{ backgroundColor: pageSettings.backgroundColor }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBlockId('page');
            }}
          >
            {blocks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12">
                <LayoutTemplate className="w-12 h-12 mb-4 opacity-20" />
                <p>Cliquez sur un composant à gauche pour l'ajouter.</p>
              </div>
            ) : (
              blocks.map((block, index) => (
                <div 
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBlockId(block.id);
                  }}
                  className={`relative group border-2 transition-all cursor-pointer ${selectedBlockId === block.id ? 'border-orange-500 z-10' : 'border-transparent hover:border-gray-200'}`}
                >
                  <div className="pointer-events-none">
                    <BlockRenderer 
                      isEditor={true}
                      blocks={[block]} 
                    />
                  </div>
                  
                  <div className={`absolute top-2 right-2 bg-white shadow-lg rounded-xl flex items-center p-1 gap-1 border border-gray-200 transition-opacity ${selectedBlockId === block.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button onClick={(e) => moveBlock(index, 'up', e)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Monter"><ArrowUp className="w-4 h-4" /></button>
                    <button onClick={(e) => moveBlock(index, 'down', e)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Descendre"><ArrowDown className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <button onClick={(e) => removeBlock(block.id, e)} className="p-1.5 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-lg" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))
            )}

            {pageSettings.whatsappWidget?.enabled && (
              <WhatsAppWidget settings={pageSettings.whatsappWidget} isEditorPreview={true} />
            )}
          </div>
        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col z-10 shrink-0">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Propriétés</h3>
            {activeBlock && (
              <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold uppercase">
                {activeBlock.type}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeBlock ? (
              <div className="space-y-4">
                {/* Specific Fields per Type */}

                {/* AUDIO BLOCK WITH WHATSAPP UI */}
                {activeBlock.type === 'audio' && (
                  <div className="space-y-4">
                    {/* Style Switcher */}
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                      <div className="text-[11px] font-black text-emerald-950 uppercase flex items-center gap-1.5">
                        <span>💬</span> Style du Lecteur
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-lg border border-emerald-200">
                        <button
                          type="button"
                          onClick={() => updateBlockContent('themeStyle', 'whatsapp')}
                          className={`py-1.5 px-2 rounded text-xs font-bold transition-all ${
                            (activeBlock.content.themeStyle || 'whatsapp') === 'whatsapp'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          💬 WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBlockContent('themeStyle', 'classic')}
                          className={`py-1.5 px-2 rounded text-xs font-bold transition-all ${
                            activeBlock.content.themeStyle === 'classic'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🎵 Classique
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-700 uppercase">Pistes Vocales ({(activeBlock.content.audios || []).length})</h4>
                      <button
                        onClick={() => {
                          const newAudios = [
                            ...(activeBlock.content.audios || []),
                            {
                              id: crypto.randomUUID(),
                              title: `Avis Vocal ${(activeBlock.content.audios?.length || 0) + 1}`,
                              senderName: `Client ${(activeBlock.content.audios?.length || 0) + 1}`,
                              time: '11:42',
                              url: '',
                              avatarUrl: ''
                            }
                          ];
                          updateBlockContent('audios', newAudios);
                        }}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-md"
                      >
                        + Ajouter un audio
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(activeBlock.content.audios || []).map((audio: any, idx: number) => (
                        <div key={audio.id || idx} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 relative group">
                          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
                            <span>Piste #{idx + 1}</span>
                            {(activeBlock.content.audios || []).length > 1 && (
                              <button
                                onClick={() => {
                                  const newAudios = activeBlock.content.audios.filter((_: any, i: number) => i !== idx);
                                  updateBlockContent('audios', newAudios);
                                }}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {(activeBlock.content.themeStyle || 'whatsapp') === 'whatsapp' && (
                            <>
                              <Field 
                                label="Nom du Contact / Client" 
                                type="text" 
                                value={audio.senderName || audio.title} 
                                onChange={(v: any) => {
                                  const newAudios = [...activeBlock.content.audios];
                                  newAudios[idx] = { ...newAudios[idx], senderName: v, title: v };
                                  updateBlockContent('audios', newAudios);
                                }} 
                                placeholder="Ex: Fatima (Casablanca)"
                              />
                              <Field 
                                label="Heure du message" 
                                type="text" 
                                value={audio.time || '11:42'} 
                                onChange={(v: any) => {
                                  const newAudios = [...activeBlock.content.audios];
                                  newAudios[idx] = { ...newAudios[idx], time: v };
                                  updateBlockContent('audios', newAudios);
                                }} 
                                placeholder="11:42"
                              />
                              <Field 
                                label="Photo de Profil (Avatar URL)" 
                                type="text" 
                                value={audio.avatarUrl || ''} 
                                onChange={(v: any) => {
                                  const newAudios = [...activeBlock.content.audios];
                                  newAudios[idx] = { ...newAudios[idx], avatarUrl: v };
                                  updateBlockContent('audios', newAudios);
                                }} 
                                placeholder="https://..."
                              />
                            </>
                          )}

                          <Field 
                            label="URL Fichier Audio MP3" 
                            type="text" 
                            value={audio.url || ''} 
                            onChange={(v: any) => {
                              const newAudios = [...activeBlock.content.audios];
                              newAudios[idx] = { ...newAudios[idx], url: v };
                              updateBlockContent('audios', newAudios);
                            }} 
                            placeholder="https://.../audio.mp3"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HERO */}
                {activeBlock.type === 'hero' && (
                  <div className="space-y-4">
                    <Field label="Couleur de Fond" type="color" value={activeBlock.content.bgColor} onChange={(v: any) => updateBlockContent('bgColor', v)} />
                    <Field label="Titre principal" type="text" value={activeBlock.content.title} onChange={(v: any) => updateBlockContent('title', v)} />
                    <Field label="Couleur du titre" type="color" value={activeBlock.content.titleColor} onChange={(v: any) => updateBlockContent('titleColor', v)} />
                    <Field label="Sous-titre" type="textarea" value={activeBlock.content.subtitle} onChange={(v: any) => updateBlockContent('subtitle', v)} />
                  </div>
                )}

                {/* HEADER */}
                {activeBlock.type === 'header' && (
                  <div className="space-y-4">
                    <Field label="Couleur de Fond" type="color" value={activeBlock.content.bgColor} onChange={(v: any) => updateBlockContent('bgColor', v)} />
                    <Field label="Nom de la marque" type="text" value={activeBlock.content.text} onChange={(v: any) => updateBlockContent('text', v)} />
                    <Field label="Couleur de texte" type="color" value={activeBlock.content.color} onChange={(v: any) => updateBlockContent('color', v)} />
                  </div>
                )}

                {/* TEXT */}
                {activeBlock.type === 'text' && (
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 font-bold">
                      <input type="checkbox" checked={activeBlock.content.isHeading} onChange={(e) => updateBlockContent('isHeading', e.target.checked)} />
                      Titre de section (h3)
                    </label>
                    <Field label="Texte" type="textarea" value={activeBlock.content.text} onChange={(v: any) => updateBlockContent('text', v)} />
                    <Field label="Couleur" type="color" value={activeBlock.content.color} onChange={(v: any) => updateBlockContent('color', v)} />
                  </div>
                )}

                {/* BUTTON */}
                {activeBlock.type === 'button' && (
                  <div className="space-y-4">
                    <Field label="Texte du Bouton" type="text" value={activeBlock.content.text} onChange={(v: any) => updateBlockContent('text', v)} />
                    <Field label="Couleur de Fond" type="color" value={activeBlock.content.bgColor} onChange={(v: any) => updateBlockContent('bgColor', v)} />
                    <Field label="Couleur du Texte" type="color" value={activeBlock.content.textColor} onChange={(v: any) => updateBlockContent('textColor', v)} />
                  </div>
                )}

                {/* EXPRESS CHECKOUT */}
                {activeBlock.type === 'express_checkout' && (
                  <div className="space-y-4">
                    <Field label="Titre du Formulaire" type="text" value={activeBlock.content.title} onChange={(v: any) => updateBlockContent('title', v)} />
                    <Field label="Sous-titre" type="text" value={activeBlock.content.subtitle} onChange={(v: any) => updateBlockContent('subtitle', v)} />
                    <Field label="Texte du Bouton" type="text" value={activeBlock.content.buttonText} onChange={(v: any) => updateBlockContent('buttonText', v)} />
                    <Field label="Couleur Principale" type="color" value={activeBlock.content.themeColor || '#f97316'} onChange={(v: any) => updateBlockContent('themeColor', v)} />
                  </div>
                )}
              </div>
            ) : (
              /* Global Page Settings */
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-black text-gray-900 uppercase mb-3 flex items-center justify-between">
                    <span>Paramètres Page</span>
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">GLOBAL</span>
                  </h4>
                  <Field 
                    label="Couleur de fond de page" 
                    type="color" 
                    value={pageSettings.backgroundColor || '#ffffff'} 
                    onChange={(v: any) => setPageSettings((prev: any) => ({ ...prev, backgroundColor: v }))} 
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <h4 className="text-xs font-black text-gray-900 uppercase flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-purple-600" />
                    <span>Données du Layout (JSON)</span>
                  </h4>
                  <button
                    onClick={handleCopyJSON}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier le Layout (JSON)</span>
                  </button>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder="Collez votre code JSON de layout ici..."
                    className="w-full text-xs font-mono p-2.5 bg-gray-50 border border-gray-200 rounded-xl h-24 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleImportJSON}
                    className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                  >
                    Appliquer le JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers
function ToolButton({ icon, label, onClick, fullWidth, badge }: { icon: React.ReactNode; label: string; onClick: () => void; fullWidth?: boolean; badge?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 p-2.5 bg-gray-50 hover:bg-orange-50 hover:text-orange-600 text-gray-700 font-bold text-xs rounded-xl border border-gray-100 transition-all text-left ${
        fullWidth ? 'w-full' : ''
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold">{badge}</span>}
    </button>
  );
}

function Field({ label, type, value, onChange, placeholder }: { label: string; type: string; value: any; onChange: (v: any) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-white focus:outline-none focus:border-orange-500 min-h-[70px]"
        />
      ) : type === 'color' ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded-lg border border-gray-200 p-0.5 cursor-pointer shrink-0"
          />
          <input
            type="text"
            value={value || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 text-xs font-mono font-bold uppercase border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white text-gray-700"
          />
        </div>
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-xs border border-gray-200 rounded-xl px-2.5 py-2 bg-white focus:outline-none focus:border-orange-500 text-gray-700"
        />
      )}
    </div>
  );
}