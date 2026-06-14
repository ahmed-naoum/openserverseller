import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { Lock, ArrowLeft, Loader2, Eye, EyeOff, ShieldCheck, XCircle, CheckCircle2 } from 'lucide-react';
import { MathCaptcha } from '../../components/common/MathCaptcha';
import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';
import LanguageSwitcherWidget from '../../components/common/LanguageSwitcherWidget';

export default function ResetPassword() {
  const { language, t: tRaw } = useLanguage();
  const t = (key: string) => tRaw(key, 'forgot-password');

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const [success, setSuccess] = useState(false);

  const { isPending: isVerifying, isError: isTokenInvalid } = useQuery({
    queryKey: ['verifyResetToken', token],
    queryFn: () => authApi.verifyResetToken(token!),
    enabled: !!token,
    retry: false,
  });

  const resetMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      toast.success(t('reset_password_success_title'));
      setSuccess(true);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || t('forgot_password_error_toast'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error(t('forgot_password_error_toast'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('reset_password_mismatch'));
      return;
    }
    if (password.length < 8) {
      toast.error(t('reset_password_too_short'));
      return;
    }
    if (!isCaptchaValid) {
      toast.error(t('captcha_required'));
      return;
    }
    resetMutation.mutate({ token, password });
  };

  const passwordValid = password.length >= 8;
  const confirmValid = confirmPassword.length > 0 && confirmPassword === password;

  // 1. Verifying token loading state
  if (isVerifying) {
    return (
      <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-['29LT_Kaff',_Cairo,_Inter,_sans-serif]">
        <div className="w-16 h-16 bg-white rounded-full shadow-xl flex items-center justify-center mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#ff5722]/20 to-transparent animate-pulse" />
          <Loader2 className="w-8 h-8 text-[#ff5722] animate-spin relative z-10" />
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">
          {t('reset_password_verifying')}
        </p>
      </div>
    );
  }

  // 2. Token invalid state
  if (!token || isTokenInvalid) {
    return (
      <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`min-h-screen flex flex-col lg:flex-row font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] bg-white overflow-hidden relative ${language === 'ar' ? 'text-right' : 'text-left'}`}>
        {/* Left Column: Error card */}
        <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-center items-center p-6 bg-[#f8f9fa] relative z-10 min-h-screen lg:min-h-0">
          <div className={`absolute top-6 ${language === 'ar' ? 'left-6' : 'right-6'} z-30`}>
            <LanguageSwitcherWidget />
          </div>

          <div className="w-full max-w-[360px]">
            <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center shadow-inner">
                <XCircle size={32} className="text-red-500" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">{t('reset_password_invalid_title')}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t('reset_password_invalid_desc')}
                </p>
              </div>
              <div className="pt-2">
                <Link
                  to="/forgot-password"
                  className="w-full flex items-center justify-center bg-[#ff5722] hover:bg-[#e64a19] text-white font-bold py-2.5 rounded-xl transition-all text-[13px] shadow-[0_4px_14px_0_rgba(255,87,34,0.39)]"
                >
                  {t('reset_password_new_link_btn')}
                </Link>
              </div>
              <div className="pt-2">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#ff5722] transition-colors">
                  <ArrowLeft size={14} /> {t('forgot_password_back_login')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Area for Invalid Link */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden bg-white items-center justify-center">
          <div className={`absolute top-10 ${language === 'ar' ? 'left-12' : 'right-12'} z-20`}>
            <Link to="/" dir="ltr" className="flex items-center gap-2.5">
              <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 object-contain" />
              <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
            </Link>
          </div>
          <div className="relative w-full h-full p-12 flex items-center justify-center">
            <div className="relative w-full max-w-[600px] flex items-center justify-center">
              <img
                src="/home page silacod copy/images/reset-password.webp"
                className="w-full h-auto max-h-[80vh] object-contain select-none opacity-40 grayscale"
                alt="Reset Password Invalid"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none z-10" />
          </div>
        </div>
      </div>
    );
  }

  // 3. Main State (Reset form / Success screen)
  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`min-h-screen flex flex-col lg:flex-row font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] bg-white overflow-hidden relative ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      {/* Left Column: Content Area */}
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-center items-center p-6 bg-[#f8f9fa] relative z-10 min-h-screen lg:min-h-0">
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
                  <h3 className="text-xl font-bold text-slate-800">{t('reset_password_success_title')}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    {t('reset_password_success_desc')}
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    to="/login"
                    className="w-full flex items-center justify-center bg-[#ff5722] hover:bg-[#e64a19] text-white font-bold py-2.5 rounded-xl transition-all text-[13px] shadow-[0_4px_14px_0_rgba(255,87,34,0.39)]"
                  >
                    {t('forgot_password_back_login')}
                  </Link>
                </div>
              </div>
            ) : (
              /* Form State */
              <>
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-[28px] font-bold text-[#2e315e] tracking-tight">{t('reset_password_title')}</h1>
                  <p className="text-[13px] font-medium text-[#ff5722]">{t('reset_password_subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  
                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold text-slate-700 ${language === 'ar' ? 'mr-1' : 'ml-1'} flex justify-between`}>
                      <span>{t('reset_password_label')}</span>
                      {passwordTouched && (
                        passwordValid ? (
                          <span className="text-emerald-500 font-bold">{t('reset_password_secure')}</span>
                        ) : (
                          <span className="text-red-500 font-bold">{t('reset_password_too_short')}</span>
                        )
                      )}
                    </label>
                    <div className="relative group/input">
                      <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                        <Lock size={18} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-11' : 'pl-11 pr-11'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400 ${
                          passwordTouched && !passwordValid ? 'border-red-300' : ''
                        }`}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => setPasswordTouched(true)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute ${language === 'ar' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors`}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold text-slate-700 ${language === 'ar' ? 'mr-1' : 'ml-1'} flex justify-between`}>
                      <span>{t('reset_password_confirm_label')}</span>
                      {confirmTouched && confirmPassword && (
                        confirmValid ? (
                          <span className="text-emerald-500 font-bold">{t('reset_password_match')}</span>
                        ) : (
                          <span className="text-red-500 font-bold">{t('reset_password_mismatch')}</span>
                        )
                      )}
                    </label>
                    <div className="relative group/input">
                      <div className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`}>
                        <ShieldCheck size={18} />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 ${language === 'ar' ? 'pr-11 pl-11' : 'pl-11 pr-11'} transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400 ${
                          confirmTouched && confirmPassword && !confirmValid ? 'border-red-300' : ''
                        }`}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onBlur={() => setConfirmTouched(true)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className={`absolute ${language === 'ar' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors`}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Math Captcha */}
                  <div>
                    <MathCaptcha onValidate={setIsCaptchaValid} />
                  </div>

                  {/* Confirm Button */}
                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={resetMutation.isPending || !passwordValid || !confirmValid || !isCaptchaValid}
                      className="w-full bg-[#ff5722] text-white font-bold py-2.5 rounded-xl hover:bg-[#e64a19] transition-all text-sm shadow-[0_4px_14px_0_rgba(255,87,34,0.39)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {resetMutation.isPending ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {t('reset_password_saving_btn')}
                        </>
                      ) : (
                        t('reset_password_confirm_btn')
                      )}
                    </button>
                  </div>
                </form>

                <div className="mt-8 flex flex-col items-center gap-4">
                  <p className="text-[13px] font-semibold text-slate-500">
                    <Link to="/login" className="text-[#ff5722] hover:text-[#e64a19] transition-colors font-bold flex items-center gap-1.5 justify-center">
                      <ArrowLeft size={15} />
                      {t('forgot_password_back_login')}
                    </Link>
                  </p>
                </div>

                <div className="mt-10 text-center">
                  <p className="text-[11px] font-semibold text-slate-400">
                    <span>{t('reset_password_need_help')} </span>
                    <a href="mailto:support@silacod.com" className="text-[#ff5722] hover:text-[#e64a19] transition-colors font-bold">
                      {t('reset_password_contact_support')}
                    </a>
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
            {success ? (
              <motion.img
                key="success"
                src="/home page silacod copy/images/reset successfully.webp"
                initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="w-full h-auto max-h-[80vh] object-contain select-none"
                alt="Password Reset Successfully Preview"
              />
            ) : (
              <motion.img
                key="form"
                src="/home page silacod copy/images/reset-password.webp"
                initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="w-full h-auto max-h-[80vh] object-contain select-none"
                alt="Reset Password Preview"
              />
            )}
          </div>
          
          {/* Soft premium gradient fading shadow from bottom to top */}
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none z-10" />
        </div>
      </div>
    </div>
  );
}
