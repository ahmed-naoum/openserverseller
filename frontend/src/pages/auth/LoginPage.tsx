import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, ShieldCheck, Mail, Lock, TrendingUp, ShoppingCart, Store, Globe, Package } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // 2FA states
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  // Force Password Change states
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const { login, login2FA, googleAuth, forcePasswordChange } = useAuth();
  const navigate = useNavigate();

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
      
      // Redirect based on role
      if (user.role === 'SUPER_ADMIN' || user.role === 'FINANCE_ADMIN' || user.role === 'SYSTEM_SUPPORT') {
        navigate('/admin');
      } else if (user.role === 'CALL_CENTER_AGENT') {
        navigate('/agent');
      } else if (user.role === 'GROSSELLER') {
        navigate('/grosseller');
      } else if (user.role === 'INFLUENCER') {
        navigate('/influencer');
      } else if (user.role === 'UNCONFIRMED') {
        navigate('/verify');
      } else {
        navigate('/dashboard');
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
      
      // Redirect based on role
      if (user.role === 'SUPER_ADMIN' || user.role === 'FINANCE_ADMIN' || user.role === 'SYSTEM_SUPPORT') {
        navigate('/admin');
      } else if (user.role === 'CALL_CENTER_AGENT') {
        navigate('/agent');
      } else if (user.role === 'GROSSELLER') {
        navigate('/grosseller');
      } else if (user.role === 'INFLUENCER') {
        navigate('/influencer');
      } else if (user.role === 'UNCONFIRMED') {
        navigate('/verify');
      } else {
        navigate('/dashboard');
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
      
      // Redirect based on role
      if (user.role === 'SUPER_ADMIN' || user.role === 'FINANCE_ADMIN' || user.role === 'SYSTEM_SUPPORT') {
        navigate('/admin');
      } else if (user.role === 'CALL_CENTER_AGENT') {
        navigate('/agent');
      } else if (user.role === 'GROSSELLER') {
        navigate('/grosseller');
      } else if (user.role === 'INFLUENCER') {
        navigate('/influencer');
      } else if (user.role === 'UNCONFIRMED') {
        navigate('/verify');
      } else {
        navigate('/dashboard');
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
      
      // Redirect based on role
      if (user.role === 'SUPER_ADMIN' || user.role === 'FINANCE_ADMIN' || user.role === 'SYSTEM_SUPPORT') {
        navigate('/admin');
      } else if (user.role === 'CALL_CENTER_AGENT') {
        navigate('/agent');
      } else if (user.role === 'GROSSELLER') {
        navigate('/grosseller');
      } else if (user.role === 'INFLUENCER') {
        navigate('/influencer');
      } else if (user.role === 'UNCONFIRMED') {
        navigate('/verify');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la connexion avec Google');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#F8FAFC] p-4 overflow-hidden font-['Inter'] bg-noise">
      {/* Decorative Background Icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-[15%] left-[10%] animate-float [animation-delay:0s] text-primary-200">
           <ShoppingCart size={64} strokeWidth={1} />
        </div>
        <div className="absolute bottom-[20%] left-[5%] animate-float [animation-delay:2s] text-accent-200">
           <Package size={80} strokeWidth={1} />
        </div>
        <div className="absolute top-[30%] right-[10%] animate-float [animation-delay:4s] text-indigo-200">
           <TrendingUp size={70} strokeWidth={1} />
        </div>
        <div className="absolute bottom-[10%] right-[15%] animate-float [animation-delay:6s] text-emerald-200">
           <Store size={90} strokeWidth={1} />
        </div>
        <div className="absolute top-[10%] right-[30%] animate-float [animation-delay:1s] text-slate-200">
           <Globe size={40} strokeWidth={1} />
        </div>
      </div>

      {/* Dynamic Mesh Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary-400/10 rounded-full blur-[120px] animate-mesh-light" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-accent-400/10 rounded-full blur-[150px] animate-mesh-light [animation-delay:3s]" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-1000">
        {/* Branding */}
        <div className="text-center space-y-6">
          <Link to="/" className="inline-flex flex-col items-center gap-4 group">
            <div className="w-16 h-16 bg-white rounded-full shadow-xl shadow-slate-200/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/10 to-transparent animate-pulse" />
               <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 relative z-10 object-contain" />
            </div>
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#2c2f74] to-primary-600">
              C'est reparti
            </h1>
            <p className="text-slate-500 font-semibold tracking-wide uppercase text-[10px]">Propulsez votre business aujourd'hui</p>
          </div>
        </div>

        {/* Form Card */}
        <div className="soft-card rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden group/card shadow-2xl">
          {/* Card sparkle effect */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-primary-400/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700" />
          
          <div className="relative z-10 max-w-[400px] mx-auto w-full">
            {requiresPasswordChange ? (
              <form onSubmit={handleForcePasswordSubmit} className="space-y-6">
                <div className="text-center space-y-3 animate-in fade-in zoom-in duration-500">
                  <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-600 shadow-inner">
                    <Lock size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Nouveau Mot de Passe</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Vous utilisez un mot de passe temporaire. Veuillez le changer pour continuer.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-primary-600 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full bg-slate-50/80 border-slate-100 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-full py-4 px-5 pl-12 pr-12 transition-all outline-none border hover:border-slate-300 shadow-sm"
                      placeholder="Nouveau mot de passe"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  
                  <div className="relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-primary-600 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full bg-slate-50/80 border-slate-100 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-full py-4 px-5 pl-12 pr-12 transition-all outline-none border hover:border-slate-300 shadow-sm"
                      placeholder="Confirmer le mot de passe"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setRequiresPasswordChange(false);
                        setNewPassword('');
                        setConfirmNewPassword('');
                        setTempToken('');
                      }}
                      className="w-full bg-slate-50 text-slate-600 font-bold py-3.5 rounded-full hover:bg-slate-100 transition-all active:scale-[0.98]"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      className="w-full bg-rose-600 text-white font-bold py-3.5 rounded-full shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      disabled={isLoading || newPassword.length < 6}
                    >
                      {isLoading ? '...' : 'Valider'}
                    </button>
                  </div>
                </div>
              </form>
            ) : requires2FA ? (
              <form onSubmit={handle2FASubmit} className="space-y-6">
                <div className="text-center space-y-3 animate-in fade-in zoom-in duration-500">
                  <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto text-primary-600 shadow-inner">
                    <ShieldCheck size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Vérification</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Saisissez le code de validation 2FA.
                  </p>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="000 000"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-slate-50/50 border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-full py-4 text-center text-3xl font-mono tracking-[0.4em] transition-all outline-none"
                    required
                  />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRequires2FA(false);
                        setTwoFactorCode('');
                        setTwoFactorToken('');
                      }}
                      className="w-full bg-slate-50 text-slate-600 font-bold py-3.5 rounded-full hover:bg-slate-100 transition-all active:scale-[0.98]"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      className="w-full bg-primary-600 text-white font-bold py-3.5 rounded-full shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      disabled={isLoading || twoFactorCode.length !== 6}
                    >
                      {isLoading ? '...' : 'Valider'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2 animate-in fade-in slide-in-from-left-1 duration-500 stagger-1">
                    <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em]">Email Professionnel</label>
                    <div className="relative group/input">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-primary-600 transition-colors">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        className="w-full bg-slate-50/80 border-slate-100 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-full py-4 px-5 pl-12 transition-all outline-none border hover:border-slate-300 shadow-sm"
                        placeholder="nom@exemple.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-500 stagger-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Mot de passe</label>
                      <Link to="/forgot-password" title="Mot de passe oublié ?" className="text-[11px] font-black text-primary-600 hover:text-primary-700 focus:outline-none tracking-wider">
                        OUBLIÉ ?
                      </Link>
                    </div>
                    <div className="relative group/input">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-primary-600 transition-colors">
                        <Lock size={18} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="w-full bg-slate-50/80 border-slate-100 focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-full py-4 px-5 pl-12 pr-12 transition-all outline-none border hover:border-slate-300 shadow-sm"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 animate-in fade-in slide-in-from-bottom-2 duration-500 stagger-3">
                    <label className="flex items-center gap-3 group cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                      <div className="relative flex items-center justify-center">
                        <div className={`w-5 h-5 rounded-lg border transition-all flex items-center justify-center ${rememberMe ? 'border-primary-500 bg-white' : 'border-slate-200 bg-slate-50'}`}>
                           <svg 
                             className={`w-3.5 h-3.5 text-primary-600 transition-all duration-300 ${rememberMe ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} 
                             fill="none" 
                             viewBox="0 0 24 24" 
                             stroke="currentColor" 
                             strokeWidth="4"
                           >
                             <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                           </svg>
                        </div>
                      </div>
                      <span className="text-[13px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Rester connecté</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="btn-premium w-full py-4.5 rounded-full text-lg font-black hover:translate-y-[-2px] shadow-[0_10px_30px_rgba(44,47,116,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-500 stagger-4"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Connexion en cours...' : 'Se connecter'}
                  </button>
                </form>

                <div className="mt-8 flex items-center gap-4 animate-in fade-in duration-1000 stagger-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">OU</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                </div>

                <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500 stagger-4">
                  <div className="transition-transform hover:scale-[1.02] active:scale-[0.98] flex justify-center w-full">
                    <GoogleLogin 
                      onSuccess={handleGoogleSuccess} 
                      onError={() => toast.error('Échec Google')}
                      useOneTap
                      theme="outline"
                      shape="pill"
                      size="large"
                      width="100%"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 pb-4">
          <p className="text-sm font-bold text-slate-400">
            Nouveau sur SILACOD ?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-black transition-all hover:underline underline-offset-4 decoration-2">
              Ouvrez votre boutique
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
