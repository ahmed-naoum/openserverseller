import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, User, Mail, Phone, Lock, Sparkles, Globe, TrendingUp, Store, Package } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

interface FormDataType {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: string;
}

const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-]/g, '');
  if (cleaned.startsWith('+212')) return cleaned;
  if (/^[5678][0-9]{8}$/.test(cleaned)) return '+212' + cleaned;
  if (/^0[5678][0-9]{8}$/.test(cleaned)) return '+212' + cleaned.slice(1);
  return phone;
};

const validateField = (name: string, value: string, allValues?: FormDataType): string | undefined => {
  switch (name) {
    case 'fullName':
      if (!value.trim()) return 'Le nom complet est requis';
      if (value.trim().length < 2) return 'Le nom doit contenir au moins 2 caractères';
      return undefined;
    case 'email':
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Format d\'email invalide';
      return undefined;
    case 'phone':
      if (value && !/^\+212[5678][0-9]{8}$/.test(value)) return 'Format: +212 6XX-XXXXXX (ex: +212667619014)';
      return undefined;
    case 'password':
      if (!value) return 'Le mot de passe est requis';
      if (value.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères';
      return undefined;
    case 'confirmPassword':
      if (!value) return 'Veuillez confirmer votre mot de passe';
      if (allValues && value !== allValues.password) return 'Les mots de passe ne correspondent pas';
      return undefined;
    default:
      return undefined;
  }
};

export default function RegisterPage() {
  const [formData, setFormData] = useState<FormDataType>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'VENDOR', // Rôle fixé par défaut
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register, googleAuth } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const processedValue = name === 'phone' ? normalizePhone(value) : value;
    setFormData({ ...formData, [name]: processedValue });
    
    if (touched[name]) {
      const error = validateField(name, processedValue, { ...formData, [name]: processedValue });
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const processedValue = name === 'phone' ? normalizePhone(value) : value;
    setTouched(prev => ({ ...prev, [name]: true }));
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    const error = validateField(name, processedValue, { ...formData, [name]: processedValue });
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;
    
    ['fullName', 'email', 'phone', 'password', 'confirmPassword'].forEach(field => {
      const error = validateField(field, formData[field as keyof typeof formData] as string, formData);
      if (error) {
        newErrors[field as keyof FormErrors] = error;
        isValid = false;
      }
    });
    
    setErrors(newErrors);
    setTouched({ fullName: true, email: true, phone: true, password: true, confirmPassword: true });
    
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const user = await register({
        email: formData.email,
        phone: formData.phone || undefined,
        password: formData.password,
        fullName: formData.fullName,
        role: formData.role, // Sera toujours VENDOR
      });
      toast.success('Compte créé avec succès !');
      
      if (user.roleName === 'SUPER_ADMIN' || user.roleName === 'FINANCE_ADMIN') {
        navigate('/admin');
      } else if (user.roleName === 'CALL_CENTER_AGENT') {
        navigate('/agent');
      } else if (user.roleName === 'GROSSELLER') {
        navigate('/grosseller');
      } else if (user.roleName === 'INFLUENCER') {
        navigate('/influencer');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (response: any) => {
    if (!response.credential) return;
    
    setIsLoading(true);
    try {
      const user = await googleAuth({ credential: response.credential, role: formData.role });
      toast.success('Compte Google connecté avec succès !');
      
      if (user.user?.roleName === 'SUPER_ADMIN' || user.user?.roleName === 'FINANCE_ADMIN') {
        navigate('/admin');
      } else if (user.user?.roleName === 'CALL_CENTER_AGENT') {
        navigate('/agent');
      } else if (user.user?.roleName === 'GROSSELLER') {
        navigate('/grosseller');
      } else if (user.user?.roleName === 'INFLUENCER') {
        navigate('/influencer');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'inscription avec Google');
    } finally {
      setIsLoading(false);
    }
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
      </div>

      {/* Dynamic Mesh Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary-400/10 rounded-full blur-[120px] animate-mesh-light" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-accent-400/10 rounded-full blur-[150px] animate-mesh-light [animation-delay:3s]" />
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-1000 mt-8 mb-8">
        {/* Branding */}
        <div className="text-center space-y-6 mb-10">
          <Link to="/" className="inline-flex flex-col items-center gap-4 group">
            <div className="w-16 h-16 bg-white rounded-full shadow-xl shadow-slate-200/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/10 to-transparent animate-pulse" />
               <img src="/logo-icon.svg" alt="SILACOD" className="w-10 h-10 relative z-10" />
            </div>
            <img src="/logo-full.svg" alt="SILACOD" className="h-7" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#2c2f74] to-primary-600">
              Créer votre compte Vendeur
            </h1>
            <p className="text-slate-500 font-semibold tracking-wide uppercase text-[10px]">
              Rejoignez le réseau leader au Maroc
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="soft-card rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden group/card shadow-2xl bg-white/90 backdrop-blur-xl border border-white/50">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-primary-400/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700" />

          <div className="max-w-[400px] mx-auto w-full">
            <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex justify-between">
                  <span>Nom & Prénom</span>
                  {touched.fullName && (errors.fullName ? <span className="text-red-500">Incomplet</span> : <span className="text-green-500">Valide</span>)}
                </label>
                <div className="relative group/input">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${touched.fullName && errors.fullName ? 'text-red-400' : touched.fullName ? 'text-green-500' : 'text-slate-400 group-focus-within/input:text-primary-600'}`}>
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    name="fullName"
                    className={`w-full bg-slate-50/80 focus:bg-white rounded-full py-3.5 px-5 pl-11 transition-all outline-none border hover:border-slate-300 shadow-sm ${touched.fullName && errors.fullName ? 'border-red-300 ring-4 ring-red-500/10' : touched.fullName ? 'border-green-300 ring-2 ring-green-500/10' : 'border-slate-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}`}
                    placeholder="Votre nom complet"
                    value={formData.fullName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                  />
                </div>
                {touched.fullName && errors.fullName && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.fullName}</p>}
              </div>

              {/* Email & Phone Grid */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em]">Email Pro</label>
                  <div className="relative group/input">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${touched.email && errors.email ? 'text-red-400' : touched.email ? 'text-green-500' : 'text-slate-400 group-focus-within/input:text-primary-600'}`}>
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      className={`w-full bg-slate-50/80 focus:bg-white rounded-full py-3.5 px-5 pl-11 transition-all outline-none border hover:border-slate-300 shadow-sm ${touched.email && errors.email ? 'border-red-300 ring-4 ring-red-500/10' : touched.email ? 'border-green-300 ring-2 ring-green-500/10' : 'border-slate-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}`}
                      placeholder="votre@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                  </div>
                  {touched.email && errors.email && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em]">WhatsApp</label>
                  <div className="relative group/input">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${touched.phone && errors.phone ? 'text-red-400' : touched.phone && formData.phone ? 'text-green-500' : 'text-slate-400 group-focus-within/input:text-primary-600'}`}>
                      <Phone size={18} />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      className={`w-full bg-slate-50/80 focus:bg-white rounded-full py-3.5 px-5 pl-11 transition-all outline-none border hover:border-slate-300 shadow-sm ${touched.phone && errors.phone ? 'border-red-300 ring-4 ring-red-500/10' : touched.phone && formData.phone ? 'border-green-300 ring-2 ring-green-500/10' : 'border-slate-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}`}
                      placeholder="+212 6XX-XXXXXX"
                      value={formData.phone}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </div>
                  {touched.phone && errors.phone && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.phone}</p>}
                </div>
              </div>

              {/* Password & Confirm Grid */}
              <div className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em]">Mot de passe</label>
                  <div className="relative group/input">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${touched.password && errors.password ? 'text-red-400' : touched.password ? 'text-green-500' : 'text-slate-400 group-focus-within/input:text-primary-600'}`}>
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      className={`w-full bg-slate-50/80 focus:bg-white rounded-full py-3.5 px-5 pl-11 pr-11 transition-all outline-none border hover:border-slate-300 shadow-sm ${touched.password && errors.password ? 'border-red-300 ring-4 ring-red-500/10' : touched.password ? 'border-green-300 ring-2 ring-green-500/10' : 'border-slate-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}`}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {touched.password && errors.password && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.password}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em]">Confirmation</label>
                  <div className="relative group/input">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${touched.confirmPassword && errors.confirmPassword ? 'text-red-400' : touched.confirmPassword ? 'text-green-500' : 'text-slate-400 group-focus-within/input:text-primary-600'}`}>
                      <Lock size={18} />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      className={`w-full bg-slate-50/80 focus:bg-white rounded-full py-3.5 px-5 pl-11 pr-11 transition-all outline-none border hover:border-slate-300 shadow-sm ${touched.confirmPassword && errors.confirmPassword ? 'border-red-300 ring-4 ring-red-500/10' : touched.confirmPassword ? 'border-green-300 ring-2 ring-green-500/10' : 'border-slate-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}`}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {touched.confirmPassword && errors.confirmPassword && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.confirmPassword}</p>}
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-primary-600 text-white font-bold py-4 rounded-full shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-[0.98] mt-6"
                disabled={isLoading}
              >
                {isLoading ? 'Création en cours...' : 'Valider & Créer le compte Vendeur'}
              </button>

              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200/60"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest font-black">
                    <span className="px-4 bg-white text-slate-400 rounded-full">Inscription avec Google</span>
                  </div>
                </div>

                <div className="mt-6 flex justify-center w-full">
                  <GoogleLogin 
                    onSuccess={handleGoogleSuccess} 
                    onError={() => toast.error('La connexion avec Google a échoué')}
                    useOneTap
                    theme="outline"
                    shape="pill"
                    size="large"
                    text="signup_with"
                    width="400px" // Force wide button
                  />
                </div>
              </div>
            </div>
          </form>
          </div>

        </div>

        <p className="text-center text-sm text-slate-500 font-medium">
          Vous avez déjà un compte ?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-black hover:underline underline-offset-4 decoration-2">
            Connectez-vous ici
          </Link>
        </p>

        {/* Liens externes pour les autres rôles */}
        <div className="flex justify-center gap-6 mt-4">
          <Link to="/influencer/register" className="text-xs text-slate-400 hover:text-primary-600 font-medium flex items-center gap-1 transition-colors">
            <Sparkles size={12} />
            Espace Influenceurs
          </Link>

        </div>
      </div>
    </div>
  );
}
