import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { Mail, Loader2, CheckCircle2, ShieldCheck, LogIn } from 'lucide-react';
import { MathCaptcha } from '../../components/common/MathCaptcha';
import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import LanguageSwitcherWidget from '../../components/common/LanguageSwitcherWidget';

export default function ForgotPassword() {
  const { language, t: tRaw } = useLanguage();
  const t = (key: string) => tRaw(key, 'forgot-password');
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);

  const isSubmittingRef = useRef(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const forgotMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: () => {
      setSuccess(true);
      toast.success(t('forgot_password_email_sent'));
    },
    onError: () => {
      toast.error(t('forgot_password_error_toast'));
      isSubmittingRef.current = false;
    },
    onSettled: () => {
      isSubmittingRef.current = false;
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!emailValid) {
      toast.error(t('email_invalid'));
      return;
    }
    if (!isCaptchaValid) {
      toast.error(t('captcha_required'));
      return;
    }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    forgotMutation.mutate({ email });
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`min-h-screen flex flex-col lg:flex-row font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] bg-white overflow-hidden relative ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      {/* Left Column: Form Area */}
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-center items-center p-6 bg-[#f8f9fa] relative z-10 min-h-screen lg:min-h-0">
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

        <div className="w-full max-w-[360px]">
          <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            
            {success ? (
              /* Success State */
              <div className="text-center py-4 space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center shadow-inner">
                  <CheckCircle2 size={32} className="text-emerald-500" strokeWidth={1.5} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">{t('forgot_password_success_title')}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    {t('forgot_password_success_desc')}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 max-w-xs mx-auto">
                  <ShieldCheck size={14} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-[10px] font-semibold text-emerald-700">{t('forgot_password_expiry_notice')}</p>
                </div>
                <div className="pt-2">
                  <Link
                    to="/login"
                    className="w-full flex items-center justify-center gap-2 bg-[#ff5722] hover:bg-[#e64a19] text-white font-bold py-2.5 rounded-xl transition-all text-[13px]"
                  >
                    {t('forgot_password_back_login')}
                  </Link>
                </div>
              </div>
            ) : (
              /* Form State */
              <>
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-[28px] font-bold text-[#2e315e] tracking-tight">{t('forgot_password_title')}</h1>
                  <p className="text-[13px] font-medium text-[#ff5722]">{t('forgot_password_subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email input */}
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold text-slate-700 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>{t('email_label')}</label>
                    <div className="relative group/input">
                      <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-4' : 'pl-11 pr-4'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400 ${
                          emailTouched && (!email || !emailValid) ? 'border-red-300' : ''
                        }`}
                        placeholder="vous@exemple.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => setEmailTouched(true)}
                        required
                      />
                    </div>
                    {emailTouched && !email && (
                      <p className="text-red-500 text-[10px] font-bold ml-1">{t('email_required')}</p>
                    )}
                    {emailTouched && email && !emailValid && (
                      <p className="text-red-500 text-[10px] font-bold ml-1">{t('invalid_email')}</p>
                    )}
                  </div>

                  {/* Math Captcha */}
                  <div>
                    <MathCaptcha onValidate={setIsCaptchaValid} />
                  </div>

                  {/* Submit button */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={forgotMutation.isPending || !email || !isCaptchaValid}
                      className="w-full bg-[#ff5722] text-white font-bold py-2.5 rounded-xl hover:bg-[#e64a19] transition-all text-sm shadow-[0_4px_14px_0_rgba(255,87,34,0.39)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {forgotMutation.isPending ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {t('sending_btn')}
                        </>
                      ) : (
                        t('send_link_btn')
                      )}
                    </button>
                  </div>
                </form>

                <div className="mt-8 flex flex-col items-center gap-4">
                  <p className="text-[13px] font-semibold text-slate-500">
                    <Link to="/login" className="text-[#ff5722] hover:text-[#e64a19] transition-colors font-bold flex items-center gap-1.5 justify-center">
                      <LogIn size={15} />
                      {t('forgot_password_back_login')}
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

      {/* Right Column: Visual Area */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden bg-white items-center justify-center">
        {/* Desktop Logo */}
        <div className={`absolute top-10 ${language === 'ar' ? 'left-12' : 'right-12'} z-20`}>
          <Link to="/" dir="ltr" className="flex items-center gap-2.5 group">
            <motion.img whileHover={{ rotateY: 15, scale: 1.05 }} src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 origin-center object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
          </Link>
        </div>

        {/* Visual Image */}
        <div className="relative w-full h-full p-12 flex items-center justify-center">
          <div className="relative w-full max-w-[600px] flex items-center justify-center">
            <img
              src="/home page silacod copy/images/Rectangle 4.webp"
              className="w-full h-auto max-h-[80vh] object-contain select-none"
              alt="Forgot Password Preview"
            />
          </div>
          
          {/* Soft premium gradient fading shadow from bottom to top */}
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none z-10" />
        </div>
      </div>
    </div>
  );
}
