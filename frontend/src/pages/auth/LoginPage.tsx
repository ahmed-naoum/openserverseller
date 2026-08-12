import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { settingsApi } from '../../lib/api';
import { VENDOR_HELPER_BASE } from '../../lib/dashboardBase';
import { Eye, EyeOff, ShieldCheck, Mail, Lock } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import GoogleAuthProvider from '../../components/auth/GoogleAuthProvider';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import LanguageSwitcherWidget from '../../components/common/LanguageSwitcherWidget';


const SLIDER_IMAGES = [
  '/images/login/grossiste.webp',
  '/images/login/influencer-login.webp',
  '/images/login/seller-new.webp'
];

export default function LoginPage() {
  const { language, t: tRaw } = useLanguage();
  const t = (key: string) => tRaw(key, 'login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // 2FA states
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  // Force Password Change states
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [currentSlide, setCurrentSlide] = useState(0);

  const { login, login2FA, googleAuth, forcePasswordChange } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDER_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await login({ email: formData.email, password: formData.password });
      
      if (res.requiresTwoFactor) {
        setRequires2FA(true);
        setTwoFactorToken(res.twoFactorToken || '');
        toast.success(res.message || 'Code 2FA requis');
        return;
      }

      if (res.requiresPasswordChange) {
        setRequiresPasswordChange(true);
        setTempToken(res.tempToken || '');
        toast.success(res.message || 'Changement de mot de passe requis');
        return;
      }
      
      const user = res.user!;
      toast.success('Connexion réussie!');
      
      if (!user.emailVerified) {
        navigate('/verify-email');
        return;
      }
      
      if (!user.isActive && user.requiresManualApproval) {
        navigate('/pending-verification');
        return;
      }

      // Redirect based on role
      if (user.role === 'SUPER_ADMIN' || user.role === 'FINANCE_ADMIN' || user.role === 'SYSTEM_SUPPORT') {
        navigate('/admin');
      } else if (user.role === 'CALL_CENTER_AGENT') {
        navigate('/agent');
      } else if (user.role === 'GROSSELLER') {
        navigate('/grosseller');
      } else if (user.role === 'INFLUENCER') {
        if (user.kycStatus !== 'APPROVED') {
          navigate('/influencer/verification');
        } else {
          navigate('/influencer');
        }
      } else if (user.role === 'UNCONFIRMED') {
        navigate('/verify');
      } else if (user.role === 'VENDOR_HELPER') {
        // Sub-accounts inherit the vendor's verified standing, so they go
        // straight to their dashboard rather than through the KYC gate.
        navigate(VENDOR_HELPER_BASE);
      } else {
        if (user.kycStatus !== 'APPROVED') {
          navigate('/dashboard/verification');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur de connexion';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFactorCode.length !== 6) return;
    
    setIsLoading(true);
    try {
      const user = await login2FA({ twoFactorToken, code: twoFactorCode });
      toast.success('Connexion réussie!');
      
      if (!user.emailVerified) {
        navigate('/verify-email');
        return;
      }
      
      if (!user.isActive && user.requiresManualApproval) {
        navigate('/pending-verification');
        return;
      }

      if (user.role === 'SUPER_ADMIN' || user.role === 'FINANCE_ADMIN' || user.role === 'SYSTEM_SUPPORT') {
        navigate('/admin');
      } else if (user.role === 'CALL_CENTER_AGENT') {
        navigate('/agent');
      } else if (user.role === 'GROSSELLER') {
        navigate('/grosseller');
      } else if (user.role === 'INFLUENCER') {
        if (user.kycStatus !== 'APPROVED') {
          navigate('/influencer/verification');
        } else {
          navigate('/influencer');
        }
      } else if (user.role === 'UNCONFIRMED') {
        navigate('/verify');
      } else if (user.role === 'VENDOR_HELPER') {
        // Sub-accounts inherit the vendor's verified standing, so they go
        // straight to their dashboard rather than through the KYC gate.
        navigate(VENDOR_HELPER_BASE);
      } else {
        if (user.kycStatus !== 'APPROVED') {
          navigate('/dashboard/verification');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Code 2FA invalide');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForcePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    
    setIsLoading(true);
    try {
      const user = await forcePasswordChange({ tempToken, newPassword });
      toast.success('Mot de passe mis à jour et connexion réussie!');
      
      if (!user.emailVerified) {
        navigate('/verify-email');
        return;
      }
      
      if (user.role === 'SUPER_ADMIN' || user.role === 'FINANCE_ADMIN' || user.role === 'SYSTEM_SUPPORT') {
        navigate('/admin');
      } else if (user.role === 'CALL_CENTER_AGENT') {
        navigate('/agent');
      } else if (user.role === 'GROSSELLER') {
        navigate('/grosseller');
      } else if (user.role === 'INFLUENCER') {
        if (user.kycStatus !== 'APPROVED') {
          navigate('/influencer/verification');
        } else {
          navigate('/influencer');
        }
      } else if (user.role === 'UNCONFIRMED') {
        navigate('/verify');
      } else if (user.role === 'VENDOR_HELPER') {
        // Sub-accounts inherit the vendor's verified standing, so they go
        // straight to their dashboard rather than through the KYC gate.
        navigate(VENDOR_HELPER_BASE);
      } else {
        if (user.kycStatus !== 'APPROVED') {
          navigate('/dashboard/verification');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (response: any) => {
    if (!response.credential) return;
    
    setIsLoading(true);
    try {
      const res = await googleAuth({ credential: response.credential });
      
      if (res.requiresTwoFactor) {
        setRequires2FA(true);
        setTwoFactorToken(res.twoFactorToken || '');
        toast.success(res.message || 'Code 2FA requis');
        return;
      }
      
      const user = res.user!;
      toast.success('Connexion avec Google réussie!');
      
      if (!user.emailVerified) {
        navigate('/verify-email');
        return;
      }
      
      if (!user.isActive && user.requiresManualApproval) {
        navigate('/pending-verification');
        return;
      }

      if (user.role === 'SUPER_ADMIN' || user.role === 'FINANCE_ADMIN' || user.role === 'SYSTEM_SUPPORT') {
        navigate('/admin');
      } else if (user.role === 'CALL_CENTER_AGENT') {
        navigate('/agent');
      } else if (user.role === 'GROSSELLER') {
        navigate('/grosseller');
      } else if (user.role === 'INFLUENCER') {
        if (user.kycStatus !== 'APPROVED') {
          navigate('/influencer/verification');
        } else {
          navigate('/influencer');
        }
      } else if (user.role === 'UNCONFIRMED') {
        navigate('/verify');
      } else if (user.role === 'VENDOR_HELPER') {
        // Sub-accounts inherit the vendor's verified standing, so they go
        // straight to their dashboard rather than through the KYC gate.
        navigate(VENDOR_HELPER_BASE);
      } else {
        if (user.kycStatus !== 'APPROVED') {
          navigate('/dashboard/verification');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Erreur lors de la connexion avec Google';
      toast.error(errMsg);
      if (error.response?.status === 404) {
        navigate('/register');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`min-h-screen flex flex-col lg:flex-row font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] bg-white overflow-hidden relative ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      {/* Left Column: Form Area */}
      <div className="w-full lg:w-[50%] xl:w-[45%] flex flex-col justify-center items-center p-6 bg-[#f8f9fa] relative z-10 min-h-screen">
        {/* Language Switcher Widget */}
        <div className={`absolute top-6 ${language === 'ar' ? 'left-6' : 'right-6'} z-30`}>
          <LanguageSwitcherWidget />
        </div>
        
        {/* Mobile Logo (Visible only on small screens) */}
        <div className={`lg:hidden absolute top-8 ${language === 'ar' ? 'right-8' : 'left-8'}`}>
          <Link to="/" dir="ltr" className="flex items-center gap-2">
            <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-8 h-8 object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-5 object-contain" />
          </Link>
        </div>

        <div className="w-full max-w-[400px] py-6">
          <div className="text-center space-y-2 mb-6 mt-8 lg:mt-0">
            <h1 className="text-[32px] font-extrabold text-[#2e315e] tracking-tight">
              {requiresPasswordChange 
                ? t('new_password_title') 
                : requires2FA 
                ? t('two_factor_title') 
                : t('login_title')}
            </h1>
            <p className="text-[17px] font-medium text-[#ff5722]">
              {requiresPasswordChange 
                ? t('new_password_subtitle') 
                : requires2FA 
                ? t('two_factor_subtitle') 
                : t('login_subtitle')}
            </p>
          </div>

          <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            {requiresPasswordChange ? (
              <form onSubmit={handleForcePasswordSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold text-slate-700 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t('new_password_label')}</label>
                    <div className="relative group/input">
                      <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                        <Lock size={18} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-11' : 'pl-11 pr-11'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400`}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        className={`absolute ${language === 'ar' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors`}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold text-slate-700 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t('confirm_password_label')}</label>
                    <div className="relative group/input">
                      <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                        <Lock size={18} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-11' : 'pl-11 pr-11'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400`}
                        placeholder="••••••••"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRequiresPasswordChange(false);
                        setNewPassword('');
                        setConfirmNewPassword('');
                        setTempToken('');
                      }}
                      className="w-full bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-200 transition-all text-[13px]"
                    >
                      {t('back_btn')}
                    </button>
                    <button
                      type="submit"
                      className="w-full bg-[#ff5722] text-white font-bold py-2.5 rounded-xl hover:bg-[#e64a19] transition-all text-[13px]"
                      disabled={isLoading || newPassword.length < 6}
                    >
                      {isLoading ? '...' : t('confirm_btn')}
                    </button>
                  </div>
                </div>
              </form>
            ) : requires2FA ? (
              <form onSubmit={handle2FASubmit} className="space-y-6">
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="000 000"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-4 text-center text-3xl font-mono tracking-[0.4em] transition-all outline-none border text-slate-700 font-bold"
                    required
                  />
                  
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRequires2FA(false);
                        setTwoFactorCode('');
                        setTwoFactorToken('');
                      }}
                      className="w-full bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-200 transition-all text-[13px]"
                    >
                      {t('back_btn')}
                    </button>
                    <button
                      type="submit"
                      className="w-full bg-[#ff5722] text-white font-bold py-2.5 rounded-xl hover:bg-[#e64a19] transition-all text-[13px]"
                      disabled={isLoading || twoFactorCode.length !== 6}
                    >
                      {isLoading ? '...' : t('verify_btn')}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold text-slate-700 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t('email_label')}</label>
                    <div className="relative group/input">
                      <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400`}
                        placeholder={t('email_label')}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold text-slate-700 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t('password_label')}</label>
                    <div className="relative group/input">
                      <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                        <Lock size={18} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-11' : 'pl-11 pr-11'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400`}
                        placeholder={t('password_label')}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className={`absolute ${language === 'ar' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors`}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <div className={`flex ${language === 'ar' ? 'justify-start' : 'justify-end'} pt-1`}>
                      <Link to="/forgot-password" title={t('forgot_password_link')} className="text-[12px] font-medium text-[#ff5722] hover:text-[#e64a19] transition-colors underline decoration-transparent hover:decoration-[#ff5722] underline-offset-4">
                        {t('forgot_password_link')}
                      </Link>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      className="w-full bg-[#ff5722] text-white font-bold py-2.5 rounded-xl hover:bg-[#e64a19] transition-all text-sm shadow-[0_4px_14px_0_rgba(255,87,34,0.39)]"
                      disabled={isLoading}
                    >
                      {isLoading ? t('signing_in_btn') : t('sign_in_btn')}
                    </button>
                  </div>
                </form>

                <div className="mt-8 flex flex-col items-center gap-4">
                  <div className="w-full flex justify-center">
                    <GoogleAuthProvider>
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => toast.error(t('google_login_failed'))}
                        useOneTap
                        theme="outline"
                        shape="pill"
                        size="large"
                        width="100%"
                      />
                    </GoogleAuthProvider>
                  </div>
                  <p className="text-[13px] font-semibold text-slate-500 mt-2">
                    {t('dont_have_account')}{' '}
                    <Link to="/register" className="text-[#ff5722] hover:text-[#e64a19] transition-colors font-bold">
                      {t('sign_up_link')}
                    </Link>
                  </p>
                </div>

                <div className="mt-10 text-center">
                  <p className="text-[11px] font-semibold text-slate-400">
                    <a href="/privacy" className="hover:text-[#ff5722] transition-colors">{t('privacy_notice')}</a>
                    {' | '}
                    <a href="/terms" className="hover:text-[#ff5722] transition-colors">{t('terms_of_service')}</a>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Image Slider */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[55%] relative overflow-hidden bg-white items-center justify-center">
        {/* Desktop Logo */}
        <div className="absolute top-10 right-12 z-20">
          <Link to="/" dir="ltr" className="flex items-center gap-2.5 group">
            <motion.img whileHover={{ rotateY: 15, scale: 1.05 }} src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 origin-center object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
          </Link>
        </div>

        {/* 3D Coverflow Carousel */}
        <div className="relative w-full h-full flex items-center justify-center">
          {SLIDER_IMAGES.map((src, idx) => {
            const isActive = idx === currentSlide;
            const isPrev = idx === (currentSlide - 1 + SLIDER_IMAGES.length) % SLIDER_IMAGES.length;
            const isNext = idx === (currentSlide + 1) % SLIDER_IMAGES.length;

            let x = 0;
            let scale = 1;
            let zIndex = 0;
            let opacity = 0;
            let filter = 'blur(0px)';

            if (isActive) {
              x = 0; scale = 1; zIndex = 30; opacity = 1; filter = 'blur(0px)';
            } else if (isPrev) {
              x = -280; scale = 0.85; zIndex = 10; opacity = 0.85; filter = 'blur(6px)';
            } else if (isNext) {
              x = 280; scale = 0.85; zIndex = 10; opacity = 0.85; filter = 'blur(6px)';
            }

            return (
              <motion.div
                key={src}
                className="absolute w-[380px] xl:w-[450px] cursor-pointer"
                animate={{ x, scale, zIndex, opacity, filter }}
                transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                onClick={() => setCurrentSlide(idx)}
                style={{ originX: 0.5, originY: 0.5 }}
              >
                <img src={src} alt="Showcase" className="w-full h-auto object-contain" />
                {!isActive && <div className="absolute inset-0 bg-white/10 rounded-[2rem]" />}
              </motion.div>
            );
          })}
          
          {/* Slider Indicators */}
          <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-3 z-40">
            {SLIDER_IMAGES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`transition-all duration-300 rounded-full ${
                  currentSlide === idx ? 'w-10 h-2 bg-[#ff5722]' : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


