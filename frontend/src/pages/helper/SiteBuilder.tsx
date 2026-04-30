import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { helperApi, publicApi, uploadApi } from '../../lib/api';
import BlockRenderer, { EditorBlock, BlockType } from '../../components/helper/sitebuilder/BlockRenderer';
import { 
  Type, Image as ImageIcon, Heading, LayoutTemplate, Link as LinkIcon, 
  ShoppingCart, ArrowUp, ArrowDown, Trash2, Save, ChevronLeft, Loader2,
  Clock, Space, Upload, ShieldCheck, Plus, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SiteBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const [pageSettings, setPageSettings] = useState({ backgroundColor: '#ffffff' });
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [productData, setProductData] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

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
            setPageSettings(landingPage.customStructure.settings);
          }
        }
      } else {
        // Default starting blocks if none exist
        setBlocks([
          { id: crypto.randomUUID(), type: 'hero', content: { title: 'Welcome to our offer!', titleColor: '#111827', subtitle: 'Find out more below.', subtitleColor: '#4b5563', bgColor: '#f9fafb' } },
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
    const newBlock: EditorBlock = {
      id: crypto.randomUUID(),
      type,
      content: getDefaultContentForType(type)
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
      case 'spacer': return { height: 32 };
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
      default: return {};
    }
  };

  const activeBlock = blocks.find(b => b.id === selectedBlockId);

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
          <button onClick={() => navigate('/helper/links')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-purple-600">
              <LayoutTemplate className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-gray-900">Constructeur de Page (BETA)</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`flex items-center gap-2 px-4 py-2 border font-bold rounded-lg transition-all ${isPreviewMode ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            <LayoutTemplate className="w-4 h-4" />
            {isPreviewMode ? 'Mode Édition' : 'Mode Aperçu'}
          </button>
          {referralCode && (
            <button 
              onClick={() => window.open(`/r/${referralCode}`, '_blank')}
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
            <div className="grid grid-cols-2 gap-2">
              <ToolButton icon={<Heading className="w-4 h-4" />} label="Header" onClick={() => addBlock('header')} />
              <ToolButton icon={<LayoutTemplate className="w-4 h-4" />} label="Hero" onClick={() => addBlock('hero')} />
              <ToolButton icon={<Type className="w-4 h-4" />} label="Texte" onClick={() => addBlock('text')} />
              <ToolButton icon={<ImageIcon className="w-4 h-4" />} label="Image" onClick={() => addBlock('image')} />
              <ToolButton icon={<Space className="w-4 h-4" />} label="Spacer" onClick={() => addBlock('spacer')} />
            </div>
          </div>
          
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Conversion</h3>
            <div className="grid grid-cols-2 gap-2">
              <ToolButton icon={<LinkIcon className="w-4 h-4" />} label="Button" onClick={() => addBlock('button')} />
              <ToolButton icon={<Clock className="w-4 h-4" />} label="Countdown" onClick={() => addBlock('countdown')} />
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
                    <Field label="Couleur de Fond" type="color" value={activeBlock.content.bgColor} onChange={(v) => updateBlockContent('bgColor', v)} />
                    <Field label="Titre principal" type="text" value={activeBlock.content.title} onChange={(v) => updateBlockContent('title', v)} />
                    <Field label="Couleur du titre" type="color" value={activeBlock.content.titleColor} onChange={(v) => updateBlockContent('titleColor', v)} />
                    <Field label="Sous-titre" type="textarea" value={activeBlock.content.subtitle} onChange={(v) => updateBlockContent('subtitle', v)} />
                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} />
                  </div>
                )}
                
                {activeBlock.type === 'header' && (
                  <div className="space-y-4">
                    <Field label="Couleur de Fond" type="color" value={activeBlock.content.bgColor} onChange={(v) => updateBlockContent('bgColor', v)} />
                    <Field label="Nom de la marque" type="text" value={activeBlock.content.text} onChange={(v) => updateBlockContent('text', v)} />
                    <Field label="Couleur de texte" type="color" value={activeBlock.content.color} onChange={(v) => updateBlockContent('color', v)} />
                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} />
                  </div>
                )}

                {activeBlock.type === 'text' && (
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 font-bold">
                      <input type="checkbox" checked={activeBlock.content.isHeading} onChange={(e) => updateBlockContent('isHeading', e.target.checked)} />
                      Titre de section (h3)
                    </label>
                    <Field label="Texte" type="textarea" value={activeBlock.content.text} onChange={(v) => updateBlockContent('text', v)} />
                    <Field label="Couleur" type="color" value={activeBlock.content.color} onChange={(v) => updateBlockContent('color', v)} />
                    
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
                    <Field label="Texte du bouton" type="text" value={activeBlock.content.text} onChange={(v) => updateBlockContent('text', v)} />
                    <Field label="Couleur de fond" type="color" value={activeBlock.content.bgColor} onChange={(v) => updateBlockContent('bgColor', v)} />
                    
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
                        <Field label="Lien de redirection (Optionnel)" type="text" value={activeBlock.content.link} onChange={(v) => updateBlockContent('link', v)} />
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
                
                {activeBlock.type === 'countdown' && (
                  <div className="space-y-4">
                    <Field label="Texte d'urgence" type="text" value={activeBlock.content.text} onChange={(v) => updateBlockContent('text', v)} />
                    <SpacingControls content={activeBlock.content} onChange={updateBlockContent} noLeftRight />
                  </div>
                )}
                
                {activeBlock.type === 'spacer' && (
                  <div className="space-y-4">
                    <Field label="Hauteur (px)" type="number" value={activeBlock.content.height} onChange={(v) => updateBlockContent('height', v)} />
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
                      <Field label="Couleur du bouton" type="color" value={activeBlock.content.themeColor} onChange={(v: string) => updateBlockContent('themeColor', v)} />
                      
                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-4 mt-2">
                           <label className="text-[10px] font-bold text-gray-400 uppercase">Afficher le prix</label>
                           <Field type="switch" value={activeBlock.content.showPrice} onChange={(v: boolean) => updateBlockContent('showPrice', v)} />
                        </div>
                        {activeBlock.content.showPrice !== false && (
                          <div className="grid grid-cols-2 gap-4">
                            <Field label="Couleur" type="color" value={activeBlock.content.priceColor} onChange={(v: string) => updateBlockContent('priceColor', v)} />
                            <Field label="Taille (px)" type="number" value={activeBlock.content.priceSize} onChange={(v: number) => updateBlockContent('priceSize', v)} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase">Options du Produit</h4>
                        <button 
                          onClick={() => {
                            const newOptions = [...(activeBlock.content.options || []), { id: Math.random().toString(36).substr(2, 9), name: '', price: '' }];
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
                          </div>
                        ))}
                      </div>
                      <Field 
                        label="Couleur des Packs" 
                        type="color" 
                        value={activeBlock.content.packColor || '#f97316'} 
                        onChange={(v: string) => updateBlockContent('packColor', v)} 
                      />
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
                          <MiniField icon="◤" value={activeBlock.content.borderRadiusTL} onChange={(v) => updateBlockContent('borderRadiusTL', v)} />
                          <MiniField icon="◥" value={activeBlock.content.borderRadiusTR} onChange={(v) => updateBlockContent('borderRadiusTR', v)} />
                          <MiniField icon="◣" value={activeBlock.content.borderRadiusBL} onChange={(v) => updateBlockContent('borderRadiusBL', v)} />
                          <MiniField icon="◢" value={activeBlock.content.borderRadiusBR} onChange={(v) => updateBlockContent('borderRadiusBR', v)} />
                        </div>
                      </div>
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
                  onChange={(v: string) => setPageSettings(prev => ({ ...prev, backgroundColor: v }))} 
                />
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
          <div 
            className="font-black mb-2"
            style={{ 
              color: content.priceColor || '#f97316',
              fontSize: `${content.priceSize || 30}px`
            }}
          >
            {price} <span className="text-lg uppercase ml-1 opacity-60">MAD</span>
          </div>
        )}
        <p className="text-gray-500 text-sm font-medium">
          {content.subtitle || 'Remplissez le formulaire ci-dessous pour réserver votre produit. Le paiement se fera à la livraison.'}
        </p>
      </div>

      {content.options && content.options.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-2">
          {content.options.map((opt: any, i: number) => (
            <div 
              key={i} 
              className={`py-3 px-3 transition-all flex justify-between items-center outline-none ${i === 0 ? '' : 'border-b border-gray-100'}`}
              style={i === 0 ? { 
                borderColor: content.packColor || '#f97316', 
                borderWidth: `${content.packBorderWidth ?? 2}px`,
                borderRadius: `${content.packBorderRadius ?? 16}px`,
                backgroundColor: `${content.packColor || '#f97316'}10`
              } : {}}
            >
              <div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Option {i + 1}</div>
                <div className="font-black text-gray-900" style={i === 0 ? { color: content.packColor || '#f97316' } : {}}>{opt.name || `Pack ${i + 1}`}</div>
              </div>
              <div className="text-lg font-black" style={{ color: i === 0 ? (content.packColor || '#f97316') : '#111827' }}>
                {opt.price || '...'} <span className="text-[10px] opacity-60">MAD</span>
              </div>
            </div>
          ))}
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
          className="w-full text-white font-black text-lg p-4 rounded-xl shadow-lg flex items-center justify-center gap-2 mt-6 cursor-default"
          style={{ backgroundColor: content.themeColor || '#f97316' }}
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
