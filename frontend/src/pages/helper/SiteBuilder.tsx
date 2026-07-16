import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { helperApi, publicApi, uploadApi, adminApi } from '../../lib/api';
import BlockRenderer, { EditorBlock, BlockType } from '../../components/helper/sitebuilder/BlockRenderer';
import WhatsAppWidget, { IconRenderer } from '../../components/public/WhatsAppWidget';
import { 
  Type, Image as ImageIcon, Heading, LayoutTemplate, Link as LinkIcon, 
  ShoppingCart, ArrowUp, ArrowDown, Trash2, Save, ChevronLeft, Loader2,
  Clock, Space, Upload, ShieldCheck, Plus, ExternalLink, Code, Copy, Download, MessageSquare,
  Layers, GripVertical, Undo2, Redo2, ShoppingBag, Music, Video
} from 'lucide-react';
import toast from 'react-hot-toast';
import { buildReferralUrl } from '../../utils/referral';

export default function SiteBuilder() {
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingAudioId, setUploadingAudioId] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [ownerSubdomain, setOwnerSubdomain] = useState<string | null>(null);

  // ── Undo / Redo history ──
  type Snapshot = { blocks: EditorBlock[]; pageSettings: any };
  const historyRef = useRef<Snapshot[]>([]);
  const historyIndexRef = useRef(-1);
  // Skip counter: when > 0, the next N useEffect fires from state changes are ignored (not pushed to history).
  // This bridges the gap between synchronous undo/redo calls and async React setState renders.
  const skipHistoryRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((b: EditorBlock[], ps: any) => {
    if (skipHistoryRef.current > 0) {
      skipHistoryRef.current -= 1;
      return;
    }
    const snap: Snapshot = { blocks: JSON.parse(JSON.stringify(b)), pageSettings: JSON.parse(JSON.stringify(ps)) };
    // Trim any redo entries beyond the current index
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(snap);
    // Cap at 50 entries
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

  // Track changes with debounce to avoid spamming history on rapid typing
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading) return;
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      pushHistory(blocks, pageSettings);
    }, 400);
    return () => { if (historyTimerRef.current) clearTimeout(historyTimerRef.current); };
  }, [blocks, pageSettings, loading, pushHistory]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // JSON Input/Export states
  const [jsonInput, setJsonInput] = useState('');

  const handleCopyJSON = () => {
    try {
      const layoutData = {
        blocks,
        settings: pageSettings
      };
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
        if (parsed.settings) {
          setPageSettings(parsed.settings);
        }
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

  const [blockProducts, setBlockProducts] = useState<any[]>([]);
  const [loadingBlockProducts, setLoadingBlockProducts] = useState(false);

  const activeBlock = blocks.find(b => b.id === selectedBlockId);

  useEffect(() => {
    if (activeBlock?.type !== 'products') return;
    const accountIds = activeBlock.content.accountIds || [];

    // Automatically enforce that the link ownerId is selected in the background
    if (ownerId && (!accountIds.includes(ownerId) || accountIds.length === 0)) {
      updateBlockContent('accountIds', [ownerId]);
      return;
    }

    if (accountIds.length === 0) {
      setBlockProducts([]);
      return;
    }
    const fetchBlockProducts = async () => {
      setLoadingBlockProducts(true);
      try {
        const res = await publicApi.getProductsByAccounts(accountIds.join(','));
        const data = res.data.status === 'success' ? res.data.data.products : res.data.products || [];
        setBlockProducts(data);
      } catch (err) {
        console.error('Failed to fetch block products in SiteBuilder:', err);
      } finally {
        setLoadingBlockProducts(false);
      }
    };
    fetchBlockProducts();
  }, [activeBlock?.id, JSON.stringify(activeBlock?.content?.accountIds), ownerId]);

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
        // Handle new structure { blocks: [], settings: {} } or legacy structure []
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
        // Default starting blocks if none exist
        setBlocks([
          { id: crypto.randomUUID(), type: 'express_checkout', content: { title: 'Commander Maintenant', buttonText: 'Confirmer ma commande' } }
        ]);
      }

      // Extract product data and referral code for the checkout preview
      const product = landingPage?.referralLink?.product;
      if (product) {
        setProductData(product);
      }
      if (landingPage?.referralLink?.code) {
        setReferralCode(landingPage.referralLink.code);
      }
      const ownerUserId = landingPage?.referralLink?.influencerId || landingPage?.referralLink?.influencer?.id;
      if (ownerUserId) {
        setOwnerId(ownerUserId);
      }
      const ownerSub = landingPage?.referralLink?.influencer?.subdomain;
      if (ownerSub) {
        setOwnerSubdomain(ownerSub);
      }
      
      // Fetch accounts for products block
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadApi.image(formData);
      updateBlockContent('url', res.data.data.url);
      toast.success('Image téléchargée avec succès !');
    } catch (err) {
      toast.error('Erreur lors du téléchargement');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadApi.cloudinaryVideo(formData);
      updateBlockContent('url', res.data.data.url);
      toast.success('Vidéo téléchargée avec succès !');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors du téléchargement de la vidéo');
    } finally {
      setIsUploading(false);
    }
  };

  const getDefaultContentForType = (type: BlockType) => {
    switch (type) {
      case 'header': return { text: 'Mon Entreprise', bgColor: '#ffffff', color: '#111827', paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 4 };
      case 'hero': return { title: 'Offre Spéciale !', subtitle: 'Découvrez notre produit exclusif.', bgColor: '#f9fafb', titleColor: '#111827', subtitleColor: '#4b5563', paddingTop: 48, paddingBottom: 48, marginTop: 0, marginBottom: 24 };
      case 'image': return { url: '', height: 500, paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0 };
      case 'text': return { 
        text: 'Nouveau paragraphe', 
        isHeading: false, 
        color: '#374151', 
        align: 'left', 
        verticalAlign: 'center',
        paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 0 
      };
      case 'button': return { 
        text: 'Commander Maintenant', 
        bgColor: '#f97316', 
        link: '', 
        behavior: 'link',
        stickyMobile: false,
        stickyDesktop: false,
        animationLayout: 'none',
        animationTiming: 'ease-in-out',
        paddingTop: 24, paddingBottom: 24, marginTop: 0, marginBottom: 0 
      };
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
        paddingTop: 32,
        paddingBottom: 32,
        marginTop: 0,
        marginBottom: 0
      };
      case 'express_checkout': return { 
        title: 'Commander Maintenant', 
        subtitle: 'Remplissez le formulaire ci-dessous pour réserver votre produit. Le paiement se fera à la livraison.',
        buttonText: 'Confirmer ma commande',
        themeColor: '#f97316',
        nameLabel: 'Nom complet *',
        namePlaceholder: 'Ex: Youssef Benjelloun',
        phoneLabel: 'Numéro de téléphone *',
        phonePlaceholder: '06 XX XX XX XX',
        cityLabel: 'Ville *',
        cityPlaceholder: 'Ex: Casablanca',
        addressLabel: 'Adresse (Optionnel)',
        addressPlaceholder: 'Votre adresse complète...',
        borderRadiusTL: 0,
        borderRadiusTR: 0,
        borderRadiusBL: 0,
        borderRadiusBR: 0,
        borderWidth: 0,
        borderColor: '#f3f4f6',
        priceColor: '#f97316',
        priceSize: 30,
        showPrice: true,
        options: [], // { name: string, price: number }
        packColor: '#f64444', 
        packBorderWidth: 2,
        packBorderRadius: 16,
        paddingTop: 32, paddingBottom: 32, paddingLeft: 16, paddingRight: 16, marginTop: 0, marginBottom: 0 
      };
      case 'audio': return {
        audios: [
          { id: '1', title: 'Audio 1', url: '' },
          { id: '2', title: 'Audio 2', url: '' },
          { id: '3', title: 'Audio 3', url: '' }
        ],
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
      case 'video': return { url: '', width: 100, autoplay: false, loop: false, muted: false, controls: true, paddingTop: 16, paddingBottom: 16, marginTop: 0, marginBottom: 0 };
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
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              const role = user?.roleName || user?.role;
              if (role === 'SUPER_ADMIN') {
                navigate('/admin/links');
              } else if (role === 'HELPER') {
                navigate('/helper/links');
              } else if (role === 'VENDOR') {
                navigate('/dashboard/links');
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
            <span className="font-bold text-gray-900">Constructeur de Page (BETA)</span>
          </div>
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
              onClick={() => window.open(buildReferralUrl(referralCode, ownerSubdomain), '_blank')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Prévisualiser
            </button>
          )}
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar - Toolbar */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col z-10 shrink-0">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Composants</h3>
            <div className="space-y-2">
              <ToolButton fullWidth icon={<ImageIcon className="w-4 h-4" />} label="Image" onClick={() => addBlock('image')} />
              <ToolButton fullWidth icon={<Layers className="w-4 h-4 text-purple-500" />} label="Slider / Carrousel" onClick={() => addBlock('slider')} />
              <ToolButton fullWidth icon={<ShoppingBag className="w-4 h-4 text-orange-500" />} label="Propositions Produits" onClick={() => addBlock('products')} />
              <ToolButton fullWidth icon={<Music className="w-4 h-4 text-indigo-500" />} label="Lecteur Audio" onClick={() => addBlock('audio')} />
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
              <ToolButton fullWidth icon={<ShoppingCart className="w-4 h-4" />} label="Express Checkout" onClick={() => addBlock('express_checkout')} />
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
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <LayoutTemplate className="w-12 h-12 mb-4 opacity-20" />
                <p>Cliquez sur un composant à gauche pour l'ajouter.</p>
              </div>
            ) : isPreviewMode ? (
              <div className="w-full h-full relative">
                <BlockRenderer 
                  isEditor={false}
                  blocks={blocks} 
                  renderCheckout={(content) => <CheckoutPreview content={content} product={productData} />} 
                />
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
                      renderCheckout={() => <CheckoutPreview content={block.content} product={productData} />} 
                    />
                  </div>
                  
                  <div className={`absolute top-2 right-2 bg-white shadow-lg rounded-xl flex items-center p-1 gap-1 border border-gray-200 transition-opacity ${selectedBlockId === block.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button onClick={(e) => moveBlock(index, 'up', e)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ArrowUp className="w-4 h-4" /></button>
                    <button onClick={(e) => moveBlock(index, 'down', e)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><ArrowDown className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <button onClick={(e) => removeBlock(block.id, e)} className="p-1.5 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))
            )}

            {(() => {
              const whatsappBlock = blocks.find(b => b.type === 'whatsapp');
              if (whatsappBlock) {
                if (whatsappBlock.content.enableWidget !== false) {
                  const widgetSettings = {
                    enabled: true,
                    ...whatsappBlock.content
                  };
                  return <WhatsAppWidget settings={widgetSettings} isEditorPreview={true} />;
                }
              } else if (pageSettings.whatsappWidget?.enabled) {
                return <WhatsAppWidget settings={pageSettings.whatsappWidget} isEditorPreview={true} />;
              }
              return null;
            })()}

          </div>
        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-72 bg-white border-l border-gray-200 flex flex-col z-10 shrink-0">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-900">Propriétés</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {activeBlock && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-black text-gray-800">Propriétés</h2>
                  <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold uppercase">{activeBlock.type}</span>
                </div>
                
                {/* Specific Fields per Type */}
                {activeBlock.type === 'hero' && (
                  <div className="space-y-4">
                    <Field label="Couleur de Fond" type="color" value={activeBlock.content.bgColor} onChange={(v: any) => updateBlockContent('bgColor', v)} />
                    <Field label="Titre principal" type="text" value={activeBlock.content.title} onChange={(v: any) => updateBlockContent('title', v)} />
                    <Field label="Couleur du titre" type="color" value={activeBlock.content.titleColor} onChange={(v: any) => updateBlockContent('titleColor', v)} />
                    <Field label="Sous-titre" type="textarea" value={activeBlock.content.subtitle} onChange={(v: any) => updateBlockContent('subtitle', v)} />
                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} />
                  </div>
                )}
                
                {activeBlock.type === 'header' && (
                  <div className="space-y-4">
                    <Field label="Couleur de Fond" type="color" value={activeBlock.content.bgColor} onChange={(v: any) => updateBlockContent('bgColor', v)} />
                    <Field label="Nom de la marque" type="text" value={activeBlock.content.text} onChange={(v: any) => updateBlockContent('text', v)} />
                    <Field label="Couleur de texte" type="color" value={activeBlock.content.color} onChange={(v: any) => updateBlockContent('color', v)} />
                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} />
                  </div>
                )}

                {activeBlock.type === 'text' && (
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 font-bold">
                      <input type="checkbox" checked={activeBlock.content.isHeading} onChange={(e) => updateBlockContent('isHeading', e.target.checked)} />
                      Titre de section (h3)
                    </label>
                    <Field label="Texte" type="textarea" value={activeBlock.content.text} onChange={(v: any) => updateBlockContent('text', v)} />
                    <Field label="Couleur" type="color" value={activeBlock.content.color} onChange={(v: any) => updateBlockContent('color', v)} />
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alignement H</label>
                        <select value={activeBlock.content.align || 'left'} onChange={(e) => updateBlockContent('align', e.target.value)} className="w-full text-sm border p-2 rounded">
                          <option value="left">Gauche</option>
                          <option value="center">Centre</option>
                          <option value="right">Droite</option>
                          <option value="justify">Justifié</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alignement V</label>
                        <select value={activeBlock.content.verticalAlign || 'center'} onChange={(e) => updateBlockContent('verticalAlign', e.target.value)} className="w-full text-sm border p-2 rounded">
                          <option value="top">Haut</option>
                          <option value="center">Centre</option>
                          <option value="bottom">Bas</option>
                        </select>
                      </div>
                    </div>
                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} noLeftRight />
                  </div>
                )}

                {activeBlock.type === 'video' && (
                  <div className="space-y-4">
                    <Field label="URL de la vidéo" type="text" value={activeBlock.content.url} onChange={(v: any) => updateBlockContent('url', v)} placeholder="https://..." />
                    
                    <div className="pt-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Uploader sur Cloudinary</label>
                      <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                        {isUploading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                        ) : (
                          <Upload className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="text-sm font-bold text-gray-600">
                          {isUploading ? 'Téléchargement...' : 'Choisir une vidéo'}
                        </span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="video/*" 
                          onChange={handleVideoUpload} 
                          disabled={isUploading} 
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={activeBlock.content.autoplay} onChange={(e) => updateBlockContent('autoplay', e.target.checked)} />
                        Autoplay
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={activeBlock.content.loop} onChange={(e) => updateBlockContent('loop', e.target.checked)} />
                        En boucle
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={activeBlock.content.muted} onChange={(e) => updateBlockContent('muted', e.target.checked)} />
                        Muet
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={activeBlock.content.controls !== false} onChange={(e) => updateBlockContent('controls', e.target.checked)} />
                        Contrôles
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Largeur (%)" type="number" value={activeBlock.content.width || 100} onChange={(v: any) => updateBlockContent('width', v)} />
                      <Field label="Hauteur Max (px)" type="number" value={activeBlock.content.maxHeight || ''} onChange={(v: any) => updateBlockContent('maxHeight', v)} placeholder="Infini" />
                    </div>

                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} noLeftRight />
                  </div>
                )}

                {activeBlock.type === 'image' && (
                  <div className="space-y-4">
                    <Field label="URL de l'image" type="text" value={activeBlock.content.url} onChange={(v: any) => updateBlockContent('url', v)} placeholder="https://..." />
                    
                    <div className="pt-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ou télécharger</label>
                      <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                        {isUploading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                        ) : (
                          <Upload className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="text-sm font-bold text-gray-600">
                          {isUploading ? 'Téléchargement...' : 'Choisir une image'}
                        </span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          disabled={isUploading} 
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Largeur (%)" type="number" value={activeBlock.content.width || 100} onChange={(v: any) => updateBlockContent('width', v)} />
                      <Field label="Hauteur Max (px)" type="number" value={activeBlock.content.maxHeight || ''} onChange={(v: any) => updateBlockContent('maxHeight', v)} placeholder="Infini" />
                    </div>

                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} noLeftRight />
                  </div>
                )}

                 {activeBlock.type === 'button' && (
                  <div className="space-y-4">
                    <Field label="Texte du bouton" type="text" value={activeBlock.content.text} onChange={(v: any) => updateBlockContent('text', v)} />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Couleur de fond" type="color" value={activeBlock.content.bgColor} onChange={(v: any) => updateBlockContent('bgColor', v)} />
                      <Field label="Couleur du texte" type="color" value={activeBlock.content.textColor || '#ffffff'} onChange={(v: any) => updateBlockContent('textColor', v)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Taille du texte (px)" type="number" value={activeBlock.content.textSize} onChange={(v: number) => updateBlockContent('textSize', v)} placeholder="Ex: 20" />
                      <Field label="Rayon Bordure (px)" type="number" value={activeBlock.content.buttonBorderRadius ?? 16} onChange={(v: number) => updateBlockContent('buttonBorderRadius', v)} placeholder="Ex: 16" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Padding Vert. (px)" type="number" value={activeBlock.content.buttonPaddingY} onChange={(v: number) => updateBlockContent('buttonPaddingY', v)} placeholder="Ex: 16" />
                      <Field label="Padding Horiz. (px)" type="number" value={activeBlock.content.buttonPaddingX} onChange={(v: number) => updateBlockContent('buttonPaddingX', v)} placeholder="Ex: 40" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Épaisseur Bordure" type="number" value={activeBlock.content.buttonBorderWidth ?? 0} onChange={(v: number) => updateBlockContent('buttonBorderWidth', v)} placeholder="Ex: 0" />
                      <Field label="Couleur de bordure" type="color" value={activeBlock.content.buttonBorderColor || '#ffffff'} onChange={(v: string) => updateBlockContent('buttonBorderColor', v)} />
                    </div>
                    
                    <div className="pt-2 border-t border-gray-100">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Comportement</label>
                      <select 
                        value={activeBlock.content.behavior || 'link'} 
                        onChange={(e) => updateBlockContent('behavior', e.target.value)}
                        className="w-full text-sm border-gray-200 rounded p-2 border focus:border-orange-500 outline-none mb-3"
                      >
                        <option value="link">Lien de redirection</option>
                        <option value="checkout">Aller au checkout</option>
                      </select>
                      
                      {activeBlock.content.behavior !== 'checkout' && (
                        <Field label="Lien de redirection (Optionnel)" type="text" value={activeBlock.content.link} onChange={(v: any) => updateBlockContent('link', v)} />
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3">Position</h4>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={activeBlock.content.stickyMobile} onChange={(e) => updateBlockContent('stickyMobile', e.target.checked)} />
                          Sticky on mobile
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={activeBlock.content.stickyDesktop} onChange={(e) => updateBlockContent('stickyDesktop', e.target.checked)} />
                          Sticky on desktop
                        </label>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3">Animation</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Layout</label>
                          <select value={activeBlock.content.animationLayout || 'none'} onChange={(e) => updateBlockContent('animationLayout', e.target.value)} className="w-full text-xs border p-2 rounded">
                            <option value="none">None</option>
                            <option value="bounceHorizontal">Horizontal Bounce</option>
                            <option value="bounceVertical">Vertical Bounce</option>
                            <option value="rotate">Rotate</option>
                            <option value="scale">Scale</option>
                            <option value="fade">Fade</option>
                            <option value="appear">Appear</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Timing</label>
                          <select value={activeBlock.content.animationTiming || 'ease-in-out'} onChange={(e) => updateBlockContent('animationTiming', e.target.value)} className="w-full text-xs border p-2 rounded">
                            <option value="linear">linear</option>
                            <option value="ease-in">ease-in</option>
                            <option value="ease-out">ease-out</option>
                            <option value="ease-in-out">ease-in-out</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} noLeftRight />
                  </div>
                )}
                
                 {activeBlock.type === 'whatsapp' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-2xl border border-emerald-100 mb-2">
                      <span className="font-bold text-emerald-950 text-xs">Activer le Widget Flottant</span>
                      <Field 
                        type="switch" 
                        value={activeBlock.content.enableWidget !== false} 
                        onChange={(v: boolean) => updateBlockContent('enableWidget', v)} 
                      />
                    </div>
                    
                    {activeBlock.content.enableWidget !== false && (
                      <div className="space-y-4 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Field 
                              label="Numéro WhatsApp" 
                              type="text" 
                              placeholder="Ex: 212600000000"
                              value={activeBlock.content.phoneNumber} 
                              onChange={(v: string) => updateBlockContent('phoneNumber', v)} 
                            />
                          </div>
                          {activeBlock.content.phoneNumber && (
                            <button
                              type="button"
                              onClick={() => {
                                const clean = (activeBlock.content.phoneNumber || '').replace(/\D/g, '');
                                if (clean) window.open(`https://wa.me/${clean}`, '_blank');
                              }}
                              className="bg-white border hover:bg-gray-50 text-gray-600 px-3 py-2 text-xs font-bold rounded-lg transition-all"
                            >
                              Test
                            </button>
                          )}
                        </div>

                        <Field 
                          label="Titre principal" 
                          type="text" 
                          placeholder="Ex: Let's chat on WhatsApp"
                          value={activeBlock.content.headline} 
                          onChange={(v: string) => updateBlockContent('headline', v)} 
                        />

                        <Field 
                          label="Sous-titre (Sous l'en-tête)" 
                          type="text" 
                          placeholder="Ex: Répond généralement instantanément"
                          value={activeBlock.content.subHeadline} 
                          onChange={(v: string) => updateBlockContent('subHeadline', v)} 
                        />

                        <Field 
                          label="Nom de l'agent (Nickname)" 
                          type="text" 
                          placeholder="Ex: Nitso"
                          value={activeBlock.content.nickname} 
                          onChange={(v: string) => updateBlockContent('nickname', v)} 
                        />

                        <Field 
                          label="Message de bienvenue (Bulle)" 
                          type="textarea" 
                          placeholder="Ex: How can I help you? :)"
                          value={activeBlock.content.welcomeMessage} 
                          onChange={(v: string) => updateBlockContent('welcomeMessage', v)} 
                        />

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <Field 
                              label="Couleur En-tête" 
                              type="color" 
                              value={activeBlock.content.headerBg} 
                              onChange={(v: string) => updateBlockContent('headerBg', v)} 
                            />
                            <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Style Icône</label>
                              <select 
                                value={activeBlock.content.iconStyle || 'bubble'} 
                                onChange={(e) => updateBlockContent('iconStyle', e.target.value)} 
                                className="w-full text-xs border p-2 bg-white rounded-lg focus:border-orange-500 outline-none"
                              >
                                <option value="bubble">Bulle (Ronde)</option>
                                <option value="pill">Pill (Texte)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Icône du Widget</label>
                            <div className="grid grid-cols-5 gap-2">
                              {['whatsapp', 'message-circle', 'message-square', 'headset', 'bot'].map(icon => {
                                const isSelected = activeBlock.content.iconType === icon || (!activeBlock.content.iconType && icon === 'whatsapp');
                                return (
                                  <button
                                    key={icon}
                                    type="button"
                                    onClick={() => updateBlockContent('iconType', icon)}
                                    className={`flex items-center justify-center p-2 rounded-xl border-2 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-100 hover:border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                    title={icon}
                                  >
                                    <IconRenderer type={icon} className="w-5 h-5" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Position du Widget</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {([
                              { value: 'top-left', label: '↖ Haut-Gauche' },
                              { value: 'top-right', label: '↗ Haut-Droite' },
                              { value: 'bottom-left', label: '↙ Bas-Gauche' },
                              { value: 'bottom-right', label: '↘ Bas-Droite' },
                            ] as const).map(pos => {
                              const isSelected = (activeBlock.content.position || 'bottom-right') === pos.value;
                              return (
                                <button
                                  key={pos.value}
                                  type="button"
                                  onClick={() => updateBlockContent('position', pos.value)}
                                  className={`text-[10px] font-bold py-1.5 px-2 rounded-lg border-2 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 hover:border-gray-200 text-gray-500 bg-white'}`}
                                >
                                  {pos.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Décalage X ({activeBlock.content.offsetX ?? 24}px)</label>
                            <input 
                              type="range" min="0" max="120" step="4"
                              value={activeBlock.content.offsetX ?? 24}
                              onChange={(e) => updateBlockContent('offsetX', Number(e.target.value))}
                              className="w-full accent-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Décalage Y ({activeBlock.content.offsetY ?? 24}px)</label>
                            <input 
                              type="range" min="0" max="120" step="4"
                              value={activeBlock.content.offsetY ?? 24}
                              onChange={(e) => updateBlockContent('offsetY', Number(e.target.value))}
                              className="w-full accent-emerald-500"
                            />
                          </div>
                        </div>

                        <Field 
                          label="Texte survol / Libellé" 
                          type="text" 
                          placeholder="Ex: WhatsApp"
                          value={activeBlock.content.hoverText} 
                          onChange={(v: string) => updateBlockContent('hoverText', v)} 
                        />

                        <Field 
                          label="Message pré-rempli (Template)" 
                          type="textarea" 
                          placeholder="Ex: Bonjour, je souhaite..."
                          value={activeBlock.content.preSetMessage} 
                          onChange={(v: string) => updateBlockContent('preSetMessage', v)} 
                        />

                        <Field 
                          label="URL Image de profil" 
                          type="text" 
                          placeholder="https://..."
                          value={activeBlock.content.profileImage} 
                          onChange={(v: string) => updateBlockContent('profileImage', v)} 
                        />

                        <div className="pt-2 border-t border-gray-100 space-y-2">
                          <h5 className="text-[10px] font-bold text-gray-400 uppercase">Affichage & Comportement</h5>
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={activeBlock.content.showOnDesktop !== false} 
                              onChange={(e) => updateBlockContent('showOnDesktop', e.target.checked)} 
                            />
                            Afficher sur Ordinateur
                          </label>
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={activeBlock.content.showOnMobile !== false} 
                              onChange={(e) => updateBlockContent('showOnMobile', e.target.checked)} 
                            />
                            Afficher sur Mobile
                          </label>
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!!activeBlock.content.openOnLoad} 
                              onChange={(e) => updateBlockContent('openOnLoad', e.target.checked)} 
                            />
                            Ouvrir au chargement de la page
                          </label>
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={activeBlock.content.useWhatsappWebOnDesktop !== false} 
                              onChange={(e) => updateBlockContent('useWhatsappWebOnDesktop', e.target.checked)} 
                            />
                            Utiliser WhatsApp Web sur PC
                          </label>

                          <div className="pt-2 mt-2 border-t border-gray-100 space-y-2">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Animation du Bouton</label>
                              <div className="grid grid-cols-5 gap-1">
                                {['none', 'pulse', 'bounce', 'shake', 'rubberBand'].map(anim => {
                                  const labels: Record<string, string> = { none: '—', pulse: '💓', bounce: '⬆', shake: '🔔', rubberBand: '🫧' };
                                  const isSelected = (activeBlock.content.animation || 'none') === anim;
                                  return (
                                    <button
                                      key={anim}
                                      type="button"
                                      onClick={() => updateBlockContent('animation', anim)}
                                      className={`text-center py-1.5 rounded-lg border-2 transition-all text-xs ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                                      title={anim}
                                    >
                                      {labels[anim]}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="text-[9px] text-gray-400 mt-0.5 text-center font-medium">
                                {activeBlock.content.animation === 'pulse' ? 'Pulse' : activeBlock.content.animation === 'bounce' ? 'Bounce' : activeBlock.content.animation === 'shake' ? 'Shake' : activeBlock.content.animation === 'rubberBand' ? 'Rubber Band' : 'Aucune'}
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Badge Notifications ({activeBlock.content.badgeCount ?? 0})</label>
                              <input 
                                type="range" min="0" max="10" step="1"
                                value={activeBlock.content.badgeCount ?? 0}
                                onChange={(e) => updateBlockContent('badgeCount', Number(e.target.value))}
                                className="w-full accent-red-500"
                              />
                              <div className="text-[9px] text-gray-400 mt-0.5 text-center font-medium">
                                {(activeBlock.content.badgeCount ?? 0) === 0 ? 'Pas de badge' : `${activeBlock.content.badgeCount} message${(activeBlock.content.badgeCount ?? 0) > 1 ? 's' : ''}`}
                              </div>
                            </div>

                            <div>
                              <Field 
                                label="Message Notification (Bulle)" 
                                type="textarea" 
                                placeholder="Ex: 👋 Besoin d'aide ? Contactez-nous !"
                                value={activeBlock.content.badgeMessage} 
                                onChange={(v: string) => updateBlockContent('badgeMessage', v)} 
                              />
                              <div className="text-[9px] text-gray-400 mt-0.5 font-medium">
                                {activeBlock.content.badgeMessage ? '✓ La bulle apparaîtra à côté du bouton' : 'Laissez vide pour désactiver'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {activeBlock.type === 'countdown' && (
                  <div className="space-y-4">
                    <Field label="Texte d'urgence" type="text" value={activeBlock.content.text} onChange={(v: any) => updateBlockContent('text', v)} />
                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} noLeftRight />
                  </div>
                )}
                
                {activeBlock.type === 'spacer' && (
                  <div className="space-y-4">
                    <Field label="Hauteur (px)" type="number" value={activeBlock.content.height} onChange={(v: any) => updateBlockContent('height', v)} />
                  </div>
                )}

                {activeBlock.type === 'audio' && (
                  <div className="space-y-6">
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <div className="flex items-center gap-3 mb-2">
                        <Music className="w-5 h-5 text-indigo-500" />
                        <span className="font-black text-indigo-900 text-sm">Lecteur Audio Multi-Cartes</span>
                      </div>
                      <p className="text-xs text-indigo-700 leading-relaxed">
                        Ajoutez un ou plusieurs audios. Ils s'afficheront sous forme de cartes élégantes alignées (jusqu'à 3 par ligne sur grand écran).
                      </p>
                    </div>

                    <div className="space-y-4">
                      {((activeBlock.content.audios as any[]) || [
                        { id: '1', title: activeBlock.content.title || '', url: activeBlock.content.url || '' }
                      ]).map((audio: any, idx: number) => {
                        const isThisUploading = uploadingAudioId === audio.id;
                        
                        return (
                          <div key={audio.id || idx} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3 relative group">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase">Audio #{idx + 1}</h4>
                              {(((activeBlock.content.audios as any[]) || []).length > 1) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentAudios = [...(activeBlock.content.audios || [])];
                                    const updated = currentAudios.filter((_, i) => i !== idx);
                                    updateBlockContent('audios', updated);
                                  }}
                                  className="text-gray-400 hover:text-red-500 p-1 transition-all"
                                  title="Supprimer cet audio"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <Field 
                              label="Titre de la carte" 
                              type="text" 
                              value={audio.title || ''} 
                              placeholder="Ex: Écoutez le témoignage"
                              onChange={(v: string) => {
                                const currentAudios = [...(activeBlock.content.audios || [
                                  { id: '1', title: activeBlock.content.title || '', url: activeBlock.content.url || '' }
                                ])];
                                currentAudios[idx] = { ...currentAudios[idx], title: v };
                                updateBlockContent('audios', currentAudios);
                              }} 
                            />

                            <div>
                              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all">
                                {isThisUploading ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                ) : (
                                  <Upload className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="text-xs font-bold text-gray-500">
                                  {isThisUploading ? 'Conversion en MP3...' : 'Télécharger un audio'}
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="audio/*"
                                  disabled={uploadingAudioId !== null}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                      setUploadingAudioId(audio.id);
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      const res = await uploadApi.audio(formData);
                                      
                                      const currentAudios = [...(activeBlock.content.audios || [
                                        { id: '1', title: activeBlock.content.title || '', url: activeBlock.content.url || '' }
                                      ])];
                                      currentAudios[idx] = { ...currentAudios[idx], url: res.data.data.url };
                                      updateBlockContent('audios', currentAudios);
                                      toast.success('Audio téléchargé et converti avec succès !');
                                    } catch (err) {
                                      toast.error('Erreur lors de la conversion audio');
                                    } finally {
                                      setUploadingAudioId(null);
                                    }
                                  }}
                                />
                              </label>
                            </div>

                            {audio.url && (
                              <div className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg p-2 font-mono break-all">
                                Fichier actuel: {audio.url}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => {
                          const currentAudios = [...(activeBlock.content.audios || [
                            { id: '1', title: activeBlock.content.title || '', url: activeBlock.content.url || '' }
                          ])];
                          currentAudios.push({
                            id: Math.random().toString(36).substring(2, 9),
                            title: `Audio ${currentAudios.length + 1}`,
                            url: ''
                          });
                          updateBlockContent('audios', currentAudios);
                        }}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-xs font-bold text-gray-700 transition-all shadow-sm"
                      >
                        <Plus className="w-4 h-4 text-gray-500" />
                        Ajouter une carte audio
                      </button>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase">Options de Lecture</h4>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600">Afficher les contrôles</span>
                        <Field type="switch" value={activeBlock.content.controls !== false} onChange={(v: boolean) => updateBlockContent('controls', v)} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600">Lecture Automatique (Autoplay)</span>
                        <Field type="switch" value={!!activeBlock.content.autoplay} onChange={(v: boolean) => updateBlockContent('autoplay', v)} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600">Lecture en boucle (Loop)</span>
                        <Field type="switch" value={!!activeBlock.content.loop} onChange={(v: boolean) => updateBlockContent('loop', v)} />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase">Couleurs</h4>
                      <Field label="Couleur de fond" type="color" value={activeBlock.content.bgColor || '#ffffff'} onChange={(v: string) => updateBlockContent('bgColor', v)} />
                      <Field label="Couleur de la bordure" type="color" value={activeBlock.content.borderColor || '#f3f4f6'} onChange={(v: string) => updateBlockContent('borderColor', v)} />
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <SpacingControls content={activeBlock.content} onChange={updateBlockContent} noLeftRight />
                    </div>
                  </div>
                )}

                {activeBlock.type === 'slider' && (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                      <div className="flex items-center gap-3 mb-2">
                        <Layers className="w-5 h-5 text-purple-500" />
                        <span className="font-black text-purple-900 text-sm">Slider / Carrousel</span>
                      </div>
                      <p className="text-xs text-purple-700 leading-relaxed">
                        Ajoutez, modifiez et réorganisez vos cartes. Chaque carte peut contenir un titre, une description et une image/vidéo/GIF.
                      </p>
                    </div>

                    {/* Cards List */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase">Cartes ({(activeBlock.content.slides || []).length})</h4>
                        <button
                          onClick={() => {
                            const newSlides = [...(activeBlock.content.slides || []), { title: '', description: '', mediaUrl: '' }];
                            updateBlockContent('slides', newSlides);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-[10px] font-bold rounded-lg transition-all"
                        >
                          <Plus className="w-3 h-3" /> Ajouter
                        </button>
                      </div>

                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {(activeBlock.content.slides || []).map((slide: any, index: number) => (
                          <div key={index} className="bg-white p-4 rounded-xl border border-gray-100 space-y-3 relative group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <GripVertical className="w-3.5 h-3.5 text-gray-300" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Carte {index + 1}</span>
                              </div>
                              <button
                                onClick={() => {
                                  const newSlides = activeBlock.content.slides.filter((_: any, i: number) => i !== index);
                                  updateBlockContent('slides', newSlides);
                                }}
                                className="p-1 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <Field
                              label="Titre"
                              type="text"
                              value={slide.title}
                              placeholder="Titre de la carte"
                              onChange={(v: string) => {
                                const newSlides = [...activeBlock.content.slides];
                                newSlides[index] = { ...newSlides[index], title: v };
                                updateBlockContent('slides', newSlides);
                              }}
                            />
                            <Field
                              label="Description"
                              type="textarea"
                              value={slide.description}
                              placeholder="Description..."
                              onChange={(v: string) => {
                                const newSlides = [...activeBlock.content.slides];
                                newSlides[index] = { ...newSlides[index], description: v };
                                updateBlockContent('slides', newSlides);
                              }}
                            />
                            <Field
                              label="URL Média (image, GIF, vidéo)"
                              type="text"
                              value={slide.mediaUrl}
                              placeholder="https://... ou /uploads/..."
                              onChange={(v: string) => {
                                const newSlides = [...activeBlock.content.slides];
                                newSlides[index] = { ...newSlides[index], mediaUrl: v };
                                updateBlockContent('slides', newSlides);
                              }}
                            />

                            {/* Upload button for this slide */}
                            <div>
                              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 cursor-pointer transition-all">
                                {isUploading ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                                ) : (
                                  <Upload className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="text-xs font-bold text-gray-500">
                                  {isUploading ? 'Téléchargement...' : 'Télécharger image/vidéo/GIF'}
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*,video/*,.gif"
                                  disabled={isUploading}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                      setIsUploading(true);
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      const res = await uploadApi.image(formData);
                                      const newSlides = [...activeBlock.content.slides];
                                      newSlides[index] = { ...newSlides[index], mediaUrl: res.data.data.url };
                                      updateBlockContent('slides', newSlides);
                                      toast.success('Fichier téléchargé !');
                                    } catch (err) {
                                      toast.error('Erreur lors du téléchargement');
                                    } finally {
                                      setIsUploading(false);
                                    }
                                  }}
                                />
                              </label>
                            </div>

                            {/* Thumbnail preview */}
                            {slide.mediaUrl && (
                              <div className="rounded-xl overflow-hidden border border-gray-100 h-20 bg-gray-50">
                                {/\.(mp4|webm|ogg)$/i.test(slide.mediaUrl) ? (
                                  <video src={slide.mediaUrl.startsWith('http') ? slide.mediaUrl : `${window.location.origin}${slide.mediaUrl}`} muted className="w-full h-full object-cover" />
                                ) : (
                                  <img src={slide.mediaUrl.startsWith('http') ? slide.mediaUrl : `${window.location.origin}${slide.mediaUrl}`} alt="" className="w-full h-full object-cover" />
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Slider Settings */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase">Paramètres du Slider</h4>

                      {/* Cards Per View */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Cartes par vue</label>
                        <div className="grid grid-cols-5 gap-1">
                          {[1, 2, 3, 4, 5].map(n => {
                            const isSelected = (activeBlock.content.cardsPerView || 1) === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => updateBlockContent('cardsPerView', n)}
                                className={`text-center py-2 rounded-lg border-2 transition-all text-xs font-black ${isSelected ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 hover:border-gray-200 bg-white text-gray-500'}`}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[9px] text-gray-400 mt-1 text-center font-medium">
                          {(activeBlock.content.cardsPerView || 1) === 1 ? '1 carte pleine largeur' : `${activeBlock.content.cardsPerView} cartes côte à côte`}
                        </div>
                      </div>

                      <Field label="Espacement entre cartes (px)" type="number" value={activeBlock.content.cardGap ?? 16} onChange={(v: number) => updateBlockContent('cardGap', v)} />

                      {/* Autoplay Mode */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Mode de défilement automatique</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'slide', label: 'Pas à pas (Slide)' },
                            { value: 'marquee', label: 'Continu (Marquee)' }
                          ].map(opt => {
                            const isSelected = (activeBlock.content.autoplayMode || 'slide') === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateBlockContent('autoplayMode', opt.value)}
                                className={`text-center py-2 px-1 rounded-lg border-2 transition-all text-[11px] font-black ${isSelected ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 hover:border-gray-200 bg-white text-gray-500'}`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Options conditionally displayed based on Autoplay Mode */}
                      {(activeBlock.content.autoplayMode || 'slide') === 'slide' ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-600">Lecture Automatique</span>
                            <Field type="switch" value={activeBlock.content.autoPlay !== false} onChange={(v: boolean) => updateBlockContent('autoPlay', v)} />
                          </div>

                          {activeBlock.content.autoPlay !== false && (
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Vitesse ({(activeBlock.content.autoPlaySpeed || 4000) / 1000}s)</label>
                              <input
                                type="range" min="1000" max="10000" step="500"
                                value={activeBlock.content.autoPlaySpeed || 4000}
                                onChange={(e) => updateBlockContent('autoPlaySpeed', Number(e.target.value))}
                                className="w-full accent-purple-500"
                              />
                            </div>
                          )}

                          {/* Slide By */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Défilement par</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { value: 'card', label: 'Une carte' },
                                { value: 'page', label: 'Toute la vue' }
                              ].map(opt => {
                                const isSelected = (activeBlock.content.slideBy || 'card') === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => updateBlockContent('slideBy', opt.value)}
                                    className={`text-center py-2 rounded-lg border-2 transition-all text-[11px] font-black ${isSelected ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 hover:border-gray-200 bg-white text-gray-500'}`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Transition type */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Type de transition</label>
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                { value: 'slide', label: 'Glissement' },
                                { value: 'zoom', label: 'Zoom' },
                                { value: 'fade', label: 'Fondu' }
                              ].map(opt => {
                                const isSelected = (activeBlock.content.transitionEffect || 'slide') === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => updateBlockContent('transitionEffect', opt.value)}
                                    className={`text-center py-2 rounded-lg border-2 transition-all text-[10px] font-black ${isSelected ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 hover:border-gray-200 bg-white text-gray-500'}`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                            {activeBlock.content.transitionEffect === 'fade' && (activeBlock.content.cardsPerView || 1) > 1 && (
                              <div className="text-[8px] text-red-500 mt-1 font-medium leading-normal">
                                ⚠️ Note: Le fondu nécessite "1 carte par vue".
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Marquee Options */}
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Vitesse du défilement continu ({activeBlock.content.marqueeSpeed ?? 20}s)</label>
                            <input
                              type="range" min="5" max="60" step="1"
                              value={activeBlock.content.marqueeSpeed ?? 20}
                              onChange={(e) => updateBlockContent('marqueeSpeed', Number(e.target.value))}
                              className="w-full accent-purple-500"
                            />
                            <div className="text-[8px] text-gray-400 mt-0.5">Plus la valeur est petite, plus ça défile vite.</div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-600">Pause au survol</span>
                            <Field type="switch" value={activeBlock.content.pauseOnHover !== false} onChange={(v: boolean) => updateBlockContent('pauseOnHover', v)} />
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600">Flèches de navigation</span>
                        <Field type="switch" value={activeBlock.content.showArrows !== false} onChange={(v: boolean) => updateBlockContent('showArrows', v)} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600">Points indicateurs</span>
                        <Field type="switch" value={activeBlock.content.showDots !== false} onChange={(v: boolean) => updateBlockContent('showDots', v)} />
                      </div>

                      <div className="flex items-center justify-between mt-2 mb-1">
                        <span className="text-xs font-bold text-gray-600 font-medium">Hauteur média 100% (Remplir la carte)</span>
                        <Field type="switch" value={activeBlock.content.mediaHeight100 === true} onChange={(v: boolean) => updateBlockContent('mediaHeight100', v)} />
                      </div>

                      {!activeBlock.content.mediaHeight100 && (
                        <Field label="Hauteur média (px)" type="number" value={activeBlock.content.mediaHeight || 280} onChange={(v: number) => updateBlockContent('mediaHeight', v)} />
                      )}

                      {/* Ajustement média */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Ajustement du média</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'cover', label: 'Remplir (Cover)' },
                            { value: 'contain', label: 'Entier (Contain)' }
                          ].map(opt => {
                            const isSelected = (activeBlock.content.mediaFit || 'cover') === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateBlockContent('mediaFit', opt.value)}
                                className={`text-center py-2 rounded-lg border-2 transition-all text-[11px] font-black ${isSelected ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 hover:border-gray-200 bg-white text-gray-500'}`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Card Style */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase">Style des Cartes</h4>
                      <Field label="Fond de carte" type="color" value={activeBlock.content.cardBg || '#ffffff'} onChange={(v: string) => updateBlockContent('cardBg', v)} />
                      <Field label="Rayon de bordure (px)" type="number" value={activeBlock.content.cardRadius ?? 20} onChange={(v: number) => updateBlockContent('cardRadius', v)} />

                      {/* Shadow selector */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Ombre</label>
                        <div className="grid grid-cols-5 gap-1">
                          {[
                            { value: 'none', label: '—' },
                            { value: 'sm', label: 'S' },
                            { value: 'md', label: 'M' },
                            { value: 'lg', label: 'L' },
                            { value: 'xl', label: 'XL' },
                          ].map(opt => {
                            const isSelected = (activeBlock.content.cardShadow ?? 'md') === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateBlockContent('cardShadow', opt.value)}
                                className={`text-center py-1.5 rounded-lg border-2 transition-all text-[10px] font-black ${isSelected ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 hover:border-gray-200 bg-white text-gray-500'}`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Border */}
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Bordure (px)" type="number" value={activeBlock.content.cardBorderWidth ?? 0} onChange={(v: number) => updateBlockContent('cardBorderWidth', v)} />
                        <Field label="Couleur bordure" type="color" value={activeBlock.content.cardBorderColor || '#e5e7eb'} onChange={(v: string) => updateBlockContent('cardBorderColor', v)} />
                      </div>

                      {/* Text Align */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Alignement texte</label>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { value: 'left', label: '◀' },
                            { value: 'center', label: '◆' },
                            { value: 'right', label: '▶' },
                          ].map(opt => {
                            const isSelected = (activeBlock.content.textAlign || 'left') === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateBlockContent('textAlign', opt.value)}
                                className={`text-center py-1.5 rounded-lg border-2 transition-all text-xs ${isSelected ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 hover:border-gray-200 bg-white text-gray-400'}`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Effet de survol */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Effet de survol (Hover)</label>
                        <select
                          value={activeBlock.content.hoverEffect || 'none'}
                          onChange={(e) => updateBlockContent('hoverEffect', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                        >
                          <option value="none">Aucun (Ombre standard)</option>
                          <option value="lift">Surélever (Lift Up)</option>
                          <option value="scale">Agrandir (Zoom scale)</option>
                          <option value="glow">Brillance colorée (Neon Glow)</option>
                          <option value="grayscale">Noir & Blanc au survol</option>
                        </select>
                      </div>

                      {/* Animation d'apparition */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Animation d'apparition</label>
                        <select
                          value={activeBlock.content.entranceAnimation || 'none'}
                          onChange={(e) => updateBlockContent('entranceAnimation', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                        >
                          <option value="none">Aucune (Immédiat)</option>
                          <option value="fade-up">Glissement vers le haut (Staggered)</option>
                          <option value="fade-in">Fondu (Fade In)</option>
                          <option value="zoom-in">Zoom d'apparition (Zoom In)</option>
                        </select>
                      </div>

                      <Field label="Couleur du titre" type="color" value={activeBlock.content.titleColor || '#111827'} onChange={(v: string) => updateBlockContent('titleColor', v)} />
                      <Field label="Couleur de description" type="color" value={activeBlock.content.descColor || '#6b7280'} onChange={(v: string) => updateBlockContent('descColor', v)} />
                      <Field label="Couleur des points" type="color" value={activeBlock.content.dotColor || '#f97316'} onChange={(v: string) => updateBlockContent('dotColor', v)} />
                    </div>

                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} noLeftRight />
                  </div>
                )}

                {activeBlock.type === 'express_checkout' && (
                  <div className="space-y-6">
                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 mb-4">
                       <div className="flex items-center gap-3 mb-2">
                         <ShoppingCart className="w-5 h-5 text-orange-500" />
                         <span className="font-black text-orange-900 text-sm">Checkout Express</span>
                       </div>
                       <p className="text-xs text-orange-700 leading-relaxed">
                         Personnalisez chaque aspect de votre formulaire de commande.
                       </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase">Configuration Action</h4>
                      <Field label="Titre du formulaire" type="text" value={activeBlock.content.title} onChange={(v: string) => updateBlockContent('title', v)} />
                      <Field label="Description" type="textarea" value={activeBlock.content.subtitle} onChange={(v: string) => updateBlockContent('subtitle', v)} />
                      <Field label="Texte du bouton" type="text" value={activeBlock.content.buttonText} onChange={(v: string) => updateBlockContent('buttonText', v)} />
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Couleur du bouton" type="color" value={activeBlock.content.themeColor} onChange={(v: string) => updateBlockContent('themeColor', v)} />
                        <Field label="Couleur du texte" type="color" value={activeBlock.content.buttonTextColor || '#ffffff'} onChange={(v: string) => updateBlockContent('buttonTextColor', v)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Taille (px)" type="number" value={activeBlock.content.buttonSize} onChange={(v: number) => updateBlockContent('buttonSize', v)} placeholder="Ex: 18" />
                        <Field label="Rayon Bordure (px)" type="number" value={activeBlock.content.buttonBorderRadius ?? 12} onChange={(v: number) => updateBlockContent('buttonBorderRadius', v)} placeholder="Ex: 12" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Épaisseur Bordure" type="number" value={activeBlock.content.buttonBorderWidth ?? 0} onChange={(v: number) => updateBlockContent('buttonBorderWidth', v)} placeholder="Ex: 0" />
                        <Field label="Couleur de bordure" type="color" value={activeBlock.content.buttonBorderColor || '#ffffff'} onChange={(v: string) => updateBlockContent('buttonBorderColor', v)} />
                      </div>
                      
                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-4 mt-2">
                           <label className="text-[10px] font-bold text-gray-400 uppercase">Afficher le prix</label>
                           <Field type="switch" value={activeBlock.content.showPrice} onChange={(v: boolean) => updateBlockContent('showPrice', v)} />
                        </div>
                        {activeBlock.content.showPrice !== false && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <Field label="Couleur" type="color" value={activeBlock.content.priceColor} onChange={(v: string) => updateBlockContent('priceColor', v)} />
                              <Field label="Taille (px)" type="number" value={activeBlock.content.priceSize} onChange={(v: number) => updateBlockContent('priceSize', v)} />
                            </div>
                            <div className="mt-4 border-t border-dashed border-gray-200 pt-4">
                              <div className="flex items-center justify-between mb-2">
                                 <label className="text-[10px] font-bold text-gray-400 uppercase">Afficher ancien prix (Barré)</label>
                                 <Field type="switch" value={activeBlock.content.showOldPrice} onChange={(v: boolean) => updateBlockContent('showOldPrice', v)} />
                              </div>
                              {activeBlock.content.showOldPrice && (
                                <div className="space-y-4">
                                  <Field label="Valeur Ancien Prix (MAD)" type="number" value={activeBlock.content.oldPriceValue} onChange={(v: number) => updateBlockContent('oldPriceValue', v)} placeholder="Ex: 150" />
                                  <div className="grid grid-cols-2 gap-4">
                                    <Field label="Couleur" type="color" value={activeBlock.content.oldPriceColor || '#9ca3af'} onChange={(v: string) => updateBlockContent('oldPriceColor', v)} />
                                    <Field label="Taille (px)" type="number" value={activeBlock.content.oldPriceSize || (activeBlock.content.priceSize || 30) * 0.7} onChange={(v: number) => updateBlockContent('oldPriceSize', v)} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase">Options du Produit</h4>
                        <button 
                          onClick={() => {
                            const newOptions = [...(activeBlock.content.options || []), { id: Math.random().toString(36).substr(2, 9), name: '', price: '', color: '' }];
                            updateBlockContent('options', newOptions);
                          }}
                          className="p-1 hover:bg-orange-50 text-orange-600 rounded-lg transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {(activeBlock.content.options || []).map((opt: any, index: number) => (
                          <div key={index} className="bg-white p-3 rounded-xl border border-gray-100 space-y-3 relative group">
                            <button 
                              onClick={() => {
                                const newOptions = activeBlock.content.options.filter((_: any, i: number) => i !== index);
                                updateBlockContent('options', newOptions);
                              }}
                              className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <Field 
                              label="Nom (ex: Pack 1)" 
                              type="text" 
                              value={opt.name} 
                              onChange={(v: string) => {
                                const newOptions = [...activeBlock.content.options];
                                newOptions[index].name = v;
                                updateBlockContent('options', newOptions);
                              }} 
                            />
                            <Field 
                              label="Prix (MAD)" 
                              type="number" 
                              value={opt.price} 
                              onChange={(v: number) => {
                                const newOptions = [...activeBlock.content.options];
                                newOptions[index].price = v;
                                updateBlockContent('options', newOptions);
                              }} 
                            />
                            <Field 
                              label="Couleur du Pack" 
                              type="color" 
                              value={opt.color || activeBlock.content.packColor || '#f97316'} 
                              onChange={(v: string) => {
                                const newOptions = [...activeBlock.content.options];
                                newOptions[index].color = v;
                                updateBlockContent('options', newOptions);
                              }} 
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <Field 
                          label="Épaisseur Bordure" 
                          type="number" 
                          value={activeBlock.content.packBorderWidth ?? 2} 
                          onChange={(v: number) => updateBlockContent('packBorderWidth', v)} 
                        />
                        <Field 
                          label="Corner Radius" 
                          type="number" 
                          value={activeBlock.content.packBorderRadius ?? 16} 
                          onChange={(v: number) => updateBlockContent('packBorderRadius', v)} 
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase">Champs du Formulaire</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-[10px] font-bold text-gray-400">NOM COMPLET</label>
                          <div className="grid grid-cols-2 gap-2">
                             <Field type="text" placeholder="Label" value={activeBlock.content.nameLabel} onChange={(v: string) => updateBlockContent('nameLabel', v)} />
                             <Field type="text" placeholder="Hint" value={activeBlock.content.namePlaceholder} onChange={(v: string) => updateBlockContent('namePlaceholder', v)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-[10px] font-bold text-gray-400">TÉLÉPHONE</label>
                          <div className="grid grid-cols-2 gap-2">
                             <Field type="text" placeholder="Label" value={activeBlock.content.phoneLabel} onChange={(v: string) => updateBlockContent('phoneLabel', v)} />
                             <Field type="text" placeholder="Hint" value={activeBlock.content.phonePlaceholder} onChange={(v: string) => updateBlockContent('phonePlaceholder', v)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-[10px] font-bold text-gray-400">VILLE</label>
                          <div className="grid grid-cols-2 gap-2">
                             <Field type="text" placeholder="Label" value={activeBlock.content.cityLabel} onChange={(v: string) => updateBlockContent('cityLabel', v)} />
                             <Field type="text" placeholder="Hint" value={activeBlock.content.cityPlaceholder} onChange={(v: string) => updateBlockContent('cityPlaceholder', v)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-[10px] font-bold text-gray-400">ADRESSE</label>
                          <div className="grid grid-cols-2 gap-2">
                             <Field type="text" placeholder="Label" value={activeBlock.content.addressLabel} onChange={(v: string) => updateBlockContent('addressLabel', v)} />
                             <Field type="text" placeholder="Hint" value={activeBlock.content.addressPlaceholder} onChange={(v: string) => updateBlockContent('addressPlaceholder', v)} />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase">Style du Formulaire</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Bordure (px)" type="number" value={activeBlock.content.borderWidth} onChange={(v: number) => updateBlockContent('borderWidth', v)} />
                        <Field label="Couleur Bordure" type="color" value={activeBlock.content.borderColor} onChange={(v: string) => updateBlockContent('borderColor', v)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Arrondi des coins (px)</label>
                        <div className="grid grid-cols-4 gap-2">
                          <MiniField icon="◤" value={activeBlock.content.borderRadiusTL} onChange={(v: any) => updateBlockContent('borderRadiusTL', v)} />
                          <MiniField icon="◥" value={activeBlock.content.borderRadiusTR} onChange={(v: any) => updateBlockContent('borderRadiusTR', v)} />
                          <MiniField icon="◣" value={activeBlock.content.borderRadiusBL} onChange={(v: any) => updateBlockContent('borderRadiusBL', v)} />
                          <MiniField icon="◢" value={activeBlock.content.borderRadiusBR} onChange={(v: any) => updateBlockContent('borderRadiusBR', v)} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-gray-100">
                       <SpacingControls content={activeBlock.content} onChange={updateBlockContent} />
                    </div>
                  </div>
                )}

                {activeBlock.type === 'products' && (
                  <div className="space-y-6">
                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                      <div className="flex items-center gap-3 mb-2">
                        <ShoppingBag className="w-5 h-5 text-orange-500" />
                        <span className="font-black text-orange-900 text-sm">Propositions Produits</span>
                      </div>
                      <p className="text-xs text-orange-700 leading-relaxed">
                        Affichez les produits de vos vendeurs ou influenceurs sous forme de grille ou carrousel.
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase">Configuration</h4>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Format d'affichage</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { type: 'grid', label: 'Grille CSS' },
                            { type: 'slider', label: 'Slide (Carrousel)' }
                          ].map(opt => {
                            const isSelected = (activeBlock.content.layoutType || 'grid') === opt.type;
                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => updateBlockContent('layoutType', opt.type)}
                                className={`text-center py-2 rounded-lg border border-2 transition-all text-xs font-black ${
                                  isSelected 
                                    ? 'border-orange-500 bg-orange-50 text-orange-700' 
                                    : 'border-gray-100 hover:border-gray-200 bg-white text-gray-500'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>



                      {(activeBlock.content.layoutType || 'grid') === 'grid' && (
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Colonnes (Desktop)</label>
                          <div className="grid grid-cols-4 gap-2">
                            {[1, 2, 3, 4].map(n => {
                              const isSelected = (activeBlock.content.gridCols || 3) === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => updateBlockContent('gridCols', n)}
                                  className={`text-center py-2 rounded-lg border-2 transition-all text-xs font-black ${
                                    isSelected 
                                      ? 'border-orange-500 bg-orange-50 text-orange-700' 
                                      : 'border-gray-100 hover:border-gray-200 bg-white text-gray-500'
                                  }`}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase font-black">Sélection des Produits</h4>
                      {loadingBlockProducts ? (
                        <div className="text-xs text-gray-400 italic py-2">Chargement des produits...</div>
                      ) : blockProducts.length === 0 ? (
                        <div className="text-xs text-gray-400 italic py-2">Sélectionnez d'abord un compte pour charger ses produits.</div>
                      ) : (
                        <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                          {blockProducts.map(p => {
                            const selectedItem = (activeBlock.content.selectedProducts || []).find((sp: any) => sp.productId === p.id);
                            const isChecked = !!selectedItem;
                            
                            return (
                              <div 
                                key={p.id} 
                                className={`border rounded-2xl p-3.5 transition-all duration-300 ${
                                  isChecked 
                                    ? 'border-orange-500 bg-orange-50/30 shadow-xs' 
                                    : 'border-gray-200/80 bg-white hover:border-gray-300'
                                }`}
                              >
                                <div 
                                  className="flex items-center gap-3 cursor-pointer select-none"
                                  onClick={() => {
                                    let updated;
                                    if (!isChecked) {
                                      const defaultLink = p.referralLinks?.[0]?.code
                                        ? buildReferralUrl(p.referralLinks[0].code, ownerSubdomain)
                                        : '';
                                      updated = [...(activeBlock.content.selectedProducts || []), { productId: p.id, link: defaultLink, buttonText: 'Commander' }];
                                    } else {
                                      updated = (activeBlock.content.selectedProducts || []).filter((sp: any) => sp.productId !== p.id);
                                    }
                                    updateBlockContent('selectedProducts', updated);
                                  }}
                                >
                                  {/* Selection Check Ring */}
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                                    isChecked 
                                      ? 'border-orange-500 bg-orange-500 text-white' 
                                      : 'border-gray-300 bg-white'
                                  }`}>
                                    {isChecked && <span className="text-[10px] font-black leading-none">✓</span>}
                                  </div>
                                  
                                  {/* Thumbnail Image */}
                                  {p.images?.[0]?.url ? (
                                    <img src={p.images[0].url} className="w-10 h-10 object-cover rounded-lg border border-gray-200/50 shrink-0" />
                                  ) : (
                                    <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-200/30 flex items-center justify-center text-gray-400 shrink-0">
                                      <ShoppingBag className="w-4 h-4" />
                                    </div>
                                  )}

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-gray-800 truncate leading-tight">{p.nameFr || p.nameEn || p.nameAr}</p>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5 tracking-tighter">{p.sku || 'Sans SKU'}</p>
                                  </div>
                                </div>

                                {isChecked && (
                                  <div className="mt-3.5 pt-3.5 border-t border-dashed border-gray-200/80 space-y-3">
                                    <div>
                                      <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Destination du Bouton</label>
                                      <div className="flex items-center gap-1.5 w-full min-w-0">
                                        <select 
                                          value={selectedItem.link || ''}
                                          onChange={(e) => {
                                            const updated = (activeBlock.content.selectedProducts || []).map((sp: any) => {
                                              if (sp.productId === p.id) {
                                                return { ...sp, link: e.target.value };
                                              }
                                              return sp;
                                            });
                                            updateBlockContent('selectedProducts', updated);
                                          }}
                                          className="flex-1 min-w-0 text-[11px] bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 font-bold truncate"
                                        >
                                          {(p.referralLinks || []).length === 0 ? (
                                            <option value="">Aucun lien de landing page</option>
                                          ) : (
                                            (p.referralLinks || []).map((link: any) => {
                                              const url = buildReferralUrl(link.code, ownerSubdomain);
                                              const displayCode = link.code.length > 15 ? link.code.slice(0, 12) + '...' : link.code;
                                              return (
                                                <option key={link.id} value={url}>
                                                  /r/{displayCode}
                                                </option>
                                              );
                                            })
                                          )}
                                        </select>
                                        <a 
                                          href={selectedItem.link && selectedItem.link.startsWith('http') ? selectedItem.link : undefined} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                                            selectedItem.link && selectedItem.link.startsWith('http')
                                              ? 'bg-white hover:bg-orange-50 hover:text-orange-600 text-gray-400 border-gray-200 cursor-pointer'
                                              : 'bg-gray-50 text-gray-300 border-gray-100/50 cursor-not-allowed pointer-events-none'
                                          }`}
                                          title="Visiter la landing page"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Texte du Bouton (ex: Shop Now)</label>
                                      <input 
                                        type="text"
                                        value={selectedItem.buttonText || ''}
                                        onChange={(e) => {
                                          const updated = (activeBlock.content.selectedProducts || []).map((sp: any) => {
                                            if (sp.productId === p.id) {
                                              return { ...sp, buttonText: e.target.value };
                                            }
                                            return sp;
                                          });
                                          updateBlockContent('selectedProducts', updated);
                                        }}
                                        className="w-full text-xs bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium"
                                        placeholder="Commander"
                                      />
                                    </div>
                                    <div className="flex gap-2.5 mt-2">
                                      <div className="flex-1">
                                        <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Fond Btn</label>
                                        <div className="flex gap-1.5 items-center">
                                          <input 
                                            type="color" 
                                            value={selectedItem.btnBg || activeBlock.content.btnBg || '#f97316'} 
                                            onChange={(e) => {
                                              const updated = (activeBlock.content.selectedProducts || []).map((sp: any) => {
                                                if (sp.productId === p.id) {
                                                  return { ...sp, btnBg: e.target.value };
                                                }
                                                return sp;
                                              });
                                              updateBlockContent('selectedProducts', updated);
                                            }} 
                                            className="h-6 w-7 border border-gray-200 p-0 rounded-lg cursor-pointer shrink-0" 
                                          />
                                          <input 
                                            type="text" 
                                            value={selectedItem.btnBg || activeBlock.content.btnBg || '#f97316'} 
                                            onChange={(e) => {
                                              const updated = (activeBlock.content.selectedProducts || []).map((sp: any) => {
                                                if (sp.productId === p.id) {
                                                  return { ...sp, btnBg: e.target.value };
                                                }
                                                return sp;
                                              });
                                              updateBlockContent('selectedProducts', updated);
                                            }} 
                                            className="w-full text-[10px] border border-gray-200 px-1.5 py-0.5 rounded-lg font-mono uppercase text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500" 
                                          />
                                        </div>
                                      </div>
                                      <div className="flex-1">
                                        <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Texte Btn</label>
                                        <div className="flex gap-1.5 items-center">
                                          <input 
                                            type="color" 
                                            value={selectedItem.btnColor || activeBlock.content.btnColor || '#ffffff'} 
                                            onChange={(e) => {
                                              const updated = (activeBlock.content.selectedProducts || []).map((sp: any) => {
                                                if (sp.productId === p.id) {
                                                  return { ...sp, btnColor: e.target.value };
                                                }
                                                return sp;
                                              });
                                              updateBlockContent('selectedProducts', updated);
                                            }} 
                                            className="h-6 w-7 border border-gray-200 p-0 rounded-lg cursor-pointer shrink-0" 
                                          />
                                          <input 
                                            type="text" 
                                            value={selectedItem.btnColor || activeBlock.content.btnColor || '#ffffff'} 
                                            onChange={(e) => {
                                              const updated = (activeBlock.content.selectedProducts || []).map((sp: any) => {
                                                if (sp.productId === p.id) {
                                                  return { ...sp, btnColor: e.target.value };
                                                }
                                                return sp;
                                              });
                                              updateBlockContent('selectedProducts', updated);
                                            }} 
                                            className="w-full text-[10px] border border-gray-200 px-1.5 py-0.5 rounded-lg font-mono uppercase text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500" 
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase font-black">Options d'Affichage</h4>
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-200/60 shadow-2xs">
                        <span className="text-xs font-bold text-gray-600">Afficher le prix</span>
                        <input 
                          type="checkbox"
                          checked={activeBlock.content.showPrice !== false}
                          onChange={(e) => updateBlockContent('showPrice', e.target.checked)}
                          className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 border-gray-300 cursor-pointer"
                        />
                      </div>
                      
                      {(activeBlock.content.layoutType || 'grid') === 'slider' && (
                        <div className="space-y-3 bg-white p-3 rounded-xl border border-gray-200/60 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-600">Défilement auto.</span>
                            <input 
                              type="checkbox"
                              checked={activeBlock.content.autoPlay !== false}
                              onChange={(e) => updateBlockContent('autoPlay', e.target.checked)}
                              className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 border-gray-300 cursor-pointer"
                            />
                          </div>
                          {activeBlock.content.autoPlay !== false && (
                            <div className="flex items-center justify-between gap-4 pt-2 border-t border-dashed border-gray-100">
                              <span className="text-[9px] font-bold text-gray-400 uppercase">Intervalle (ms)</span>
                              <input 
                                type="number"
                                min={1000}
                                step={500}
                                value={activeBlock.content.autoPlaySpeed || 3500}
                                onChange={(e) => updateBlockContent('autoPlaySpeed', Number(e.target.value))}
                                className="w-20 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-right text-gray-600 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                              />
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between gap-4 pt-2 border-t border-dashed border-gray-100">
                            <span className="text-[11px] font-bold text-gray-600">Défiler par</span>
                            <select 
                              value={activeBlock.content.slideStep || 1}
                              onChange={(e) => updateBlockContent('slideStep', Number(e.target.value))}
                              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-600 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                              <option value={1}>1 carte</option>
                              <option value={2}>2 cartes</option>
                              <option value={3}>3 cartes</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-4 pt-2 border-t border-dashed border-gray-100">
                            <span className="text-[11px] font-bold text-gray-600">Transition</span>
                            <select 
                              value={activeBlock.content.animationType || 'standard'}
                              onChange={(e) => updateBlockContent('animationType', e.target.value)}
                              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-600 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                              <option value="standard">Standard</option>
                              <option value="smooth">Fluide</option>
                              <option value="bounce">Ressort</option>
                              <option value="continuous">Continu</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase">Style des Cartes</h4>
                      <Field label="Couleur de fond" type="color" value={activeBlock.content.cardBg || '#ffffff'} onChange={(v: string) => updateBlockContent('cardBg', v)} />
                      <Field label="Arrondi (px)" type="number" value={activeBlock.content.cardRadius ?? 16} onChange={(v: number) => updateBlockContent('cardRadius', v)} />
                      <Field label="Couleur titre" type="color" value={activeBlock.content.titleColor || '#111827'} onChange={(v: string) => updateBlockContent('titleColor', v)} />
                      <Field label="Couleur description" type="color" value={activeBlock.content.descColor || '#4b5563'} onChange={(v: string) => updateBlockContent('descColor', v)} />
                      <Field label="Couleur prix" type="color" value={activeBlock.content.priceColor || '#f97316'} onChange={(v: string) => updateBlockContent('priceColor', v)} />
                      <Field label="Couleur de fond Bouton" type="color" value={activeBlock.content.btnBg || '#f97316'} onChange={(v: string) => updateBlockContent('btnBg', v)} />
                      <Field label="Couleur Texte Bouton" type="color" value={activeBlock.content.btnColor || '#ffffff'} onChange={(v: string) => updateBlockContent('btnColor', v)} />
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <SpacingControls content={activeBlock.content} onChange={updateBlockContent} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedBlockId === 'page' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-black text-gray-800">Paramètres Page</h2>
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase">Global</span>
                </div>
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 mb-6 transition-all">
                  <p className="text-xs text-blue-600 leading-relaxed font-medium">
                    Ces paramètres s'appliquent à l'ensemble du fond de votre page de vente.
                  </p>
                </div>
                
                <Field 
                  label="Couleur de fond de page" 
                  type="color" 
                  value={pageSettings.backgroundColor} 
                  onChange={(v: string) => setPageSettings((prev: any) => ({ ...prev, backgroundColor: v }))} 
                />
                <div className="pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="w-4 h-4 text-purple-500" />
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Données du Layout (JSON)</h4>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium leading-relaxed mb-3">
                    Copiez les données actuelles ou collez un layout existant ci-dessous pour le charger instantanément.
                  </p>
                  
                  <div className="space-y-3">
                    <button
                      onClick={handleCopyJSON}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl transition-all active:scale-95 border border-purple-100"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copier le Layout (JSON)
                    </button>
                    
                    <textarea
                      placeholder='Collez votre code JSON de layout ici...'
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      className="w-full h-32 p-3 border border-gray-200 rounded-xl text-[10px] font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none bg-gray-50/50"
                    />
                    
                    <button
                      onClick={handleImportJSON}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-100 transition-all active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Appliquer le JSON
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!activeBlock && selectedBlockId !== 'page' && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <LayoutTemplate className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-sm font-medium">Sélectionnez un composant ou le fond pour l'éditer.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Subcomponents
const CheckoutPreview = ({ content, product }: any) => {
  const price = product?.retailPriceMad || '...';
  
  return (
    <div 
      className="bg-white p-6 sm:p-8 w-full max-w-xl mx-auto selection:bg-orange-100"
      style={{ 
        border: `${content.borderWidth ?? 1}px solid ${content.borderColor ?? '#f3f4f6'}`,
        borderRadius: `${content.borderRadiusTL ?? 32}px ${content.borderRadiusTR ?? 32}px ${content.borderRadiusBR ?? 32}px ${content.borderRadiusBL ?? 32}px`
      }}
    >
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-black text-gray-900 mb-1">
          {content.title || 'Commander Maintenant'}
        </h2>
        {content.showPrice !== false && (
          <div className="flex items-center justify-center gap-3 mb-2">
            {content.showOldPrice && (
              <span 
                className="font-bold line-through opacity-60"
                style={{ 
                  color: content.oldPriceColor || '#9ca3af',
                  fontSize: `${content.oldPriceSize || (content.priceSize || 30) * 0.7}px`
                }}
              >
                {content.oldPriceValue || (product?.retailPriceMad ? Number(product.retailPriceMad) + 50 : 150)} <span className="text-sm uppercase ml-0.5">MAD</span>
              </span>
            )}
            <div 
              className="font-black"
              style={{ 
                color: content.priceColor || '#f97316',
                fontSize: `${content.priceSize || 30}px`
              }}
            >
              {price} <span className="text-lg uppercase ml-1 opacity-60">MAD</span>
            </div>
          </div>
        )}
        <p className="text-gray-500 text-sm font-medium">
          {content.subtitle || 'Remplissez le formulaire ci-dessous pour réserver votre produit. Le paiement se fera à la livraison.'}
        </p>
      </div>

      {content.options && content.options.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-2">
          {content.options.map((opt: any, i: number) => {
            const optionColor = opt.color || content.packColor || '#f97316';
            const isFirst = i === 0;
            return (
              <div 
                key={i} 
                className={`py-3 px-3 transition-all flex justify-between items-center outline-none ${isFirst ? '' : 'border-b border-gray-100'}`}
                style={isFirst ? { 
                  borderColor: optionColor, 
                  borderWidth: `${content.packBorderWidth ?? 2}px`,
                  borderRadius: `${content.packBorderRadius ?? 16}px`,
                  backgroundColor: `${optionColor}10`
                } : {}}
              >
                <div>
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Option {i + 1}</div>
                  <div className="font-black text-gray-900" style={isFirst ? { color: optionColor } : {}}>{opt.name || `Pack ${i + 1}`}</div>
                </div>
                <div className="text-lg font-black" style={{ color: isFirst ? optionColor : '#111827' }}>
                  {opt.price || '...'} <span className="text-[10px] opacity-60">MAD</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <div className="space-y-4">
        {[
          { label: content.nameLabel || 'Nom complet *', placeholder: content.namePlaceholder || 'Ex: Youssef Benjelloun' },
          { label: content.phoneLabel || 'Numéro de téléphone *', placeholder: content.phonePlaceholder || '06 XX XX XX XX' },
          { label: content.cityLabel || 'Ville *', placeholder: content.cityPlaceholder || 'Ex: Casablanca' },
          { label: content.addressLabel || 'Adresse (Optionnel)', placeholder: content.addressPlaceholder || 'Votre adresse complète...' }
        ].map((field, i) => (
          <div key={i}>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">{field.label}</label>
            <div className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl font-medium text-gray-400 text-sm">
              {field.placeholder}
            </div>
          </div>
        ))}

        <div 
          className="w-full font-black p-4 shadow-lg flex items-center justify-center gap-2 mt-6 cursor-default"
          style={{ 
            backgroundColor: content.themeColor || '#f97316',
            color: content.buttonTextColor || '#ffffff',
            fontSize: content.buttonSize ? `${content.buttonSize}px` : '18px',
            border: content.buttonBorderWidth !== undefined && content.buttonBorderWidth !== '' ? `${content.buttonBorderWidth}px solid ${content.buttonBorderColor || '#f97316'}` : 'none',
            borderRadius: content.buttonBorderRadius !== undefined && content.buttonBorderRadius !== '' ? `${content.buttonBorderRadius}px` : '12px',
          }}
        >
          {content.buttonText || 'Confirmer ma commande'}
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 mt-4 uppercase tracking-widest">
           <ShieldCheck className="w-3.5 h-3.5" />
           Informations Sécurisées
        </div>
      </div>
    </div>
  );
};

// Subcomponents
const SpacingControls = ({ content, onChange, noLeftRight = false }: any) => (
  <div className="pt-2 border-t border-gray-100 pb-2">
    <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Espacement (px)</h4>
    <div className="grid grid-cols-2 gap-x-2 gap-y-3">
      <Field label="Pad. Haut" type="number" value={content.paddingTop} onChange={(v: any) => onChange('paddingTop', v)} />
      <Field label="Pad. Bas" type="number" value={content.paddingBottom} onChange={(v: any) => onChange('paddingBottom', v)} />
      {!noLeftRight && (
        <>
          <Field label="Pad. Gauche" type="number" value={content.paddingLeft} onChange={(v: any) => onChange('paddingLeft', v)} />
          <Field label="Pad. Droite" type="number" value={content.paddingRight} onChange={(v: any) => onChange('paddingRight', v)} />
        </>
      )}
      <Field label="Marg. Haut" type="number" value={content.marginTop} onChange={(v: any) => onChange('marginTop', v)} />
      <Field label="Marg. Bas" type="number" value={content.marginBottom} onChange={(v: any) => onChange('marginBottom', v)} />
    </div>
  </div>
);

const MiniField = ({ icon, value, onChange }: any) => (
  <div className="flex flex-col gap-1">
    <div className="text-[10px] text-gray-400 text-center">{icon}</div>
    <input 
      type="number" 
      value={value ?? 0} 
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full text-[10px] border-gray-200 rounded p-1 border focus:border-orange-500 outline-none text-center font-bold"
    />
  </div>
);

const ToolButton = ({ icon, label, onClick, fullWidth = false }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 hover:border-orange-500 hover:shadow-md hover:text-orange-600 rounded-xl transition-all ${fullWidth ? 'w-full' : 'col-span-1'}`}
  >
    <div className="text-gray-400">{icon}</div>
    <span className="text-xs font-bold">{label}</span>
  </button>
);

const Field = ({ label, type, value, onChange, placeholder }: any) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
    {type === 'textarea' ? (
      <textarea 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border-gray-200 rounded p-2 border focus:border-orange-500 outline-none min-h-[100px]"
      />
    ) : type === 'color' ? (
      <div className="flex gap-2">
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 border p-0 rounded cursor-pointer" />
        <input type="text" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="flex-1 text-sm border p-1 px-2 rounded font-mono uppercase" />
      </div>
    ) : type === 'switch' ? (
      <div 
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full p-0.5 cursor-pointer transition-all duration-300 ${value ? 'bg-orange-500' : 'bg-gray-200'}`}
      >
        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    ) : (
      <input 
        type={type} 
        value={value || ''} 
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border-gray-200 rounded p-2 border focus:border-orange-500 outline-none"
      />
    )}
  </div>
);
