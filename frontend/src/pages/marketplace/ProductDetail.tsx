import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { productsApi, fulfillmentApi } from '../../lib/api';
import toast from 'react-hot-toast';

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
      setProduct(res.data.data.product);
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

    // 2. Permission Check (Role Verification)
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
      navigate('/dashboard'); // or /grosseller depending on user role, handle later
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
                <div className="uppercase tracking-wide text-sm text-primary-600 font-semibold">{product.category?.nameFr || 'Sans Catégorie'}</div>
                <h2 className="block mt-1 text-2xl leading-tight font-bold text-gray-900">{product.nameFr}</h2>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${product.visibility === 'AFFILIATE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {product.visibility}
                  </span>
                </div>
                <p className="mt-4 text-gray-500">{product.description || 'Aucune description disponible.'}</p>
                
                <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-6">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-gray-600">Prix unitaire</span>
                     <span className="text-2xl font-bold text-gray-900">{product.retailPriceMad} MAD</span>
                   </div>
                   <button 
                     onClick={handleAction}
                     disabled={isSubmitting}
                     className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
                   >
                     {isSubmitting ? 'Traitement...' : product.visibility === 'AFFILIATE' ? 'Réclamer le produit' : 'Acheter le produit'}
                   </button>
                    {(!isAuthenticated || user?.role === 'CALL_CENTER_AGENT' || user?.role === 'UNCONFIRMED' || (product.visibility === 'AFFILIATE' && user?.mode !== 'AFFILIATE')) && (
                      <p className="text-sm text-center text-red-500 mt-2 flex items-center justify-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                        {product.visibility === 'AFFILIATE' && user?.mode !== 'AFFILIATE' ? 'Passez en mode Affilié pour réclamer' : 'Action restreinte (View-Only ou Non connecté)'}
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
