import { useState, useEffect } from 'react';
import { settingsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  Shield, 
  Lock, 
  Power, 
  Key, 
  AlertCircle,
  Construction,
  Save,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function PlatformSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    secret: 'silacod-admin'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsApi.getAdminMaintenanceSettings();
      setSettings(res.data.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsApi.updateMaintenanceSettings(settings);
      toast.success('Paramètres mis à jour avec succès !');
      // If maintenance mode was just enabled, the user themselves might need to 
      // ensure they have the bypass token if they want to keep working.
      // But usually, the admin toggle is safe as it's an exempt path.
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Paramètres de la Plateforme</h1>
          <p className="text-sm text-slate-500 mt-1">Gérez l'état global du système et la maintenance.</p>
        </div>
        <button 
           onClick={fetchSettings}
           className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Maintenance Toggle Card */}
        <div className="md:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className={`p-3 rounded-2xl ${settings.enabled ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Power size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-none">Mode Maintenance</h3>
              <p className="text-xs text-slate-400 mt-1 uppercase font-black tracking-widest leading-none">Statut: {settings.enabled ? 'Activé' : 'Désactivé'}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="max-w-[70%]">
                 <p className="font-bold text-slate-700">Activer la Maintenance</p>
                 <p className="text-xs text-slate-500 mt-1">Le site sera inaccessible pour le public. Une page de "Coming Soon" sera affichée.</p>
               </div>
               <button 
                  onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${settings.enabled ? 'bg-amber-500' : 'bg-slate-300'}`}
               >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
               </button>
            </div>

            <div className="space-y-3">
               <div className="flex items-center gap-2 text-slate-700 font-bold px-2">
                 <Key size={16} className="text-primary-500" />
                 <label className="text-sm">Mot de passe de bypass (Développeur)</label>
               </div>
               <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                 </div>
                 <input 
                    type="text"
                    value={settings.secret}
                    onChange={(e) => setSettings(s => ({ ...s, secret: e.target.value }))}
                    placeholder="Entrez le mot de passe secret"
                    className="w-full pl-11 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all text-sm font-semibold text-slate-700"
                 />
               </div>
               <p className="text-[10px] text-slate-400 font-medium px-4">Utilisez ce mot de passe pour accéder au site via le bouton caché sur la page de maintenance.</p>
            </div>
          </div>

          <div className="mt-10 flex justify-end pt-6 border-t border-slate-50">
            <button 
               onClick={handleSave}
               disabled={saving}
               className="flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-primary-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-slate-900/10 hover:shadow-primary-600/20 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Enregistrer les Paramètres
            </button>
          </div>
        </div>

        {/* Warning/Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6">
             <div className="flex items-start gap-3 text-amber-700">
                <AlertCircle size={24} className="flex-shrink-0" />
                <div>
                   <p className="font-bold text-sm mb-1 leading-tight">Attention</p>
                   <p className="text-[11px] leading-relaxed font-medium">Activer le mode maintenance déconnectera les utilisateurs normaux et arrêtera tout le trafic vers le frontend React.</p>
                </div>
             </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6">
             <div className="flex items-start gap-3 text-blue-700">
                <Construction size={24} className="flex-shrink-0" />
                <div>
                   <p className="font-bold text-sm mb-1 leading-tight">Guide Express</p>
                   <ul className="text-[11px] leading-relaxed font-medium list-disc list-inside space-y-1">
                      <li>Togguez le bouton pour activer/désactiver le mode.</li>
                      <li>Configurez un mot de passe unique.</li>
                      <li>Cliquez sur "Enregistrer" pour appliquer les changements instantanément.</li>
                   </ul>
                </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
