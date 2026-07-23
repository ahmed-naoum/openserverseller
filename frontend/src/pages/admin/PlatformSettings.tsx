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
  RefreshCw,
  Flame
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function PlatformSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [resettingLevels, setResettingLevels] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    secret: 'silacod-admin',
    registrationBlocked: false,
    influencerRegistrationBlocked: false,
    showIdentityVerification: true,
    showBankVerification: true,
    showContractVerification: true
  });

  const handleCacheRefresh = async () => {
    try {
      setRefreshingCache(true);
      const res = await settingsApi.refreshCache();
      toast.success(res.data?.message || 'Recachement forcé avec succès !');
    } catch (error) {
      toast.error('Erreur lors de la réactualisation générale');
    } finally {
      setRefreshingCache(false);
    }
  };

  const handleResetLevels = async () => {
    try {
      setResettingLevels(true);
      const res = await settingsApi.resetRankLevels();
      toast.success(res.data?.message || 'Niveaux de rang réinitialisés avec succès !');
      setIsResetModalOpen(false);
    } catch (error) {
      toast.error('Erreur lors de la réinitialisation des niveaux');
    } finally {
      setResettingLevels(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsApi.getAdminMaintenanceSettings();
      const data = res.data.data;
      setSettings({
        enabled: data.enabled || false,
        secret: data.secret || '',
        registrationBlocked: !!data.registrationBlocked,
        influencerRegistrationBlocked: !!data.influencerRegistrationBlocked,
        showIdentityVerification: data.showIdentityVerification !== false,
        showBankVerification: data.showBankVerification !== false,
        showContractVerification: data.showContractVerification !== false
      });
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
        
        <div className="md:col-span-2 space-y-6">
          {/* Maintenance Toggle Card */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
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

              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="max-w-[70%]">
                   <p className="font-bold text-slate-700">Approbation Manuelle des Inscriptions</p>
                   <p className="text-xs text-slate-500 mt-1">Les nouveaux utilisateurs doivent être approuvés par un admin avant d'accéder à la plateforme. Leurs données sont collectées normalement.</p>
                 </div>
                 <button 
                    onClick={() => setSettings(s => ({ ...s, registrationBlocked: !s.registrationBlocked }))}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${settings.registrationBlocked ? 'bg-rose-500' : 'bg-slate-300'}`}
                 >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.registrationBlocked ? 'translate-x-7' : 'translate-x-1'}`} />
                 </button>
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="max-w-[70%]">
                   <p className="font-bold text-slate-700">Approbation Influenceurs</p>
                   <p className="text-xs text-slate-500 mt-1">Les nouveaux influenceurs doivent être approuvés avant d'accéder à leur espace. Indépendant du contrôle vendeurs.</p>
                 </div>
                 <button 
                    onClick={() => setSettings(s => ({ ...s, influencerRegistrationBlocked: !s.influencerRegistrationBlocked }))}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${settings.influencerRegistrationBlocked ? 'bg-violet-500' : 'bg-slate-300'}`}
                 >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.influencerRegistrationBlocked ? 'translate-x-7' : 'translate-x-1'}`} />
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

          {/* Verification Steps Toggle Card */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-none">Étapes de Vérification Obligatoires</h3>
                <p className="text-xs text-slate-400 mt-1 uppercase font-black tracking-widest leading-none">Déterminez les étapes affichées et requises</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="max-w-[70%]">
                   <p className="font-bold text-slate-700">3. Vérification d'Identité (CIN/Passeport)</p>
                   <p className="text-xs text-slate-500 mt-1">Si désactivé, l'étape de vérification d'identité sera masquée et validée par défaut.</p>
                 </div>
                 <button 
                    onClick={() => setSettings(s => ({ ...s, showIdentityVerification: !s.showIdentityVerification }))}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${settings.showIdentityVerification ? 'bg-indigo-500' : 'bg-slate-300'}`}
                 >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.showIdentityVerification ? 'translate-x-7' : 'translate-x-1'}`} />
                 </button>
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="max-w-[70%]">
                   <p className="font-bold text-slate-700">4. Méthode de Paiement Bancaire (RIB)</p>
                   <p className="text-xs text-slate-500 mt-1">Si désactivé, l'étape bancaire sera masquée et validée par défaut.</p>
                 </div>
                 <button 
                    onClick={() => setSettings(s => ({ ...s, showBankVerification: !s.showBankVerification }))}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${settings.showBankVerification ? 'bg-amber-500' : 'bg-slate-300'}`}
                 >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.showBankVerification ? 'translate-x-7' : 'translate-x-1'}`} />
                 </button>
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="max-w-[70%]">
                   <p className="font-bold text-slate-700">5. Contrat & Engagement</p>
                   <p className="text-xs text-slate-500 mt-1">Si désactivé, l'étape de signature du contrat sera masquée et validée par défaut.</p>
                 </div>
                 <button 
                    onClick={() => setSettings(s => ({ ...s, showContractVerification: !s.showContractVerification }))}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${settings.showContractVerification ? 'bg-slate-900' : 'bg-slate-300'}`}
                 >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.showContractVerification ? 'translate-x-7' : 'translate-x-1'}`} />
                 </button>
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

          {/* Cache Refresh Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
                <RefreshCw size={20} className={refreshingCache ? 'animate-spin' : ''} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-none">Forcer l'Actualisation</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest leading-none">Recachement des clients</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
              Cliquez pour vider instantanément le cache navigateur de tous les utilisateurs connectés ou visitant la plateforme. Ils recevront immédiatement la nouvelle version du site.
            </p>

            <button
              onClick={handleCacheRefresh}
              disabled={refreshingCache}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 text-xs"
            >
              {refreshingCache ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Vider le cache général
            </button>
          </div>

          {/* Reset Rank Levels Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <Flame size={20} className={resettingLevels ? 'animate-pulse text-rose-500' : ''} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-none">Réinitialiser les Rangs</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest leading-none">Niveaux de progression</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
              Réinitialisez instantanément la progression des grades (Bronze, Argent, Or, Platine) de tous les utilisateurs en remettant leurs gains cumulés à 0.
            </p>

            <button
              onClick={() => setIsResetModalOpen(true)}
              disabled={resettingLevels}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 text-xs"
            >
              {resettingLevels ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Flame size={14} />
              )}
              Réinitialiser tous les grades
            </button>
          </div>
        </div>

      </div>

      <ConfirmResetModal 
        isOpen={isResetModalOpen} 
        onClose={() => setIsResetModalOpen(false)} 
        onConfirm={handleResetLevels} 
        loading={resettingLevels} 
      />
    </div>
  );
}

function ConfirmResetModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  loading 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  loading: boolean; 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden flex flex-col shadow-2xl border border-slate-100/50 p-8 text-center relative">
        <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-6">
          <AlertCircle size={32} className="animate-bounce" />
        </div>

        <h2 className="text-xl font-black text-slate-800 tracking-tight mb-3">
          Réinitialiser tous les Rangs ?
        </h2>

        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8 px-2">
          Êtes-vous sûr de vouloir réinitialiser les niveaux de rang (total des gains cumulés) pour <strong className="text-slate-800">TOUS</strong> les utilisateurs ? Cette action est définitive et irréversible.
        </p>

        <div className="flex gap-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Flame size={18} />
            )}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
