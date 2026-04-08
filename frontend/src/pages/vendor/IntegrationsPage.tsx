import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { Link2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function IntegrationsPage() {
  const { user } = useAuth();

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
              <h3 className="text-2xl font-bold text-gray-900">YouCan</h3>
              <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-wide ${
                user?.youcanAccessToken ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}>
                {user?.youcanAccessToken ? 'CONNECTÉ' : 'DÉCONNECTÉ'}
              </span>
            </div>
            <p className="text-gray-600 text-base leading-relaxed mb-8">
              Importez vos clients directement depuis votre boutique YouCan. Tous les clients ayant passé commande seront synchronisés en tant que nouveaux Leads sur Silacod.
            </p>
            
            {!user?.youcanAccessToken ? (
              <a 
                href={`https://seller-area.youcan.shop/admin/oauth/authorize?client_id=2498&redirect_uri=${encodeURIComponent(window.location.origin + '/dashboard/youcan-callback')}&response_type=code&scope[]=read-customers`}
                className="inline-flex items-center justify-center px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xl shadow-indigo-600/20 transition-all hover:scale-105 gap-3"
              >
                <Link2 size={20} /> Connecter ma boutique
              </a>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={async () => {
                    try {
                      const res = await api.post('/youcan/sync');
                      toast.success(res.data.message || 'Synchronisation terminée');
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || 'Erreur de synchronisation');
                    }
                  }}
                  className="inline-flex items-center justify-center px-8 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold shadow-xl shadow-gray-900/20 transition-all hover:scale-105 gap-3 w-full sm:w-auto"
                >
                  <RefreshCw size={20} /> Synchroniser les Leads
                </button>
                <p className="text-sm text-gray-400 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100">
                  Les leads importés seront disponibles dans l'onglet "Vos Leads" avec le statut "NEW".
                </p>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-white p-8 md:w-1/3 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 mb-6 bg-white rounded-3xl p-5 shadow-lg border border-indigo-100 flex items-center justify-center hover:scale-110 transition-transform">
              {/* Fallback image handler for YouCan logo */}
              <img 
                src="https://developer.youcan.shop/logo.svg" 
                alt="YouCan Logo" 
                className="w-full" 
                onError={(e) => { 
                  e.currentTarget.src = ''; 
                  e.currentTarget.className = 'w-12 h-12 bg-indigo-100 rounded-full'; 
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
