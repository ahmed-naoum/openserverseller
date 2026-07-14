import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { User, Mail, Phone, Store, Sparkles, Link as LinkIcon, Check } from 'lucide-react';
import { FaTiktok, FaFacebook, FaInstagram, FaSnapchatGhost, FaYoutube } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import LanguageSwitcherWidget from '../../components/common/LanguageSwitcherWidget';
import CguModal from '../../components/auth/CguModal';

const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-]/g, '');
  if (cleaned.startsWith('+212')) return cleaned;
  if (/^[5678][0-9]{8}$/.test(cleaned)) return '+212' + cleaned;
  if (/^0[5678][0-9]{8}$/.test(cleaned)) return '+212' + cleaned.slice(1);
  return phone;
};

const translations = {
  fr: {
    title: "Compléter votre inscription",
    subtitle: "Remplissez les détails restants pour finaliser votre compte Google",
    im_an_influencer: "Je suis un Influenceur",
    im_a_seller: "Je suis un Vendeur",
    full_name_label: "Nom complet",
    phone_label: "Numéro de téléphone",
    phone_placeholder: "0612345678 ou +212612345678",
    cgu_label: "J'accepte les Conditions Générales d'Utilisation (CGU)",
    cgu_error: "Veuillez accepter les CGU pour continuer",
    submit_btn: "Finaliser mon inscription",
    submitting: "Création du compte...",
    success: "Compte créé avec succès !",
    social_section: "Vos Réseaux Sociaux",
    social_tip: "Indiquez vos pseudonymes de réseaux sociaux (sans le symbole @)",
    phone_invalid: "Format de téléphone marocain invalide",
    name_required: "Nom complet requis",
    phone_required: "Téléphone requis",
  },
  ar: {
    title: "إكمال عملية التسجيل",
    subtitle: "يرجى ملء البيانات المتبقية لإنهء حساب Google الخاص بك",
    im_an_influencer: "أنا مؤثر",
    im_a_seller: "أنا بائع",
    full_name_label: "الاسم الكامل",
    phone_label: "رقم الهاتف",
    phone_placeholder: "0612345678 أو +212612345678",
    cgu_label: "أوافق على الشروط العامة للاستخدام",
    cgu_error: "يرجى قبول الشروط العامة للاستخدام للمتابعة",
    submit_btn: "إنهاء التسجيل",
    submitting: "جاري إنشاء الحساب...",
    success: "تم إنشاء الحساب بنجاح!",
    social_section: "حسابات التواصل الاجتماعي",
    social_tip: "أدخل أسماء حساباتك (بدون الرمز @)",
    phone_invalid: "رقم هاتف مغربي غير صحيح",
    name_required: "الاسم الكامل مطلوب",
    phone_required: "رقم الهاتف مطلوب",
  },
  en: {
    title: "Complete Registration",
    subtitle: "Fill in the remaining details to finalize your Google account",
    im_an_influencer: "I'm an Influencer",
    im_a_seller: "I'm a Seller",
    full_name_label: "Full Name",
    phone_label: "Phone Number",
    phone_placeholder: "0612345678 or +212612345678",
    cgu_label: "I accept the Terms of Service (CGU)",
    cgu_error: "Please accept the Terms of Service to continue",
    submit_btn: "Complete Registration",
    submitting: "Creating account...",
    success: "Account created successfully!",
    social_section: "Social Networks",
    social_tip: "Enter your social network handles (without the @ symbol)",
    phone_invalid: "Invalid Moroccan phone format",
    name_required: "Full name is required",
    phone_required: "Phone is required",
  }
};

