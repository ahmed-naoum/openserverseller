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
            <div className="relative overflow-hidden rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[320px]">
              {/* Glow Effects */}
              <div className="absolute -top-20 -left-20 w-56 h-56 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 w-56 h-56 bg-[#ff5722]/5 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-5 max-w-md mx-auto">
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <svg className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  Bientôt disponible
                </span>

                <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight pt-1">
                  Domaine personnalisé en préparation
                </h3>

                <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                  Bientôt, vous pourrez connecter votre propre nom de domaine (ex: myshop.ma) à vos pages de vente et liens de parrainage. Restez connecté !
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
