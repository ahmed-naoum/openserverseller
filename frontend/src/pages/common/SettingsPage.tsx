import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, authApi, BACKEND_URL } from '../../lib/api';
import { CitySelect } from '../../components/ui/CitySelect';
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
import BankSelect from '../../components/common/BankSelect';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');

  const [theme, setTheme] = useState<'classic' | 'girly' | 'princess'>(() => {
    return (localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly';
  });

  const changeTheme = (next: 'classic' | 'girly' | 'princess') => {
    setTheme(next);
    localStorage.setItem('agent-theme', next);
    window.dispatchEvent(new Event('agent-theme-change'));
  };

  useEffect(() => {
    const syncTheme = () => {
      const current = (localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly';
      setTheme(current);
    };
    window.addEventListener('agent-theme-change', syncTheme);
    return () => window.removeEventListener('agent-theme-change', syncTheme);
  }, []);

  const isClassic = theme === 'classic';
  const isGirly = theme === 'girly';
  const isPrincess = theme === 'princess';

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

  // Bank OTP verification states
  const [bankOtpStep, setBankOtpStep] = useState<'idle' | 'sending' | 'verify'>('idle');
  const [bankOtpValue, setBankOtpValue] = useState('');
  const [bankOtpMaskedEmail, setBankOtpMaskedEmail] = useState('');
  const [bankOtpLoading, setBankOtpLoading] = useState(false);

  const handleSetDefaultBank = async (id: number) => {
    try {
      await authApi.setDefaultBankAccount(id);
      toast.success('Méthode par défaut mise à jour');
      refreshUser();
    } catch { toast.error('Erreur lors du changement'); }
  };

  // Delete bank account confirmation modal state
  const [deleteBankConfirm, setDeleteBankConfirm] = useState<{
    isOpen: boolean;
    bankAccountId: number | null;
    password: string;
    loading: boolean;
  }>({
    isOpen: false,
    bankAccountId: null,
    password: '',
    loading: false
  });

  const handleDeleteBankClick = (id: number) => {
    setDeleteBankConfirm({
      isOpen: true,
      bankAccountId: id,
      password: '',
      loading: false
    });
  };

  const handleConfirmDeleteBank = async () => {
    if (!deleteBankConfirm.bankAccountId) return;
    if (!deleteBankConfirm.password) {
      toast.error('Veuillez saisir votre mot de passe');
      return;
    }

    setDeleteBankConfirm(prev => ({ ...prev, loading: true }));
    try {
      await authApi.deleteBankAccount(deleteBankConfirm.bankAccountId, deleteBankConfirm.password);
      toast.success('Compte supprimé avec succès');
      setDeleteBankConfirm({
        isOpen: false,
        bankAccountId: null,
        password: '',
        loading: false
      });
      refreshUser();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Erreur lors de la suppression';
      toast.error(errorMsg);
      setDeleteBankConfirm(prev => ({ ...prev, loading: false }));
    }
  };

  const [bankForm, setBankForm] = useState({
    bankName: '',
    ribAccount: '',
    iceNumber: '',
  });

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.bankName || !bankForm.ribAccount) return toast.error('Veuillez remplir les champs requis');
    if (bankForm.ribAccount.length !== 24) return toast.error('Le RIB doit contenir 24 chiffres');

    // Step 1: Send OTP
    setBankOtpStep('sending');
    setBankOtpLoading(true);
    try {
      const res = await authApi.sendBankOtp(bankForm);
      const maskedEmail = res.data?.data?.maskedEmail || res.data?.maskedEmail || '***';
      setBankOtpMaskedEmail(maskedEmail);
      setBankOtpValue('');
      setBankOtpStep('verify');
      toast.success('Code de vérification envoyé !');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de l\'envoi du code');
      setBankOtpStep('idle');
    } finally {
      setBankOtpLoading(false);
    }
  };

  const handleBankOtpVerify = async () => {
    if (bankOtpValue.length !== 6) return;
    setBankOtpLoading(true);
    try {
      await authApi.verifyBankOtp(bankOtpValue);
      toast.success('Compte bancaire ajouté avec succès !');
      refreshUser();
      setBankForm({ bankName: '', ribAccount: '', iceNumber: '' });
      setBankOtpStep('idle');
      setBankOtpValue('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Code incorrect ou expiré');
    } finally {
      setBankOtpLoading(false);
    }
  };

  // Subdomain states & handlers
  const [isEditingSubdomain, setIsEditingSubdomain] = useState(false);
  const [newSubdomain, setNewSubdomain] = useState(user?.subdomain || '');
  const [subdomainOtpStep, setSubdomainOtpStep] = useState<'idle' | 'sending' | 'verify'>('idle');
  const [subdomainOtpValue, setSubdomainOtpValue] = useState('');
  const [subdomainLoading, setSubdomainLoading] = useState(false);

  useEffect(() => {
    if (user?.subdomain) {
      setNewSubdomain(user.subdomain);
    }
  }, [user]);

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
    { id: 'profile', label: t('settings_tab_profile', 'dashboard'), icon: User, desc: t('settings_tab_profile_desc', 'dashboard') },
    { id: 'payment', label: t('settings_tab_payment', 'dashboard'), icon: CreditCard, desc: t('settings_tab_payment_desc', 'dashboard') },
    { id: 'password', label: t('settings_tab_security', 'dashboard'), icon: ShieldCheck, desc: t('settings_tab_security_desc', 'dashboard') }
  ];

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-primary-900 to-gray-900 p-6 sm:p-8 mb-6 shadow-xl">
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
          <div className={`text-center ${isRtl ? 'md:text-right' : 'md:text-left'}`}>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
              {t('settings_title', 'dashboard')}
            </h1>
            <p className="text-xl text-primary-100 font-medium opacity-90">
              {t('settings_subtitle', 'dashboard')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-gray-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-2 sticky top-24">
            <nav className="space-y-1.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`w-full group flex items-start gap-4 p-4 rounded-xl transition-all duration-300 ${isRtl ? 'text-right' : 'text-left'} ${
                      isActive
                        ? (isPrincess ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 shadow-sm border border-amber-100/50' : isGirly ? 'bg-gradient-to-br from-pink-50 to-pink-100/50 shadow-sm border border-pink-100/50' : 'bg-gradient-to-br from-primary-50 to-primary-100/50 shadow-sm border border-primary-100/50')
                        : 'hover:bg-gray-50/80 border border-transparent'
                    }`}
                  >
                    <div className={`mt-0.5 p-2 rounded-lg transition-colors duration-300 ${
                      isActive 
                        ? (isPrincess ? 'bg-amber-600 text-white shadow-md' : isGirly ? 'bg-pink-600 text-white shadow-md' : 'bg-primary-600 text-white shadow-md') 
                        : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700'
                    }`}>
                      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <div>
                      <div className={`font-semibold transition-colors duration-300 ${
                        isActive 
                          ? (isPrincess ? 'text-amber-900 font-bold' : isGirly ? 'text-pink-900' : 'text-primary-900') 
                          : 'text-gray-700 group-hover:text-gray-900'
                      }`}>
                        {tab.label}
                      </div>
                      <div className={`text-xs mt-0.5 transition-colors duration-300 ${
                        isActive 
                          ? (isPrincess ? 'text-amber-700' : isGirly ? 'text-pink-700' : 'text-primary-700') 
                          : 'text-gray-500 group-hover:text-gray-600'
                      }`}>
                        {tab.desc}
                      </div>
                    </div>
                    {isActive && (
                      <ChevronRight size={16} className={`mt-2 ${isRtl ? 'mr-auto rotate-180' : 'ml-auto'} ${isPrincess ? 'text-amber-500' : isGirly ? 'text-pink-500' : 'text-primary-500'}`} />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-100/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-500 ease-in-out">
            
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <User className={isPrincess ? 'text-amber-500' : isGirly ? 'text-pink-500' : 'text-primary-500'} size={28} />
                    {t('profile_info_title', 'dashboard')}
                  </h2>
                  <p className="text-gray-500 mt-1">{t('profile_info_desc', 'dashboard')}</p>
                </div>
                
                <form onSubmit={handleProfileSubmit} className="p-6 space-y-6">

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <User size={16} className="text-gray-400" /> {t('full_name', 'dashboard')}
                      </label>
                      <input
                        type="text"
                        className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-4 transition-all duration-200 text-gray-900 font-medium ${
                          isPrincess ? 'focus:border-amber-500 focus:ring-amber-500/10' : isGirly ? 'focus:border-pink-500 focus:ring-pink-500/10' : 'focus:border-primary-500 focus:ring-primary-500/10'
                        }`}
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" /> {t('email', 'dashboard')}
                      </label>
                      <input
                        type="email"
                        className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-4 transition-all duration-200 text-gray-900 font-medium disabled:opacity-50 ${
                          isPrincess ? 'focus:border-amber-500 focus:ring-amber-500/10' : isGirly ? 'focus:border-pink-500 focus:ring-pink-500/10' : 'focus:border-primary-500 focus:ring-primary-500/10'
                        }`}
                        value={profileForm.email}
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <Phone size={16} className="text-gray-400" /> {t('phone', 'dashboard')}
                      </label>
                      <input
                        type="tel"
                        className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-4 transition-all duration-200 text-gray-900 font-medium ${
                          isPrincess ? 'focus:border-amber-500 focus:ring-amber-500/10' : isGirly ? 'focus:border-pink-500 focus:ring-pink-500/10' : 'focus:border-primary-500 focus:ring-primary-500/10'
                        }`}
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <MapPin size={16} className="text-gray-400" /> {t('city', 'dashboard')}
                      </label>
                      {/* Full catalogue, not just deliverable cities — a user's
                          home city is unrelated to Coliaty's coverage. */}
                      <CitySelect
                        value={profileForm.city}
                        onChange={(name) => setProfileForm({ ...profileForm, city: name })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                      <MapPin size={16} className="text-gray-400" /> {t('address', 'dashboard')}
                    </label>
                    <textarea
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200 text-gray-900 font-medium resize-none"
                      rows={3}
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    />
                  </div>

                  {/* Influencer Custom Subdomain Section */}
                  {user?.role === 'INFLUENCER' && (
                    <div className="pt-8 mt-4 border-t border-gray-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-primary-50 rounded-xl text-primary-600">
                            <Globe size={22} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{t('settings_subdomain_title', 'dashboard')}</h3>
                            <p className="text-sm text-gray-500">{t('settings_subdomain_desc', 'dashboard')}</p>
                          </div>
                        </div>
                        {!isEditingSubdomain && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingSubdomain(true);
                              setNewSubdomain(user?.subdomain || '');
                              setSubdomainOtpStep('idle');
                            }}
                            className={`px-4 py-2 border rounded-xl font-semibold text-sm transition-all duration-200 hover:shadow-md ${
                              isPrincess 
                                ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/50' 
                                : isGirly 
                                ? 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100/50' 
                                : 'bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100/50'
                            }`}
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
                                    title={t('settings_subdomain_input_title', 'dashboard')}
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
                                <p className="text-[10.5px] text-gray-400 font-medium">
                                  {t('settings_subdomain_allowed_chars', 'dashboard')}<span className="font-mono text-gray-600 bg-gray-100 px-1 py-0.5 rounded">seller</span>.
                                </p>
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
                                  className={`px-5 py-2 text-white rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 hover:shadow-lg ${
                                    isPrincess 
                                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/10' 
                                      : isGirly 
                                      ? 'bg-pink-600 hover:bg-pink-700 shadow-pink-600/10' 
                                      : 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/10'
                                  }`}
                                >
                                  {subdomainLoading && <RefreshCw size={14} className="animate-spin" />}
                                  {t('settings_subdomain_send_code', 'dashboard')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="p-4 bg-primary-50 rounded-xl border border-primary-100 text-sm text-primary-800 flex items-start gap-3">
                                <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-bold">{t('settings_subdomain_otp_required', 'dashboard')}</p>
                                  <p className="mt-0.5">{t('settings_subdomain_otp_sent_to_email', 'dashboard')} <span className="font-mono font-bold bg-primary-100 px-1 rounded">{newSubdomain}</span>.</p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                                  {t('settings_subdomain_otp_input_label', 'dashboard')}
                                </label>
                                <input
                                  type="text"
                                  maxLength={6}
                                  pattern="^[0-9]{6}$"
                                  placeholder="000000"
                                  disabled={subdomainLoading}
                                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center font-mono text-2xl font-bold tracking-widest text-gray-900 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all duration-200"
                                  value={subdomainOtpValue}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    setSubdomainOtpValue(val);
                                    if (val.length === 6 && !subdomainLoading) {
                                      setSubdomainLoading(true);
                                      authApi.verifySubdomainOtp(newSubdomain, val)
                                        .then(async () => {
                                          toast.success(t('settings_subdomain_success_toast', 'dashboard'));
                                          await refreshUser();
                                          setIsEditingSubdomain(false);
                                          setSubdomainOtpStep('idle');
                                          setSubdomainOtpValue('');
                                        })
                                        .catch((err: any) => {
                                          toast.error(err?.response?.data?.message || err?.response?.data?.error || t('settings_subdomain_invalid_otp_toast', 'dashboard'));
                                        })
                                        .finally(() => {
                                          setSubdomainLoading(false);
                                        });
                                    }
                                  }}
                                />
                              </div>

                              <div className="flex gap-3 justify-between items-center">
                                <button
                                  type="button"
                                  disabled={subdomainLoading}
                                  onClick={() => setSubdomainOtpStep('idle')}
                                  className="text-xs font-bold text-primary-600 hover:underline disabled:opacity-50"
                                >
                                  {t('settings_subdomain_edit_typed', 'dashboard')}
                                </button>
                                <div className="flex gap-3">
                                  <button
                                    type="button"
                                    disabled={subdomainLoading}
                                    onClick={() => {
                                      setIsEditingSubdomain(false);
                                      setSubdomainOtpStep('idle');
                                    }}
                                    className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold text-sm transition-all"
                                  >
                                    {t('settings_subdomain_cancel', 'dashboard')}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={subdomainLoading || subdomainOtpValue.length !== 6}
                                    onClick={handleSubdomainOtpVerify}
                                    className={`px-5 py-2 text-white rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 hover:shadow-lg ${
                                      isPrincess 
                                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/10' 
                                        : isGirly 
                                        ? 'bg-pink-600 hover:bg-pink-700 shadow-pink-600/10' 
                                        : 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/10'
                                    } disabled:opacity-50`}
                                  >
                                    {subdomainLoading && <RefreshCw size={14} className="animate-spin" />}
                                    {t('settings_subdomain_verify_confirm', 'dashboard')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Influencer Social Platforms Section */}
                  {user?.role === 'INFLUENCER' && (
                    <div className="pt-8 mt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-purple-50 rounded-xl">
                            <Globe className="text-purple-600" size={22} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{t('social_networks', 'dashboard')}</h3>
                            <p className="text-sm text-gray-500">{t('social_networks_desc', 'dashboard')}</p>
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
                                        {t('verified', 'dashboard')}
                                      </span>
                                    )}
                                  </div>
                                  {!isEditingThis && (
                                    <p className="text-sm font-bold text-gray-500 truncate">
                                      {username || t('not_configured', 'dashboard')}
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
                        {t('social_warn', 'dashboard')}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-6 border-t border-gray-100">
                    <button
                      type="submit"
                      className="px-8 py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold shadow-lg shadow-gray-900/20 transition-all duration-200 flex items-center gap-2"
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? t('saving', 'dashboard') : t('save_changes', 'dashboard')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <CreditCard className="text-primary-500" size={28} />
                        {t('payout_title', 'dashboard')}
                      </h2>
                      <p className="text-gray-500 mt-1">{t('payout_subtitle', 'dashboard')}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Bank Accounts List */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Landmark size={20} className="text-gray-400" /> {t('bank_accounts', 'dashboard')}
                      </h3>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                        {t('methods_count', 'dashboard').replace('{count}', String(user?.bankAccounts?.length || 0))}
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
                            <div key={ba.id} className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 ${
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
                                          <Star size={10} fill="currentColor" /> {t('default_method', 'dashboard')}
                                        </span>
                                      )}
                                      {!isDefault && isApproved && (
                                        <button 
                                          onClick={() => handleSetDefaultBank(ba.id)}
                                          className="text-[10px] font-bold text-primary-600 hover:underline"
                                        >
                                          {t('use_default', 'dashboard')}
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
                                        {isApproved ? t('approved', 'dashboard') : isPending ? t('pending', 'dashboard') : t('rejected', 'dashboard')}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {!isDefault && (
                                    <button 
                                      onClick={() => handleDeleteBankClick(ba.id)}
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
                        <div className="text-center p-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                          <CreditCard className="mx-auto text-gray-300 mb-4" size={48} />
                          <p className="text-gray-500 font-bold">{t('no_payment_configured', 'dashboard')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add New Bank Account Section */}
                  <div className="pt-10 border-t border-gray-100 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Plus size={20} className="text-primary-500" /> {t('add_bank_account', 'dashboard')}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">{t('bank_manual_warn', 'dashboard')}</p>
                    </div>

                    <form onSubmit={handleBankSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-6 sm:p-8 rounded-2xl border border-gray-100">
                      <div className="md:col-span-2 space-y-3">
                        <BankSelect 
                          value={bankForm.bankName} 
                          onChange={(name) => setBankForm({ ...bankForm, bankName: name })} 
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                          {t('rib_label', 'dashboard')}
                        </label>
                        <input
                          type="text"
                          maxLength={24}
                          placeholder={t('rib_placeholder', 'dashboard')}
                          className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-mono font-bold"
                          value={bankForm.ribAccount}
                          onChange={(e) => setBankForm({ ...bankForm, ribAccount: e.target.value.replace(/\D/g, '').slice(0, 24) })}
                        />
                      </div>
                      <div className="md:col-span-2 flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={bankOtpLoading || bankOtpStep === 'verify'}
                          className="px-8 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {bankOtpLoading && bankOtpStep === 'sending' ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                          {t('send_verification_code', 'dashboard')}
                        </button>
                      </div>
                    </form>

                    {/* OTP Verification Step */}
                    {bankOtpStep === 'verify' && (
                      <div className="mt-6 p-6 sm:p-8 bg-blue-50/50 rounded-2xl border-2 border-blue-100 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                            <Mail size={28} className="text-blue-600" />
                          </div>
                          <h3 className="text-lg font-black text-gray-900">{t('email_verification', 'dashboard')}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {t('otp_sent_to', 'dashboard').replace('{email}', bankOtpMaskedEmail)}
                          </p>
                        </div>

                        <div className="flex justify-center gap-2 mb-4">
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <input
                              key={i}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              className="w-12 h-14 bg-white border-2 border-gray-200 rounded-xl text-center text-xl font-black text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                              value={bankOtpValue[i] || ''}
                              autoFocus={i === 0}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                if (!val && e.target.value) return;
                                const newValue = bankOtpValue.split('');
                                newValue[i] = val;
                                const joined = newValue.join('').slice(0, 6);
                                setBankOtpValue(joined);
                                if (val && i < 5) {
                                  const next = e.target.parentElement?.children[i + 1] as HTMLInputElement;
                                  next?.focus();
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !bankOtpValue[i] && i > 0) {
                                  const prev = (e.target as HTMLElement).parentElement?.children[i - 1] as HTMLInputElement;
                                  prev?.focus();
                                }
                              }}
                              onPaste={(e) => {
                                e.preventDefault();
                                const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                                setBankOtpValue(pasted);
                                const target = (e.target as HTMLElement).parentElement?.children[Math.min(pasted.length, 5)] as HTMLInputElement;
                                target?.focus();
                              }}
                            />
                          ))}
                        </div>

                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center mb-6">
                          {t('otp_expire', 'dashboard')}
                        </p>

                        <div className="flex gap-3 justify-center">
                          <button
                            onClick={() => { setBankOtpStep('idle'); setBankOtpValue(''); }}
                            className="px-6 py-3 bg-white border border-gray-200 text-gray-500 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
                          >
                            {t('cancel', 'dashboard')}
                          </button>
                          <button
                            onClick={handleBankOtpVerify}
                            disabled={bankOtpValue.length !== 6 || bankOtpLoading}
                            className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            {bankOtpLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            {t('confirm_add', 'dashboard')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'password' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <ShieldCheck className="text-primary-500" size={28} />
                    {t('security_conn', 'dashboard')}
                  </h2>
                  <p className="text-gray-500 mt-1">{t('security_desc', 'dashboard')}</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Password Section */}
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <Lock className="text-gray-400" size={20} /> {t('change_pwd', 'dashboard')}
                    </h3>
                    <div className="space-y-6 max-w-2xl">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t('current_pwd', 'dashboard')}</label>
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
                          <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t('new_pwd', 'dashboard')}</label>
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
                          <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{t('confirm_pwd', 'dashboard')}</label>
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
                          {changePasswordMutation.isPending ? t('updating', 'dashboard') : t('update_pwd', 'dashboard')}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* 2FA Section */}
                  <div className="pt-10 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          {t('two_factor', 'dashboard')}
                          {user?.isTwoFactorEnabled ? (
                            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30 animate-pulse-slow">
                              <CheckCircle2 size={14} /> {t('two_factor_enabled', 'dashboard')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-red-500/30">
                              <ShieldCheck size={14} /> {t('two_factor_disabled', 'dashboard')}
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{t('two_factor_desc', 'dashboard')}</p>
                      </div>
                    </div>
                    
                    {user?.isTwoFactorEnabled && (
                      <div className="bg-gradient-to-br from-emerald-50 via-white to-white border-2 border-emerald-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl shadow-emerald-500/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-emerald-100/20 rounded-full blur-3xl"></div>
                        
                        <div className="flex items-center gap-6 relative z-10">
                          <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <ShieldCheck size={32} />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-xl tracking-tight">{t('max_security_active', 'dashboard')}</p>
                            <p className="text-sm text-gray-500 mt-1 max-w-md leading-relaxed">
                              {t('max_security_desc', 'dashboard')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 relative z-10">
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{t('active_protection', 'dashboard')}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={true}
                                    onChange={() => {
                                        if (confirm(t('disable_2fa_confirm', 'dashboard'))) {
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
                            <p className="font-semibold text-gray-900 text-base">{t('protect_space', 'dashboard')}</p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {t('protect_space_desc', 'dashboard')}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setup2FAMutation.mutate()}
                          disabled={setup2FAMutation.isPending}
                          className="px-6 py-2.5 bg-white border-2 border-primary-600 text-primary-600 hover:bg-primary-50 rounded-xl font-bold transition-colors whitespace-nowrap shrink-0"
                        >
                          {setup2FAMutation.isPending ? t('loading', 'dashboard') : t('configure_2fa', 'dashboard')}
                        </button>
                      </div>
                    )}

                    {twoFactorData && (
                      <div className="bg-gradient-to-br from-primary-50 via-white to-primary-50/30 rounded-2xl p-8 border border-primary-100 shadow-xl shadow-primary-500/5">
                        <div className="grid lg:grid-cols-2 gap-12">
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center">1</div>
                              <h4 className="text-lg font-bold text-gray-900">{t('scan_qr', 'dashboard')}</h4>
                            </div>
                            <p className="text-gray-600">
                              {t('scan_qr_desc', 'dashboard')}
                            </p>
                            <div className="bg-white p-4 rounded-2xl inline-block border border-gray-100 shadow-sm mx-auto">
                              <img src={twoFactorData.qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                            </div>
                            <div className="bg-white/60 p-4 rounded-xl border border-gray-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t('manual_code', 'dashboard')}</p>
                              <code className="text-sm font-mono text-gray-900 bg-gray-100/80 px-2 py-1 rounded">
                                {twoFactorData.secret}
                              </code>
                            </div>
                          </div>
                          
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center">2</div>
                              <h4 className="text-lg font-bold text-gray-900">{t('verify_activate', 'dashboard')}</h4>
                            </div>
                            <p className="text-gray-600">
                              {t('verify_activate_desc', 'dashboard')}
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
                                {verify2FAMutation.isPending ? t('verifying', 'dashboard') : t('activate_2fa', 'dashboard')}
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
                      <MonitorSmartphone className="text-gray-400" size={20} /> {t('connected_devices', 'dashboard')}
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                            <MonitorSmartphone size={24} />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{t('this_session', 'dashboard')}</div>
                            <div className="text-sm text-gray-500 font-medium mt-0.5">{t('last_active_now', 'dashboard')}</div>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wide">
                          {t('active', 'dashboard')}
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
                    
                  </h2>
                  <p className="text-gray-500 mt-1"></p>
                </div>
                
                <div className="p-4 sm:p-8">
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

      {/* Delete Bank Account Password Confirmation Modal */}
      {deleteBankConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white border border-slate-200/60 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Top accent */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500" />
            
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 flex-shrink-0">
                  <AlertCircle size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{t('delete_payment_method', 'dashboard')}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {t('delete_payment_desc', 'dashboard')}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    {t('password', 'dashboard')}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder={t('enter_password_placeholder', 'dashboard')}
                      className="w-full bg-slate-50 border border-slate-200/60 rounded-xl pl-4 pr-10 py-3 text-xs font-semibold focus:outline-none focus:border-rose-500/50 focus:bg-white focus:ring-2 focus:ring-rose-500/5 transition-all text-slate-700"
                      value={deleteBankConfirm.password}
                      onChange={(e) => setDeleteBankConfirm(prev => ({ ...prev, password: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleConfirmDeleteBank();
                        }
                      }}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock size={15} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteBankConfirm({ isOpen: false, bankAccountId: null, password: '', loading: false })}
                  className="flex-1 px-4 py-3 bg-slate-50 text-slate-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95"
                >
                  {t('cancel', 'dashboard')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteBank}
                  disabled={deleteBankConfirm.loading || !deleteBankConfirm.password}
                  className="flex-[2] bg-rose-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-700 shadow-md hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {deleteBankConfirm.loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t('deleting', 'dashboard')}
                    </>
                  ) : (
                    t('confirm_delete', 'dashboard')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
