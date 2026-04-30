import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { Lock, ArrowLeft, Loader2, Eye, EyeOff, Sparkles, TrendingUp, Store, Package, Globe, ShieldCheck, XCircle } from 'lucide-react';
import { MathCaptcha } from '../../components/common/MathCaptcha';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);

  const { isPending: isVerifying, isError: isTokenInvalid } = useQuery({
    queryKey: ['verifyResetToken', token],
    queryFn: () => authApi.verifyResetToken(token!),
    enabled: !!token,
    retry: false,
  });

  const resetMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      toast.success('Mot de passe réinitialisé avec succès !');
      navigate('/login');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la réinitialisation.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Jeton de réinitialisation manquant.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!isCaptchaValid) {
      toast.error('Veuillez résoudre le calcul de sécurité.');
      return;
    }
    resetMutation.mutate({ token, password });
  };

  const passwordValid = password.length >= 8;
  const confirmValid = confirmPassword.length > 0 && confirmPassword === password;

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 bg-noise font-['Inter']">
        <div className="w-16 h-16 bg-white rounded-full shadow-xl flex items-center justify-center mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/20 to-transparent animate-pulse" />
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin relative z-10" />
        </div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Vérification du lien...</p>
      </div>
    );
  }

  if (!token || isTokenInvalid) {
    return (
      <div className="min-h-screen relative flex items-center justify-center bg-[#F8FAFC] p-4 overflow-hidden font-['Inter'] bg-noise">
        {/* Dynamic Mesh Background Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-400/10 rounded-full blur-[120px] animate-mesh-light" />
        </div>
        
        <div className="relative z-10 w-full max-w-sm space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-1000">
          <div className="soft-card rounded-[2.5rem] p-8 text-center relative overflow-hidden group/card shadow-2xl bg-white/90 backdrop-blur-xl border border-white/50">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-50 flex items-center justify-center shadow-inner mb-6">
              <XCircle size={40} className="text-red-500" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 mb-3 bg-clip-text text-transparent bg-gradient-to-r from-red-800 to-red-500">
              Lien expiré ou invalide
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-8">
              Ce lien de réinitialisation n'est plus valable. Veuillez effectuer une nouvelle demande pour modifier votre mot de passe.
            </p>
            <Link to="/forgot-password" className="w-full bg-slate-800 text-white font-bold py-4 rounded-full shadow-lg hover:bg-slate-900 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center">
              Demander un nouveau lien
            </Link>
          </div>
          <div className="pt-2 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#F8FAFC] p-4 overflow-hidden font-['Inter'] bg-noise">
      {/* Decorative Background Icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-[15%] left-[10%] animate-float [animation-delay:0s] text-primary-200">
          <Store size={64} strokeWidth={1} />
        </div>
        <div className="absolute bottom-[20%] left-[5%] animate-float [animation-delay:2s] text-accent-200">
          <Package size={80} strokeWidth={1} />
        </div>
        <div className="absolute top-[30%] right-[10%] animate-float [animation-delay:4s] text-indigo-200">
          <TrendingUp size={70} strokeWidth={1} />
        </div>
        <div className="absolute bottom-[10%] right-[15%] animate-float [animation-delay:6s] text-emerald-200">
          <Sparkles size={90} strokeWidth={1} />
        </div>
        <div className="absolute top-[10%] right-[30%] animate-float [animation-delay:1s] text-slate-200">
          <Globe size={40} strokeWidth={1} />
        </div>
        <div className="absolute top-[45%] left-[15%] animate-float [animation-delay:3s] text-rose-200">
          <ShieldCheck size={50} strokeWidth={1} />
        </div>
      </div>

      {/* Dynamic Mesh Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary-400/10 rounded-full blur-[120px] animate-mesh-light" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-accent-400/10 rounded-full blur-[150px] animate-mesh-light [animation-delay:3s]" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-1000 my-8">
        {/* Branding */}
        <div className="text-center space-y-6 mb-10">
          <Link to="/" className="inline-flex flex-col items-center gap-4 group">
            <div className="w-16 h-16 bg-white rounded-full shadow-xl shadow-slate-200/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/10 to-transparent animate-pulse" />
              <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 relative z-10 object-contain" />
            </div>
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#2c2f74] to-primary-600">
              Nouveau mot de passe
            </h1>
            <p className="text-slate-500 font-semibold tracking-wide uppercase text-[10px]">
              Sécurisez votre compte SILACOD
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="soft-card rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden group/card shadow-2xl bg-white/90 backdrop-blur-xl border border-white/50">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-primary-400/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700" />

          <div className="max-w-[380px] mx-auto w-full">
            <form className="space-y-5" onSubmit={handleSubmit}>
              
              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex justify-between">
                  <span>Nouveau mot de passe</span>
                  {passwordTouched && (
                    passwordValid ? <span className="text-green-500">Sécurisé</span> : <span className="text-red-500">Trop court (8+)</span>
                  )}
                </label>
                <div className="relative group/input">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                    passwordTouched && !passwordValid ? 'text-red-400' : passwordTouched && passwordValid ? 'text-green-500' : 'text-slate-400 group-focus-within/input:text-primary-600'
                  }`}>
                    <Lock size={18} />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setPasswordTouched(true)}
                    className={`w-full bg-slate-50/80 focus:bg-white rounded-full py-3.5 px-5 pl-11 pr-11 transition-all outline-none border hover:border-slate-300 shadow-sm ${
                      passwordTouched && !passwordValid ? 'border-red-300 ring-4 ring-red-500/10' : passwordTouched && passwordValid ? 'border-green-300 ring-2 ring-green-500/10' : 'border-slate-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex justify-between">
                  <span>Confirmation</span>
                  {confirmTouched && confirmPassword && (
                    confirmValid ? <span className="text-green-500">Correspond</span> : <span className="text-red-500">Différent</span>
                  )}
                </label>
                <div className="relative group/input">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                    confirmTouched && confirmPassword && !confirmValid ? 'text-red-400' : confirmTouched && confirmValid ? 'text-green-500' : 'text-slate-400 group-focus-within/input:text-primary-600'
                  }`}>
                    <ShieldCheck size={18} />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setConfirmTouched(true)}
                    className={`w-full bg-slate-50/80 focus:bg-white rounded-full py-3.5 px-5 pl-11 pr-11 transition-all outline-none border hover:border-slate-300 shadow-sm ${
                      confirmTouched && confirmPassword && !confirmValid ? 'border-red-300 ring-4 ring-red-500/10' : confirmTouched && confirmValid ? 'border-green-300 ring-2 ring-green-500/10' : 'border-slate-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <MathCaptcha onValidate={setIsCaptchaValid} />
              </div>

              <button
                type="submit"
                disabled={resetMutation.isPending || !passwordValid || !confirmValid || !isCaptchaValid}
                className="w-full bg-primary-600 text-white font-bold py-4 rounded-full shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 mt-6"
              >
                {resetMutation.isPending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  'Confirmer la modification'
                )}
              </button>

              <div className="pt-2 text-center">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary-600 transition-colors">
                  <ArrowLeft size={14} /> Retour à la connexion
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 font-medium">
          Besoin d'aide ?{' '}
          <a href="mailto:support@silacod.com" className="text-primary-600 hover:text-primary-700 font-black hover:underline underline-offset-4 decoration-2">
            Contactez le support
          </a>
        </p>
      </div>
    </div>
  );
}
