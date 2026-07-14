import { useState, useEffect } from 'react';
import { Activity, Plus, Trash2, CheckCircle2, XCircle, Target, ChevronDown, Globe, Music, Ghost, Facebook } from 'lucide-react';
import { userPixelApi, influencerApi, productsApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface UserPixel {
  id: number;
  name: string;
  type: 'GLOBAL' | 'SINGLE';
  pixelId: string;
  platform: 'META' | 'GOOGLE' | 'TIKTOK' | 'SNAPCHAT';
  conversionEvent: string;
  targetIds: string[];
}

interface UserPixelsProps {
  platform?: 'META' | 'GOOGLE' | 'TIKTOK' | 'SNAPCHAT';
}

const PLATFORM_DETAILS = {
  META: {
    title: 'Meta Pixels',
    description: 'Gérez vos pixels Facebook pour suivre les conversions sur vos pages',
    icon: Facebook,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    btnClass: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 focus:ring-blue-600/20',
    accentColor: 'blue',
    label: 'Pixel ID (Meta)',
    placeholder: 'Ex: 123456789012345',
  },
  GOOGLE: {
    title: 'Google Pixels',
    description: 'Gérez vos tags Google Analytics et Google Ads pour suivre les conversions',
    icon: Globe,
    colorClass: 'text-red-500',
    bgClass: 'bg-red-50',
    btnClass: 'bg-red-500 hover:bg-red-600 shadow-red-500/20 focus:ring-red-500/20',
    accentColor: 'red',
    label: 'Tag ID / Measurement ID (Google)',
    placeholder: 'Ex: G-XXXXXXXXXX ou AW-XXXXXXXXXX',
  },
  TIKTOK: {
    title: 'TikTok Pixels',
    description: 'Gérez vos pixels TikTok pour suivre les conversions sur vos pages',
    icon: Music,
    colorClass: 'text-cyan-600',
    bgClass: 'bg-cyan-50',
    btnClass: 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-600/20 focus:ring-cyan-600/20',
    accentColor: 'cyan',
    label: 'Pixel Code ID (TikTok)',
    placeholder: 'Ex: CXXXXXXXXXXXXXXXXXXX',
  },
  SNAPCHAT: {
    title: 'Snapchat Pixels',
    description: 'Gérez vos pixels Snapchat pour suivre les conversions sur vos pages',
    icon: Ghost,
    colorClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
    btnClass: 'bg-yellow-500 hover:bg-yellow-600 text-black shadow-yellow-500/20 focus:ring-yellow-500/20',
    accentColor: 'yellow',
    label: 'Pixel ID (Snapchat)',
    placeholder: 'Ex: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  },
};

export default function UserPixels({ platform = 'META' }: UserPixelsProps) {
  const { user } = useAuth();
  const [pixels, setPixels] = useState<UserPixel[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'GLOBAL' | 'SINGLE'>('GLOBAL');
  const [pixelId, setPixelId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [conversionEvent, setConversionEvent] = useState<'Lead' | 'Purchase'>('Lead');

  const details = PLATFORM_DETAILS[platform] || PLATFORM_DETAILS.META;
  const PlatformIcon = details.icon;

  useEffect(() => {
    fetchData();
  }, [platform]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pixelsRes, linksRes, productsRes] = await Promise.all([
        userPixelApi.list(platform),
        influencerApi.getLinks().catch(() => ({ data: [] })),
        productsApi.list({ myProducts: 'true' }).catch(() => ({ data: { data: { products: [] } } }))
      ]);
      setPixels(pixelsRes.data.data || []);
      setLinks(linksRes.data || []);
      setProducts(productsRes.data?.data?.products || []);
    } catch (err: any) {
      toast.error('Erreur lors du chargement des pixels');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name || !pixelId) {
      return toast.error('Veuillez remplir tous les champs obligatoires');
    }
    if (type === 'SINGLE' && !targetId) {
      return toast.error('Veuillez sélectionner une page');
    }

    try {
      setIsSubmitting(true);
      await userPixelApi.create({
        name,
        type,
        pixelId,
        platform,
        conversionEvent,
        targetIds: type === 'SINGLE' ? [targetId] : []
      });
      toast.success('Pixel ajouté avec succès');
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'ajout du pixel');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce pixel ?')) return;
    try {
      await userPixelApi.delete(id);
      toast.success('Pixel supprimé');
      fetchData();
    } catch (err: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setName('');
    setType('GLOBAL');
    setPixelId('');
    setTargetId('');
    setConversionEvent('Lead');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <PlatformIcon className={`w-8 h-8 ${details.colorClass}`} />
            {details.title}
          </h1>
          <p className="text-gray-500 font-medium mt-1 text-sm">
            {details.description}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className={`flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold transition-all shadow-lg ${details.btnClass}`}
        >
          <Plus className="w-5 h-5" />
          Ajouter un Pixel
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className={`w-10 h-10 border-4 border-t-transparent rounded-full animate-spin ${details.colorClass}`} style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}></div>
        </div>
      ) : pixels.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${details.bgClass} ${details.colorClass}`}>
            <Target className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">Aucun Pixel Actif</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Commencez à tracker vos visites et conversions en ajoutant votre premier Pixel {details.title.split(' ')[0]}.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors ${details.bgClass} ${details.colorClass} hover:opacity-80`}
          >
            <Plus className="w-5 h-5" />
            Ajouter mon premier Pixel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pixels.map(pixel => (
            <div key={pixel.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative group overflow-hidden">
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110 ${details.bgClass}`}></div>
              
              <div className="relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${details.bgClass} ${details.colorClass}`}>
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{pixel.name}</h3>
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                        <span>ID: {pixel.pixelId}</span>
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(pixel.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-xs font-bold text-gray-500 uppercase">Application</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                      pixel.type === 'GLOBAL' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {pixel.type === 'GLOBAL' ? 'Global' : 'Single Page'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-xs font-bold text-gray-500 uppercase">Événement</span>
                    <span className="text-xs font-bold text-gray-900 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm">
                      {pixel.conversionEvent}
                    </span>
                  </div>

                  {pixel.type === 'SINGLE' && (
                    <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5 p-1">
                      <Target className="w-3.5 h-3.5" />
                      Cible: {pixel.targetIds?.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Pixel Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-900">Nouveau Pixel</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Nom de l'intégration</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Mon Pixel Principal"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:border-blue-600 transition-all font-medium"
                    style={{ '--tw-ring-color': `rgba(59, 130, 246, 0.2)` } as any}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{details.label}</label>
                  <input
                    type="text"
                    value={pixelId}
                    onChange={(e) => setPixelId(e.target.value)}
                    placeholder={details.placeholder}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:border-blue-600 transition-all font-medium"
                    style={{ '--tw-ring-color': `rgba(59, 130, 246, 0.2)` } as any}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Mode d'application</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setType('GLOBAL')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        type === 'GLOBAL' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="font-bold text-gray-900 mb-1">Global</div>
                      <div className="text-xs text-gray-500 font-medium">Toutes vos pages</div>
                    </button>
                    <button
                      onClick={() => setType('SINGLE')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        type === 'SINGLE' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="font-bold text-gray-900 mb-1">Single Page</div>
                      <div className="text-xs text-gray-500 font-medium">Page spécifique</div>
                    </button>
                  </div>
                </div>

                {type === 'SINGLE' && (
                  <div className="animate-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Sélectionnez la page</label>
                    <div className="relative">
                      <select
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none focus:bg-white focus:ring-2 focus:border-blue-600 transition-all font-medium"
                        style={{ '--tw-ring-color': `rgba(59, 130, 246, 0.2)` } as any}
                      >
                        <option value="">Choisir la cible...</option>
                        {links.length > 0 && (
                          <optgroup label={user?.role === 'INFLUENCER' ? "Liens de Parrainage" : "Liens de Parrainage (Affilié)"}>
                            {links.map(link => (
                              <option key={`link-${link.id}`} value={link.code}>
                                {link.product?.nameFr || 'Produit'} (Code: {link.code})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {products.length > 0 && user?.role !== 'INFLUENCER' && (
                          <optgroup label="Mes Produits (Vendeur)">
                            {products.map(product => (
                              <option key={`prod-${product.id}`} value={product.id.toString()}>
                                {product.nameFr || product.nameEn || 'Produit'} (SKU: {product.sku})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <ChevronDown className="absolute right-4 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Événement de conversion</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setConversionEvent('Lead')}
                      className={`p-3 rounded-xl border-2 transition-all font-bold ${
                        conversionEvent === 'Lead' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Lead (Prospect)
                    </button>
                    <button
                      onClick={() => setConversionEvent('Purchase')}
                      className={`p-3 rounded-xl border-2 transition-all font-bold ${
                        conversionEvent === 'Purchase' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Purchase (Achat)
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={isSubmitting || !name || !pixelId || (type === 'SINGLE' && !targetId)}
                  className={`w-full py-4 text-white rounded-xl font-black text-lg transition-colors disabled:opacity-50 shadow-lg ${details.btnClass}`}
                >
                  {isSubmitting ? 'Enregistrement...' : 'Sauvegarder le Pixel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
