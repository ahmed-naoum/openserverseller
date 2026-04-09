import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Link2, RefreshCw, Smartphone, ToggleLeft, ToggleRight, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function IntegrationsPage() {
  const { user } = useAuth();

  const [status, setStatus] = useState<{
    isConnected: boolean;
    autoSyncActive: boolean;
    storeDomain: string | null;
  }>({
    isConnected: !!user?.youcanAccessToken,
    autoSyncActive: true,
    storeDomain: null,
  });

  const [loading, setLoading] = useState(false);

  // === CONFIG YOUCAN (à mettre dans ton .env) ===
  const YOUCAN_CLIENT_ID = import.meta.env.VITE_YOUCAN_CLIENT_ID;
  const REDIRECT_URI = `${window.location.origin}/dashboard/youcan-callback`;

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/youcan/status');
      setStatus(res.data.data);
    } catch (err) {
      console.error('Failed to fetch YouCan status');
    }
  };

  const handleConnect = () => {
    if (!YOUCAN_CLIENT_ID) {
      toast.error('Client ID YouCan non configuré');
      return;
    }

    const scopes = encodeURIComponent('read_customers read_orders edit_rest_hooks');
    const authUrl =
      `https://seller-area.youcan.shop/admin/oauth/authorize` +
      `?client_id=${YOUCAN_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${scopes}`;

    window.location.href = authUrl;
  };

  const handleToggleSync = async () => {
    setLoading(true);
    try {
      const nextActive = !status.autoSyncActive;
      await api.post('/youcan/toggle-sync', { active: nextActive });
      setStatus(prev => ({ ...prev, autoSyncActive: nextActive }));
      toast.success(`Synchronisation automatique ${nextActive ? 'activée' : 'désactivée'}`);
    } catch (err) {
      toast.error('Erreur lors du changement de mode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="mb-8 p-8 border-b border-gray-100 bg-white rounded-3xl shadow-sm">
        <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
          <Link2 className="text-indigo-600" size={36} />
          Intégrations et APIs
        </h2>
        <p className="text-gray-500 mt-2 text-lg">
          Connectez votre boutique pour synchroniser vos leads automatiquement.
        </p>
      </div>

      <div className="space-y-8">
        {/* YouCan Integration Card */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-lg transition-shadow border border-gray-100">
          <div className="p-8 md:w-2/3 border-b md:border-b-0 md:border-r border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold text-gray-900">YouCan</h3>
                {status.isConnected && (
                  <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    <CheckCircle2 size={10} /> Lié
                  </span>
                )}
              </div>
              <span
                className={`px-4 py-1.5 rounded-full text-xs font-black tracking-wide ${
                  status.isConnected
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                {status.isConnected ? 'CONNECTÉ' : 'DÉCONNECTÉ'}
              </span>
            </div>

            <p className="text-gray-600 text-base leading-relaxed mb-8">
              Importez vos clients directement depuis votre boutique YouCan. Tous les clients ayant passé commande seront synchronisés en tant que nouveaux Leads sur Silacod.
            </p>

            {!status.isConnected ? (
              <button
                onClick={handleConnect}
                className="inline-flex items-center justify-center px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xl shadow-indigo-600/20 transition-all hover:scale-105 gap-3"
              >
                <Link2 size={20} /> Connecter ma boutique
              </button>
            ) : (
              <div className="space-y-6">
                {/* Control Panel */}
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">Synchronisation Automatique</p>
                      <p className="text-sm text-gray-500">Capture les leads en temps réel via Webhook</p>
                    </div>
                    <button
                      onClick={handleToggleSync}
                      disabled={loading}
                      className={`p-1 rounded-full transition-colors ${status.autoSyncActive ? 'text-indigo-600' : 'text-gray-300'}`}
                    >
                      {status.autoSyncActive ? <ToggleRight size={48} /> : <ToggleLeft size={48} />}
                    </button>
                  </div>

                  <div className="pt-4 border-t border-gray-200/60 flex flex-wrap gap-4">
                    <button
                      onClick={async () => {
                        try {
                          const res = await api.post('/youcan/sync');
                          toast.success(res.data.message || 'Synchronisation terminée');
                        } catch (err: any) {
                          toast.error(err.response?.data?.message || 'Erreur de synchronisation');
                        }
                      }}
                      className="inline-flex items-center justify-center px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold shadow-lg shadow-gray-900/10 transition-all gap-2 text-sm"
                    >
                      <RefreshCw size={16} /> Sync. Manuelle
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                  <Smartphone size={16} className="text-indigo-600" />
                  <p className="text-xs text-indigo-700 font-medium font-['Inter'] tracking-tight">
                    Domaine lié : <span className="font-black underline">{status.storeDomain || 'Chargement...'}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-white p-8 md:w-1/3 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 mb-6 bg-white rounded-3xl p-5 shadow-lg border border-indigo-100 flex items-center justify-center hover:scale-110 transition-transform">
              <img
                src="https://developer.youcan.shop/logo.svg"
                alt="YouCan Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) parent.innerHTML = `<div class="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-xl">YC</div>`;
                }}
              />
            </div>
            <p className="font-extrabold text-gray-900 mb-1 text-lg">Store Connect</p>
            <p className="text-sm font-medium text-indigo-600">OAuth 2.0 Sécurisé</p>
          </div>
        </div>
      </div>
    </div>
  );
}