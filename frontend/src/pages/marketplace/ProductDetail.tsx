import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { productsApi, fulfillmentApi, chatApi, influencerApi } from '../../lib/api';
import { getVerificationStatus } from '../common/ProfileVerification';
import toast from 'react-hot-toast';
import { Package, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
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
      <svg className="w-24 h-24 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }

  if (count === 1) {
    return <img src={images[0].imageUrl} alt={alt} className="w-full h-full object-cover" />;
  }

  return (
    <div
      className="relative w-full h-full flex flex-col bento-card p-2 border-none shadow-sm bg-white"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main image area */}
      <div className="relative flex-1 min-h-0 overflow-hidden rounded-[2rem] bg-slate-50">
        {images.map((img, i) => (
          <img
            key={i}
            src={img.imageUrl}
            alt={`${alt} ${i + 1}`}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === current ? 1 : 0 }}
          />
        ))}

        {/* Arrows */}
        <button
          onClick={() => setCurrent(prev => (prev - 1 + count) % count)}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md shadow-xl flex items-center justify-center text-slate-700 hover:bg-white hover:text-primary-600 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 z-10 border border-white/20"
          style={{ opacity: hovered ? 1 : 0, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <ChevronLeft size={20} strokeWidth={3} />
        </button>
        <button
          onClick={() => setCurrent(prev => (prev + 1) % count)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md shadow-xl flex items-center justify-center text-slate-700 hover:bg-white hover:text-primary-600 hover:scale-110 transition-all z-10 border border-white/20"
          style={{ opacity: hovered ? 1 : 0, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <ChevronRight size={20} strokeWidth={3} />
        </button>

        {/* Counter badge */}
        <span className="absolute top-4 right-4 bg-slate-900/60 backdrop-blur-md text-white text-[10px] font-black tracking-widest px-3 py-1.5 rounded-xl z-10 shadow-sm border border-white/10 uppercase">
          {current + 1} / {count}
        </span>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 p-2 mt-2 justify-center overflow-x-auto scrollbar-hide">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all duration-300 flex-shrink-0 relative ${
              i === current ? 'border-primary-500 shadow-lg shadow-primary-500/20 scale-105' : 'border-transparent opacity-50 hover:opacity-100 hover:scale-95 bg-slate-100'
            }`}
          >
            <img src={img.imageUrl} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover absolute inset-0" />
          </button>
        ))}
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
      toast.error('Erreur lors du chargement du produit');
      navigate('/marketplace');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    // 1. Login Gate
    if (!isAuthenticated) {
      toast.error('Vous devez être connecté pour continuer.');
      navigate('/login');
      return;
    }

    // 2. Profile Verification Gate
    const { percentage } = getVerificationStatus(user);
    if (percentage < 100) {
      toast.error('Vous devez compléter votre profil à 100% pour effectuer cette action.');
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
      toast.success('Vous possédez déjà ce produit.');
      return;
    }

    if (product.userStatus?.isPending) {
      toast.error('Vous avez déjà une demande en cours pour ce produit.');
      return;
    }

    // 3. Permission Check (Role Verification)
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'CALL_CENTER_AGENT' || user?.role === 'UNCONFIRMED') {
      toast.error('Accès refusé: Votre rôle permet uniquement la consultation.');
      return;
    }

    // Determine the action type based on user mode and product visibility
    let type = 'DELIVERY_FULFILLMENT'; // Default: Purchase
    
    if (user?.role === 'INFLUENCER' && product.visibility?.includes('INFLUENCER')) {
      type = 'PRODUCT_CLAIM';
    } else if (user?.mode === 'AFFILIATE' && product.visibility?.includes('AFFILIATE')) {
      type = 'PRODUCT_CLAIM';
    } else if (user?.mode === 'SELLER' && product.visibility?.includes('REGULAR')) {
      type = 'DELIVERY_FULFILLMENT';
    } else {
      if (product.visibility?.includes('AFFILIATE') && !product.visibility?.includes('REGULAR')) {
        toast.error('Vous devez passer en mode Affilié pour réclamer ce produit.');
        return;
      }
      if (product.visibility?.includes('INFLUENCER') && !product.visibility?.includes('REGULAR')) {
        toast.error('Ce produit est réservé exclusivement aux influenceurs.');
        return;
      }
      toast.error("Ce produit n'est pas disponible pour votre rôle actuel.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      if (type === 'PRODUCT_CLAIM') {
        await influencerApi.claimProduct(Number(id));
      } else {
        await fulfillmentApi.createRequest({
          type,
          subject: `Demande de livraison pour ${product.nameFr}`,
          description: `L'utilisateur souhaite acheter le produit.`,
          productId: Number(id)
        });
      }
      
      toast.success(type === 'PRODUCT_CLAIM' ? 'Produit réclamé avec succès. En attente d\'approbation.' : 'Demande d\'achat envoyée. En attente de traitement.');
      // Refresh product data to show pending status
      fetchProduct(id!);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la demande.');
    } finally {
      setIsSubmitting(false);
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
  const actionText = (isInfluencerClaimable || isAffiliateClaimable) ? 'Réclamer le produit' : 'Acheter le produit';

  // Public login gate: if not authenticated, show limited info
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-[#F9FAFB] pt-8 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-1000 ease-out">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <Link to="/marketplace" className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-primary-600 hover:bg-primary-50 transition-all mb-8 hover:-translate-x-1">
            <ChevronLeft size={16} /> Catalogue Public
          </Link>

          <div className="flex flex-col lg:flex-row gap-8">
             <div className="w-full lg:w-1/2 min-h-[400px]">
               <DetailImageCarousel images={product.images || []} alt={product.nameFr} />
             </div>
             
             <div className="w-full lg:w-1/2 flex flex-col justify-center relative bento-card border-none bg-white p-10 shadow-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm w-fit mb-4">
                  {product.category?.nameFr || 'Sans Catégorie'}
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{product.nameFr}</h2>
                  <h2 className="text-3xl font-black text-slate-900 font-arabic leading-none" dir="rtl">{product.nameAr}</h2>
                </div>
                
                {/* Blurred preview */}
                <div className="mt-8 relative flex-1 flex flex-col">
                  <div className="blur-sm select-none pointer-events-none flex-1">
                    <p className="text-slate-500 leading-relaxed font-medium">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore...</p>
                    <div className="mt-8 border-t border-slate-100 pt-8">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valeur Marché</span>
                        <span className="text-3xl font-black text-slate-900 tracking-tight">*** MAD</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Login overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 shadow-2xl">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-lg shadow-primary-500/30">
                       <Package className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-slate-800 font-black text-xl mb-2 text-center tracking-tight">Accès Réservé</p>
                    <p className="text-sm font-medium text-slate-500 text-center mb-8 px-8">Connectez-vous à votre espace personnel pour découvrir les prix grossistes et les commissions.</p>
                    <Link 
                      to="/login"
                      className="btn-premium px-8 py-4 text-xs font-black tracking-widest uppercase bg-[#2c2f74] text-white rounded-full shadow-xl shadow-indigo-500/20"
                    >
                      Se connecter / S'inscrire
                    </Link>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F9FAFB] pt-8 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-1000 ease-out">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <Link to="/dashboard/marketplace" className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-primary-600 hover:bg-primary-50 transition-all mb-8 hover:-translate-x-1">
          <ChevronLeft size={16} /> Retour au Catalogue
        </Link>

        <div className="flex flex-col lg:flex-row gap-8">
           <div className="w-full lg:w-1/2 min-h-[400px]">
             <DetailImageCarousel images={product.images || []} alt={product.nameFr} />
           </div>
           
           <div className="w-full lg:w-1/2 flex flex-col gap-6">
              {/* Info Bento */}
              <div className="bento-card border-none bg-white p-8 shadow-md">
                <div className="flex flex-col gap-1 mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm w-fit mb-2">
                    {product.category?.nameFr || 'Sans Catégorie'}
                  </div>
                  <div className="flex items-start justify-between">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{product.nameFr}</h2>
                    <h2 className="text-3xl font-black text-slate-900 font-arabic leading-none" dir="rtl">{product.nameAr}</h2>
                  </div>
                  <div className="flex items-center gap-2 mt-2 opacity-60">
                    <Package size={14} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU: {product.sku}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {product.visibility?.map((vis: string) => (
                    <span key={vis} className={`px-3 py-1 text-[9px] rounded-lg font-black uppercase tracking-widest shadow-sm ${vis === 'AFFILIATE' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : vis === 'INFLUENCER' ? 'bg-pink-50 text-pink-600 border border-pink-100' : 'bg-slate-50 text-slate-600 border border-slate-100'}`}>
                      {vis}
                    </span>
                  ))}
                  {isBought && <span className="px-3 py-1 text-[9px] rounded-lg font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">En stock (Acheté)</span>}
                  {isClaimed && <span className="px-3 py-1 text-[9px] rounded-lg font-black uppercase tracking-widest bg-purple-50 text-purple-600 border border-purple-100 shadow-sm">Partenariat Actif</span>}
                  {isCurrentlyPending && <span className="px-3 py-1 text-[9px] rounded-lg font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100 shadow-sm animate-pulse">Examen en cours</span>}
                </div>
                
                <p className="text-sm font-medium leading-relaxed text-slate-500 bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                  {product.description || 'Aucune description détaillée n\'est disponible pour ce produit pour le moment.'}
                </p>
                
                {(product.videoUrls?.length > 0 || product.landingPageUrls?.length > 0) && (
                  <div className="mt-8 border-t border-slate-50 pt-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <MessageSquare size={14} /> Ressources Marketing
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {product.videoUrls?.map((url: string, idx: number) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-500 hover:text-white transition-all text-xs font-black uppercase tracking-widest shadow-sm border border-red-100 hover:scale-105">
                          Vidéo {idx + 1}
                        </a>
                      ))}
                      {product.landingPageUrls?.map((url: string, idx: number) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-500 hover:text-white transition-all text-xs font-black uppercase tracking-widest shadow-sm border border-indigo-100 hover:scale-105">
                          Landing Page {idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing Bento */}
              <div className="bento-card border-none bg-white p-8 shadow-md">
                 <div className="flex flex-col md:flex-row gap-6 items-center w-full">
                   
                   {/* Market Value / Affiliate Price Block */}
                   <div className="flex-1 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 w-full">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                       {user?.role === 'INFLUENCER' && product.visibility?.includes('INFLUENCER')
                         ? 'Coût B2B (Influencer)'
                         : user?.mode === 'AFFILIATE' && product.visibility?.includes('AFFILIATE')
                           ? 'Coût B2B (Affilié)'
                           : 'Valeur Marché'}
                     </span>
                     <span className="text-3xl font-black text-slate-900 tracking-tight leading-none block">
                       {displayPrice} <span className="text-sm text-slate-400 uppercase font-black tracking-widest">MAD</span>
                     </span>
                   </div>

                   {/* Commision / Reward Block */}
                   {(product.visibility?.includes('AFFILIATE') || product.visibility?.includes('INFLUENCER')) && (
                     <>
                       <div className="hidden md:block w-px h-16 bg-slate-100"></div>
                       {product.visibility?.includes('AFFILIATE') && (!isAuthenticated || user?.mode === 'AFFILIATE' || user?.role === 'SUPER_ADMIN') && (
                         <div className="flex-1 bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-[2rem] border border-indigo-100/50 w-full shadow-inner">
                           <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1.5 mb-2">
                             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                             </svg>
                             Impact (Com.)
                           </span>
                           <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight leading-none block">
                             {product.commissionMad > 0 ? product.commissionMad : Math.round(((product.affiliatePriceMad || product.retailPriceMad) || 0) * 0.1 * 100) / 100} <span className="text-sm text-indigo-400 uppercase font-black tracking-widest">MAD</span>
                           </span>
                         </div>
                       )}
                     </>
                   )}
                 </div>

                 {/* Action Buttons */}
                 <div className="mt-8">
                   {(isBought || isClaimed) ? (
                     <div className="flex flex-col sm:flex-row gap-4">
                       <Link 
                         to="../inventory"
                         className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] py-4 px-6 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-1"
                       >
                         <Package className="w-4 h-4" />
                         {isClaimed ? 'Gérer ce partenariat' : 'Voir dans mon inventaire'}
                       </Link>
                       <button
                         onClick={async () => {
                           try {
                             const res = await chatApi.createConversation({ type: 'SUPPORT', title: `Branding — ${product.nameFr}` });
                             const convId = res.data?.data?.conversation?.id;
                             if (convId) {
                               await chatApi.sendMessage(convId.toString(), { content: `💬 Demande de branding:\n📦 ${product.nameFr}\n🔖 SKU: ${product.sku}\n\nJ'aimerais des informations sur la marque en marque blanche.` });
                               const basePath = user?.role === 'INFLUENCER' ? '/influencer' : user?.role === 'VENDOR' ? '/dashboard' : '';
                               navigate(`${basePath}/chat`);
                             }
                           } catch (error: any) { toast.error('Erreur chat'); }
                         }}
                         className="flex-shrink-0 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[10px] py-4 px-6 rounded-2xl shadow-xl shadow-amber-500/20 transition-all hover:-translate-y-1"
                       >
                         <MessageSquare className="w-4 h-4" /> Branding
                       </button>
                     </div>
                   ) : isCurrentlyPending ? (
                     <button disabled className="w-full btn-premium bg-amber-500 text-white font-black uppercase tracking-widest text-[10px] py-4 px-6 rounded-2xl opacity-70 cursor-not-allowed">
                       Examen en cours
                     </button>
                   ) : (
                     <button 
                       onClick={handleAction}
                       disabled={isSubmitting}
                       className="w-full btn-premium bg-[#2c2f74] hover:bg-[#1a1c4b] text-white font-black uppercase tracking-widest text-xs py-5 px-6 rounded-[1.5rem] shadow-2xl shadow-indigo-900/20 transition-all disabled:opacity-50 hover:-translate-y-1 transform"
                     >
                       {isSubmitting ? 'Traitement...' : actionText}
                     </button>
                    )}
                   
                    {(user?.role === 'CALL_CENTER_AGENT' || user?.role === 'UNCONFIRMED' || 
                      (!isVendorPurchasable && !isInfluencerClaimable && !isAffiliateClaimable)) && !isBought && !isCurrentlyPending && (
                       <p className="text-[10px] font-black uppercase tracking-widest text-center text-red-500 mt-4 flex items-center justify-center gap-1.5 opacity-80 bg-red-50 py-3 rounded-xl">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        {product.visibility?.includes('AFFILIATE') && user?.mode !== 'AFFILIATE' && !product.visibility?.includes('REGULAR')
                           ? 'Basculez en Profil Affilié pour intégrer' 
                           : product.visibility?.includes('INFLUENCER') && user?.role !== 'INFLUENCER' && !product.visibility?.includes('REGULAR')
                             ? 'Catalogue Influenceurs Exclusive'
                             : 'Action non autorisée sur ce profil'}
                       </p>
                    )}
                 </div>
              </div>
           </div>
        </div>

        {/* Profit Simulator — only for AFFILIATE or INFLUENCER products when authenticated AND the user is actually an Affiliate or Influencer */}
        {isAuthenticated && (user?.mode === 'AFFILIATE' || user?.role === 'INFLUENCER') && (product.visibility?.includes('AFFILIATE') || product.visibility?.includes('INFLUENCER')) && (
          <div className="mt-6">
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
    </div>
  );
}