export default function CompleteRegisterGoogle() {
  const { language, t: tGlobal } = useLanguage();
  const currentLang = (language === 'ar' || language === 'fr' || language === 'en') ? language : 'fr';
  
  const t = (key: string) => {
    if (key in translations[currentLang]) {
      return (translations[currentLang] as any)[key];
    }
    return tGlobal(key);
  };

  const navigate = useNavigate();
  const location = useLocation();
  const { googleAuth } = useAuth();

  const stateData = location.state as {
    credential?: string;
    email?: string;
    fullName?: string;
    avatarUrl?: string;
    googleId?: string;
    role?: 'VENDOR' | 'INFLUENCER';
  } | null;

  useEffect(() => {
    if (!stateData || !stateData.credential) {
      toast.error("Données de connexion Google introuvables. Redirection...");
      navigate('/register');
    }
  }, [stateData, navigate]);

  const [role, setRole] = useState<'VENDOR' | 'INFLUENCER'>(stateData?.role || 'VENDOR');
  const [fullName, setFullName] = useState(stateData?.fullName || '');
  const [phone, setPhone] = useState('');
  const [cguAccepted, setCguAccepted] = useState(false);
  const [showCguModal, setShowCguModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Social selection state
  const [activeSocial, setActiveSocial] = useState<'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'snapchat'>('instagram');
  const [showUrlInputs, setShowUrlInputs] = useState<Record<string, boolean>>({
    instagram: false,
    tiktok: false,
    facebook: false,
    youtube: false,
    snapchat: false
  });

  const toggleUrlInput = (platform: string) => {
    setShowUrlInputs(prev => ({ ...prev, [platform]: !prev[platform] }));
  };

  // Social usernames and custom URLs
  const [socials, setSocials] = useState({
    instagramUsername: '',
    instagramUrl: '',
    tiktokUsername: '',
    tiktokUrl: '',
    facebookUsername: '',
    facebookUrl: '',
    youtubeUsername: '',
    youtubeUrl: '',
    snapchatUsername: '',
    snapchatUrl: ''
  });

  const handleSocialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name.endsWith('Username')) {
      setSocials(prev => ({ ...prev, [name]: value.replace('@', '').trim() }));
    } else {
      setSocials(prev => ({ ...prev, [name]: value.trim() }));
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(normalizePhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stateData?.credential) return;

    if (!fullName.trim()) {
      toast.error(t('name_required'));
      return;
    }

    if (!phone) {
      toast.error(t('phone_required'));
      return;
    }

    if (!/^\+212[5678][0-9]{8}$/.test(phone)) {
      toast.error(t('phone_invalid'));
      return;
    }

    if (role === 'INFLUENCER') {
      const { instagramUsername, tiktokUsername, facebookUsername, youtubeUsername, snapchatUsername } = socials;
      if (!instagramUsername && !tiktokUsername && !facebookUsername && !youtubeUsername && !snapchatUsername) {
        toast.error(t('social_media_required'));
        return;
      }
    }

    if (!cguAccepted) {
      toast.error(t('cgu_error'));
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        credential: stateData.credential,
        role,
        phone,
        fullName,
        instagramUsername: socials.instagramUsername || undefined,
        instagramUrl: socials.instagramUrl || (socials.instagramUsername ? `https://instagram.com/${socials.instagramUsername}` : undefined),
        tiktokUsername: socials.tiktokUsername || undefined,
        tiktokUrl: socials.tiktokUrl || (socials.tiktokUsername ? `https://tiktok.com/@${socials.tiktokUsername}` : undefined),
        facebookUsername: socials.facebookUsername || undefined,
        facebookUrl: socials.facebookUrl || (socials.facebookUsername ? `https://facebook.com/${socials.facebookUsername}` : undefined),
        youtubeUsername: socials.youtubeUsername || undefined,
        youtubeUrl: socials.youtubeUrl || (socials.youtubeUsername ? `https://youtube.com/@${socials.youtubeUsername}` : undefined),
        snapchatUsername: socials.snapchatUsername || undefined,
        snapchatUrl: socials.snapchatUrl || (socials.snapchatUsername ? `https://snapchat.com/add/${socials.snapchatUsername}` : undefined),
      };

      const userRes = await googleAuth(payload);

      toast.success(t('success'));
      const user = userRes.user;
      if (user?.roleName === 'SUPER_ADMIN' || user?.roleName === 'FINANCE_ADMIN') navigate('/admin');
      else if (user?.roleName === 'CALL_CENTER_AGENT') navigate('/agent');
      else if (user?.roleName === 'GROSSELLER') navigate('/grosseller');
      else if (user?.roleName === 'INFLUENCER') {
        if (user.kycStatus !== 'APPROVED') {
          navigate('/influencer/verification');
        } else {
          navigate('/influencer');
        }
      } else {
        if (user?.kycStatus !== 'APPROVED') {
          navigate('/dashboard/verification');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentImage = role === 'VENDOR' 
    ? '/images/login-seller-img.webp' 
    : '/images/login-influencer-img.webp';

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`min-h-screen flex flex-col lg:flex-row font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] bg-white overflow-x-hidden relative ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      {/* Left Column: Form Area */}
      <div className="w-full lg:w-[50%] xl:w-[45%] flex flex-col justify-center items-center p-6 bg-[#f8f9fa] relative z-10 min-h-screen">
        {/* Language Switcher Widget */}
        <div className={`absolute top-6 ${language === 'ar' ? 'left-6' : 'right-6'} z-30`}>
          <LanguageSwitcherWidget />
        </div>
        
        {/* Mobile Logo */}
        <div className={`lg:hidden absolute top-8 ${language === 'ar' ? 'right-8' : 'left-8'}`}>
          <Link to="/" dir="ltr" className="flex items-center gap-2">
            <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-8 h-8 object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-5 object-contain" />
          </Link>
        </div>

        <div className="w-full max-w-[440px] py-6">
          <div className="text-center space-y-2 mb-6 mt-8 lg:mt-0">
            <h1 className="text-[28px] font-extrabold text-[#2e315e] tracking-tight">{t('title')}</h1>
            <p className="text-[14px] font-medium text-slate-500">{t('subtitle')}</p>
          </div>

          {/* User Google Info Badge */}
          {stateData && (
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-6">
              {stateData.avatarUrl ? (
                <img src={stateData.avatarUrl} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-[#ff5722]" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#ff5722]/10 flex items-center justify-center text-[#ff5722] font-bold">
                  {stateData.email?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 font-bold truncate">Google Account Connected</p>
                <p className="text-[13px] text-slate-700 font-bold truncate">{stateData.email}</p>
              </div>
            </div>
          )}

          {/* Role Toggle Switch */}
          <div className="flex bg-[#f4f5f7] p-1 rounded-2xl mb-6 relative max-w-[340px] mx-auto">
            <button
              type="button"
              onClick={() => setRole('INFLUENCER')}
              className={`flex-1 py-3 rounded-xl text-[13px] font-bold transition-all duration-300 ${
                role === 'INFLUENCER' ? 'bg-[#ff5722] text-white shadow-md' : 'text-[#2e315e] hover:bg-slate-200/50'
              }`}
            >
              {t('im_an_influencer')}
            </button>
            <button
              type="button"
              onClick={() => setRole('VENDOR')}
              className={`flex-1 py-3 rounded-xl text-[13px] font-bold transition-all duration-300 ${
                role === 'VENDOR' ? 'bg-[#ff5722] text-white shadow-md' : 'text-[#2e315e] hover:bg-slate-200/50'
              }`}
            >
              {t('im_a_seller')}
            </button>
          </div>

          <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>{t('full_name_label')} <span className="text-[#ff5722]">*</span></span>
                </label>
                <div className="relative group/input">
                  <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400`}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>{t('phone_label')} <span className="text-[#ff5722]">*</span></span>
                </label>
                <div className="relative group/input">
                  <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                    <Phone size={18} />
                  </div>
                  <input
                    type="tel"
                    className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400`}
                    placeholder={t('phone_placeholder')}
                    value={phone}
                    onChange={handlePhoneChange}
                    required
                  />
                </div>
              </div>

              {/* Influencer Social Handles (Active Tab Selection) */}
              {role === 'INFLUENCER' && (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700">{t('social_media_section_title')} <span className="text-[#ff5722]">*</span></label>
                  
                  <div className="flex flex-wrap gap-3 py-2">
                    <button 
                      type="button" 
                      onClick={() => setActiveSocial('instagram')} 
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        activeSocial === 'instagram' || socials.instagramUsername 
                          ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white shadow-md' 
                          : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'
                      } ${activeSocial === 'instagram' ? 'ring-4 ring-offset-2 ring-pink-500/40 scale-105' : ''}`}
                    >
                      <FaInstagram className="w-4 h-4" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setActiveSocial('tiktok')} 
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        activeSocial === 'tiktok' || socials.tiktokUsername 
                          ? 'bg-black text-white shadow-md' 
                          : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'
                      } ${activeSocial === 'tiktok' ? 'ring-4 ring-offset-2 ring-black/30 scale-105' : ''}`}
                    >
                      <FaTiktok className="w-4 h-4" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setActiveSocial('facebook')} 
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        activeSocial === 'facebook' || socials.facebookUsername 
                          ? 'bg-[#1877F2] text-white shadow-md' 
                          : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'
                      } ${activeSocial === 'facebook' ? 'ring-4 ring-offset-2 ring-[#1877F2]/40 scale-105' : ''}`}
                    >
                      <FaFacebook className="w-4 h-4" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setActiveSocial('youtube')} 
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        activeSocial === 'youtube' || socials.youtubeUsername 
                          ? 'bg-[#FF0000] text-white shadow-md' 
                          : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'
                      } ${activeSocial === 'youtube' ? 'ring-4 ring-offset-2 ring-[#FF0000]/40 scale-105' : ''}`}
                    >
                      <FaYoutube className="w-4 h-4" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setActiveSocial('snapchat')} 
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        activeSocial === 'snapchat' || socials.snapchatUsername 
                          ? 'bg-[#FFFC00] text-black shadow-md' 
                          : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'
                      } ${activeSocial === 'snapchat' ? 'ring-4 ring-offset-2 ring-[#FFFC00]/60 scale-105' : ''}`}
                    >
                      <FaSnapchatGhost className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4 pt-2">
                    {activeSocial === 'instagram' && (
                      <div className="space-y-3">
                        <div className="relative">
                          <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400 font-bold`}>@</span>
                          <input 
                            type="text" 
                            name="instagramUsername" 
                            className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'} border border-transparent focus:bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} 
                            placeholder={t('instagram_username_placeholder')} 
                            value={socials.instagramUsername} 
                            onChange={handleSocialChange} 
                          />
                          <button 
                            type="button" 
                            onClick={() => toggleUrlInput('instagram')} 
                            className={`absolute inset-y-0 ${language === 'ar' ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center transition-colors ${showUrlInputs['instagram'] ? 'text-pink-500' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <LinkIcon size={20} />
                          </button>
                        </div>
                        {showUrlInputs['instagram'] && (
                          <div className="relative">
                            <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400`}><LinkIcon size={16} /></span>
                            <input 
                              type="url" 
                              name="instagramUrl" 
                              className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-transparent focus:bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} 
                              placeholder="https://instagram.com/..." 
                              value={socials.instagramUrl} 
                              onChange={handleSocialChange} 
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {activeSocial === 'tiktok' && (
                      <div className="space-y-3">
                        <div className="relative">
                          <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400 font-bold`}>@</span>
                          <input 
                            type="text" 
                            name="tiktokUsername" 
                            className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'} border border-transparent focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} 
                            placeholder={t('tiktok_username_placeholder')} 
                            value={socials.tiktokUsername} 
                            onChange={handleSocialChange} 
                          />
                          <button 
                            type="button" 
                            onClick={() => toggleUrlInput('tiktok')} 
                            className={`absolute inset-y-0 ${language === 'ar' ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center transition-colors ${showUrlInputs['tiktok'] ? 'text-black' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <LinkIcon size={20} />
                          </button>
                        </div>
                        {showUrlInputs['tiktok'] && (
                          <div className="relative">
                            <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400`}><LinkIcon size={16} /></span>
                            <input 
                              type="url" 
                              name="tiktokUrl" 
                              className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-transparent focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} 
                              placeholder="https://tiktok.com/@..." 
                              value={socials.tiktokUrl} 
                              onChange={handleSocialChange} 
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {activeSocial === 'facebook' && (
                      <div className="space-y-3">
                        <div className="relative">
                          <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400 font-bold`}>@</span>
                          <input 
                            type="text" 
                            name="facebookUsername" 
                            className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'} border border-transparent focus:bg-white focus:border-[#1877F2] focus:ring-4 focus:ring-[#1877F2]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} 
                            placeholder={t('facebook_username_placeholder')} 
                            value={socials.facebookUsername} 
                            onChange={handleSocialChange} 
                          />
                          <button 
                            type="button" 
                            onClick={() => toggleUrlInput('facebook')} 
                            className={`absolute inset-y-0 ${language === 'ar' ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center transition-colors ${showUrlInputs['facebook'] ? 'text-[#1877F2]' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <LinkIcon size={20} />
                          </button>
                        </div>
                        {showUrlInputs['facebook'] && (
                          <div className="relative">
                            <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400`}><LinkIcon size={16} /></span>
                            <input 
                              type="url" 
                              name="facebookUrl" 
                              className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-transparent focus:bg-white focus:border-[#1877F2] focus:ring-4 focus:ring-[#1877F2]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} 
                              placeholder="https://facebook.com/..." 
                              value={socials.facebookUrl} 
                              onChange={handleSocialChange} 
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {activeSocial === 'youtube' && (
                      <div className="space-y-3">
                        <div className="relative">
                          <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400 font-bold`}>@</span>
                          <input 
                            type="text" 
                            name="youtubeUsername" 
                            className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'} border border-transparent focus:bg-white focus:border-[#FF0000] focus:ring-4 focus:ring-[#FF0000]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} 
                            placeholder={t('youtube_username_placeholder')} 
                            value={socials.youtubeUsername} 
                            onChange={handleSocialChange} 
                          />
                          <button 
                            type="button" 
                            onClick={() => toggleUrlInput('youtube')} 
                            className={`absolute inset-y-0 ${language === 'ar' ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center transition-colors ${showUrlInputs['youtube'] ? 'text-[#FF0000]' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <LinkIcon size={20} />
                          </button>
                        </div>
                        {showUrlInputs['youtube'] && (
                          <div className="relative">
                            <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400`}><LinkIcon size={16} /></span>
                            <input 
                              type="url" 
                              name="youtubeUrl" 
                              className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-transparent focus:bg-white focus:border-[#FF0000] focus:ring-4 focus:ring-[#FF0000]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} 
                              placeholder="https://youtube.com/@..." 
                              value={socials.youtubeUrl} 
                              onChange={handleSocialChange} 
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {activeSocial === 'snapchat' && (
                      <div className="space-y-3">
                        <div className="relative">
                          <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400 font-bold`}>@</span>
                          <input 
                            type="text" 
                            name="snapchatUsername" 
                            className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'} border border-transparent focus:bg-white focus:border-[#FFFC00] focus:ring-4 focus:ring-[#FFFC00]/20 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} 
                            placeholder={t('snapchat_username_placeholder')} 
                            value={socials.snapchatUsername} 
                            onChange={handleSocialChange} 
                          />
                          <button 
                            type="button" 
                            onClick={() => toggleUrlInput('snapchat')} 
                            className={`absolute inset-y-0 ${language === 'ar' ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center transition-colors ${showUrlInputs['snapchat'] ? 'text-[#d6d400]' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <LinkIcon size={20} />
                          </button>
                        </div>
                        {showUrlInputs['snapchat'] && (
                          <div className="relative">
                            <span className={`absolute inset-y-0 ${language === 'ar' ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center text-slate-400`}><LinkIcon size={16} /></span>
                            <input 
                              type="url" 
                              name="snapchatUrl" 
                              className={`w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} border border-transparent focus:bg-white focus:border-[#FFFC00] focus:ring-4 focus:ring-[#FFFC00]/20 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700`} 
                              placeholder="https://snapchat.com/add/..." 
                              value={socials.snapchatUrl} 
                              onChange={handleSocialChange} 
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CGU checkbox */}
              <div className="flex items-start gap-3 mt-4">
                <input
                  type="checkbox"
                  id="cgu"
                  className="mt-1 w-4 h-4 text-[#ff5722] border-slate-300 rounded focus:ring-[#ff5722]"
                  checked={cguAccepted}
                  onChange={(e) => setCguAccepted(e.target.checked)}
                />
                <label htmlFor="cgu" className="text-xs text-slate-500 font-semibold select-none leading-relaxed">
                  J'accepte les{' '}
                  <button
                    type="button"
                    onClick={() => setShowCguModal(true)}
                    className="text-[#ff5722] hover:underline font-bold"
                  >
                    Conditions Générales d'Utilisation (CGU)
                  </button>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full mt-4 bg-[#ff5722] text-white font-bold py-3 rounded-xl hover:bg-[#e64a19] transition-all text-sm shadow-[0_4px_14px_rgba(255,87,34,0.3)] flex items-center justify-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t('submitting')}</span>
                  </>
                ) : (
                  <span>{t('submit_btn')}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Right Column: Visual Area */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[55%] relative overflow-hidden bg-white items-center justify-center">
        {/* Desktop Logo */}
        <div className="absolute top-10 right-12 z-20">
          <Link to="/" dir="ltr" className="flex items-center gap-2.5 group">
            <motion.img whileHover={{ rotateY: 15, scale: 1.05 }} src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 origin-center object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
          </Link>
        </div>

        {/* Dynamic Image */}
        <div className="relative w-full h-full p-12 flex items-center justify-center">
          <div className="relative w-full max-w-[600px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.img
                key={role}
                src={currentImage}
                initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="w-full h-auto max-h-[80vh] object-contain"
                alt={role === 'VENDOR' ? 'Seller Preview' : 'Influencer Preview'}
              />
            </AnimatePresence>
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none z-10" />
          </div>
          <div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] bg-gradient-to-tr from-[#ff5722]/5 to-[#ffc107]/5 rounded-full blur-[80px] -z-10" />
        </div>
      </div>

      <CguModal isOpen={showCguModal} onClose={() => setShowCguModal(false)} language={language} />
    </div>
  );
}
