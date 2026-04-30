import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ShieldCheck, Truck, Clock, CheckCircle2, UserCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BlockRenderer from '../../components/helper/sitebuilder/BlockRenderer';

export default function ReferralForm() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
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
  const [selectedOption, setSelectedOption] = useState<any>(null);

  useEffect(() => {
    if (code) {
      fetchData();
    }
  }, [code]);

  const findCheckoutBlock = (structure: any) => {
    if (!structure || !structure.blocks) return null;
    return structure.blocks.find((b: any) => b.type === 'express_checkout');
  };

  useEffect(() => {
    if (data?.landingPage?.customStructure) {
      const checkoutBlock = findCheckoutBlock(data.landingPage.customStructure);
      if (checkoutBlock?.content?.options?.length > 0 && !selectedOption) {
        setSelectedOption(checkoutBlock.content.options[0]);
      }
    }
  }, [data]); // Removed selectedOption from deps to prevent unnecessary resets if already set

  const fetchData = async () => {
    try {
      const res = await publicApi.getReferralLinkData(code!);
      // Handle standardized response wrapper
      const responseData = res.data.status === 'success' ? res.data.data : res.data;
      setData(responseData);
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
        ...form,
        productVariant: selectedOption?.name
      });
      navigate('/thank-you', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 mb-4"
          style={{ borderTopColor: data?.landingPage?.themeColor || '#f97316' }}
        ></div>
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

  const { product, influencerName, influencerAvatar, landingPage } = data;

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Produit introuvable</h2>
          <p className="text-gray-500 mb-8">Les informations du produit n'ont pas pu être chargées.</p>
        </div>
      </div>
    );
  }

  const renderCheckoutForm = (blockContent: any = {}) => (
    <div 
      className="bg-white p-6 sm:p-7 relative"
      style={{
        border: `${blockContent.borderWidth ?? 1}px solid ${blockContent.borderColor ?? '#f3f4f6'}`,
        borderRadius: `${blockContent.borderRadiusTL ?? 32}px ${blockContent.borderRadiusTR ?? 32}px ${blockContent.borderRadiusBR ?? 32}px ${blockContent.borderRadiusBL ?? 32}px`
      }}
    >
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
              className="font-bold hover:underline"
              style={{ color: blockContent.themeColor || landingPage?.themeColor || '#f97316' }}
            >
              Passer une autre commande
            </button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-black text-gray-900 mb-1">
                {blockContent.title || 'Commander Maintenant'}
              </h2>
              {blockContent.showPrice !== false && (
                <div 
                  className="font-black mb-2"
                  style={{ 
                    color: blockContent.priceColor || '#f64444', 
                    fontSize: `${blockContent.priceSize || 30}px` 
                  }}
                >
                  {selectedOption?.price || product?.retailPriceMad} <span className="text-lg uppercase ml-1 opacity-60">MAD</span>
                </div>
              )}
              <p className="text-sm text-gray-500 font-medium">
                {blockContent.subtitle || 'Remplissez le formulaire ci-dessous pour réserver votre produit. Le paiement se fera à la livraison.'}
              </p>
            </div>

            {blockContent.options && blockContent.options.length > 0 && (
              <div className="mb-8 space-y-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">Sélectionnez votre offre</label>
                <div className="grid grid-cols-1 gap-0">
                  {blockContent.options.map((opt: any, i: number) => {
                    const isSelected = selectedOption?.id === opt.id || (!selectedOption && i === 0);
                    const accentColor = blockContent.packColor || '#f97316';
                    
                    return (
                      <div 
                        key={opt.id || i} 
                        onClick={() => setSelectedOption(opt)}
                        className={`py-4 px-3 transition-all cursor-pointer flex justify-between items-center group relative outline-none ${
                          isSelected ? '' : 'border-b border-gray-100'
                        }`}
                        style={isSelected ? { 
                          borderColor: accentColor, 
                          borderWidth: `${blockContent.packBorderWidth ?? 2}px`,
                          borderRadius: `${blockContent.packBorderRadius ?? 16}px`,
                          backgroundColor: `${accentColor}08`
                        } : {}}
                      >
                        {isSelected && (
                           <div 
                            className="absolute -top-1 -right-2 py-0.5 px-2 text-[7px] font-black text-white uppercase tracking-tighter rounded-full shadow-sm"
                            style={{ backgroundColor: accentColor }}
                           >
                            Sélectionné
                           </div>
                        )}
                        <div>
                          <div 
                            className="font-black text-lg transition-colors"
                            style={{ color: isSelected ? accentColor : '#111827' }}
                          >
                            {opt.name || `Pack ${i + 1}`}
                          </div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 whitespace-nowrap">Meilleure Valeur</div>
                        </div>
                        <div 
                          className="text-2xl font-black transition-colors"
                          style={{ color: isSelected ? accentColor : '#111827' }}
                        >
                          {opt.price} <span className="text-[11px] opacity-60 uppercase ml-1">MAD</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.nameLabel || 'Nom complet *'}</label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium"
                  style={{ 
                    '--tw-ring-color': `${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`,
                    '--tw-focus-border-color': blockContent.themeColor || landingPage?.themeColor || '#f97316'
                  } as any}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder={blockContent.namePlaceholder || "Ex: Youssef Benjelloun"}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.phoneLabel || 'Numéro de téléphone *'}</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder={blockContent.phonePlaceholder || "06 XX XX XX XX"}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.cityLabel || 'Ville *'}</label>
                <input
                  type="text"
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder={blockContent.cityPlaceholder || "Ex: Casablanca"}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.addressLabel || 'Adresse (Optionnel)'}</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium resize-none"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder={blockContent.addressPlaceholder || "Votre adresse complète pour faciliter la livraison"}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full text-white font-black text-lg p-4 rounded-xl shadow-lg transition-all disabled:opacity-50 mt-6"
                style={{ backgroundColor: blockContent.themeColor || landingPage?.themeColor || '#f97316' }}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Traitement...
                  </span>
                ) : (
                  blockContent.buttonText || landingPage?.buttonText || 'Confirmer ma commande'
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
  );

  const structure = landingPage?.customStructure;
  const blocks = Array.isArray(structure) ? structure : (structure?.blocks || []);
  const pageSettings = Array.isArray(structure) ? { backgroundColor: '#f9fafb' } : (structure?.settings || { backgroundColor: '#f9fafb' });

  if (blocks.length > 0) {
    return (
      <div 
        className="w-full min-h-screen font-sans pb-20 transition-colors duration-300"
        style={{ backgroundColor: pageSettings.backgroundColor }}
      >
        
        <BlockRenderer blocks={blocks} renderCheckout={renderCheckoutForm} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col items-center py-12 px-4">
      
      {/* Influencer Header (Trust Badge) */}

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
            <div 
              className="inline-block px-3 py-1 font-bold text-xs rounded-lg mb-3"
              style={{ 
                backgroundColor: `${landingPage?.themeColor || '#f97316'}15`,
                color: landingPage?.themeColor || '#f97316'
              }}
            >
              {product.category?.nameFr}
            </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight mb-2">
                {landingPage?.title || product.nameFr}
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                {landingPage?.description || product.description}
              </p>
              
              <div className="flex items-end gap-2 mb-6">
                <div 
                  className="text-4xl font-black leading-none"
                  style={{ color: landingPage?.themeColor || '#f97316' }}
                >
                  {product.retailPriceMad}
                </div>
                <div 
                  className="text-lg font-bold pb-1"
                  style={{ color: `${landingPage?.themeColor || '#f97316'}99` }}
                >
                  MAD
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-xs font-bold text-gray-700">
                  <Truck className="w-4 h-4" style={{ color: landingPage?.themeColor || '#f97316' }} />
                  Livraison partout au Maroc
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-xs font-bold text-gray-700">
                  <ShieldCheck className="w-4 h-4" style={{ color: landingPage?.themeColor || '#f97316' }} />
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
          className="sticky top-8"
        >
          {renderCheckoutForm()}
        </motion.div>
      </div>
    </div>
  );
}
