import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { influencerApi } from '../../lib/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { buildReferralUrl } from '../../utils/referral';
import { containsBlockedWord } from '../../utils/blockedWords';
import { RefreshCw, Copy, QrCode, Power, Plus, Package, AlertCircle, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';

export interface LinksManagerConfig {
  isOpen: boolean;
  mode: 'manage' | 'create';
  productId: number;
  productName: string;
}

interface LinksManagerModalProps {
  config: LinksManagerConfig | null;
  onClose: () => void;
  onLinkCreated?: (productId: number, newLink: any) => void;
  onLinkStatusChanged?: (productId: number, linkId: number, isActive: boolean) => void;
}

export default function LinksManagerModal({
  config,
  onClose,
  onLinkCreated,
  onLinkStatusChanged
}: LinksManagerModalProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Mode state: 'manage' or 'create'
  const [currentMode, setCurrentMode] = useState<'manage' | 'create'>('manage');

  // Links List State
  const [modalLinks, setModalLinks] = useState<any[]>([]);
  const [isModalLinksLoading, setIsModalLinksLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedLinkForQr, setSelectedLinkForQr] = useState<any | null>(null);

  // Create Link State
  const [customName, setCustomName] = useState('');
  const [customNameError, setCustomNameError] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    icon: <RefreshCw size={24} />,
    confirmText: 'Confirmer',
    variant: 'primary',
    isLoading: false
  });

  useEffect(() => {
    if (config?.isOpen) {
      setCurrentMode(config.mode);
      if (config.mode === 'manage') {
        fetchLinks();
      } else {
        setCustomName('');
        setCustomNameError('');
      }
    } else {
      setModalLinks([]);
      setShowQrModal(false);
      setSelectedLinkForQr(null);
    }
  }, [config]);

  const fetchLinks = async () => {
    if (!config) return;
    setIsModalLinksLoading(true);
    try {
      const res = await influencerApi.getLinks();
      const allLinks = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setModalLinks(allLinks.filter((l: any) => l.productId === config.productId));
    } catch (err) {
      toast.error(t('error_loading_links', 'inventory', 'Impossible de charger les liens'));
      console.error(err);
    } finally {
      setIsModalLinksLoading(false);
    }
  };

  const handleNameChange = (val: string) => {
    let clean = val.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
    setCustomName(clean);

    if (!clean) {
      setCustomNameError('');
      return;
    }
    if (clean.length < 3) {
      setCustomNameError(t('err_name_short', 'links', 'Le nom doit faire au moins 3 caractères'));
      return;
    }
    if (clean.length > 20) {
      setCustomNameError(t('err_name_long', 'links', 'Le nom ne doit pas dépasser 20 caractères'));
      return;
    }
    const regex = /^[a-zA-Z0-9-_]+$/;
    if (!regex.test(clean)) {
      setCustomNameError(t('err_name_invalid_chars', 'links', 'Caractères non autorisés (lettres, chiffres, tirets)'));
      return;
    }
    const blocked = containsBlockedWord(clean);
    if (blocked) {
      setCustomNameError(t('err_name_blocked', 'links', 'Ce nom contient un mot interdit.'));
      return;
    }
    setCustomNameError('');
  };

  useEffect(() => {
    if (!customName || customName.length < 3 || customName.length > 20 || !/^[a-zA-Z0-9-_]+$/.test(customName)) {
      return;
    }
    if (containsBlockedWord(customName)) {
      return;
    }
    const timer = setTimeout(async () => {
      setIsCheckingName(true);
      try {
        const res = await influencerApi.checkLinkNameUnique(customName);
        if (!res.data.unique) {
          setCustomNameError(t('err_name_taken', 'links', 'Ce nom de lien est déjà utilisé'));
        } else {
          setCustomNameError('');
        }
      } catch (err) {
        console.error('Error checking name uniqueness', err);
      } finally {
        setIsCheckingName(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [customName]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !customName || customNameError) return;

    setIsCreatingLink(true);
    try {
      const res = await influencerApi.createLink(config.productId, customName);
      const newLink = res.data;
      
      if (onLinkCreated) {
        onLinkCreated(config.productId, newLink);
      }
      
      toast.success(t('link_success', 'inventory', 'Lien généré avec succès !'));
      
      // Go back to manage mode
      setCurrentMode('manage');
      fetchLinks();
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('link_error', 'inventory', 'Erreur lors de la génération du lien'));
      console.error(error);
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleToggleStatus = (link: any) => {
    setConfirmModal({
      isOpen: true,
      title: link.isActive ? t('confirm_deactivate_title', 'links', "Désactiver le lien ?") : t('confirm_activate_title', 'links', "Activer le lien ?"),
      message: link.isActive 
        ? t('confirm_deactivate_message', 'links', "Êtes-vous sûr de vouloir désactiver ce lien ? Les visiteurs cliquant sur ce lien ne pourront plus accéder à l'offre et verront le message 'Offre indisponible'.")
        : t('confirm_activate_message', 'links', "Êtes-vous sûr de vouloir réactiver ce lien de parrainage ?"),
      icon: <Power size={32} className={link.isActive ? "text-red-500 animate-pulse" : "text-emerald-500"} />,
      confirmText: link.isActive ? t('btn_deactivate', 'links', "Oui, désactiver") : t('btn_activate', 'links', "Oui, activer"),
      variant: link.isActive ? 'danger' : 'primary',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await influencerApi.updateLinkStatus(link.id, !link.isActive);
          
          setModalLinks(prev => prev.map(l => l.id === link.id ? { ...l, isActive: res.data.isActive } : l));
          
          if (onLinkStatusChanged) {
            onLinkStatusChanged(config!.productId, link.id, res.data.isActive);
          }
          
          toast.success(link.isActive ? t('toast_deactivated', 'links', 'Lien désactivé') : t('toast_activated', 'links', 'Lien activé'));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error(t('toast_status_error', 'links', 'Erreur lors du changement de statut'));
        } finally {
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  if (!config || !config.isOpen) return null;

  return (
    <>
      {/* Create Link Modal */}
      {currentMode === 'create' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('create_modal_title', 'links', 'Créer un Nouveau Lien')}</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t('create_modal_subtitle', 'links', 'PERSONNALISEZ VOTRE PARRAINAGE')}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-black p-2 hover:bg-slate-50 rounded-xl"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateLink} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('label_select_product', 'links', 'PRODUIT SÉLECTIONNÉ')}</label>
                  <div className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700">
                    {config.productName}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('label_custom_name', 'links', 'NOM DU LIEN PERSONNALISÉ')}</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('custom_name_placeholder', 'links', 'mon-super-lien')}
                      value={customName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-sm font-mono font-bold text-slate-700 focus:outline-none transition-all ${
                        customNameError 
                          ? 'border-red-300 focus:border-red-500' 
                          : customName && !isCheckingName 
                            ? 'border-emerald-300 focus:border-emerald-500' 
                            : 'border-slate-100 focus:border-slate-900'
                      }`}
                      required
                      minLength={3}
                      maxLength={20}
                    />
                    {isCheckingName && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <RefreshCw size={14} className="animate-spin text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[70%]">
                      {t('final_url_prefix', 'links', 'URL FINALE')}: {buildReferralUrl(customName || t('name_placeholder', 'links', 'NOM'), user?.subdomain, user?.customDomain, user?.customDomainStatus)}
                    </span>
                    <span className={`text-[10px] font-black uppercase ${customName.length >= 3 && customName.length <= 20 ? 'text-slate-400' : 'text-amber-500'}`}>
                      {customName.length}/20 chars
                    </span>
                  </div>
                  {customNameError && (
                    <p className="text-xs font-bold text-red-500 flex items-center gap-1.5 mt-1">
                      <AlertCircle size={12} /> {customNameError}
                    </p>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (config.mode === 'create' && modalLinks.length === 0) {
                        onClose();
                      } else {
                        setCurrentMode('manage');
                        fetchLinks();
                      }
                    }}
                    className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
                  >
                    {t('btn_cancel', 'links', 'ANNULER')}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingLink || !config.productId || !customName || !!customNameError || isCheckingName}
                    className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-slate-800 rounded-2xl shadow-lg shadow-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreatingLink && (
                      <RefreshCw size={14} className="animate-spin" />
                    )}
                    {t('btn_generate', 'links', 'GÉNÉRER')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Links List Modal */}
      {currentMode === 'manage' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('product_links_title', 'inventory', 'Liens de Parrainage')}</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {t('selected_product', 'inventory', 'Produit')}: {config.productName}
                  </p>
                </div>
                <button 
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-black p-2 hover:bg-slate-50 rounded-xl"
                >
                  ✕
                </button>
              </div>

              {isModalLinksLoading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="max-h-[350px] overflow-y-auto space-y-4 pr-1">
                    {modalLinks.map((link) => {
                      const ctr = link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : '0.0';
                      const role = user?.roleName || user?.role;
                      const showBuilder = role === 'SUPER_ADMIN' || role === 'HELPER' || role === 'VENDOR' || (role === 'INFLUENCER' && user?.canManageInfluencerLinks);
                      return (
                        <div key={link.id} className="bg-slate-50/50 border border-slate-100/70 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <span className="px-3 py-1 bg-white border border-slate-100 text-slate-700 rounded-xl text-xs font-mono font-bold shadow-sm">
                                {link.code}
                              </span>
                              
                              <button
                                onClick={() => handleToggleStatus(link)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                  link.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' : 'bg-slate-100 text-slate-400 border border-slate-200/50'
                                }`}
                              >
                                <Power className={`w-2.5 h-2.5 ${link.isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                                {link.isActive ? t('status_active', 'links', 'Actif') : t('status_paused', 'links', 'Suspendu')}
                              </button>
                            </div>
                            
                            <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[280px]">
                              URL: {buildReferralUrl(link.code, user?.subdomain, user?.customDomain, user?.customDomainStatus)}
                            </p>

                            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100/50">
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('views', 'links', 'Vues')}</p>
                                <p className="text-xs font-black text-slate-800">{(link.rawClicks || link.clicks).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('visitors', 'links', 'Visiteurs')}</p>
                                <p className="text-xs font-black text-slate-800">{link.clicks.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('sales', 'links', 'Ventes')}</p>
                                <p className="text-xs font-black text-slate-800">{link.conversions.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('ctr', 'links', 'Taux')}</p>
                                <p className="text-xs font-black text-indigo-600">{ctr}%</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              onClick={() => {
                                const fullUrl = buildReferralUrl(link.code, user?.subdomain, user?.customDomain, user?.customDomainStatus);
                                navigator.clipboard.writeText(fullUrl);
                                toast.success(t('copied_success', 'inventory', 'Lien copié dans le presse-papiers !'));
                              }}
                              className="p-2.5 bg-white text-slate-400 hover:text-slate-900 border border-slate-100 rounded-xl transition-all shadow-sm"
                              title={t('btn_copy', 'links', 'Copier le lien')}
                            >
                              <Copy size={14} />
                            </button>
                            {showBuilder && (
                              <button
                                onClick={() => {
                                  const role = user?.roleName || user?.role;
                                  const targetPath = role === 'VENDOR' 
                                    ? `/dashboard/links/${link.id}/builder` 
                                    : role === 'INFLUENCER' 
                                      ? `/influencer/links/${link.id}/builder` 
                                      : `/helper/links/${link.id}/builder`;
                                  navigate(targetPath);
                                }}
                                className="p-2.5 bg-white text-slate-400 hover:text-purple-600 border border-slate-100 rounded-xl transition-all shadow-sm"
                                title={t('tooltip_builder', 'links') || "Constructeur de Page"}
                              >
                                <Wand2 size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedLinkForQr(link);
                                setShowQrModal(true);
                              }}
                              className="p-2.5 bg-white text-slate-400 hover:text-purple-600 border border-slate-100 rounded-xl transition-all shadow-sm"
                              title={t('btn_qr', 'links', 'Code QR')}
                            >
                              <QrCode size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {modalLinks.length === 0 && (
                      <div className="p-10 text-center bg-slate-50 border border-dashed border-slate-100 rounded-2xl">
                        <Package className="w-12 h-12 mx-auto text-slate-300 mb-2 opacity-55" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                          {t('no_links_created', 'inventory', 'Aucun lien généré pour le moment')}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100/80 flex justify-between items-center gap-4">
                    <button
                      onClick={() => setCurrentMode('create')}
                      disabled={modalLinks.length >= 5}
                      className="flex-1 py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> {t('btn_create_another_link', 'inventory', 'Créer un autre lien')} ({modalLinks.length}/5)
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                    >
                      {t('btn_close', 'links', 'Fermer')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && selectedLinkForQr && (
        <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-10 text-center animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black text-slate-900 mb-2">{t('qr_title', 'links', 'Code QR du lien')}</h2>
            <p className="text-sm text-slate-400 font-medium mb-8">{t('qr_subtitle', 'links', 'Scannez ou téléchargez le code QR')}</p>
            <div className="bg-white p-6 rounded-2xl border-4 border-dashed border-slate-100 inline-block mb-8">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(buildReferralUrl(selectedLinkForQr?.code, user?.subdomain, user?.customDomain, user?.customDomainStatus))}`}
                alt="QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(buildReferralUrl(selectedLinkForQr?.code, user?.subdomain, user?.customDomain, user?.customDomainStatus))}`;
                  link.download = `qr-link-${selectedLinkForQr?.code}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast.success(t('toast_qr_ready', 'links', 'Téléchargement lancé !'));
                }}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
              >
                {t('btn_download_hd', 'links', 'Télécharger HD')}
              </button>
              <button onClick={() => setShowQrModal(false)} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                {t('btn_close', 'links', 'Fermer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-slate-50">
                {confirmModal.icon}
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                {confirmModal.title}
              </h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                {confirmModal.message}
              </p>
            </div>
            <div className="p-8 bg-slate-50/50 flex gap-4">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                disabled={confirmModal.isLoading}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-100 rounded-2xl transition-all disabled:opacity-50"
              >
                {t('btn_cancel', 'links', 'Annuler')}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                disabled={confirmModal.isLoading}
                className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white rounded-2xl shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  confirmModal.variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {confirmModal.isLoading && (
                  <RefreshCw size={14} className="animate-spin" />
                )}
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
