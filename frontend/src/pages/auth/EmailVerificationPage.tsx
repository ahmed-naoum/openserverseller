import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import { authApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import LanguageSwitcherWidget from '../../components/common/LanguageSwitcherWidget';

export default function EmailVerificationPage() {
  const { language, t: tRaw } = useLanguage();
  const t = (key: string) => tRaw(key, 'register');
  const { logout, refreshUser, user, isLoading: authLoading } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  
  const email = location.state?.email || user?.email || '';

  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isLoading) return;
    setIsLoading(true);
    try {
      await authApi.resendOtp({ email });
      toast.success(
        language === 'ar' 
          ? 'تم إعادة إرسال رمز التحقق بنجاح.' 
          : language === 'fr' 
          ? 'Le code de vérification a été renvoyé avec succès.' 
          : 'Verification code resent successfully.'
      );
      setCooldown(60);
    } catch (err: any) {
      const remaining = err.response?.data?.remainingSeconds;
      if (remaining) {
        setCooldown(remaining);
      }
      toast.error(
        err.response?.data?.message || 
        (language === 'ar' ? 'حدث خطأ أثناء إعادة إرسال الرمز.' : 'Erreur lors du renvoi du code.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!email) {
      toast.error(t('session_invalid'));
      navigate('/login');
    }
  }, [email, navigate, authLoading]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedData = value.slice(0, 6).split('');
      const newOtp = [...otp];
      pastedData.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char;
      });
      setOtp(newOtp);
      // Focus the next empty input or the last one
      const nextIndex = Math.min(index + pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && index > 0 && otp[index] === '') {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleLogoutAndGoBack = async () => {
    setIsLoading(true);
    try {
      await logout();
      toast.success(language === 'ar' ? 'تم تسجيل الخروج بنجاح' : language === 'fr' ? 'Déconnexion réussie' : 'Logged out successfully');
      navigate('/register');
    } catch (err) {
      navigate('/register');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      toast.error(t('enter_6_digits'));
      return;
    }

    setIsLoading(true);
    try {
      await authApi.verifyEmail({ email, otp: otpValue });
      toast.success(t('email_verified_success'));
      
      try {
        const meRes = await authApi.me();
        const refreshedUser = meRes.data?.data?.user;
        await refreshUser();
        
        // If manual approval is required, send to pending page
        if (refreshedUser?.requiresManualApproval && !refreshedUser?.isActive) {
          navigate('/pending-verification');
          return;
        }
        
        // Otherwise, send to the appropriate dashboard
        if (refreshedUser?.role === 'INFLUENCER') {
          navigate('/influencer');
          return;
        } else if (refreshedUser?.role === 'SUPER_ADMIN' || refreshedUser?.role === 'FINANCE_ADMIN' || refreshedUser?.role === 'SYSTEM_SUPPORT') {
          navigate('/admin');
          return;
        } else if (refreshedUser?.role === 'GROSSELLER') {
          navigate('/grosseller');
          return;
        } else {
          navigate('/dashboard');
          return;
        }
      } catch (meError) {
        console.error('Error fetching verified profile status:', meError);
      }
      
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Code invalide ou expiré');
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
            <h1 className="text-[32px] font-extrabold text-[#2e315e] tracking-tight">{t('verify_email_title')}</h1>
          </div>

          <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            <p className="text-slate-500 text-center mb-8 text-[15px]">
              {t('verify_email_desc')}<br />
              <strong className="text-slate-700">{email}</strong>
            </p>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="flex justify-between gap-2" dir="ltr">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6} // Allow pasting
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold text-[#2e315e] border border-slate-200 focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl transition-all outline-none bg-[#f8f9fa] focus:bg-white"
                    required
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full flex items-center justify-center gap-2 bg-[#ff5722] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#e64a19] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgba(255,87,34,0.39)]"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {t('verify_code_btn')}
                    <ShieldCheck className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center text-[14px]">
              <p className="text-slate-500">
                {t('didnt_receive_code')}{' '}
                {cooldown > 0 ? (
                  <span className="text-slate-400 font-bold">
                    {language === 'ar' 
                      ? `إعادة الإرسال خلال ${cooldown} ثانية` 
                      : language === 'fr' 
                      ? `Renvoyer dans ${cooldown}s` 
                      : `Resend in ${cooldown}s`}
                  </span>
                ) : (
                  <button 
                    type="button" 
                    onClick={handleResend}
                    disabled={isLoading}
                    className="text-[#2e315e] font-bold hover:underline disabled:opacity-50"
                  >
                    {t('resend_btn')}
                  </button>
                )}
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 flex justify-center">
              <button
                type="button"
                onClick={handleLogoutAndGoBack}
                className="flex items-center gap-2 text-[14px] text-slate-500 hover:text-[#ff5722] font-semibold transition-colors"
              >
                <ArrowLeft className={`w-4 h-4 ${language === 'ar' ? 'rotate-180' : ''}`} />
                {t('logout_goback_btn')}
              </button>
            </div>
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

        {/* Verification themed visual */}
        <div className="relative w-full h-full p-12 flex items-center justify-center">
            <div className="relative w-full max-w-[500px] flex items-center justify-center">
                <motion.img
                    src="/images/login-seller-img.webp"
                    initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="w-full h-auto max-h-[80vh] object-contain"
                    alt="Email Verification Preview"
                />
                {/* Soft premium gradient fading shadow */}
                <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none z-10" />
            </div>

            {/* Decorative background circle */}
            <div className="absolute inset-0 z-[-1] flex items-center justify-center pointer-events-none">
                <div className="w-[600px] h-[600px] rounded-full blur-[100px] bg-[#2e315e]/10"></div>
            </div>
        </div>
      </div>
    </div>
  );
}
