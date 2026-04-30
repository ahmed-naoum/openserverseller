import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, Loader2, Sparkles, TrendingUp, Store, Package, Globe, KeyRound, CheckCircle2, ShieldCheck } from 'lucide-react';
import { MathCaptcha } from '../../components/common/MathCaptcha';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);

  const isSubmittingRef = React.useRef(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const forgotMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: () => {
      setSuccess(true);
      toast.success('Si un compte existe, un email a été envoyé.');
    },
    onError: () => {
      toast.error('Une erreur est survenue.');
      isSubmittingRef.current = false;
    },
    onSettled: () => {
      isSubmittingRef.current = false;
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!isCaptchaValid) {
      toast.error('Veuillez résoudre le calcul de sécurité.');
      return;
    }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    forgotMutation.mutate({ email });
  };

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
        <div className="absolute top-[50%] left-[20%] animate-float [animation-delay:3s] text-violet-200">
          <KeyRound size={50} strokeWidth={1} />
        </div>
      </div>

      {/* Dynamic Mesh Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary-400/10 rounded-full blur-[120px] animate-mesh-light" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-accent-400/10 rounded-full blur-[150px] animate-mesh-light [animation-delay:3s]" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-1000">
        {/* Branding */}
        <div className="text-center space-y-6 mb-10">
          <Link to="/" className="inline-flex flex-col items-center gap-4 group">
            <div className="w-16 h-16 bg-white rounded-full shadow-xl shadow-slate-200/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/10 to-transparent animate-pulse" />
              <img src="/new logo/logo filess-25.png" alt="SILACOD" className="w-10 h-10 relative z-10 object-contain" />
            </div>
            <img src="/new logo/logo filess-24.png" alt="SILACOD" className="h-7 object-contain" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#2c2f74] to-primary-600">
              Mot de passe oublié
            </h1>
            <p className="text-slate-500 font-semibold tracking-wide uppercase text-[10px]">
              Réinitialisez votre accès en toute sécurité
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="soft-card rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden group/card shadow-2xl bg-white/90 backdrop-blur-xl border border-white/50">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-primary-400/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700" />

          {success ? (
            /* Success State */
            <div className="text-center py-6 space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="mx-auto w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center shadow-inner">
                <CheckCircle2 size={40} className="text-emerald-500" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-800">Email envoyé !</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Si cette adresse est associée à un compte, vous recevrez un lien de réinitialisation. Vérifiez aussi vos spams.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50 rounded-2xl border border-emerald-100 max-w-xs mx-auto">
                <ShieldCheck size={14} className="text-emerald-600 flex-shrink-0" />
                <p className="text-[11px] font-semibold text-emerald-700">Le lien expirera dans 15 minutes.</p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors underline underline-offset-4 decoration-2"
              >
                <ArrowLeft size={14} />
                Retour à la connexion
              </Link>
            </div>
          ) : (
            /* Form State */
            <div className="max-w-[380px] mx-auto w-full">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex justify-between">
                    <span>Adresse e-mail</span>
                    {emailTouched && (
                      email
                        ? (emailValid ? <span className="text-green-500">Valide</span> : <span className="text-red-500">Format invalide</span>)
                        : <span className="text-red-500">Requis</span>
                    )}
                  </label>
                  <div className="relative group/input">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                      emailTouched && (!email || !emailValid)
                        ? 'text-red-400'
                        : emailTouched && emailValid
                        ? 'text-green-500'
                        : 'text-slate-400 group-focus-within/input:text-primary-600'
                    }`}>
                      <Mail size={18} />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setEmailTouched(true)}
                      className={`w-full bg-slate-50/80 focus:bg-white rounded-full py-3.5 px-5 pl-11 transition-all outline-none border hover:border-slate-300 shadow-sm ${
                        emailTouched && (!email || !emailValid)
                          ? 'border-red-300 ring-4 ring-red-500/10'
                          : emailTouched && emailValid
                          ? 'border-green-300 ring-2 ring-green-500/10'
                          : 'border-slate-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'
                      }`}
                      placeholder="vous@exemple.com"
                    />
                  </div>
                  {emailTouched && !email && (
                    <p className="text-red-500 text-[10px] font-bold ml-1">L'adresse e-mail est requise</p>
                  )}
                  {emailTouched && email && !emailValid && (
                    <p className="text-red-500 text-[10px] font-bold ml-1">Format d'email invalide</p>
                  )}
                </div>

                {/* Math Captcha */}
                <div>
                  <MathCaptcha onValidate={setIsCaptchaValid} />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={forgotMutation.isPending || !email || !isCaptchaValid}
                  className="w-full bg-primary-600 text-white font-bold py-4 rounded-full shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {forgotMutation.isPending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    'Envoyer le lien de réinitialisation'
                  )}
                </button>

                {/* Back to login */}
                <div className="pt-2 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary-600 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Retour à la connexion
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 font-medium">
          Vous n'avez pas de compte ?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700 font-black hover:underline underline-offset-4 decoration-2">
            Créez-en un gratuitement
          </Link>
        </p>
      </div>
    </div>
  );
}
