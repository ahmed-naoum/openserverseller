import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, authApi, BACKEND_URL } from '../../lib/api';
import { 
  Eye, EyeOff, User, Lock, Bell, Settings as SettingsIcon, 
  MapPin, Phone, Mail, Camera, ShieldCheck, CheckCircle2, 
  MonitorSmartphone, CreditCard, ChevronRight, AlertCircle,
  Shield, Globe, Pencil, Check, RefreshCw, CheckCircle, Loader2,
  Trash2, Star, Landmark, Plus, AlertTriangle, Building2, Clock
} from 'lucide-react';
import { 
  FaInstagram, 
  FaTiktok, 
  FaFacebook, 
  FaYoutube, 
  FaSnapchatGhost 
} from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import toast from 'react-hot-toast';
import ProfileVerification from './ProfileVerification';
import AvatarCropModal from '../../components/common/AvatarCropModal';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');

  // Sync activeTab with URL search params
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    } else {
      setActiveTab('profile');
    }
  }, [searchParams]);

  // Update URL when tab changes manually
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };
  const defaultBank = user?.bankAccounts?.find((ba: any) => ba.isDefault) || user?.bankAccounts?.[0];
  const isBankApproved = defaultBank?.status === 'APPROVED';
  const isAdmin = ['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(user?.role || '');
  const canEditPayment = isAdmin;

  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    city: user?.city || '',
    address: user?.address || '',
    language: user?.language || 'fr',
    payoutMethod: user?.metadata?.payoutMethod || 'bank_transfer',
    instagramUsername: user?.instagramUsername || '',
    tiktokUsername: user?.tiktokUsername || '',
    facebookUsername: user?.facebookUsername || '',
    xUsername: user?.xUsername || '',
    youtubeUsername: user?.youtubeUsername || '',
    snapchatUsername: user?.snapchatUsername || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailOrders: true,
    emailPayouts: true,
    smsOrders: false,
    whatsappOrders: true,
  });

  const [twoFactorData, setTwoFactorData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);

  // Avatar crop state
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 5 Mo');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarCropSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // Bank Mutations
  const addBankMutation = useMutation({
    mutationFn: authApi.addBankAccount,
    onSuccess: () => {
      toast.success('Compte bancaire ajouté !');
      refreshUser();
      setBankForm({ bankName: '', ribAccount: '', iceNumber: '' });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur lors de l\'ajout'),
  });

  const setDefaultBankMutation = useMutation({
    mutationFn: authApi.setDefaultBankAccount,
    onSuccess: () => {
      toast.success('Méthode par défaut mise à jour');
      refreshUser();
    },
    onError: () => toast.error('Erreur lors du changement'),
  });

  const deleteBankMutation = useMutation({
    mutationFn: authApi.deleteBankAccount,
    onSuccess: () => {
      toast.success('Compte supprimé');
      refreshUser();
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const [bankForm, setBankForm] = useState({
    bankName: '',
    ribAccount: '',
    iceNumber: '',
  });

  const handleBankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.bankName || !bankForm.ribAccount) return toast.error('Veuillez remplir les champs requis');
    if (bankForm.ribAccount.length !== 24) return toast.error('Le RIB doit contenir 24 chiffres');
    addBankMutation.mutate(bankForm);
  };

  const handleAvatarSave = async (croppedBlob: Blob) => {
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', croppedBlob, 'avatar.jpg');
      await api.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshUser();
      toast.success('Photo de profil mise à jour !');
      setAvatarCropSrc(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du téléchargement');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const socialPlatforms = [
    {
      id: 'instagramUsername',
      name: 'Instagram',
      icon: FaInstagram,
      connected: !!user?.instagramUsername,
      color: 'from-pink-500 to-purple-600',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600',
    },
    {
      id: 'tiktokUsername',
      name: 'TikTok',
      icon: FaTiktok,
      connected: !!user?.tiktokUsername,
      color: 'from-gray-800 to-gray-900',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-600',
    },
    {
      id: 'facebookUsername',
      name: 'Facebook',
      icon: FaFacebook,
      connected: !!user?.facebookUsername,
      color: 'from-blue-600 to-blue-700',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      id: 'xUsername',
      name: 'X (Twitter)',
      icon: FaXTwitter,
      connected: !!user?.xUsername,
      color: 'from-gray-700 to-gray-900',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-900',
    },
    {
      id: 'youtubeUsername',
      name: 'YouTube',
      icon: FaYoutube,
      connected: !!user?.youtubeUsername,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-500',
    },
    {
      id: 'snapchatUsername',
      name: 'Snapchat',
      icon: FaSnapchatGhost,
      connected: !!user?.snapchatUsername,
      color: 'from-yellow-400 to-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
  ];

  const handleSavePlatform = async (platformId: string) => {
    setSavingPlatform(platformId);
    try {
      const value = (profileForm as any)[platformId];
      await api.patch(`/users/${user?.uuid}`, { [platformId]: value });
      await refreshUser();
      toast.success('Lien mis à jour!');
      setEditingPlatform(null);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSavingPlatform(null);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/users/${user?.uuid}`, data),
    onSuccess: () => {
      toast.success('Profil mis à jour!');
      refreshUser();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: any) => api.post('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Mot de passe changé!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const setup2FAMutation = useMutation({
    mutationFn: authApi.setup2FA,
    onSuccess: (res) => {
      setTwoFactorData(res.data.data);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la configuration 2FA');
    },
  });

  const verify2FAMutation = useMutation({
    mutationFn: (data: { code: string; secret: string }) => authApi.verify2FA(data),
    onSuccess: () => {
      toast.success('L\'authentification à deux facteurs a été activée!');
      setTwoFactorData(null);
      setTwoFactorCode('');
      refreshUser();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Code de vérification invalide');
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: authApi.disable2FA,
    onSuccess: () => {
      toast.success('L\'authentification à deux facteurs a été désactivée');
      refreshUser();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la désactivation');
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const tabs = [
    { id: 'profile', label: 'Profil', icon: User, desc: 'Informations personnelles' },
    { id: 'payment', label: 'Paiement', icon: CreditCard, desc: 'Configurez comment vous recevez vos commissions.' },
    { id: 'password', label: 'Sécurité', icon: ShieldCheck, desc: 'Mots de passe et 2FA' },
    { id: 'kyc', label: 'Vérification KYC', icon: Shield, desc: 'Validation du compte' },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Préférences d\'emails' },
    { id: 'preferences', label: 'Préférences', icon: SettingsIcon, desc: 'Langue et région' },
  ];

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-gray-900 via-primary-900 to-gray-900 p-8 sm:p-12 mb-8 shadow-2xl">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3">
          <div className="w-96 h-96 bg-primary-500/30 rounded-full blur-3xl"></div>
        </div>
        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3">
          <div className="w-96 h-96 bg-accent-500/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <div className="w-28 h-28 bg-white/10 backdrop-blur-xl rounded-full border-2 border-white/20 flex items-center justify-center text-5xl text-white font-bold shadow-xl overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName || ''} className="w-full h-full object-cover" />
              ) : (
                profileForm.fullName?.charAt(0) || '?'
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarSelect}
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 translate-y-1/4 translate-x-1/4 bg-white text-gray-900 p-2.5 rounded-full shadow-lg hover:scale-110 hover:bg-gray-50 transition-all duration-300 disabled:opacity-50"
            >
              {uploadingAvatar ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            </button>
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
              Paramètres du Compte
            </h1>
            <p className="text-xl text-primary-100 font-medium opacity-90">
              Gérez vos préférences et sécurisez votre espace
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-3 sticky top-24">
            <nav className="space-y-1.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`w-full group flex items-start gap-4 p-4 rounded-xl text-left transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-br from-primary-50 to-primary-100/50 shadow-sm border border-primary-100/50'
                        : 'hover:bg-gray-50/80 border border-transparent'
                    }`}
                  >
                    <div className={`mt-0.5 p-2 rounded-lg transition-colors duration-300 ${
                      isActive ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700'
                    }`}>
                      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <div>
                      <div className={`font-semibold transition-colors duration-300 ${
                        isActive ? 'text-primary-900' : 'text-gray-700 group-hover:text-gray-900'
                      }`}>
                        {tab.label}
                      </div>
                      <div className={`text-xs mt-0.5 transition-colors duration-300 ${
                        isActive ? 'text-primary-700' : 'text-gray-500 group-hover:text-gray-600'
                      }`}>
                        {tab.desc}
                      </div>
                    </div>
                    {isActive && (
                      <ChevronRight size={16} className="ml-auto mt-2 text-primary-500" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-3xl border border-gray-100/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-500 ease-in-out">
            
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <User className="text-primary-500" size={28} />
                    Informations du profil
                  </h2>
                  <p className="text-gray-500 mt-1">Mettez à jour vos informations publiques et de contact.</p>
                </div>
                
                <form onSubmit={handleProfileSubmit} className="p-8 space-y-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <User size={16} className="text-gray-400" /> Nom complet
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200 text-gray-900 font-medium"
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" /> Email
                      </label>
                      <input
                        type="email"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200 text-gray-900 font-medium disabled:opacity-50"
                        value={profileForm.email}
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Phone size={16} className="text-gray-400" /> Téléphone
                      </label>
                      <input
                        type="tel"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200 text-gray-900 font-medium"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <MapPin size={16} className="text-gray-400" /> Ville
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200 text-gray-900 font-medium"
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                      <MapPin size={16} className="text-gray-400" /> Adresse Complète
                    </label>
                    <textarea
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200 text-gray-900 font-medium resize-none"
                      rows={3}
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    />
                  </div>
                  {/* Influencer Social Platforms Section */}
                  {user?.role === 'INFLUENCER' && (
                    <div className="pt-8 mt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-purple-50 rounded-xl">
                            <Globe className="text-purple-600" size={22} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Réseaux Sociaux</h3>
                            <p className="text-sm text-gray-500">Gérez vos plateformes d'influence connectées.</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {socialPlatforms.map((platform) => {
                          const isEditingThis = editingPlatform === platform.id;
                          const isSavingThis = savingPlatform === platform.id;
                          const username = (profileForm as any)[platform.id];

                          return (
                            <div key={platform.name} className={`flex flex-col gap-3 p-5 rounded-2xl border transition-all duration-300 ${
                              isEditingThis ? 'border-purple-200 bg-white ring-4 ring-purple-500/5 shadow-xl' : 'border-gray-100 bg-gray-50/50 hover:bg-white hover:border-gray-200'
                            }`}>
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center text-white shadow-md`}>
                                  <platform.icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-black text-gray-900 uppercase tracking-wider">{platform.name}</p>
                                    {platform.connected && !isEditingThis && (
                                      <span className="flex items-center gap-0.5 text-[8px] font-black text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                                        <CheckCircle className="w-2.5 h-2.5" />
                                        Vérifié
                                      </span>
                                    )}
                                  </div>
                                  {!isEditingThis && (
                                    <p className="text-sm font-bold text-gray-500 truncate">
                                      {username || 'Non configuré'}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {isEditingThis ? (
                                    <button
                                      type="button"
                                      onClick={() => handleSavePlatform(platform.id)}
                                      disabled={isSavingThis}
                                      className="p-2 bg-green-500 text-white rounded-lg shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all disabled:opacity-50"
                                    >
                                      {isSavingThis ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setEditingPlatform(platform.id)}
                                      className="p-2 bg-white text-gray-400 border border-gray-200 rounded-lg hover:text-purple-500 hover:border-purple-200 hover:shadow-md transition-all"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              {isEditingThis && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                  <input
                                    type="text"
                                    autoFocus
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-0 transition-all text-sm font-bold placeholder:text-gray-300"
                                    placeholder={`@username ou URL ${platform.name}`}
                                    value={username}
                                    onChange={(e) => setProfileForm({ ...profileForm, [platform.id]: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.preventDefault(); handleSavePlatform(platform.id); }
                                      if (e.key === 'Escape') setEditingPlatform(null);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-6 font-bold italic opacity-60">
                        * Tout changement de plateforme nécessite une nouvelle vérification manuelle par nos administrateurs.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-6 border-t border-gray-100">
                    <button
                      type="submit"
                      className="px-8 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold shadow-lg shadow-gray-900/20 transition-all duration-200 flex items-center gap-2"
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? 'Sauvegarde en cours...' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <CreditCard className="text-primary-500" size={28} />
                        Préférences de Paiement
                      </h2>
                      <p className="text-gray-500 mt-1">Gérez vos méthodes de réception de commissions.</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-8 space-y-10">
                  {/* Bank Accounts List */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Landmark size={20} className="text-gray-400" /> Vos comptes bancaires
                      </h3>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                        {user?.bankAccounts?.length || 0} Méthodes
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {user?.bankAccounts && user.bankAccounts.length > 0 ? (
                        user.bankAccounts.map((ba: any) => {
                          const isApproved = ba.status === 'APPROVED';
                          const isPending = ba.status === 'PENDING';
                          const isRejected = ba.status === 'REJECTED';
                          const isDefault = ba.isDefault;

                          return (
                            <div key={ba.id} className={`group relative p-6 rounded-3xl border-2 transition-all duration-300 ${
                              isDefault ? 'border-primary-500 bg-primary-50/30 shadow-lg shadow-primary-500/5' : 'border-gray-100 bg-white hover:border-gray-200'
                            }`}>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                <div className="flex items-start gap-5">
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${
                                    isApproved ? 'bg-emerald-500 text-white' : 
                                    isPending ? 'bg-amber-500 text-white' : 
                                    'bg-rose-500 text-white'
                                  }`}>
                                    <Building2 size={24} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-black text-gray-900 tracking-tight">{ba.bankName}</h4>
                                      {isDefault && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-600 text-white text-[9px] font-black uppercase tracking-tighter">
                                          <Star size={10} fill="currentColor" /> Par défaut
                                        </span>
                                      )}
                                      {!isDefault && isApproved && (
                                        <button 
                                          onClick={() => setDefaultBankMutation.mutate(ba.id)}
                                          className="text-[10px] font-bold text-primary-600 hover:underline"
                                        >
                                          Utiliser par défaut
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-sm font-mono font-bold text-gray-500 tracking-wider">
                                      {ba.ribAccount.replace(/(.{4})/g, '$1 ').trim()}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                                        isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                        isPending ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                                        'bg-rose-50 text-rose-700 border-rose-100'
                                      }`}>
                                        {isApproved ? <CheckCircle2 size={12} /> : isPending ? <Clock size={12} /> : <AlertTriangle size={12} />}
                                        {isApproved ? 'Approuvé' : isPending ? 'En attente' : 'Rejeté'}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {!isDefault && (
                                    <button 
                                      onClick={() => deleteBankMutation.mutate(ba.id)}
                                      className="p-3 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                                      title="Supprimer"
                                    >
                                      <Trash2 size={20} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center p-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                          <CreditCard className="mx-auto text-gray-300 mb-4" size={48} />
                          <p className="text-gray-500 font-bold">Aucune méthode de paiement configurée</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add New Bank Account Section */}
                  <div className="pt-10 border-t border-gray-100 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Plus size={20} className="text-primary-500" /> Ajouter un nouveau compte
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Toutes les nouvelles méthodes sont soumises à une vérification manuelle.</p>
                    </div>

                    <form onSubmit={handleBankSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-6 sm:p-8 rounded-3xl border border-gray-100">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                          Nom de la banque
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: CIH, BMCE, Attijari..."
                          className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-medium"
                          value={bankForm.bankName}
                          onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                          RIB Bancaire (24 chiffres)
                        </label>
                        <input
                          type="text"
                          maxLength={24}
                          placeholder="RIB à 24 chiffres"
                          className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-mono font-bold"
                          value={bankForm.ribAccount}
                          onChange={(e) => setBankForm({ ...bankForm, ribAccount: e.target.value.replace(/\D/g, '').slice(0, 24) })}
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={addBankMutation.isPending}
                          className="px-8 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {addBankMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                          Ajouter le compte
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'password' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <ShieldCheck className="text-primary-500" size={28} />
                    Sécurité et Connexion
                  </h2>
                  <p className="text-gray-500 mt-1">Gérez votre mot de passe et l'authentification à deux facteurs.</p>
                </div>

                <div className="p-8 space-y-12">
                  {/* Password Section */}
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <Lock className="text-gray-400" size={20} /> Changer le mot de passe
                    </h3>
                    <div className="space-y-6 max-w-2xl">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Mot de passe actuel</label>
                        <div className="relative group">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            required
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          >
                            {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Nouveau mot de passe</label>
                          <div className="relative group">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200"
                              value={passwordForm.newPassword}
                              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                              required
                              minLength={8}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Confirmer le mot de passe</label>
                          <div className="relative group">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200"
                              value={passwordForm.confirmPassword}
                              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                              required
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold shadow-md shadow-gray-900/10 transition-all duration-200"
                          disabled={changePasswordMutation.isPending}
                        >
                          {changePasswordMutation.isPending ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* 2FA Section */}
                  <div className="pt-10 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          Authentification à deux facteurs (2FA)
                          {user?.isTwoFactorEnabled ? (
                            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30 animate-pulse-slow">
                              <CheckCircle2 size={14} /> ACTIVÉ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-red-500/30">
                              <ShieldCheck size={14} /> DÉSACTIVÉ
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Ajoute une sécurité supplémentaire à votre compte.</p>
                      </div>
                    </div>
                    
                    {user?.isTwoFactorEnabled && (
                      <div className="bg-gradient-to-br from-emerald-50 via-white to-white border-2 border-emerald-100 rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl shadow-emerald-500/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-emerald-100/20 rounded-full blur-3xl"></div>
                        
                        <div className="flex items-center gap-6 relative z-10">
                          <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <ShieldCheck size={32} />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-xl tracking-tight">Sécurité maximale active</p>
                            <p className="text-sm text-gray-500 mt-1 max-w-md leading-relaxed">
                              Votre compte est protégé par l'authentification à deux facteurs. Votre espace est entièrement sécurisé.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 relative z-10">
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Protection Active</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={true}
                                    onChange={() => {
                                        if (confirm('Voulez-vous vraiment désactiver l\'authentification à deux facteurs ? Cela réduira la sécurité de votre compte.')) {
                                            disable2FAMutation.mutate();
                                        }
                                    }}
                                    className="sr-only peer"
                                    disabled={disable2FAMutation.isPending}
                                />
                                <div className="w-14 h-7 bg-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all shadow-lg shadow-emerald-500/20"></div>
                            </label>
                        </div>
                      </div>
                    )}
                    
                    {!user?.isTwoFactorEnabled && !twoFactorData && (
                      <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center shrink-0">
                            <ShieldCheck size={24} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-base">Protéger votre espace</p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              Utilisez Google Authenticator pour générer un code unique à chaque connexion.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setup2FAMutation.mutate()}
                          disabled={setup2FAMutation.isPending}
                          className="px-6 py-2.5 bg-white border-2 border-primary-600 text-primary-600 hover:bg-primary-50 rounded-xl font-bold transition-colors whitespace-nowrap shrink-0"
                        >
                          {setup2FAMutation.isPending ? 'Chargement...' : 'Configurer 2FA'}
                        </button>
                      </div>
                    )}

                    {twoFactorData && (
                      <div className="bg-gradient-to-br from-primary-50 via-white to-primary-50/30 rounded-3xl p-8 border border-primary-100 shadow-xl shadow-primary-500/5">
                        <div className="grid lg:grid-cols-2 gap-12">
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center">1</div>
                              <h4 className="text-lg font-bold text-gray-900">Scanner le QR Code</h4>
                            </div>
                            <p className="text-gray-600">
                              Ouvrez votre application d'authentification (comme Google Authenticator ou Authy) et scannez ce code.
                            </p>
                            <div className="bg-white p-4 rounded-2xl inline-block border border-gray-100 shadow-sm mx-auto">
                              <img src={twoFactorData.qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                            </div>
                            <div className="bg-white/60 p-4 rounded-xl border border-gray-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Code secret manuel</p>
                              <code className="text-sm font-mono text-gray-900 bg-gray-100/80 px-2 py-1 rounded">
                                {twoFactorData.secret}
                              </code>
                            </div>
                          </div>
                          
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center">2</div>
                              <h4 className="text-lg font-bold text-gray-900">Vérifier et Activer</h4>
                            </div>
                            <p className="text-gray-600">
                              Entrez le code à 6 chiffres généré par l'application pour confirmer l'association.
                            </p>
                            <div className="space-y-4 pt-4">
                              <input
                                type="text"
                                placeholder="000 000"
                                maxLength={6}
                                value={twoFactorCode}
                                onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full px-6 py-4 bg-white border-2 border-gray-200 focus:border-primary-500 rounded-2xl font-mono text-3xl tracking-[0.5em] text-center text-gray-900 shadow-sm transition-colors"
                              />
                              <button
                                onClick={() => verify2FAMutation.mutate({ code: twoFactorCode, secret: twoFactorData.secret })}
                                disabled={twoFactorCode.length !== 6 || verify2FAMutation.isPending}
                                className="w-full px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-600/30 transition-all duration-200 disabled:opacity-50 disabled:shadow-none text-lg"
                              >
                                {verify2FAMutation.isPending ? 'Vérification en cours...' : 'Activer la double authentification'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sessions */}
                  <div className="pt-10 border-t border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <MonitorSmartphone className="text-gray-400" size={20} /> Appareils connectés
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                            <MonitorSmartphone size={24} />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">Cette session</div>
                            <div className="text-sm text-gray-500 font-medium mt-0.5">Dernière activité à l'instant • Rabat, Maroc</div>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wide">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* KYC Tab */}
            {activeTab === 'kyc' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Shield className="text-primary-500" size={28} />
                    Vérification du profil (KYC)
                  </h2>
                  <p className="text-gray-500 mt-1">Complétez les étapes ci-dessous pour valider votre compte.</p>
                </div>
                
                <div className="p-4 sm:p-8">
                  <ProfileVerification hideHeader={true} />
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Bell className="text-primary-500" size={28} />
                    Préférences de notification
                  </h2>
                  <p className="text-gray-500 mt-1">Choisissez comment et quand vous souhaitez être contacté.</p>
                </div>
                
                <div className="p-8">
                  <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 shadow-sm overflow-hidden">
                    {[
                      { key: 'emailOrders', label: 'Emails de Commandes', desc: 'Recevoir une alerte pour chaque nouvelle commande validée' },
                      { key: 'emailPayouts', label: 'Emails de Paiements', desc: 'Être notifié lorsqu\'un virement est émis vers votre compte' },
                      { key: 'smsOrders', label: 'Alertes SMS urgentes', desc: 'Recevoir un SMS pour les anomalies de commandes' },
                      { key: 'whatsappOrders', label: 'Mises à jour WhatsApp', desc: 'Recevoir le suivi quotidien de vos colis via WhatsApp' },
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-center justify-between p-6 hover:bg-gray-50/50 transition-colors">
                        <div className="pr-8">
                          <div className="font-bold text-gray-900 text-base">{setting.label}</div>
                          <div className="text-sm text-gray-500 mt-1 leading-relaxed">{setting.desc}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={notificationSettings[setting.key as keyof typeof notificationSettings]}
                            onChange={(e) => setNotificationSettings({
                              ...notificationSettings,
                              [setting.key]: e.target.checked,
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary-500 shadow-inner"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <SettingsIcon className="text-primary-500" size={28} />
                    Préférences générales
                  </h2>
                  <p className="text-gray-500 mt-1">Configurez l'interface selon vos besoins.</p>
                </div>
                
                <div className="p-8 space-y-8 max-w-2xl">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Langue de l'interface</label>
                    <select
                      className="w-full px-4 py-3 rounded-xl border-gray-200 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-medium text-gray-900 shadow-sm"
                      value={profileForm.language}
                      onChange={(e) => setProfileForm({ ...profileForm, language: e.target.value })}
                    >
                      <option value="fr">🇫🇷 Français</option>
                      <option value="ar">🇲🇦 العربية</option>
                      <option value="en">🇬🇧 English</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Devise d'affichage</label>
                    <select className="w-full px-4 py-3 rounded-xl border-gray-200 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-medium text-gray-900 shadow-sm" defaultValue="MAD">
                      <option value="MAD">MAD - Dirham marocain</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="USD">USD - Dollar américain</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-2">Cette devise sera utilisée à titre indicatif sur les tableaux de bord.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Fuseau horaire</label>
                    <select className="w-full px-4 py-3 rounded-xl border-gray-200 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-medium text-gray-900 shadow-sm" defaultValue="Africa/Casablanca">
                      <option value="Africa/Casablanca">(GMT+01:00) Casablanca</option>
                      <option value="Europe/Paris">(GMT+01:00) Paris</option>
                      <option value="UTC">(GMT+00:00) UTC</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Avatar Crop Modal */}
      {avatarCropSrc && (
        <AvatarCropModal
          imageSrc={avatarCropSrc}
          onClose={() => setAvatarCropSrc(null)}
          onSave={handleAvatarSave}
        />
      )}
    </div>
  );
}
