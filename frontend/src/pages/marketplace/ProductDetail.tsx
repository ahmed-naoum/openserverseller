import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { productsApi, fulfillmentApi, chatApi, influencerApi, uploadApi, ordersApi, supportApi, BACKEND_URL } from '../../lib/api';
import { getVerificationStatus } from '../common/ProfileVerification';
import toast from 'react-hot-toast';
import { 
  Package, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare, 
  ExternalLink, 
  Edit3, 
  Upload, 
  FileText, 
  Layout, 
  ChevronDown, 
  Play, 
  Check, 
  ShoppingCart,
  Plus,
  Video,
  Info,
  Beaker,
  Gift,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProfitSimulator from '../../components/ProfitSimulator';

function DetailImageCarousel({ images, alt }: { images: { imageUrl: string }[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = images.length;

  useEffect(() => {
    if (count <= 1) return;
    if (hovered) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % count);
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [count, hovered]);

  if (count === 0) {
    return (
      <div className="w-full h-full min-h-[400px] bg-slate-50 rounded-3xl flex items-center justify-center border-2 border-dashed border-slate-200">
        <Package className="w-12 h-12 text-slate-300" />
      </div>
    );
  }

  return (
    <div
      className="relative flex gap-4 h-full min-h-[500px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Vertical Thumbnails on the Left */}
      <div className="flex flex-col gap-2 w-20 overflow-y-auto scrollbar-hide">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all duration-300 flex-shrink-0 relative ${
              i === current ? 'border-[#21c55d] shadow-lg shadow-green-500/20' : 'border-transparent opacity-50 hover:opacity-100 bg-white'
            }`}
          >
            <img src={img.imageUrl} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Main image area */}
      <div className="flex-1 relative overflow-hidden rounded-[2.5rem] bg-white shadow-xl border border-slate-100 group">
        <AnimatePresence mode="wait">
          <motion.img
            key={current}
            src={images[current]?.imageUrl}
            alt={`${alt} ${current + 1}`}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>

        {/* Available Badge */}
        <div className="absolute top-6 right-6 px-4 py-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 z-10">
          <span className="text-[10px] font-black text-[#21c55d] uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#21c55d] animate-pulse" />
            Available
          </span>
        </div>

        {/* Arrows */}
        <button
          onClick={() => setCurrent(prev => (prev - 1 + count) % count)}
          className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-white/90 backdrop-blur-md shadow-2xl flex items-center justify-center text-slate-700 hover:bg-white hover:text-[#21c55d] transition-all opacity-0 group-hover:opacity-100 z-10 border border-white/20"
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => setCurrent(prev => (prev + 1) % count)}
          className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-white/90 backdrop-blur-md shadow-2xl flex items-center justify-center text-slate-700 hover:bg-white hover:text-[#21c55d] transition-all opacity-0 group-hover:opacity-100 z-10 border border-white/20"
        >
          <ChevronRight size={24} strokeWidth={2.5} />
        </button>

        {/* Counter badge */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/60 backdrop-blur-md text-white text-[10px] font-black tracking-widest px-4 py-2 rounded-2xl z-10 shadow-sm border border-white/10 uppercase">
          {current + 1} / {count}
        </div>
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tempPdfUrl, setTempPdfUrl] = useState<string | null>(null);
  const [showWholesaleBadge, setShowWholesaleBadge] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);
  const [brandingData, setBrandingData] = useState({
    brandName: '',
    quantity: 20,
    landingPageUrl: '',
    description: ''
  });

  useEffect(() => {
    if (id) {
      const savedBadge = localStorage.getItem(`wholesale_badge_${id}`);
      if (savedBadge === 'true') setShowWholesaleBadge(true);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id]);

  const fetchProduct = async (productId: string) => {
    try {
      setIsLoading(true);
      const res = await productsApi.get(productId);
      // The API returns { product: {...}, userStatus: {...} }
      const productData = res.data.data.product;
      const userStatusData = res.data.data.userStatus;
      
      setProduct({
        ...productData,
        userStatus: userStatusData
      });
    } catch (error) {
      toast.error('Error loading product');
      navigate('/marketplace');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    // 1. Login Gate
    if (!isAuthenticated) {
      toast.error('You must be logged in to continue.');
      navigate('/login');
      return;
    }

    // 2. Profile Verification Gate
    const { percentage } = getVerificationStatus(user);
    if (percentage < 100) {
      toast.error('You must complete your profile to 100% to perform this action.');
      const basePath = user?.role === 'INFLUENCER' ? '/influencer' 
                     : user?.role === 'VENDOR' ? '/dashboard'
                     : user?.role === 'GROSSELLER' ? '/grosseller'
                     : '';
      if (basePath) {
         navigate(`${basePath}/verification`);
      }
      return;
    }

    // 3. Already Bought/Pending Check
    if (product.userStatus?.isBought || product.userStatus?.isClaimed) {
      toast.success('You already own this product.');
      return;
    }

    if (product.userStatus?.isPending) {
      toast.error('You already have a pending request for this product.');
      return;
    }

    if (user?.role === 'SUPER_ADMIN' || user?.role === 'CALL_CENTER_AGENT' || user?.role === 'UNCONFIRMED') {
      toast.error('Access Denied: Your role only allows viewing.');
      return;
    }

    // Determine if we should skip the modal (ONLY regular Affiliates skip it now)
    const isAffiliateFlow = (user?.mode === 'AFFILIATE' && product.visibility?.includes('AFFILIATE'));

    if (isAffiliateFlow) {
      // Execute directly with default/empty branding info
      submitBrandingRequest({
        brandName: 'N/A',
        quantity: 1,
        landingPageUrl: '',
        description: 'Auto-claim by Affiliate/Influencer'
      });
    } else {
      // Open Branding Modal for Vendors
      setIsBrandingModalOpen(true);
    }
  };

  const submitBrandingRequest = async (overrideData?: any) => {
    // If overrideData is an event (has preventDefault), ignore it and use brandingData
    const dataToUse = (overrideData && !overrideData.preventDefault) ? overrideData : brandingData;
    
    // Determine the action type - forced to PRODUCT_CLAIM for all user types now
    let type = 'PRODUCT_CLAIM';

    try {
      setIsSubmitting(true);
      
      const payloadParams = {
        productId: Number(id),
        brandingLabelPrintUrl: tempPdfUrl,
        brandName: dataToUse.brandName,
        requestedQty: Number(dataToUse.quantity),
        requestedLandingPageUrl: dataToUse.landingPageUrl,
        description: dataToUse.description || `L'utilisateur souhaite obtenir le produit.`
      };

      // 1. Create the Affiliate Claim
      const claimRes = await influencerApi.claimProduct({
        productId: payloadParams.productId,
        brandingLabelPrintUrl: payloadParams.brandingLabelPrintUrl || undefined,
        brandName: payloadParams.brandName,
        requestedQty: payloadParams.requestedQty,
        requestedLandingPageUrl: payloadParams.requestedLandingPageUrl
      });
      const affiliateClaimId = claimRes.data.id;

      // 2. Create the Support Request
      const supportPayload = {
        subject: `[Achat Gros/Claim] ${product.nameFr}`,
        type: 'PRODUCT_CLAIM',
        description: payloadParams.description,
        productId: payloadParams.productId,
      };
      const supportRes = await supportApi.create(supportPayload);
      const supportRequestId = supportRes.data.data.id;

      // 3. Auto-Open the Conversation
      const convRes = await chatApi.autoOpenConversation({
        affiliateClaimId: Number(affiliateClaimId),
        supportRequestId: Number(supportRequestId),
        productId: payloadParams.productId,
        brandName: payloadParams.brandName,
        requestedQty: payloadParams.requestedQty,
        brandingLabelPrintUrl: payloadParams.brandingLabelPrintUrl || undefined
      });
      const convId = convRes.data.data.conversationId;

      toast.success('Demande envoyée avec succès. Ouverture du chat...');
      
      // Set wholesale badge
      setShowWholesaleBadge(true);
      localStorage.setItem(`wholesale_badge_${id}`, 'true');
      
      setIsBrandingModalOpen(false);
      // Refresh product data to show pending status
      await fetchProduct(id!);

      // Redirect directly to the generated chat
      const basePath = user?.role === 'INFLUENCER' ? '/influencer' : '/dashboard';
      navigate(`${basePath}/chat?convId=${convId}`);

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error occurred during request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBrandingUpload = async (step: 2 | 3, file: File) => {
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await uploadApi.image(formData);
      const fileUrl = uploadRes.data.data.url;
      
      if (step === 3) {
        setTempPdfUrl(fileUrl);
      }

      const updateData = step === 2 
        ? { brandingLabelMockupUrl: fileUrl }
        : { brandingLabelPrintUrl: fileUrl };
        
      // Only persist to DB if user already owns the product
      if (isBought || isClaimed) {
        await productsApi.updateBranding(id!, updateData);
      }
      
      setProduct((prev: any) => ({
        ...prev,
        userStatus: {
          ...prev.userStatus,
          ...updateData
        }
      }));
      
      toast.success(step === 2 ? 'Mockup label uploaded!' : 'Print PDF uploaded!');
    } catch (error: any) {
      toast.error('Failed to upload branding file');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWholesaleOrder = async () => {
    setShowWholesaleBadge(false);
    localStorage.removeItem(`wholesale_badge_${id}`);
    try {
      const res = await chatApi.createConversation({ 
        type: 'SUPPORT', 
        title: `Wholesale Order — ${product.nameFr}`,
        metadata: { productId: product.id }
      });
      const conv = res.data?.data?.conversation;
      const alreadyExists = res.data?.data?.alreadyExists;
      
      if (conv?.id) {
        // Only send the inquiry message if it's a NEW conversation
        if (!alreadyExists) {
          await chatApi.sendMessage(conv.id.toString(), { 
            content: `📦 Wholesale Order Inquiry:\nProduct: ${product.nameFr}\nSKU: ${product.sku}\n\nI would like to place a wholesale order for this product.` 
          });
        }
        const basePath = user?.role === 'INFLUENCER' ? '/influencer' : '/dashboard';
        navigate(`${basePath}/chat?convId=${conv.id}`);
      }
    } catch (error: any) {
      toast.error('Failed to initiate wholesale order');
    }
  };

  if (isLoading || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const isBought = product.userStatus?.isBought;
  const isClaimed = product.userStatus?.isClaimed;
  const isPurchasePending = product.userStatus?.isPurchasePending;
  const isClaimPending = product.userStatus?.isClaimPending;

  // Avoid detailed mode checks that cause desync, use the global lock state
  const isCurrentlyPending = product.userStatus?.isPending;

  const getDisplayPrice = () => {
    if (user?.role === 'INFLUENCER' && product.visibility?.includes('INFLUENCER')) {
      return product.influencerPriceMad || product.retailPriceMad;
    }
    if (user?.mode === 'AFFILIATE' && product.visibility?.includes('AFFILIATE')) {
      return product.affiliatePriceMad || product.retailPriceMad;
    }
    return product.retailPriceMad;
  };

  const displayPrice = getDisplayPrice();
  const isInfluencerClaimable = user?.role === 'INFLUENCER' && product.visibility?.includes('INFLUENCER');
  const isAffiliateClaimable = user?.mode === 'AFFILIATE' && product.visibility?.includes('AFFILIATE');
  const isVendorPurchasable = user?.mode === 'SELLER' && product.visibility?.includes('REGULAR');
  const actionText = (isInfluencerClaimable || isAffiliateClaimable) ? 'Add to My Product' : 'Buy Product';

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-['Inter'] pb-20">
      {/* Header Bar */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 shadow-sm mb-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all border border-slate-100 rounded-xl hover:bg-slate-50 shadow-sm"
          >
            <ChevronLeft size={16} /> Back to Catalog
          </button>

          <div className="flex items-center gap-3">
             <div className="relative">
               <button
                 onClick={handleWholesaleOrder}
                 disabled={!isBought && !isClaimed && !isCurrentlyPending && !showWholesaleBadge}
                 className="px-6 py-3 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <ShoppingCart size={14} /> Wholesale Order
               </button>
               {showWholesaleBadge && (
                 <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                   1
                 </span>
               )}
             </div>

             {isBought || isClaimed ? (
               <div className="px-6 py-3 bg-[#21c55d]/10 text-[#21c55d] text-[11px] font-black uppercase tracking-widest rounded-xl border border-[#21c55d]/20 flex items-center gap-2">
                 <Check size={14} strokeWidth={3} /> Product Active
               </div>
             ) : isCurrentlyPending ? (
               <div className="px-6 py-3 bg-amber-500/10 text-amber-600 text-[11px] font-black uppercase tracking-widest rounded-xl border border-amber-500/20 flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-2" /> Pending Approval
               </div>
             ) : (
               <button
                 onClick={handleAction}
                 disabled={isSubmitting || (!isAffiliateClaimable && !tempPdfUrl && !isBought && !isClaimed)}
                 className="px-8 py-3 bg-[#21c55d] text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-green-500/20 hover:bg-[#19a34a] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
               >
                 <Plus size={14} strokeWidth={3} /> {isSubmitting ? 'Processing...' : actionText}
               </button>
             )}
          </div>

          <div className="hidden lg:flex items-center gap-4 text-right">
             <div className="flex flex-col">
               <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">{product.nameEn || product.nameFr}</h2>
               <h2 className="text-lg font-black text-slate-900 font-arabic leading-none mt-1" dir="rtl">{product.nameAr}</h2>
             </div>
             {product.videoUrls?.[0] && (
               <a href={product.videoUrls[0]} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl border border-rose-100 bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all">
                 <Video size={18} />
               </a>
             )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Image Card */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-50 relative group">
               <DetailImageCarousel images={product.images || []} alt={product.nameFr} />
               
               <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-slate-50 pt-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-[0.15em] rounded-lg border border-emerald-100">
                        {product.category?.nameFr || 'General'}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Package size={12} /> SKU: {product.sku}
                      </span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 leading-[0.9] tracking-tight">{product.nameFr}</h1>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Price per unit</span>
                    <span className="text-5xl font-black text-[#21c55d] tracking-tighter leading-none">
                      {displayPrice} <span className="text-sm text-slate-400 font-black uppercase tracking-widest ml-1">MAD</span>
                    </span>
                  </div>
               </div>
            </div>

            {/* Profit Simulator Section */}
            {isAuthenticated && (user?.mode === 'AFFILIATE' || user?.role === 'INFLUENCER') && (product.visibility?.includes('AFFILIATE') || product.visibility?.includes('INFLUENCER')) && (
              <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-50 overflow-hidden relative">
                <ProfitSimulator
                  retailPrice={displayPrice}
                  productName={product.nameFr}
                  commissionMad={
                    user?.role === 'INFLUENCER' && product.visibility?.includes('INFLUENCER')
                      ? (Math.round((displayPrice || 0) * 0.15 * 100) / 100)
                      : (product.commissionMad > 0 ? product.commissionMad : Math.round((displayPrice || 0) * 0.1 * 100) / 100)
                  }
                />
              </div>
            )}
          </div>

          {/* Right Column: Steps & Accordions */}
          <div className="lg:col-span-5 space-y-4">
                     {/* Branding Section */}
            {(!isAffiliateClaimable && (isVendorPurchasable || isInfluencerClaimable || isBought || isClaimed)) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <Edit3 size={14} className="text-[#21c55d]" /> Personalization Workflow
                  </h3>
                </div>

                {/* Step 1: Canva */}
                <BrandingCard 
                  number={1}
                  titleEn="Customize label in Canva"
                  titleAr="صمم ملصق المنتج الخاص بك عبر Canva"
                  desc="Customize the product label with your own brand"
                  isActive={true}
                  isDone={!!product.userStatus?.brandingLabelMockupUrl}
                  actionLabel="Open Link"
                  variant="purple"
                  onAction={() => product.canvaLink ? window.open(product.canvaLink, '_blank') : toast.error('Canva link not available')}
                />

                {/* Step 2: Print PDF */}
                <BrandingCard 
                  number={2}
                  titleEn="Upload PDF label for printing"
                  titleAr="قم برفع ملف PDF الخاص بالملصق للطباعة"
                  desc="Submit final High-Resolution PDF for production"
                  isActive={true}
                  isDone={!!(product.userStatus?.brandingLabelPrintUrl || tempPdfUrl)}
                  actionLabel={(product.userStatus?.brandingLabelPrintUrl || tempPdfUrl) ? 'Update' : 'Upload'}
                  variant="green"
                  hasUpload
                  accept="application/pdf"
                  onUpload={(file: File) => handleBrandingUpload(3, file)}
                />

                {/* Step 3: Landing Page */}
                <BrandingCard 
                  number={3}
                  titleEn="Customize landing page on canva"
                  titleAr="تخصيص صفحة الهبوط الخاصة بك عبر Canva"
                  desc="Edit and launch your custom landing page"
                  isActive={isBought || isClaimed || user?.role === 'SUPER_ADMIN'}
                  isDone={false}
                  actionLabel="Open Link"
                  variant="bonus"
                  isBonus
                  onAction={() => product.landingPageUrls?.[0] ? window.open(product.landingPageUrls[0], '_blank') : toast.error('No landing page available')}
                />
              </div>
            )}

            {/* Accordions */}
            <div className="pt-6 space-y-4">
               <AccordionItem 
                 titleEn="Product Description" 
                 titleAr="وصف المنتج"
                 icon={<Info size={16} />} 
                 content={product.description || 'No description available.'} 
               />
               
               <AccordionItem 
                 titleEn="Details & Ingredients" 
                 titleAr="المكونات"
                 icon={<Beaker size={16} />} 
                 content={product.longDescription || 'Details about ingredients and technical specs will be listed here.'} 
               />

               <AccordionItem 
                 titleEn="Marketing Resources" 
                 titleAr="مصادر التسويق"
                 icon={<MessageSquare size={16} />} 
                 content={
                   <div className="flex flex-col gap-3">
                      <p className="text-[11px] text-slate-500">Access videos and high-quality banners for your campaigns.</p>
                      {(product.userStatus?.brandingLabelPrintUrl || product.userStatus?.brandingLabelMockupUrl) && (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const pdfUrl = product.userStatus.brandingLabelPrintUrl || product.userStatus.brandingLabelMockupUrl;
                            return (
                              <a 
                                href={pdfUrl.startsWith('http') ? pdfUrl : `${BACKEND_URL}${pdfUrl}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all border border-rose-100"
                              >
                                <Eye size={14} />
                                Voir Label PDF
                              </a>
                            );
                          })()}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {product.videoUrls?.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">
                             <Video size={14} /> Video {i+1}
                          </a>
                        ))}
                        {product.landingPageUrls?.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all">
                             <ExternalLink size={14} /> Page {i+1}
                          </a>
                        ))}
                      </div>
                   </div>
                 } 
               />
            </div>

          </div>
        </div>
       <BrandingInfoModal 
         isOpen={isBrandingModalOpen}
         onClose={() => setIsBrandingModalOpen(false)}
         data={brandingData}
         setData={setBrandingData}
         onSubmit={submitBrandingRequest}
         isSubmitting={isSubmitting}
       />
      </div>
    </div>
   );
 }

function BrandingCard({ 
  number, 
  titleEn, 
  titleAr, 
  desc, 
  isActive, 
  isDone, 
  actionLabel, 
  onAction, 
  hasUpload, 
  onUpload, 
  accept, 
  isBonus, 
  variant 
}: any) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'purple': return 'bg-[#f4f3ff] text-[#a5a1ff] border-[#f4f3ff]';
      case 'blue': return 'bg-[#f0f7ff] text-[#8ab9ff] border-[#f0f7ff]';
      case 'green': return 'bg-[#f0fff4] text-[#86efac] border-[#f0fff4]';
      case 'bonus': return 'bg-[#f0fff4] text-[#86efac] border-[#f0fff4]';
      default: return 'bg-slate-50 text-slate-400 border-slate-50';
    }
  };

  return (
    <div className={`flex items-center justify-between p-6 rounded-[1.5rem] border transition-all duration-300 relative bg-white ${
      !isActive ? 'opacity-40 grayscale pointer-events-none' : 'shadow-sm hover:shadow-md'
    } ${isBonus ? 'border-[#86efac] ring-1 ring-[#86efac]/10' : 'border-slate-50'}`}>
      
      {isBonus && (
        <div className="absolute -top-3 left-8 px-2.5 py-1 bg-[#21c55d] text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-green-500/20 z-10">
          Bonus
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all shrink-0 ${
          isDone && !isBonus ? 'bg-[#21c55d] border-[#21c55d] text-white' : getVariantStyles()
        }`}>
          {isBonus ? <Gift size={20} /> : isDone ? <Check size={20} strokeWidth={3} /> : <span className="text-sm font-black">{number}</span>}
        </div>
        <div className="flex flex-col">
          <h4 className="text-[13px] font-black text-slate-900 leading-tight font-arabic" dir="rtl">{titleAr}</h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{titleEn}</p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 ml-4">
        {hasUpload ? (
          <label className="cursor-pointer text-[10px] font-black text-slate-400 hover:text-slate-900 transition-all uppercase tracking-widest flex items-center gap-1">
            {actionLabel}
            <input 
              type="file" 
              className="hidden" 
              accept={accept} 
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} 
            />
          </label>
        ) : (
          <button 
            onClick={onAction}
            className="text-[10px] font-black text-slate-400 hover:text-slate-900 transition-all uppercase tracking-widest flex items-center gap-1 group"
          >
            {actionLabel} <ExternalLink size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </div>
  );
}

function BrandingInfoModal({ isOpen, onClose, data, setData, onSubmit, isSubmitting }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
              <Edit3 size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 leading-none uppercase tracking-tight">Finalize Your Brand</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Information pour la production</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Brand Name / Nom de Marque</label>
              <input 
                type="text" 
                value={data.brandName}
                onChange={(e) => setData({ ...data, brandName: e.target.value })}
                placeholder="Ex: My Silk Brand"
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Quantity / Quantité (Min 20)</label>
              <input 
                type="number" 
                min="20"
                value={data.quantity}
                onChange={(e) => setData({ ...data, quantity: Number(e.target.value) })}
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Landing Page URL (Optionnel)</label>
              <input 
                type="url" 
                value={data.landingPageUrl}
                onChange={(e) => setData({ ...data, landingPageUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Description / Spécifications</label>
              <textarea 
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                placeholder="Any special instructions for the support team..."
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all min-h-[100px] resize-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button 
              onClick={onClose}
              className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSubmit()}
              disabled={isSubmitting || !data.brandName || data.quantity < 20}
              className="flex-[2] py-4 bg-primary-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary-500/20 hover:bg-primary-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
            >
              {isSubmitting ? 'Submitting...' : 'Confirm & Request'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AccordionItem({ titleEn, titleAr, icon, content }: any) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-white rounded-[1.5rem] border border-slate-50 overflow-hidden transition-all hover:bg-slate-50/20">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 group"
      >
        <div className="text-slate-300 transition-colors group-hover:text-slate-900">
          <ChevronDown size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        <div className="flex items-center gap-4 text-right" dir="rtl">
           <h3 className="text-sm font-black text-slate-800 font-arabic">
            {titleAr}
          </h3>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="px-6 pb-6 text-[13px] text-slate-500 leading-relaxed font-arabic text-right border-t border-slate-50/50 pt-4 mx-6" dir="rtl">
               {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
