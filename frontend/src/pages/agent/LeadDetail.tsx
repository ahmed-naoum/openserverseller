import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leadsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUS_LABELS: Record<string, { label: string, icon: string, color: string, ring: string }> = {
  NEW: { label: 'Nouveau', icon: '🆕', color: 'bg-blue-100 text-blue-800', ring: 'bg-blue-500' },
  AVAILABLE: { label: 'Disponible', icon: '🟢', color: 'bg-emerald-100 text-emerald-800', ring: 'bg-emerald-500' },
  ASSIGNED: { label: 'Assigné', icon: '👤', color: 'bg-amber-100 text-amber-800', ring: 'bg-amber-500' },
  CALL_LATER: { label: 'Rappel demandé', icon: '📞', color: 'bg-blue-100 text-blue-800', ring: 'bg-blue-500' },
  NO_REPLY: { label: 'Pas de réponse', icon: '📵', color: 'bg-gray-100 text-gray-800', ring: 'bg-gray-500' },
  CONFIRMED: { label: 'Confirmé', icon: '✅', color: 'bg-green-100 text-green-800', ring: 'bg-green-500' },
  WRONG_ORDER: { label: 'Mauvaise commande', icon: '⚠️', color: 'bg-amber-100 text-amber-800', ring: 'bg-amber-500' },
  CANCEL_REASON_PRICE: { label: 'Annulé (Prix)', icon: '💰', color: 'bg-gray-100 text-gray-800', ring: 'bg-gray-500' },
  CANCEL_ORDER: { label: 'Annulé', icon: '❌', color: 'bg-red-100 text-red-800', ring: 'bg-red-500' },
  CONTACTED: { label: 'Contacté', icon: '📞', color: 'bg-blue-100 text-blue-800', ring: 'bg-blue-500' },
  INTERESTED: { label: 'Intéressé', icon: '✅', color: 'bg-green-100 text-green-800', ring: 'bg-green-500' },
  ORDERED: { label: 'Commandé', icon: '🛒', color: 'bg-emerald-100 text-emerald-800', ring: 'bg-emerald-600' },
  INVALID: { label: 'Invalide', icon: '🚫', color: 'bg-red-100 text-red-800', ring: 'bg-red-600' },
};

