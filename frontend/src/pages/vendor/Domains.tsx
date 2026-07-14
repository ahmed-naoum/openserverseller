import React, { useState, useEffect } from 'react';
import { Globe, CheckCircle2, AlertCircle, RefreshCw, X, Link as LinkIcon, Server } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, domainApi } from '../../lib/api';
import toast from 'react-hot-toast';

export default function Domains() {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'subdomain' | 'custom'>('subdomain');
  
  // --- SUBDOMAIN STATE ---
  const [isEditingSubdomain, setIsEditingSubdomain] = useState(false);
  const [newSubdomain, setNewSubdomain] = useState('');
  const [subdomainOtpStep, setSubdomainOtpStep] = useState<'idle' | 'sending' | 'verify'>('idle');
  const [subdomainOtpValue, setSubdomainOtpValue] = useState('');
  const [subdomainLoading, setSubdomainLoading] = useState(false);

  // --- CUSTOM DOMAIN STATE ---
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [customDomainLoading, setCustomDomainLoading] = useState(false);

  useEffect(() => {
    if (user?.subdomain) {
      setNewSubdomain(user.subdomain);
    }
  }, [user]);

  // --- SUBDOMAIN LOGIC ---
  const handleSubdomainSendOtp = async (e?: any) => {
    e?.preventDefault?.();
    if (!newSubdomain) return toast.error(t('settings_subdomain_toast_empty', 'dashboard'));
    const regex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!regex.test(newSubdomain) || newSubdomain.length < 3 || newSubdomain.length > 30) {
      return toast.error(t('settings_subdomain_toast_invalid', 'dashboard'));
    }

    setSubdomainOtpStep('sending');
    setSubdomainLoading(true);
    try {
      await authApi.sendSubdomainOtp(newSubdomain);
      setSubdomainOtpValue('');
      setSubdomainOtpStep('verify');
      toast.success(t('settings_subdomain_otp_sent_toast', 'dashboard'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || t('settings_subdomain_send_error_toast', 'dashboard'));
      setSubdomainOtpStep('idle');
    } finally {
      setSubdomainLoading(false);
    }
  };

  const handleSubdomainOtpVerify = async () => {
    if (subdomainOtpValue.length !== 6) return;
    setSubdomainLoading(true);
    try {
      await authApi.verifySubdomainOtp(newSubdomain, subdomainOtpValue);
      toast.success(t('settings_subdomain_success_toast', 'dashboard'));
      await refreshUser();
      setIsEditingSubdomain(false);
      setSubdomainOtpStep('idle');
      setSubdomainOtpValue('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || t('settings_subdomain_invalid_otp_toast', 'dashboard'));
    } finally {
      setSubdomainLoading(false);
    }
  };

  // --- CUSTOM DOMAIN LOGIC ---
  const handleConnectDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDomainInput) return;
    
    setCustomDomainLoading(true);
    try {
      await domainApi.connect(customDomainInput);
      toast.success("Domaine ajouté avec succès !");
      await refreshUser();
      setCustomDomainInput('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Erreur lors de l'ajout du domaine.");
    } finally {
      setCustomDomainLoading(false);
    }
  };

  const handleRefreshDomainStatus = async () => {
    setCustomDomainLoading(true);
    try {
      await domainApi.refresh();
      await refreshUser();
      toast.success("Statut mis à jour.");
    } catch (err: any) {
      toast.error("Erreur lors de la mise à jour du statut.");
    } finally {
      setCustomDomainLoading(false);
    }
  };

  const handleDisconnectDomain = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir déconnecter ce domaine ?")) return;
    setCustomDomainLoading(true);
    try {
      await domainApi.disconnect();
      await refreshUser();
      toast.success("Domaine déconnecté avec succès.");
    } catch (err: any) {
      toast.error("Erreur lors de la déconnexion du domaine.");
    } finally {
      setCustomDomainLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary-100 text-primary-600 rounded-xl">
          <Globe size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intégration de Domaine</h1>
          <p className="text-gray-500">Gérez vos liens avec un sous-domaine gratuit ou votre propre domaine personnalisé.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('subdomain')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 font-semibold text-sm transition-colors relative ${
              activeTab === 'subdomain' ? 'text-primary-600 bg-primary-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Server size={18} />
            Sous-domaine Silacod
            {activeTab === 'subdomain' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 font-semibold text-sm transition-colors relative ${
              activeTab === 'custom' ? 'text-primary-600 bg-primary-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <LinkIcon size={18} />
            Domaine Personnalisé
            {activeTab === 'custom' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
            )}
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {activeTab === 'subdomain' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{t('settings_subdomain_title', 'dashboard')}</h3>
                  <p className="text-sm text-gray-500">{t('settings_subdomain_desc', 'dashboard')}</p>
                </div>
                {!isEditingSubdomain && (
                  <button
                    onClick={() => {
                      setIsEditingSubdomain(true);
                      setNewSubdomain(user?.subdomain || '');
                      setSubdomainOtpStep('idle');
                    }}
                    className="px-4 py-2 border rounded-xl font-semibold text-sm bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100/50 transition-colors"
                  >
                    {user?.subdomain ? t('settings_subdomain_btn_edit', 'dashboard') : t('settings_subdomain_btn_config', 'dashboard')}
                  </button>
                )}
              </div>

              {!isEditingSubdomain ? (
                <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">
                      {t('settings_subdomain_status_label', 'dashboard')}
                    </span>
                    {user?.subdomain ? (
                      <div className="font-mono text-base font-bold">
                        <span className="text-primary-600">{user.subdomain}</span>
                        <span className="text-gray-400">.{window.location.host}</span>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-gray-500 italic">
                        {t('settings_subdomain_no_config', 'dashboard')}
                      </span>
                    )}
                  </div>
                  {user?.subdomain && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                      <CheckCircle2 size={14} /> {t('settings_subdomain_active', 'dashboard')}
                    </span>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50/50 rounded-2xl border border-gray-200 p-6 space-y-6">
                  {subdomainOtpStep === 'idle' || subdomainOtpStep === 'sending' ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                          {t('settings_subdomain_input_label', 'dashboard')}
                        </label>
                        <div className="flex rounded-xl shadow-sm border border-gray-200 overflow-hidden bg-white focus-within:ring-4 focus-within:ring-primary-500/10 focus-within:border-primary-500 transition-all duration-200">
                          <input
                            type="text"
                            required
                            pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                            disabled={subdomainLoading}
                            placeholder="mon-boutique"
                            className="flex-1 min-w-0 border-0 px-4 py-3 bg-transparent text-gray-900 font-mono font-bold focus:ring-0 placeholder:text-gray-300"
                            value={newSubdomain}
                            onChange={(e) => setNewSubdomain(e.target.value.toLowerCase().trim())}
                          />
                          <span className="inline-flex items-center px-4 border-l border-gray-200 bg-gray-50 text-gray-500 text-sm font-semibold select-none font-mono">
                            .{window.location.host}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end">
                        <button
                          type="button"
                          disabled={subdomainLoading}
                          onClick={() => setIsEditingSubdomain(false)}
                          className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold text-sm transition-all"
                        >
                          {t('settings_subdomain_cancel', 'dashboard')}
                        </button>
                        <button
                          type="button"
                          disabled={subdomainLoading}
                          onClick={handleSubdomainSendOtp}
                          className="px-5 py-2 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
                        >
                          {subdomainLoading ? 'Patientez...' : t('settings_subdomain_btn_verify', 'dashboard')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-primary-50 rounded-xl border border-primary-100 text-primary-700 text-sm">
                        <p>{t('settings_subdomain_otp_sent_msg', 'dashboard')}</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-bold text-gray-700 uppercase tracking-wider block mb-2">
                          {t('settings_subdomain_otp_label', 'dashboard')}
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="000000"
                          disabled={subdomainLoading}
                          value={subdomainOtpValue}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setSubdomainOtpValue(val);
                            if (val.length === 6) {
                              setTimeout(() => handleSubdomainOtpVerify(), 0);
                            }
                          }}
                          className="w-full text-center tracking-[0.5em] font-mono text-2xl px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500"
                        />
                      </div>

                      <div className="flex gap-3 justify-end mt-4">
                        <button
                          type="button"
                          disabled={subdomainLoading}
                          onClick={() => setSubdomainOtpStep('idle')}
                          className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold text-sm transition-all"
                        >
                          {t('settings_subdomain_cancel', 'dashboard')}
                        </button>
                        <button
                          type="button"
                          disabled={subdomainLoading || subdomainOtpValue.length !== 6}
                          onClick={handleSubdomainOtpVerify}
                          className="px-5 py-2 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                          {subdomainLoading ? 'Vérification...' : t('settings_subdomain_btn_confirm', 'dashboard')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Connecter un domaine existant</h3>
                <p className="text-sm text-gray-500">Utilisez votre propre nom de domaine pour vos liens de parrainage (ex: myshop.ma).</p>
              </div>

              {!user?.customDomain ? (
                <form onSubmit={handleConnectDomain} className="space-y-4">
                  <div>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        required
                        disabled={customDomainLoading}
                        placeholder="example.com"
                        value={customDomainInput}
                        onChange={(e) => setCustomDomainInput(e.target.value.toLowerCase().trim())}
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                      />
                      <button
                        type="submit"
                        disabled={customDomainLoading || !customDomainInput}
                        className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                        {customDomainLoading ? 'Connexion...' : 'Connecter'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <AlertCircle size={14} /> Ne mettez pas de "http://" ou "www.", juste le domaine.
                    </p>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Domaine actuel</p>
                      <p className="text-lg font-mono font-bold text-gray-900">{user.customDomain}</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        user.customDomainStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 
                        user.customDomainStatus === 'FAILED' ? 'bg-red-100 text-red-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {user.customDomainStatus === 'ACTIVE' && <CheckCircle2 size={14} />}
                        {user.customDomainStatus === 'PENDING' && <RefreshCw size={14} className="animate-spin" />}
                        {user.customDomainStatus === 'FAILED' && <AlertCircle size={14} />}
                        {user.customDomainStatus === 'ACTIVE' ? 'Vérifié' : 
                         user.customDomainStatus === 'FAILED' ? 'Échoué' : 
                         'En attente'}
                      </div>
                      <button
                        onClick={handleDisconnectDomain}
                        disabled={customDomainLoading}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Déconnecter le domaine"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-12 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Comment lier votre domaine personnalisé</h3>
                
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-4">
                  <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                    <AlertCircle size={16} /> Solution 1 (Recommandée) : Configuration DNS
                  </h4>
                  <p className="text-sm text-blue-800">
                    La première solution consiste à ajouter l'enregistrement DNS suivant chez votre fournisseur de domaine (GoDaddy, Namecheap, etc.) :
                  </p>
                  
                  <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-blue-50/50 border-b border-blue-200">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-blue-900">Type</th>
                          <th className="px-4 py-2 font-semibold text-blue-900">Nom / Hôte</th>
                          <th className="px-4 py-2 font-semibold text-blue-900">Cible / Valeur</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-4 py-3 font-mono font-bold text-gray-900">CNAME</td>
                          <td className="px-4 py-3 font-mono text-gray-900">@ <span className="text-gray-400 text-xs">(ou votre domaine)</span></td>
                          <td className="px-4 py-3 font-mono text-gray-900">custom.silacod.com</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-blue-700 italic">
                      Les modifications DNS peuvent prendre jusqu'à 24h pour se propager.
                    </p>
                    {user?.customDomain && user?.customDomainStatus !== 'ACTIVE' && (
                      <button
                        onClick={handleRefreshDomainStatus}
                        disabled={customDomainLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={customDomainLoading ? "animate-spin" : ""} />
                        Vérifier le statut
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-100/50 rounded-xl p-5 space-y-4">
                  <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                    <AlertCircle size={16} /> Solution 2 (Optionnelle) : Validation SSL préventive
                  </h4>
                  <p className="text-sm text-blue-800">
                    Si vous souhaitez valider la sécurité SSL à l'avance avant de changer le CNAME principal pour éviter toute interruption :
                  </p>
                  
                  <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-blue-50/50 border-b border-blue-200">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-blue-900">Type</th>
                          <th className="px-4 py-2 font-semibold text-blue-900">Nom / Hôte</th>
                          <th className="px-4 py-2 font-semibold text-blue-900">Cible / Valeur</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-4 py-3 font-mono font-bold text-gray-900">CNAME</td>
                          <td className="px-4 py-3 font-mono text-gray-900">_acme-challenge{user?.customDomain ? `.${user.customDomain}` : ''}</td>
                          <td className="px-4 py-3 font-mono text-gray-900">{user?.customDomain || 'votre-domaine'}.0da65d650e424ce1.dcv.cloudflare.com</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
