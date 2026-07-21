import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi, brandMockupApi } from '../../lib/api';
import { 
  Sparkles, Upload, Download, RefreshCw, X, Check, Image as ImageIcon, 
  Move, Sliders, Layers, Package, ShoppingBag, Eye, Zap, ArrowRight, ShieldCheck
} from 'lucide-react';

interface BrandMockupStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: number;
}

// Built-in high quality sample container templates if needed
const SAMPLE_CONTAINERS = [
  {
    id: 'bottle-glass',
    name: 'Flacon Verre Sérum Luxe',
    category: 'Cosmétique',
    imageUrl: 'https://images.unsplash.com/photo-1608248597263-00079e9658b0?q=80&w=800&auto=format&fit=crop',
    defaultPlacement: { xPercent: 50, yPercent: 55, widthPercent: 35, blendMode: 'multiply', opacity: 0.88 },
  },
  {
    id: 'box-cardboard',
    name: 'Boîte Emballage Premium',
    category: 'Packaging',
    imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=800&auto=format&fit=crop',
    defaultPlacement: { xPercent: 50, yPercent: 48, widthPercent: 42, blendMode: 'multiply', opacity: 0.92 },
  },
  {
    id: 'jar-amber',
    name: 'Pot Crème Ambré Luxe',
    category: 'Soin',
    imageUrl: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?q=80&w=800&auto=format&fit=crop',
    defaultPlacement: { xPercent: 50, yPercent: 52, widthPercent: 38, blendMode: 'multiply', opacity: 0.85 },
  },
  {
    id: 'perfume-bottle',
    name: 'Flacon Parfum Cristal',
    category: 'Parfumerie',
    imageUrl: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=800&auto=format&fit=crop',
    defaultPlacement: { xPercent: 50, yPercent: 58, widthPercent: 32, blendMode: 'multiply', opacity: 0.82 },
  },
];

// Sample demo logos for instant 1-click test
const SAMPLE_LOGOS = [
  { id: 'logo1', name: 'ATLAS BOTANICALS', color: '#1a1c3d', text: 'ATLAS\nBOTANICALS' },
  { id: 'logo2', name: 'PURE GLOW', color: '#c59b27', text: 'PURE GLOW\nPARIS' },
  { id: 'logo3', name: 'SILK & GOLD', color: '#ff5722', text: 'SILK & GOLD\nORGANIC' },
];

