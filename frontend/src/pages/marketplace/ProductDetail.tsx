import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { productsApi, fulfillmentApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';

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
      className="relative w-full h-full flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main image area */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {images.map((img, i) => (
          <img
            key={i}
            src={img.imageUrl}
            alt={`${alt} ${i + 1}`}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: i === current ? 1 : 0 }}
          />
        ))}

        {/* Arrows */}
        <button
          onClick={() => setCurrent(prev => (prev - 1 + count) % count)}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:scale-110 transition-all opacity-0 hover:opacity-100 z-10"
          style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.2s' }}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => setCurrent(prev => (prev + 1) % count)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:scale-110 transition-all z-10"
          style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.2s' }}
        >
          <ChevronRight size={18} />
        </button>

        {/* Counter badge */}
        <span className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
          {current + 1}/{count}
        </span>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-1.5 p-2 bg-gray-50 justify-center">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
              i === current ? 'border-primary-500 shadow-md scale-105' : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <img src={img.imageUrl} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
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

    // 2. Already Bought/Pending Check
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

    const type = product.visibility === 'AFFILIATE' ? 'PRODUCT_CLAIM' : 'DELIVERY_FULFILLMENT';

    if (type === 'PRODUCT_CLAIM' && user?.mode !== 'AFFILIATE') {
      toast.error('Vous devez passer en mode Affilié pour réclamer ce produit.');
      return;
    }

    try {
      setIsSubmitting(true);
      await fulfillmentApi.createRequest({
        type,
        subject: `Demande de ${type === 'PRODUCT_CLAIM' ? 'réclamation' : 'livraison'} pour ${product.nameFr}`,
        description: `L'utilisateur souhaite ${type === 'PRODUCT_CLAIM' ? 'réclamer' : 'acheter'} le produit.`,
        productId: Number(id)
      });
      toast.success(type === 'PRODUCT_CLAIM' ? 'Produit réclamé avec succès. En attente d\'attribution.' : 'Demande d\'achat envoyée. En attente de traitement.');
      // Refresh product data to show pending status
      fetchProduct(id!);
    } catch (error) {
      toast.error('Erreur lors de la demande.');
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
  const isPending = product.userStatus?.isPending;

  // Public login gate: if not authenticated, show limited info
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="md:flex">
               <div className="md:w-1/2 bg-gray-100 flex items-center justify-center min-h-[300px]">
                 <DetailImageCarousel images={product.images || []} alt={product.nameFr} />
               </div>
               
               <div className="p-8 md:w-1/2 flex flex-col justify-center relative">
                  <div className="uppercase tracking-wide text-sm text-primary-600 font-semibold">{product.category?.nameFr || 'Sans Catégorie'}</div>
                  <div className="flex items-center justify-between mt-1">
                    <h2 className="text-2xl font-bold text-gray-900">{product.nameFr}</h2>
                    <h2 className="text-2xl font-bold text-gray-900 font-arabic" dir="rtl">{product.nameAr}</h2>
                  </div>
                  
                  {/* Blurred preview */}
                  <div className="mt-4 relative">
                    <div className="blur-sm select-none pointer-events-none">
                      <p className="text-gray-500">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore...</p>
                      <div className="mt-6 border-t border-gray-100 pt-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">Prix unitaire</span>
                          <span className="text-2xl font-bold text-gray-900">*** MAD</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Login overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px] rounded-xl">
                      <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                      <p className="text-gray-600 font-semibold mb-4 text-center">Connectez-vous pour voir tous les détails</p>
                      <Link 
                        to="/login"
                        className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
                      >
                        Se connecter
                      </Link>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="md:flex">
             <div className="md:w-1/2 bg-gray-100 flex items-center justify-center min-h-[300px]">
               <DetailImageCarousel images={product.images || []} alt={product.nameFr} />
             </div>
             
             <div className="p-8 md:w-1/2 flex flex-col justify-center">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">{product.nameFr}</h2>
                    <h2 className="text-2xl font-bold text-gray-900 font-arabic" dir="rtl">{product.nameAr}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">SKU: {product.sku}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <div className="uppercase tracking-wide text-sm text-primary-600 font-semibold">{product.category?.nameFr || 'Sans Catégorie'}</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${product.visibility === 'AFFILIATE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {product.visibility}
                  </span>
                  {isBought && <span className="px-2 py-1 text-xs rounded-full font-bold bg-green-100 text-green-700">Déjà acheté</span>}
                  {isClaimed && <span className="px-2 py-1 text-xs rounded-full font-bold bg-purple-100 text-purple-700">Déjà claimé</span>}
                  {isPending && <span className="px-2 py-1 text-xs rounded-full font-bold bg-amber-100 text-amber-700">En attente d'approbation</span>}
                </div>
                <p className="mt-4 text-gray-500">{product.description || 'Aucune description disponible.'}</p>
                
                {(product.videoUrls?.length > 0 || product.landingPageUrls?.length > 0) && (
                  <div className="mt-6 border-t border-gray-100 pt-6">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Ressources Marketing</h3>
                    <div className="flex flex-wrap gap-3">
                      {product.videoUrls?.map((url: string, idx: number) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium border border-red-100">
                          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                          Vidéo {idx + 1}
                        </a>
                      ))}
                      {product.landingPageUrls?.map((url: string, idx: number) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-100">
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
                          Page de Vente {idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-6">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-gray-600">Prix unitaire</span>
                     <span className="text-2xl font-bold text-gray-900">{product.retailPriceMad} MAD</span>
                   </div>

                   {(isBought || isClaimed) ? (
                     <Link 
                       to="../inventory"
                       className="w-full bg-green-600 hover:bg-green-700 text-white text-center font-bold py-4 px-4 rounded-xl shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2"
                     >
                       <Package className="w-5 h-5" />
                       {isClaimed ? 'Voir mes Produits Réclamés' : 'Voir sur mon Inventaire'}
                     </Link>
                   ) : isPending ? (
                     <button 
                       disabled
                       className="w-full bg-amber-500 text-white font-bold py-4 px-4 rounded-xl cursor-not-allowed opacity-80"
                     >
                       En attente d'approbation
                     </button>
                   ) : (
                     <button 
                       onClick={handleAction}
                       disabled={isSubmitting}
                       className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-primary-200 transition-all disabled:opacity-50"
                     >
                       {isSubmitting ? 'Traitement...' : product.visibility === 'AFFILIATE' ? 'Réclamer le produit' : 'Acheter le produit'}
                     </button>
                   )}
                   
                    {(user?.role === 'CALL_CENTER_AGENT' || user?.role === 'UNCONFIRMED' || (product.visibility === 'AFFILIATE' && user?.mode !== 'AFFILIATE')) && !isBought && !isPending && (
                      <p className="text-sm text-center text-red-500 mt-2 flex items-center justify-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                        {product.visibility === 'AFFILIATE' && user?.mode !== 'AFFILIATE' ? 'Passez en mode Affilié pour réclamer' : 'Action restreinte (View-Only)'}
                      </p>
                    )}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
