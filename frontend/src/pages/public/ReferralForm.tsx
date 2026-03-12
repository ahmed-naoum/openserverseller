import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ShieldCheck, Truck, Clock, CheckCircle2, UserCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReferralForm() {
  const { code } = useParams<{ code: string }>();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    city: '',
    address: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (code) {
      fetchData();
    }
  }, [code]);

  const fetchData = async () => {
    try {
      const res = await publicApi.getReferralLinkData(code!);
      setData(res.data);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.city) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    try {
      setIsSubmitting(true);
      await publicApi.submitReferralLead({
        referralCode: code!,
        ...form
      });
      setIsSuccess(true);
      toast.success('Votre demande a été enregistrée avec succès !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-influencer-600 mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">Chargement de l'offre...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Offre indisponible</h2>
          <p className="text-gray-500 mb-8">Ce lien de parrainage est invalide ou l'offre a expiré.</p>
        </div>
      </div>
    );
  }

  const { product, influencerName, influencerAvatar } = data;

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col items-center py-12 px-4 selection:bg-influencer-100 selection:text-influencer-900">
      
      {/* Influencer Header (Trust Badge) */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8 flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-sm border border-gray-200/50"
      >
        {influencerAvatar ? (
          <img src={influencerAvatar} alt={influencerName} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <UserCircle2 className="w-8 h-8 text-gray-400" />
        )}
        <div className="text-sm">
          <span className="text-gray-500">Recommandé par</span>
          <strong className="block text-gray-900">{influencerName || 'Un partenaire'}</strong>
        </div>
      </motion.div>

      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        
        {/* Product Details Columns */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-6 lg:space-y-8"
        >
          <div className="bg-white rounded-[2rem] p-4 shadow-xl shadow-gray-200/40 border border-gray-100">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-gray-50 mb-6 relative">
              {product.images?.[0]?.imageUrl ? (
                <img 
                  src={product.images[0].imageUrl} 
                  alt={product.nameFr} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                  <Package className="w-16 h-16" />
                </div>
              )}
            </div>
            
            <div className="px-2 pb-2">
              <div className="inline-block px-3 py-1 bg-influencer-50 text-influencer-700 font-bold text-xs rounded-lg mb-3">
                {product.category?.nameFr}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight mb-2">
                {product.nameFr}
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                {product.description}
              </p>
              
              <div className="flex items-end gap-2 mb-6">
                <div className="text-4xl font-black text-influencer-600 leading-none">
                  {product.retailPriceMad}
                </div>
                <div className="text-lg font-bold text-influencer-600/60 pb-1">MAD</div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-xs font-bold text-gray-700">
                  <Truck className="w-4 h-4 text-influencer-500" />
                  Livraison partout au Maroc
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-xs font-bold text-gray-700">
                  <ShieldCheck className="w-4 h-4 text-influencer-500" />
                  Paiement à la livraison
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Lead Capture Form Column */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-gray-200/50 border border-gray-100 sticky top-8">
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">Félicitations !</h3>
                  <p className="text-gray-500 text-lg mb-8 max-w-xs mx-auto">
                    Votre demande a été bien reçue. Un agent va vous contacter très prochainement pour confirmer la commande.
                  </p>
                  <button 
                    onClick={() => {
                      setIsSuccess(false);
                      setForm({ fullName: '', phone: '', city: '', address: '' });
                    }}
                    className="text-influencer-600 font-bold hover:underline"
                  >
                    Passer une autre commande
                  </button>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-8">
                    <h2 className="text-2xl font-black text-gray-900">Commander Maintenant</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Remplissez le formulaire ci-dessous pour réserver votre produit. Le paiement se fera à la livraison.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Nom complet *</label>
                      <input
                        type="text"
                        required
                        value={form.fullName}
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-influencer-500/20 focus:border-influencer-500 transition-all font-medium"
                        placeholder="Ex: Youssef Benjelloun"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Numéro de téléphone *</label>
                      <input
                        type="tel"
                        required
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-influencer-500/20 focus:border-influencer-500 transition-all font-medium"
                        placeholder="06 XX XX XX XX"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Ville *</label>
                      <input
                        type="text"
                        required
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-influencer-500/20 focus:border-influencer-500 transition-all font-medium"
                        placeholder="Ex: Casablanca"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Adresse <span className="text-gray-400 font-normal">(Optionnel)</span></label>
                      <textarea
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-influencer-500/20 focus:border-influencer-500 transition-all font-medium resize-none"
                        placeholder="Votre adresse complète pour faciliter la livraison"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-influencer-600 to-influencer-500 text-white font-black text-lg p-4 rounded-xl shadow-lg shadow-influencer-500/20 hover:shadow-xl hover:shadow-influencer-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 mt-6"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Traitement...
                        </span>
                      ) : (
                        'Confirmer ma commande'
                      )}
                    </button>
                    
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-400 mt-4">
                      <ShieldCheck className="w-4 h-4" />
                      Vos informations sont sécurisées
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