export default function AgentLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [callbackDate, setCallbackDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [callbackHour, setCallbackHour] = useState<string>(format(new Date(), 'HH'));
  const [callbackMinute, setCallbackMinute] = useState<string>(format(new Date(), 'mm'));
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    try {
      const res = await leadsApi.detail(Number(id));
      const d = res.data?.data || res.data;
      setData(d);
      setNotes(d?.lead?.notes || '');
    } catch (err: any) {
      toast.error('Lead introuvable');
      navigate('/agent/leads');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string, extra?: any) => {
    setUpdating(true);
    try {
      await leadsApi.updateStatus(String(id), { status, notes, ...extra });
      toast.success(`Statut mis à jour: ${status}`);
      if (['CALL_LATER', 'NO_REPLY', 'CONFIRMED', 'WRONG_ORDER', 'CANCEL_REASON_PRICE', 'CANCEL_ORDER', 'INVALID'].includes(status)) {
        navigate('/agent/leads');
      } else {
        loadDetail();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-500"></div>
      </div>
    );
  }

  if (!data) return null;

  const { lead, influencer, product, vendor } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/agent/leads')}
            className="text-sm text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1"
          >
            ← Retour aux leads
          </button>
          <h1 className="text-2xl font-extrabold text-gray-900">Confirmation du Lead</h1>
          <p className="text-sm text-gray-500 mt-1">Appelez le client et mettez à jour le statut.</p>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase ${
          lead.status === 'ASSIGNED' ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-blue-100 text-blue-800'
        }`}>
          {lead.status}
        </span>
      </div>

      {/* Customer Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
          <h2 className="text-white font-bold flex items-center gap-2">👤 Client</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase mb-1">Nom complet</p>
              <p className="text-lg font-bold text-gray-900">{lead.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase mb-1">Téléphone</p>
              <a href={`tel:${lead.phone}`} className="text-lg font-bold text-primary-600 hover:underline flex items-center gap-2">
                📞 {lead.phone}
              </a>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase mb-1">Ville</p>
              <p className="text-gray-700 font-medium">{lead.city || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase mb-1">Adresse</p>
              <p className="text-gray-700 font-medium">{lead.address || '-'}</p>
            </div>
            {lead.whatsapp && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase mb-1">WhatsApp</p>
                <a
                  href={`https://wa.me/${lead.whatsapp.replace('+', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 font-medium hover:underline flex items-center gap-2"
                >
                  💬 {lead.whatsapp}
                </a>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase mb-1">Reçu le</p>
              <p className="text-gray-700 font-medium">{format(new Date(lead.createdAt), 'dd MMM yyyy à HH:mm')}</p>
            </div>
            {lead.referralLink?.code && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase mb-1">Lien de parrainage</p>
                <div className="flex items-center gap-2">
                  <a 
                    href={`/r/${lead.referralLink.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-mono text-sm font-bold border border-gray-200 hover:bg-gray-200 hover:text-primary-600 transition-all shadow-sm"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                    {lead.referralLink.code}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Lead Info Paragraph */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Informations de contact du prospect pour la confirmation et le suivi.
            </p>
          </div>
        </div>
      </div>

      {/* Product Info */}
      {product && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
            <h2 className="text-white font-bold flex items-center gap-2">📦 Produit</h2>
          </div>
          <div className="p-6">
            <div className="flex items-start gap-4">
              {product.image && (
                <img src={product.image} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-100" />
              )}
              <div className="flex-1">
                <p className="text-lg font-bold text-gray-900">{product.name}</p>
                <p className="text-sm text-gray-400 mt-0.5">SKU: {product.sku}</p>
                
                {(() => {
                  const variantPrice = (() => {
                    if (!lead.productVariant || !lead.referralLink?.landingPage?.customStructure) return null;
                    try {
                      const structure = typeof lead.referralLink.landingPage.customStructure === 'string' 
                        ? JSON.parse(lead.referralLink.landingPage.customStructure) 
                        : lead.referralLink.landingPage.customStructure;
                      const blocks = structure.blocks || [];
                      const checkoutBlock = blocks.find((b: any) => b.type === 'express_checkout');
                      if (!checkoutBlock) return null;
                      const options = checkoutBlock.content?.options || [];
                      const selected = options.find((o: any) => o.name === lead.productVariant);
                      return selected ? selected.price : null;
                    } catch (e) {
                      return null;
                    }
                  })();

                  const displayPrice = variantPrice !== null ? variantPrice : product.retailPrice;

                  return (
                    <div className="mt-2">
                      <div className="flex items-baseline gap-2">
                        <p className="text-xl font-black text-purple-600">{Number(displayPrice).toFixed(2)} MAD</p>
                        {variantPrice !== null && (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-bold uppercase rounded-md border border-purple-100">
                            Prix du Pack
                          </span>
                        )}
                      </div>
                      {lead.productVariant && (
                        <p className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1">
                          <span className="text-purple-400 font-black">↳</span> Sélection: {lead.productVariant}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {product.description && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{product.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Influencer & Vendor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Influencer */}
        {influencer && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-pink-500 to-pink-600 px-6 py-3">
              <h2 className="text-white font-bold text-sm flex items-center gap-2">🎙️ Influenceur (Référent)</h2>
            </div>
            <div className="p-5">
              <p className="font-bold text-gray-900">{influencer.fullName}</p>
              <p className="text-sm text-gray-400">{influencer.email}</p>
            </div>
          </div>
        )}

        {/* Vendor */}
        {vendor && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-3">
              <h2 className="text-white font-bold text-sm flex items-center gap-2">🏪 Vendeur (Propriétaire)</h2>
            </div>
            <div className="p-5">
              <p className="font-bold text-gray-900">{vendor.fullName}</p>
              <p className="text-sm text-gray-400">{vendor.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-gray-900 mb-3 block">📝 Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          rows={3}
          placeholder="Ajoutez des notes sur l'appel..."
        />
      </div>

      {/* Status Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-gray-900 mb-4">✅ Résultat de la confirmation</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="relative group">
            {lead.callbackAt && (
              <div className="absolute -top-2 -right-1 z-10 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full shadow-lg border border-blue-400 animate-bounce">
                ⏰ {format(new Date(lead.callbackAt), 'dd/MM HH:mm')}
              </div>
            )}
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={updating}
              className="w-full py-3 px-4 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all border border-blue-200 flex items-center justify-center gap-2"
            >
              📞 CALL LATER
            </button>
          </div>
          <button
            onClick={() => handleUpdateStatus('NO_REPLY')}
            disabled={updating}
            className="py-3 px-4 bg-gray-50 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all border border-gray-200 flex items-center justify-center gap-2"
          >
            📵 NO REPLY
          </button>
          <button
            onClick={() => handleUpdateStatus('CONFIRMED')}
            disabled={updating}
            className="py-3 px-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all border border-emerald-200 flex items-center justify-center gap-2"
          >
            ✅ CONFIRMED
          </button>
          <button
            onClick={() => handleUpdateStatus('WRONG_ORDER')}
            disabled={updating}
            className="py-3 px-4 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-100 transition-all border border-amber-200 flex items-center justify-center gap-2"
          >
            ⚠️ WRONG ORDER
          </button>
          <button
            onClick={() => handleUpdateStatus('CANCEL_REASON_PRICE')}
            disabled={updating}
            className="py-3 px-4 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all border border-gray-300 flex items-center justify-center gap-2"
          >
            💰 CANCEL REASON PRICE
          </button>
          <button
            onClick={() => handleUpdateStatus('CANCEL_ORDER')}
            disabled={updating}
            className="py-3 px-4 bg-red-50 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100 transition-all border border-red-200 flex items-center justify-center gap-2"
          >
            ❌ CANCEL ORDER
          </button>
        </div>
        {updating && (
          <p className="text-sm text-gray-400 text-center mt-3 animate-pulse">Mise à jour en cours...</p>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                <span className="text-3xl">⏰</span>
              </div>
              <h3 className="text-xl font-black">Programmer le rappel</h3>
              <p className="text-blue-100 text-sm mt-1">À quel moment souhaitez-vous rappeler {lead.fullName} ?</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</label>
                  <input
                    type="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full pl-4 pr-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold text-base focus:bg-white focus:border-blue-500 focus:ring-0 transition-all outline-none"
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Heure (24h)</label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold text-base focus:bg-white focus:border-blue-500 focus:ring-0 transition-all outline-none appearance-none text-center"
                      value={callbackHour}
                      onChange={(e) => setCallbackHour(e.target.value)}
                    >
                      {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="flex items-center font-bold text-gray-400">:</span>
                    <select
                      className="flex-1 px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold text-base focus:bg-white focus:border-blue-500 focus:ring-0 transition-all outline-none appearance-none text-center"
                      value={callbackMinute}
                      onChange={(e) => setCallbackMinute(e.target.value)}
                    >
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    if (!callbackDate || !callbackHour || !callbackMinute) return toast.error('Veuillez choisir une date et une heure');
                    
                    const selected = new Date(`${callbackDate}T${callbackHour}:${callbackMinute}:00`);
                    if (selected <= new Date()) {
                      return toast.error('La date de rappel doit être dans le futur');
                    }

                    handleUpdateStatus('CALL_LATER', { callbackAt: selected.toISOString() });
                    setShowScheduleModal(false);
                  }}
                  disabled={updating}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
