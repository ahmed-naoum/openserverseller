import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leadsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUS_LABELS: Record<string, { label: string, icon: string, color: string, ring: string }> = {
  NEW: { label: 'Nouveau', icon: '🆕', color: 'bg-blue-100 text-blue-800', ring: 'bg-blue-500' },
  AVAILABLE: { label: 'Disponible', icon: '🟢', color: 'bg-emerald-100 text-emerald-800', ring: 'bg-emerald-500' },
  ASSIGNED: { label: 'Assigné', icon: '👤', color: 'bg-amber-100 text-amber-800', ring: 'bg-amber-500' },
  CONTACTED: { label: 'Contacté', icon: '📞', color: 'bg-blue-100 text-blue-800', ring: 'bg-blue-500' },
  INTERESTED: { label: 'Intéressé', icon: '✅', color: 'bg-green-100 text-green-800', ring: 'bg-green-500' },
  ORDERED: { label: 'Commandé', icon: '🛒', color: 'bg-emerald-100 text-emerald-800', ring: 'bg-emerald-600' },
  CALLBACK_REQUESTED: { label: 'Rappel demandé', icon: '🔁', color: 'bg-orange-100 text-orange-800', ring: 'bg-orange-500' },
  NOT_INTERESTED: { label: 'Pas intéressé', icon: '❌', color: 'bg-red-100 text-red-800', ring: 'bg-red-500' },
  UNREACHABLE: { label: 'Injoignable', icon: '📵', color: 'bg-gray-100 text-gray-800', ring: 'bg-gray-500' },
  INVALID: { label: 'Invalide', icon: '🚫', color: 'bg-red-100 text-red-800', ring: 'bg-red-600' },
  PUSHED_TO_DELIVERY: { label: 'En livraison', icon: '🚚', color: 'bg-indigo-100 text-indigo-800', ring: 'bg-indigo-500' },
};

export default function AgentLeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');

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

  const handleUpdateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await leadsApi.updateStatus(String(id), { status, notes });
      toast.success(`Statut mis à jour: ${status}`);
      if (['CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'CALLBACK_REQUESTED', 'ORDERED', 'UNREACHABLE', 'INVALID'].includes(status)) {
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
          </div>

          {/* Click-to-call CTA */}
          <div className="mt-6 flex gap-3">
            <a
              href={`tel:${lead.phone}`}
              className="flex-1 py-3 bg-primary-500 text-white rounded-xl text-sm font-bold text-center hover:bg-primary-600 transition-all shadow-lg shadow-primary-200"
            >
              📞 Appeler maintenant
            </a>
            {lead.whatsapp && (
              <a
                href={`https://wa.me/${lead.whatsapp.replace('+', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-all"
              >
                💬 WhatsApp
              </a>
            )}
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
                {product.retailPrice && (
                  <p className="text-xl font-black text-purple-600 mt-2">{Number(product.retailPrice).toFixed(2)} MAD</p>
                )}
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
          <button
            onClick={() => handleUpdateStatus('CONTACTED')}
            disabled={updating}
            className="py-3 px-4 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all border border-blue-200"
          >
            📞 Contacté
          </button>
          <button
            onClick={() => handleUpdateStatus('INTERESTED')}
            disabled={updating}
            className="py-3 px-4 bg-green-50 text-green-700 rounded-xl text-sm font-bold hover:bg-green-100 transition-all border border-green-200"
          >
            ✅ Intéressé
          </button>
          <button
            onClick={() => handleUpdateStatus('ORDERED')}
            disabled={updating}
            className="py-3 px-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all border border-emerald-200"
          >
            🛒 Commandé
          </button>
          <button
            onClick={() => handleUpdateStatus('CALLBACK_REQUESTED')}
            disabled={updating}
            className="py-3 px-4 bg-orange-50 text-orange-700 rounded-xl text-sm font-bold hover:bg-orange-100 transition-all border border-orange-200"
          >
            🔁 Rappel demandé
          </button>
          <button
            onClick={() => handleUpdateStatus('NOT_INTERESTED')}
            disabled={updating}
            className="py-3 px-4 bg-red-50 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100 transition-all border border-red-200"
          >
            ❌ Pas intéressé
          </button>
          <button
            onClick={() => handleUpdateStatus('UNREACHABLE')}
            disabled={updating}
            className="py-3 px-4 bg-gray-50 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all border border-gray-200"
          >
            📵 Injoignable
          </button>
          <button
            onClick={() => handleUpdateStatus('INVALID')}
            disabled={updating}
            className="py-3 px-4 bg-red-50 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100 transition-all border border-red-200"
          >
            🚫 Invalide
          </button>
        </div>
        {updating && (
          <p className="text-sm text-gray-400 text-center mt-3 animate-pulse">Mise à jour en cours...</p>
        )}
      </div>
    </div>
  );
}
