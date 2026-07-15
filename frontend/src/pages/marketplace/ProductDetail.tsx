import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { productsApi, chatApi, influencerApi, uploadApi, BACKEND_URL } from '../../lib/api';
import { getVerificationStatus } from '../common/ProfileVerification';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { 
  Package, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  Edit3, 
  Upload, 
  Check, 
  ShoppingCart,
  Plus,
  Info,
  ArrowRight,
  Download,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
      <div className="w-full h-full min-h-[400px] bg-slate-50 rounded-3xl flex items-center justify-center">
        <Package className="w-12 h-12 text-slate-300" />
      </div>
    );
  }

  return (
    <div
      className="relative flex gap-4 h-full w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 relative aspect-square overflow-hidden rounded-3xl group bg-white border border-slate-50">
        <AnimatePresence mode="wait">
          <motion.img
            key={current}
            src={images[current]?.imageUrl}
            alt={`${alt} ${current + 1}`}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 w-full h-full object-contain p-2"
          />
        </AnimatePresence>

        {count > 1 && (
          <>
            <button
              onClick={() => setCurrent(prev => (prev - 1 + count) % count)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-slate-700 hover:text-[#21c55d] transition-all opacity-0 group-hover:opacity-100 z-10"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setCurrent(prev => (prev + 1) % count)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-slate-700 hover:text-[#21c55d] transition-all opacity-0 group-hover:opacity-100 z-10"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {images.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-slate-800 w-3' : 'bg-slate-300'}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { t, language } = useLanguage();
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const textAlign = language === 'ar' ? 'text-right' : 'text-left';
  const flexAlign = language === 'ar' ? 'items-end justify-end' : 'items-start justify-start';
  const { user, isAuthenticated, platformSettings } = useAuth();
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
    if (!isAuthenticated) {
      toast.error('You must be logged in to continue.');
      navigate('/login');
      return;
    }
    const { percentage } = getVerificationStatus(user, platformSettings);
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

    const isAffiliateFlow = (user?.mode === 'AFFILIATE' && product.visibility?.includes('AFFILIATE'));

    if (isAffiliateFlow) {
      submitBrandingRequest({
        brandName: 'N/A',
        quantity: 999,
        landingPageUrl: '',
        description: 'Auto-claim by Affiliate'
      });
    } else {
      setIsBrandingModalOpen(true);
    }
  };

  const submitBrandingRequest = async (overrideData?: any) => {
    const dataToUse = (overrideData && !overrideData.preventDefault) ? overrideData : brandingData;
    
    try {
      if (dataToUse.landingPageUrl && /^(javascript|data|vbscript):/i.test(dataToUse.landingPageUrl.trim())) {
        toast.error('URL non valide. Les protocoles javascript: ou data: sont interdits.');
        return;
      }

      setIsSubmitting(true);
      const payloadParams = {
        productId: Number(id),
        brandingLabelPrintUrl: tempPdfUrl,
        brandName: dataToUse.brandName,
        requestedQty: Number(dataToUse.quantity),
        requestedLandingPageUrl: dataToUse.landingPageUrl ? dataToUse.landingPageUrl.trim() : '',
        description: dataToUse.description || `L'utilisateur souhaite obtenir le produit.`
      };

      const claimRes = await influencerApi.claimProduct({
        productId: payloadParams.productId,
        brandingLabelPrintUrl: payloadParams.brandingLabelPrintUrl || undefined,
        brandName: payloadParams.brandName,
        requestedQty: payloadParams.requestedQty,
        requestedLandingPageUrl: payloadParams.requestedLandingPageUrl,
        userMode: user?.mode || 'AFFILIATE'
      });
      const affiliateClaimId = claimRes.data.id;

      const convRes = await chatApi.autoOpenConversation({
        affiliateClaimId: Number(affiliateClaimId),
        productId: payloadParams.productId,
        brandName: payloadParams.brandName,
        requestedQty: payloadParams.requestedQty,
        brandingLabelPrintUrl: payloadParams.brandingLabelPrintUrl || undefined,
        requestedLandingPageUrl: payloadParams.requestedLandingPageUrl || undefined,
        subject: `[Achat Gros/Claim] ${product.nameFr}`,
        type: 'PRODUCT_CLAIM',
        description: payloadParams.description,
      });
      const convId = convRes.data.data.conversationId;

      toast.success('Demande envoyée بنجاح. Ouverture du chat...');
      
      setShowWholesaleBadge(true);
      localStorage.setItem(`wholesale_badge_${id}`, 'true');
      setIsBrandingModalOpen(false);
      await fetchProduct(id!);

      const basePath = user?.role === 'INFLUENCER' ? '/influencer' : '/dashboard';
      navigate(`${basePath}/chat?convId=${convId}`);

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error occurred during request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBrandingUpload = async (step: 2 | 3, file: File) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(language === 'ar' ? 'صيغة غير مدعومة. يرجى استخدام PDF, PNG أو JPG.' : 'Format non supporté. Veuillez utiliser PDF, PNG ou JPG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الملف يجب أن لا يتجاوز 5 ميجابايت.' : 'La taille du fichier ne doit pas dépasser 5 Mo.');
      return;
    }

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const isBought = product.userStatus?.isBought;
  const isClaimed = product.userStatus?.isClaimed;
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
  
  const showBrandingFlow = ((!isAffiliateClaimable && (isVendorPurchasable || isInfluencerClaimable || isBought || isClaimed)) || user?.role === 'SUPER_ADMIN' || user?.role === 'HELPER');

  const extractFilename = (url?: string | null) => {
    if (!url) return '';
    const parts = url.split('/');
    let filename = parts[parts.length - 1];
    try { filename = decodeURIComponent(filename); } catch(e) {}
    if (/^\d{13,}-/.test(filename)) {
      filename = filename.replace(/^\d{13,}-/, '');
    }
    return filename;
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] pb-20" dir={direction}>
      <div className="max-w-7xl mx-auto px-6 pt-10">
        
        {/* Top Header - Back Button */}
        <div className="flex items-center mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            {language === 'ar' ? (
              <>
                <ChevronRight size={18} /> العودة إلى المنتجات
              </>
            ) : (
              <>
                <ChevronLeft size={18} /> {t('pd_back', 'marketplace')}
              </>
            )}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-6 relative">
          
          {/* Right Column: Sticky Product Card */}
          <div className="w-full lg:w-4/12 lg:sticky lg:top-24 space-y-4 shrink-0">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
              
              {/* Product Info Header */}
              <div className="w-full flex items-start justify-between mb-4">
                <div className={textAlign}>
                  <p className="text-[10px] font-bold text-slate-500 mb-1">
                    {product.category && (
                      language === 'ar' ? product.category.nameAr || product.category.nameFr :
                      language === 'en' ? product.category.nameEn || product.category.nameFr :
                      product.category.nameFr
                    )}
                  </p>
                  <h1 className="text-2xl font-black text-slate-900 leading-none font-arabic">
                    {language === 'ar' ? product.nameAr :
                     language === 'en' ? product.nameEn || product.nameFr :
                     product.nameFr || product.nameAr}
                  </h1>
                </div>
                <div className="flex flex-col gap-1 shrink-0 items-start">
                  <span className="px-3 py-1 bg-[#21c55d] text-white text-[9px] font-black rounded-full flex items-center gap-1.5 shadow-sm shadow-green-500/20">
                    {t('pd_available', 'marketplace')} <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                  <span className="px-3 py-1 bg-[#21c55d] text-white text-[9px] font-black rounded-full shadow-sm shadow-green-500/20">
                    {language === 'ar' ? '30 كبسولة' : '30 Capsules'}
                  </span>
                </div>
              </div>

              {/* Main Image */}
              <div className="w-full flex items-center justify-center my-4">
                 <div className="w-full aspect-square max-w-[320px]">
                   <DetailImageCarousel images={product.images || []} alt={language === 'ar' ? product.nameAr : product.nameFr} />
                 </div>
              </div>

              {/* Footer Row */}
              <div className="w-full flex items-end justify-between mt-4">
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-100 w-fit">
                    <Package size={12} className="text-slate-400" /> SKU: {product.sku}
                  </span>
                </div>
                
                <div className={textAlign}>
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{t('pd_price', 'marketplace')}</span>
                  <div className="flex items-baseline gap-1 text-slate-800 justify-start">
                    <span className="text-[28px] leading-none font-black text-[#232863]">{displayPrice}</span>
                    <span className="text-sm font-bold text-[#232863]">{t('pd_currency', 'marketplace')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {user?.role !== 'HELPER' && (
              <div className="grid grid-cols-2 gap-3" dir={direction}>
                <button
                  onClick={handleAction}
                  disabled={isSubmitting || isCurrentlyPending || isBought || isClaimed || (!isAffiliateClaimable && !tempPdfUrl)}
                  className="w-full py-3.5 bg-[#FF6B4A] hover:bg-[#ff5733] text-white text-[12px] font-black rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCurrentlyPending ? t('pending_approval', 'marketplace') : 
                   (isBought || isClaimed) ? (language === 'ar' ? 'تمت الإضافة' : language === 'en' ? 'Added' : 'Ajouté') : 
                   t('pd_add_to_products', 'marketplace')}
                  {!isCurrentlyPending && !(isBought || isClaimed) && <Plus size={16} />}
                </button>

                <button
                  onClick={handleWholesaleOrder}
                  disabled={!isBought && !isClaimed && !isCurrentlyPending && !showWholesaleBadge}
                  className="w-full py-3.5 bg-[#232863] hover:bg-[#1a1f2c] text-white text-[12px] font-black rounded-xl shadow-lg shadow-slate-800/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 relative"
                >
                  {t('pd_order_wholesale', 'marketplace')} <MessageSquare size={16} />
                  {showWholesaleBadge && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                      1
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Left Column: Content */}
          <div className="w-full lg:w-8/12 space-y-6">
             {showBrandingFlow && (
               <div className="space-y-4">
                 <BrandingCard 
                   stepNumberAr={t('pd_step1_label', 'marketplace')}
                   titleAr={t('pd_step1_title', 'marketplace')}
                   desc={t('pd_step1_desc', 'marketplace')}
                   bullets={[
                     t('pd_step1_b1', 'marketplace'),
                     t('pd_step1_b2', 'marketplace'),
                     t('pd_step1_b3', 'marketplace'),
                     t('pd_step1_b4', 'marketplace')
                   ]}
                   actionLabel={t('pd_step1_action', 'marketplace')}
                   isActive={!isCurrentlyPending}
                   onAction={() => product.canvaLink ? window.open(product.canvaLink, '_blank') : toast.error('Canva link not available')}
                 />

                 <BrandingCard 
                   stepNumberAr={t('pd_step2_label', 'marketplace')}
                   titleAr={t('pd_step2_title', 'marketplace')}
                   desc={t('pd_step2_desc', 'marketplace')}
                   bullets={[
                     t('pd_step2_b1', 'marketplace'),
                     t('pd_step2_b2', 'marketplace'),
                     t('pd_step2_b3', 'marketplace'),
                     t('pd_step2_b4', 'marketplace')
                   ]}
                   actionLabel={t('pd_step2_action', 'marketplace')}
                   isActive={!isCurrentlyPending}
                   hasUpload
                   accept="application/pdf,image/png,image/jpeg,image/jpg"
                   onUpload={(file: File) => handleBrandingUpload(3, file)}
                   isSubmitting={isSubmitting}
                   isUploaded={!!tempPdfUrl || !!product.userStatus?.brandingLabelPrintUrl}
                   uploadedFileName={extractFilename(tempPdfUrl || product.userStatus?.brandingLabelPrintUrl)}
                 />

                 <BrandingCard 
                   stepNumberAr={t('pd_bonus_label', 'marketplace')}
                   isBonus
                   titleAr={t('pd_bonus_title', 'marketplace')}
                   desc={t('pd_bonus_desc', 'marketplace')}
                   bullets={[
                     t('pd_bonus_b1', 'marketplace'),
                     t('pd_bonus_b2', 'marketplace'),
                     t('pd_bonus_b3', 'marketplace'),
                     t('pd_bonus_b4', 'marketplace')
                   ]}
                   actionLabel={t('pd_bonus_action', 'marketplace')}
                   isActive={isBought || isClaimed || user?.role === 'SUPER_ADMIN'}
                   onAction={() => product.landingPageUrls?.[0] ? window.open(product.landingPageUrls[0], '_blank') : toast.error('No landing page available')}
                 />
               </div>
             )}

             <ProductTabs product={product} />
          </div>

        </div>
       <BrandingInfoModal 
         isOpen={isBrandingModalOpen}
         onClose={() => setIsBrandingModalOpen(false)}
         data={brandingData}
         setData={setBrandingData}
         onSubmit={submitBrandingRequest}
         isSubmitting={isSubmitting}
         showLandingPage={user?.role !== 'INFLUENCER'}
       />
      </div>
    </div>
   );
 }

function BrandingCard({ titleAr, desc, isActive, actionLabel, onAction, hasUpload, onUpload, accept, isBonus, stepNumberAr, bullets, isSubmitting, isUploaded, uploadedFileName }: any) {
  const { language } = useLanguage();
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const textAlign = language === 'ar' ? 'text-right' : 'text-left';
  return (
    <div className={`p-6 rounded-3xl bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border ${!isActive ? 'opacity-50 grayscale' : 'shadow-sm border-slate-100 hover:shadow-md transition-all'}`}>
      
      {/* Right Side Content */}
      <div className={`flex flex-col items-start ${textAlign} flex-1`} dir={direction}>
        <div className="flex items-center gap-3 mb-3 w-full">
          <span className={`px-3 py-1 rounded-lg text-[10px] font-black text-slate-900 ${isBonus ? 'bg-amber-400' : 'bg-[#232863] text-white'}`}>
            {stepNumberAr}
          </span>
          <h4 className="text-base font-black text-slate-900 font-arabic">{titleAr}</h4>
        </div>
        
        <p className="text-xs text-slate-600 font-medium font-arabic max-w-xl leading-relaxed">{desc}</p>
        
        {bullets && (
          <ul className={`mt-3 space-y-1.5 ${language === 'ar' ? 'pr-4' : 'pl-4'} flex flex-col items-start w-full`}>
            {bullets.map((b: string, i: number) => (
              <li key={i} className="text-[11px] font-bold text-slate-800 font-arabic list-disc list-inside marker:text-slate-400">{b}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Left Side Action */}
      <div className="shrink-0 self-center">
        {hasUpload ? (
          <label className={`px-5 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-widest flex items-center gap-2 bg-white ${
            !isActive || isSubmitting ? 'opacity-50 pointer-events-none cursor-not-allowed border-[#FF6B4A] text-[#FF6B4A]' : 
            isUploaded ? 'border-emerald-500 text-emerald-600 hover:bg-emerald-50 cursor-pointer shadow-sm' : 
            'border-[#FF6B4A] text-[#FF6B4A] cursor-pointer hover:bg-orange-50 transition-colors'
          }`}>
            {isSubmitting ? (
              <><div className="w-3.5 h-3.5 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin" /> {language === 'ar' ? 'جاري الرفع...' : language === 'en' ? 'Uploading...' : 'Téléchargement...'}</>
            ) : isUploaded ? (
              <><Check size={14} className="text-emerald-500" /> <span className="max-w-[150px] truncate">{uploadedFileName || (language === 'ar' ? 'الملف جاهز' : language === 'en' ? 'File Ready' : 'Fichier Prêt')}</span></>
            ) : (
              <><Upload size={14} /> {actionLabel}</>
            )}
            <input type="file" className="hidden" accept={accept} disabled={!isActive || isSubmitting} onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
        ) : (
          <button onClick={onAction} disabled={!isActive} className="px-5 py-2.5 rounded-xl border border-[#FF6B4A] text-[#FF6B4A] text-[11px] font-black uppercase tracking-widest hover:bg-orange-50 transition-colors flex items-center gap-2 bg-white disabled:opacity-50 disabled:pointer-events-none">
             {actionLabel} <ExternalLink size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function ProductTabs({ product }: { product: any }) {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('desc');

  const tabs = [
    { id: 'desc', label: t('pd_tab_description', 'marketplace') },
    { id: 'ingredients', label: t('pd_tab_ingredients', 'marketplace') },
  ];

  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const textAlign = language === 'ar' ? 'text-right' : 'text-left';

  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 mt-6">
      {/* Tab Headers */}
      <div className="flex items-center gap-8 border-b border-slate-100 pb-4 mb-8">
        {tabs.map(t => (
          <button 
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`text-base font-black font-arabic pb-3 relative transition-colors ${activeTab === t.id ? 'text-[#232863]' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {t.label}
            {activeTab === t.id && (
              <motion.div layoutId="activeTab" className="absolute -bottom-4 left-0 right-0 h-1 bg-[#232863] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'desc' && (
          <div className="space-y-6">
            <DescRow 
              title={t('pd_desc_intro', 'marketplace')} 
              content={`${language === 'ar' ? 'اسم المنتج' : language === 'en' ? 'Product Name' : 'Nom du produit'}: ${language === 'ar' ? product.nameAr : language === 'en' ? product.nameEn || product.nameFr : product.nameFr}\n${language === 'ar' ? 'الوصف' : 'Description'}: ${product.description || ''}`} 
            />
            <DescRow 
              title={t('pd_desc_benefits', 'marketplace')} 
              content={language === 'ar' ? "غني بالفيتامينات والمعادن التي تعزز الصحة العامة. يساعد في تحسين مستويات الطاقة والأداء البدني. يحتوي على مضادات الأكسدة التي تدعم جهاز المناعة." : language === 'en' ? "Rich in vitamins and minerals that boost overall health. Helps improve energy levels and physical performance. Contains antioxidants that support the immune system." : "Riche en vitamines et minéraux qui renforcent la santé globale. Aide à améliorer les niveaux d'énergie et les performances physiques. Contient des antioxydants qui soutiennent le système immunitaire."} 
            />
            <DescRow 
              title={t('pd_desc_target', 'marketplace')} 
              content={language === 'ar' ? "الأشخاص الذين يحتاجون إلى تعزيز صحتهم العامة. الأفراد الذين يبحثون عن مكمل طبيعي غني بالعناصر الغذائية. أولئك الذين يرغبون في تحسين مستويات الطاقة والمناعة." : language === 'en' ? "People who need to boost their overall health. Individuals looking for a natural supplement rich in nutrients. Those wishing to improve energy and immunity levels." : "Les personnes qui ont besoin de renforcer leur santé globale. Les personnes à la recherche d'un complément naturel riche en nutriments. Ceux qui souhaitent améliorer leur niveau d'énergie et leur immunité."} 
            />
            <DescRow 
              title={t('pd_desc_ingredients', 'marketplace')} 
              content={product.longDescription || (language === 'ar' ? "مسحوق أوراق المورينجا\nمستخلص الكركم\nمستخلص الفلفل الأسود" : language === 'en' ? "Moringa Leaf Powder\nTurmeric Extract\nBlack Pepper Extract" : "Poudre de feuilles de moringa\nExtrait de curcuma\nExtrait de poivre noir")} 
            />
            <DescRow 
              title={t('pd_desc_usage', 'marketplace')} 
              content={language === 'ar' ? "تناول من كبسولة إلى كبسولتين في اليوم. يمكن خلطه مع الماء أو إضافته إلى العصائر." : language === 'en' ? "Take 1 to 2 capsules daily. Can be mixed with water or added to juices." : "Prendre 1 à 2 capsules par jour. Peut être mélangé avec de l'eau ou ajouté aux jus."} 
            />
            <DescRow 
              title={t('pd_desc_warnings', 'marketplace')} 
              content={language === 'ar' ? "لا ينصح به أثناء الحمل (خطر التأثير على تقلصات الرحم) وفي حالة انخفاض ضغط الدم." : language === 'en' ? "Not recommended during pregnancy (risk of uterine contraction) and in case of low blood pressure." : "Déconseillé pendant la grossesse (risque de contraction utérine) et en cas d'hypotension artérielle."} 
              isWarning 
            />
          </div>
        )}



        {activeTab === 'ingredients' && (
          <div className={`${textAlign} text-sm text-slate-600 font-medium font-arabic leading-relaxed bg-slate-50 p-6 rounded-2xl`}>
            {product.longDescription && typeof product.longDescription === 'string' && /<[a-z][\s\S]*>/i.test(product.longDescription) ? (
              <div dangerouslySetInnerHTML={{ __html: product.longDescription }} />
            ) : (
              product.longDescription || (language === 'ar' ? 'مكمل غذائي متطور يهدف إلى تعزيز الصحة العامة بفضل احتوائه على مستخلص أوراق المورينجا بتركيز فعال. تعرف المورينجا بخصائصها الغنية بالمغذيات الطبيعية والفيتامينات والمعادن، مما يساعد على تحسين مستويات الطاقة، دعم الجهاز المناعي، وتعزيز صحة البشرة والشعر. مع الاستخدام المنتظم، يمنح الجسم التوازن الغذائي والشعور بالحيوية. يدعم الصحة العامة ويعزز مستويات الطاقة يعزز صحة الجهاز المناعي ويحارب الإجهاد التأكسدي يساعد في تحسين نسيج البشرة وإشراقتها' : language === 'en' ? 'An advanced supplement designed to promote overall health with an effective concentration of Moringa leaf extract. Moringa is known for its rich profile of natural nutrients, vitamins, and minerals, helping to boost energy levels, support the immune system, and promote healthy skin and hair. With regular use, it gives the body nutritional balance and a feeling of vitality.' : 'Un complément alimentaire avancé visant à améliorer la santé globale grâce à sa concentration efficace en extrait de feuilles de moringa. Le moringa est reconnu pour ses propriétés riches en nutriments naturels, vitamines et minéraux, contribuant à optimiser les niveaux d\'énergie, soutenir le système immunitaire et favoriser l\'éclat de la peau et des cheveux.')
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DescRow({ title, content, isWarning }: any) {
  const { language } = useLanguage();
  const textAlign = language === 'ar' ? 'text-right' : 'text-left';
  const hasHtml = typeof content === 'string' && /<[a-z][\s\S]*>/i.test(content);

  return (
    <div className={`flex flex-col md:flex-row items-start gap-4 border-b border-slate-50 pb-6 last:border-0 last:pb-0 ${textAlign}`}>
       <div className="md:w-1/4 font-black text-slate-900 text-sm font-arabic mt-1 shrink-0">{title}</div>
       <div className={`md:w-3/4 flex items-start justify-start gap-3 w-full`}>
         {!isWarning ? <Check size={16} className="text-slate-400 shrink-0 mt-0.5" /> : <Info size={16} className="text-red-500 shrink-0 mt-0.5" />}
         {hasHtml ? (
           <div 
             className="text-xs font-medium leading-relaxed font-arabic text-slate-600 w-full"
             dangerouslySetInnerHTML={{ __html: content }}
           />
         ) : (
           <div className={`text-xs font-medium leading-relaxed font-arabic whitespace-pre-line ${isWarning ? 'text-red-500' : 'text-slate-600'}`}>
             {content}
           </div>
         )}
       </div>
    </div>
  );
}

function MarketingRow({ title, desc, bullets, btnLabel, badge, onBtnClick }: any) {
  const { language } = useLanguage();
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const textAlign = language === 'ar' ? 'text-right' : 'text-left';
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-50 pb-6 last:border-0 last:pb-0 bg-white">
      <div className={`flex-1 ${textAlign}`} dir={direction}>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-black text-slate-900 font-arabic">{title}</h4>
          {badge && <span className="px-2 py-0.5 bg-amber-400 text-slate-900 text-[9px] font-black rounded-lg">{badge}</span>}
        </div>
        <p className="text-xs text-slate-600 font-medium font-arabic leading-relaxed max-w-xl">{desc}</p>
        {bullets && (
          <ul className={`mt-3 ${language === 'ar' ? 'pr-4' : 'pl-4'} space-y-1`}>
            {bullets.map((b: any, i: number) => (
              <li key={i} className="text-[11px] font-bold text-slate-800 font-arabic list-disc list-inside marker:text-slate-400">{b}</li>
            ))}
          </ul>
        )}
      </div>
      {btnLabel && (
        <button onClick={onBtnClick} className="px-5 py-2.5 bg-[#FF6B4A] text-white hover:bg-orange-600 rounded-xl text-[11px] font-black transition-colors flex items-center gap-2 shrink-0">
           {btnLabel} <ExternalLink size={14} />
        </button>
      )}
    </div>
  );
}

function BrandingInfoModal({ isOpen, onClose, data, setData, onSubmit, isSubmitting, showLandingPage = true }: any) {
  const { t, language } = useLanguage();
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const textAlign = language === 'ar' ? 'text-right' : 'text-left';

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir={direction}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#FF6B4A]/5 rounded-full -ml-16 -mt-16" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-[#FF6B4A]">
              <Edit3 size={20} />
            </div>
            <div className={textAlign}>
              <h3 className="text-xl font-black text-slate-900 leading-none uppercase tracking-tight">{t('pd_modal_title', 'marketplace')}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('pd_modal_subtitle', 'marketplace')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className={textAlign}>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t('pd_modal_brand_name', 'marketplace')}</label>
              <input 
                type="text" 
                value={data.brandName}
                onChange={(e) => setData({ ...data, brandName: e.target.value })}
                placeholder={t('pd_modal_brand_placeholder', 'marketplace')}
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#FF6B4A] transition-all"
              />
            </div>
            <div className={textAlign}>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t('pd_modal_quantity', 'marketplace')}</label>
              <input 
                type="number" 
                min="20"
                value={data.quantity}
                onChange={(e) => setData({ ...data, quantity: Number(e.target.value) })}
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#FF6B4A] transition-all"
              />
            </div>
            {showLandingPage && (
              <div className={textAlign}>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t('pd_modal_landing_url', 'marketplace')}</label>
                <input 
                  type="url" 
                  value={data.landingPageUrl}
                  onChange={(e) => setData({ ...data, landingPageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#FF6B4A] transition-all text-left"
                  dir="ltr"
                />
              </div>
            )}
            <div className={textAlign}>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t('pd_modal_description', 'marketplace')}</label>
              <textarea 
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                placeholder={t('pd_modal_desc_placeholder', 'marketplace')}
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#FF6B4A] transition-all min-h-[100px] resize-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button 
              onClick={onClose}
              className="flex-1 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all bg-slate-50 rounded-2xl"
            >
              {t('pd_modal_cancel', 'marketplace')}
            </button>
            <button 
              onClick={() => onSubmit()}
              disabled={isSubmitting || !data.brandName || data.quantity < 20}
              className="flex-[2] py-4 bg-[#FF6B4A] text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-500/20 hover:bg-orange-600 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
            >
              {isSubmitting ? t('pd_modal_submitting', 'marketplace') : t('pd_modal_confirm', 'marketplace')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
