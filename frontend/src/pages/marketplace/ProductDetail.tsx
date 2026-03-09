import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { productsApi, fulfillmentApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { Package } from 'lucide-react';

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
                 {product.images?.[0] ? (
                   <img src={product.images[0].imageUrl} alt={product.nameFr} className="w-full h-full object-cover" />
                 ) : (
                   <svg className="w-24 h-24 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                   </svg>
                 )}
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
               {product.images?.[0] ? (
                 <img src={product.images[0].imageUrl} alt={product.nameFr} className="w-full h-full object-cover" />
               ) : (
                 <svg className="w-24 h-24 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                 </svg>
               )}
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