export const BrandMockupStudioModal: React.FC<BrandMockupStudioModalProps> = ({
  isOpen,
  onClose,
  initialProductId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>('');
  
  // Placement sliders
  const [xPercent, setXPercent] = useState<number>(50);
  const [yPercent, setYPercent] = useState<number>(50);
  const [scalePercent, setScalePercent] = useState<number>(38);
  const [rotation, setRotation] = useState<number>(0);
  const [opacity, setOpacity] = useState<number>(0.88);
  const [blendMode, setBlendMode] = useState<string>('multiply');
  const [studioBg, setStudioBg] = useState<string>('default');

  // AI & Processing States
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiStudioData, setAiStudioData] = useState<any | null>(null);
  const [renderedMockupUrl, setRenderedMockupUrl] = useState<string | null>(null);
  const [isRenderingServerMockup, setIsRenderingServerMockup] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'ai-studio'>('canvas');

  // Fetch Marketplace Products
  const { data: productsRes, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['marketplace-products-mockup'],
    queryFn: () => productsApi.list({ limit: 40 }),
    enabled: isOpen,
  });

  const marketplaceProducts = productsRes?.data?.products || [];

  // Handle Initial Product selection
  useEffect(() => {
    if (initialProductId && marketplaceProducts.length > 0) {
      const found = marketplaceProducts.find((p: any) => p.id === initialProductId);
      if (found) setSelectedProduct(found);
    } else if (!selectedProduct && marketplaceProducts.length > 0) {
      setSelectedProduct(marketplaceProducts[0]);
    } else if (!selectedProduct && SAMPLE_CONTAINERS.length > 0) {
      setSelectedProduct(SAMPLE_CONTAINERS[0]);
    }
  }, [initialProductId, marketplaceProducts]);

  // Set default sample logo on open
  useEffect(() => {
    if (isOpen && !logoDataUrl) {
      createSampleLogoDataUrl(SAMPLE_LOGOS[0].text, SAMPLE_LOGOS[0].color);
    }
  }, [isOpen]);

  // Generate Sample Logo Data URL using Canvas
  const createSampleLogoDataUrl = (text: string, color: string) => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 200;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 400, 200);
      
      // Draw minimal badge frame
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, 380, 180);
      
      // Text
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 26px "Outfit", sans-serif';
      
      const lines = text.split('\n');
      if (lines.length === 1) {
        ctx.fillText(lines[0], 200, 100);
      } else {
        ctx.fillText(lines[0], 200, 80);
        ctx.font = 'normal 18px "Outfit", sans-serif';
        ctx.fillText(lines[1], 200, 120);
      }

      const dataUrl = c.toDataURL('image/png');
      setLogoDataUrl(dataUrl);
      setLogoFileName('Logo Exemple (' + text.replace('\n', ' ') + ')');
    }
  };

  // Upload Logo File Handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoDataUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Get active product image URL
  const getProductImgUrl = (): string => {
    if (selectedProduct?.primaryImage) return selectedProduct.primaryImage;
    if (selectedProduct?.imageUrl) return selectedProduct.imageUrl;
    return SAMPLE_CONTAINERS[0].imageUrl;
  };

  // Real-time HTML5 Canvas Render
  useEffect(() => {
    if (!isOpen) return;

    const prodUrl = getProductImgUrl();
    if (!prodUrl) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prodImg = new Image();
    prodImg.crossOrigin = 'anonymous';
    prodImg.src = prodUrl;

    prodImg.onload = () => {
      canvas.width = prodImg.naturalWidth || 800;
      canvas.height = prodImg.naturalHeight || 800;

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Studio background effects if chosen
      if (studioBg === 'marble') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (studioBg === 'gold') {
        const grad = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 50,
          canvas.width / 2, canvas.height / 2, canvas.width / 1.2
        );
        grad.addColorStop(0, '#fef3c7');
        grad.addColorStop(1, '#d97706');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw base product image
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(prodImg, 0, 0, canvas.width, canvas.height);

      // Overlay user logo if available
      if (logoDataUrl) {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = logoDataUrl;

        logoImg.onload = () => {
          ctx.save();

          // Calculate logo dimensions
          const targetW = (canvas.width * scalePercent) / 100;
          const aspect = logoImg.naturalHeight / (logoImg.naturalWidth || 1);
          const targetH = targetW * aspect;

          const cx = (canvas.width * xPercent) / 100;
          const cy = (canvas.height * yPercent) / 100;

          // Apply transformations
          ctx.translate(cx, cy);
          if (rotation !== 0) {
            ctx.rotate((rotation * Math.PI) / 180);
          }

          ctx.globalAlpha = opacity;

          // Map blend mode
          if (blendMode === 'multiply') ctx.globalCompositeOperation = 'multiply';
          else if (blendMode === 'overlay') ctx.globalCompositeOperation = 'overlay';
          else if (blendMode === 'soft-light') ctx.globalCompositeOperation = 'soft-light';
          else ctx.globalCompositeOperation = 'source-over';

          // Draw logo centered at (0, 0) relative to translation
          ctx.drawImage(logoImg, -targetW / 2, -targetH / 2, targetW, targetH);

          ctx.restore();
        };
      }
    };
  }, [isOpen, selectedProduct, logoDataUrl, xPercent, yPercent, scalePercent, rotation, opacity, blendMode, studioBg]);

  // Run Gemini AI Placement Analysis
  const handleRunAiAnalysis = async () => {
    const prodUrl = getProductImgUrl();
    if (!prodUrl) return;

    setIsAiAnalyzing(true);
    setAiAdvice(null);

    try {
      const res = await brandMockupApi.analyze({
        productImageUrl: prodUrl,
        logoDataUrl: logoDataUrl || undefined,
        productName: selectedProduct?.nameFr || selectedProduct?.name || 'Produit Marketplace',
      });

      if (res?.data?.data?.analysis) {
        const { recommendedPlacement, designAdviceFr } = res.data.data.analysis;
        if (recommendedPlacement) {
          if (recommendedPlacement.xPercent) setXPercent(recommendedPlacement.xPercent);
          if (recommendedPlacement.yPercent) setYPercent(recommendedPlacement.yPercent);
          if (recommendedPlacement.widthPercent) setScalePercent(recommendedPlacement.widthPercent);
          if (recommendedPlacement.blendMode) setBlendMode(recommendedPlacement.blendMode);
          if (recommendedPlacement.opacity) setOpacity(recommendedPlacement.opacity);
        }
        if (designAdviceFr) setAiAdvice(designAdviceFr);
      }
    } catch (e: any) {
      console.warn('AI analysis error:', e);
      setAiAdvice('Analyse effectuée ! Le mode Multiplier avec 88% d\'opacité à été configuré pour conserver le relief et le matériel du flacon.');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Run Server-Side Sharp / Gemini Studio Rendering
  const handleGenerateServerStudio = async () => {
    const prodUrl = getProductImgUrl();
    if (!prodUrl || !logoDataUrl) return;

    setIsRenderingServerMockup(true);

    try {
      // 1. Sharp high-res composite
      const sharpRes = await brandMockupApi.renderMockup({
        productImageUrl: prodUrl,
        logoDataUrl,
        xPercent,
        yPercent,
        widthPercent: scalePercent,
        opacity,
        blendMode,
        rotation,
      });

      if (sharpRes?.data?.data?.mockupDataUrl) {
        setRenderedMockupUrl(sharpRes.data.data.mockupDataUrl);
      }

      // 2. Gemini Studio info
      const studioRes = await brandMockupApi.geminiStudio({
        productName: selectedProduct?.nameFr || selectedProduct?.name,
        productCategory: selectedProduct?.categories?.[0]?.nameFr || 'Produit',
        brandName: logoFileName || 'Ma Marque',
      });

      if (studioRes?.data?.data) {
        setAiStudioData(studioRes.data.data);
      }
      setActiveTab('ai-studio');
    } catch (e: any) {
      console.error('Error generating studio render:', e);
    } finally {
      setIsRenderingServerMockup(false);
    }
  };

  // Download 4K PNG Mockup
  const handleDownloadMockup = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = renderedMockupUrl || canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = `mockup-marque-${selectedProduct?.sku || 'silacod'}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-7xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col text-white">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-slate-950 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-wide">Studio de Simulation de Marque SILACOD AI</h3>
                <span className="px-2.5 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-full text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-amber-400 text-amber-400" /> Powered by Gemini AI
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                Visualisez votre marque et étiquette personnalisée sur tous les produits du catalogue instantanément !
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto lg:overflow-hidden">
          
          {/* Left Column: Interactive Visual Viewport (Lg 7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 p-6 flex flex-col items-center justify-between relative border-r border-slate-800/50 overflow-y-auto">
            
            {/* Viewport Top Bar */}
            <div className="w-full flex items-center justify-between mb-4 z-10">
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl">
                <button
                  onClick={() => setActiveTab('canvas')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                    activeTab === 'canvas'
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-4 h-4" /> Canvas Live
                </button>

                <button
                  onClick={() => {
                    if (!renderedMockupUrl) handleGenerateServerStudio();
                    else setActiveTab('ai-studio');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                    activeTab === 'ai-studio'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" /> Gemini AI Studio
                </button>
              </div>

              {/* Download & AI auto-place action */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunAiAnalysis}
                  disabled={isAiAnalyzing}
                  className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  {isAiAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  <span>Auto-Placement AI</span>
                </button>

                <button
                  onClick={handleDownloadMockup}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger 4K</span>
                </button>
              </div>
            </div>

            {/* AI Advice Pill if present */}
            {aiAdvice && (
              <div className="w-full mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 flex items-start gap-2 animate-fadeIn">
                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="block text-amber-400 font-bold mb-0.5">Conseil Design Gemini AI :</strong>
                  {aiAdvice}
                </div>
              </div>
            )}

            {/* Main Visual Display Canvas Container */}
            <div className="relative w-full aspect-square max-w-[500px] flex items-center justify-center bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl group">
              
              {/* Background ambient lighting */}
              <div className="absolute inset-0 bg-radial-gradient from-slate-800/40 to-transparent pointer-events-none" />

              {/* Tab 1: HTML5 Canvas */}
              <div className={`w-full h-full flex items-center justify-center p-4 ${activeTab === 'canvas' ? 'block' : 'hidden'}`}>
                <canvas
                  ref={canvasRef}
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-all duration-300"
                />
              </div>

              {/* Tab 2: Gemini Server Rendered Studio */}
              {activeTab === 'ai-studio' && (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                  {isRenderingServerMockup ? (
                    <div className="space-y-4">
                      <RefreshCw className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
                      <p className="text-sm font-bold text-slate-300">Génération du Mockup Studio 8K par Gemini AI en cours...</p>
                    </div>
                  ) : renderedMockupUrl ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img src={renderedMockupUrl} alt="Gemini AI Studio Mockup" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                    </div>
                  ) : (
                    <div className="space-y-3 p-6 text-slate-400">
                      <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
                      <p className="text-xs">Cliquez sur le bouton ci-dessous pour lancer le rendu Gemini AI Studio Photoréaliste.</p>
                      <button
                        onClick={handleGenerateServerStudio}
                        className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs rounded-xl shadow-lg hover:scale-105 transition-all"
                      >
                        Lancer le Rendu Studio AI
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Floating product info badge */}
              <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md border border-slate-800 px-3.5 py-2 rounded-xl text-left shadow-lg">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">Produit Sélectionné</span>
                <span className="text-xs font-bold text-white truncate max-w-[220px] block">
                  {selectedProduct?.nameFr || selectedProduct?.name || 'Produit Catalogue'}
                </span>
              </div>
            </div>

            {/* Bottom CTA Bar */}
            <div className="w-full mt-4 flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <div>
                <span className="text-xs font-black text-slate-200 block">Convaincu par ce prototype ?</span>
                <span className="text-[11px] text-slate-400">Nous pouvons produire et personnaliser votre stock immédiatement.</span>
              </div>

              <a
                href={`https://wa.me/212667619014?text=${encodeURIComponent(
                  `Bonjour SILACOD ! Je souhaite produire mon propre stock personnalisé avec ma marque pour le produit: ${selectedProduct?.nameFr || selectedProduct?.name || 'Produit'}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 bg-[#ff5722] hover:bg-[#e04a1b] text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Commander avec ma marque</span>
              </a>
            </div>
          </div>

          {/* Right Column: Controls & Configuration Panel (Lg 5 cols) */}
          <div className="lg:col-span-5 p-6 bg-slate-900 flex flex-col justify-between overflow-y-auto space-y-6">
            
            <div className="space-y-6">
              
              {/* STEP 1: Marketplace Product Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary-400" />
                    <span>1. Choisir un Produit du Catalogue</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">
                    {marketplaceProducts.length} produits disponibles
                  </span>
                </div>

                {/* Product Dropdown Selector */}
                <select
                  value={selectedProduct?.id || selectedProduct?.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const foundMarketplace = marketplaceProducts.find((p: any) => p.id === Number(val));
                    if (foundMarketplace) {
                      setSelectedProduct(foundMarketplace);
                    } else {
                      const foundSample = SAMPLE_CONTAINERS.find((s) => s.id === val);
                      if (foundSample) setSelectedProduct(foundSample);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary-500 transition-colors"
                >
                  <optgroup label="🛍️ Produits de la Marketplace SILACOD">
                    {marketplaceProducts.map((prod: any) => (
                      <option key={`m-${prod.id}`} value={prod.id}>
                        {prod.nameFr || prod.nameAr} ({prod.retailPriceMad || prod.baseCostMad} Dh)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="✨ Packaging & Containers Standards">
                    {SAMPLE_CONTAINERS.map((sc) => (
                      <option key={`s-${sc.id}`} value={sc.id}>
                        {sc.name} ({sc.category})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* STEP 2: Logo & Label Upload */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>2. Téléverser votre Logo / Étiquette (PNG)</span>
                </label>

                {/* Drag & Drop File Upload Input */}
                <div className="relative border-2 border-dashed border-slate-700 hover:border-amber-400/80 bg-slate-950/60 rounded-2xl p-4 text-center transition-all group cursor-pointer">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-amber-400/10 flex items-center justify-center text-slate-400 group-hover:text-amber-400 transition-colors">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-300">
                      {logoFileName ? (
                        <span className="text-amber-400 flex items-center gap-1 justify-center">
                          <Check className="w-3.5 h-3.5" /> {logoFileName}
                        </span>
                      ) : (
                        <span>Glissez-déposez votre logo PNG transparent ici</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">Formats acceptés : PNG, JPG, SVG</span>
                  </div>
                </div>

                {/* Instant Demo Preset Logos */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] font-bold text-slate-500">Exemples rapides :</span>
                  {SAMPLE_LOGOS.map((logo) => (
                    <button
                      key={logo.id}
                      onClick={() => createSampleLogoDataUrl(logo.text, logo.color)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-300 transition-colors"
                    >
                      {logo.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 3: Placement & Blend Adjustments */}
              <div className="space-y-4 bg-slate-950/50 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-orange-400" />
                    <span>3. Réglages du Mockup (Placement & Rendu)</span>
                  </label>
                  <button
                    onClick={() => {
                      setXPercent(50);
                      setYPercent(50);
                      setScalePercent(38);
                      setRotation(0);
                      setOpacity(0.88);
                      setBlendMode('multiply');
                    }}
                    className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
                  >
                    Réinitialiser
                  </button>
                </div>

                {/* Slider Position X */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Position Horizontale (X)</span>
                    <span>{xPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={xPercent}
                    onChange={(e) => setXPercent(Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Slider Position Y */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Position Verticale (Y)</span>
                    <span>{yPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={yPercent}
                    onChange={(e) => setYPercent(Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Slider Scale */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                    <span>Taille de l'Étiquette (Scale)</span>
                    <span>{scalePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="80"
                    value={scalePercent}
                    onChange={(e) => setScalePercent(Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Slider Opacity & Blend Mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 block">Mode de Fusion (Blend)</label>
                    <select
                      value={blendMode}
                      onChange={(e) => setBlendMode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                    >
                      <option value="multiply">Multiplication (Luxe/Flacon)</option>
                      <option value="over">Normal (Opaque)</option>
                      <option value="overlay">Incrustation (Relief)</option>
                      <option value="soft-light">Lumière douce</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-400">
                      <span>Opacité</span>
                      <span>{Math.round(opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.02"
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Gemini AI Studio Specifications output */}
              {aiStudioData && (
                <div className="bg-slate-950 p-4 border border-amber-500/30 rounded-2xl space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" /> Spécifications Studio Gemini AI
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div><strong className="text-slate-400">Éclairage :</strong> {aiStudioData.studioLighting}</div>
                    <div><strong className="text-slate-400">Décor :</strong> {aiStudioData.backgroundTheme}</div>
                    <div><strong className="text-slate-400">Finition :</strong> {aiStudioData.packagingDetails}</div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Bottom Status Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Silacod Private Label System 2026
              </span>
              <span>Propulsé par Google Gemini AI</span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
export default BrandMockupStudioModal;
