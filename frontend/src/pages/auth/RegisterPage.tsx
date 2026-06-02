import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { settingsApi } from '../../lib/api';
import { Eye, EyeOff, User, Mail, Phone, Lock, Sparkles, Store, Link as LinkIcon } from 'lucide-react';
import { FaTiktok, FaFacebook, FaInstagram, FaSnapchatGhost, FaYoutube } from 'react-icons/fa';
import { GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  instagramUsername?: string;
  tiktokUsername?: string;
  facebookUsername?: string;
  youtubeUsername?: string;
  snapchatUsername?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  snapchatUrl?: string;
}

interface FormDataType {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: 'VENDOR' | 'INFLUENCER';
  instagramUsername: string;
  tiktokUsername: string;
  facebookUsername: string;
  youtubeUsername: string;
  snapchatUsername: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  snapchatUrl: string;
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
      if (value.trim().length < 4) return 'Le nom doit contenir au moins 4 caractères';
      if (value.trim().length > 20) return 'Le nom ne doit pas dépasser 20 caractères';
      return undefined;
    case 'email':
      if (!value) return 'L\'adresse email est requise';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Format d\'email invalide';
      return undefined;
    case 'phone':
      if (!value) return 'Le numéro de téléphone est requis';
      if (!/^\+212[5678][0-9]{8}$/.test(value)) return 'Format: +212 6XX-XXXXXX (ex: +212667619014)';
      return undefined;
    case 'instagramUsername':
    case 'tiktokUsername':
    case 'facebookUsername':
      if (value && value.trim().includes(' ')) return 'Le pseudo ne doit pas contenir d\'espaces';
      return undefined;
    case 'password':
      if (!value) return 'Le mot de passe est requis';
      if (value.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères';
      const criteriaMet = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(value)).length;
      if (criteriaMet < 3) return 'Le mot de passe doit contenir au moins 3 types de caractères (majuscule, minuscule, chiffre, symbole)';
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
  const { pathname } = useLocation();
  const defaultRole = pathname.includes('/influencer') ? 'INFLUENCER' : 'VENDOR';

  const [formData, setFormData] = useState<FormDataType>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: defaultRole,
    instagramUsername: '',
    tiktokUsername: '',
    facebookUsername: '',
    youtubeUsername: '',
    snapchatUsername: '',
    instagramUrl: '',
    tiktokUrl: '',
    facebookUrl: '',
    youtubeUrl: '',
    snapchatUrl: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  // Influencer specific states
  const [activeSocial, setActiveSocial] = useState<'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'snapchat'>('instagram');
  const [showUrlInputs, setShowUrlInputs] = useState<Record<string, boolean>>({});

  const toggleUrlInput = (social: string) => {
    setShowUrlInputs(prev => ({ ...prev, [social]: !prev[social] }));
  };
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const hasLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasLowercase = /[a-z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const hasSymbol = /[^A-Za-z0-9]/.test(formData.password);
  const criteriaMet = [hasUppercase, hasLowercase, hasNumber, hasSymbol].filter(Boolean).length;
  const isPasswordStrong = hasLength && criteriaMet >= 3;
  const getStrengthPercentage = () => {
    if (!formData.password) return 0;
    let score = 0;
    if (hasLength) score += 20;
    if (hasUppercase) score += 20;
    if (hasLowercase) score += 20;
    if (hasNumber) score += 20;
    if (hasSymbol) score += 20;
    return score;
  };
  
  const { register, registerInfluencer, googleAuth } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'phone') {
        processedValue = normalizePhone(value);
    } else if (['instagramUsername', 'tiktokUsername', 'facebookUsername', 'youtubeUsername', 'snapchatUsername'].includes(name)) {
        processedValue = value.replace('@', '');
    }

    setFormData({ ...formData, [name]: processedValue });
    
    if (touched[name]) {
      const error = validateField(name, processedValue, { ...formData, [name]: processedValue });
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'phone') {
        processedValue = normalizePhone(value);
    } else if (['instagramUsername', 'tiktokUsername', 'facebookUsername', 'youtubeUsername', 'snapchatUsername'].includes(name)) {
        processedValue = value.replace('@', '');
    }

    setTouched(prev => ({ ...prev, [name]: true }));
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    const error = validateField(name, processedValue, { ...formData, [name]: processedValue });
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;
    
    const fieldsToValidate = ['fullName', 'email', 'phone', 'password', 'confirmPassword'];
    if (formData.role === 'INFLUENCER') {
        fieldsToValidate.push('instagramUsername', 'tiktokUsername', 'facebookUsername', 'youtubeUsername', 'snapchatUsername');
    }

    fieldsToValidate.forEach(field => {
      const error = validateField(field, formData[field as keyof typeof formData], formData);
      if (error) {
        newErrors[field as keyof FormErrors] = error;
        isValid = false;
      }
    });

    if (!formData.email) {
        newErrors.email = 'L\'adresse email est requise';
        isValid = false;
    }
    if (!formData.phone) {
        newErrors.phone = 'Le numéro de téléphone est requis';
        isValid = false;
    }

    if (formData.role === 'INFLUENCER' && !formData.instagramUsername && !formData.tiktokUsername && !formData.facebookUsername && !formData.youtubeUsername && !formData.snapchatUsername) {
        toast.error('Veuillez fournir au moins un réseau social');
        isValid = false;
    }
    
    setErrors(newErrors);
    
    const fieldsToTouch: Record<string, boolean> = { fullName: true, email: true, phone: true, password: true, confirmPassword: true };
    if (formData.role === 'INFLUENCER') {
        Object.assign(fieldsToTouch, { instagramUsername: true, tiktokUsername: true, facebookUsername: true, youtubeUsername: true, snapchatUsername: true });
    }
    setTouched(fieldsToTouch);
    
    return isValid;
  };

  const handleNextStep = () => {
    let isValid = true;
    let newErrors = { ...errors };
    let newTouched = { ...touched };

    if (step === 1) {
      const fields = ['fullName', 'email', 'phone'];
      fields.forEach(field => {
        const err = validateField(field, formData[field as keyof typeof formData] as string, formData);
        if (err) { newErrors[field as keyof FormErrors] = err; isValid = false; }
        newTouched[field] = true;
      });
      if (!formData.email) {
        newErrors.email = 'L\'adresse email est requise'; isValid = false;
      }
      if (!formData.phone) {
        newErrors.phone = 'Le numéro de téléphone est requis'; isValid = false;
      }
    } else if (step === 2) {
      if (!formData.instagramUsername && !formData.tiktokUsername && !formData.facebookUsername && !formData.youtubeUsername && !formData.snapchatUsername) {
        toast.error('Veuillez fournir au moins un réseau social');
        isValid = false;
      }
    }

    setErrors(newErrors);
    setTouched(newTouched);

    if (isValid) setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      if (formData.role === 'INFLUENCER') {
        if (!registerInfluencer) throw new Error("registerInfluencer endpoint missing");
        
        await registerInfluencer({
            email: formData.email,
            phone: formData.phone || undefined,
            password: formData.password,
            fullName: formData.fullName,
            instagramUsername: formData.instagramUsername || undefined,
            tiktokUsername: formData.tiktokUsername || undefined,
            facebookUsername: formData.facebookUsername || undefined,
            youtubeUsername: formData.youtubeUsername || undefined,
            snapchatUsername: formData.snapchatUsername || undefined,
        });
        toast.success('Compte créateur créé avec succès ! Bienvenue 🎉');
        
        try {
          const statusRes = await settingsApi.getMaintenanceStatus();
          if (statusRes.data?.data?.influencerRegistrationBlocked) {
            navigate('/pending-verification');
            return;
          }
        } catch {}

        navigate('/influencer/verification');
      } else {
        const user = await register({
            email: formData.email,
            phone: formData.phone || undefined,
            password: formData.password,
            fullName: formData.fullName,
            role: 'VENDOR',
        });
        toast.success('Compte créé avec succès !');
        
        try {
          const statusRes = await settingsApi.getMaintenanceStatus();
          if (statusRes.data?.data?.registrationBlocked && !user.isActive) {
            navigate('/pending-verification');
            return;
          }
        } catch {}

        if (user.roleName === 'SUPER_ADMIN' || user.roleName === 'FINANCE_ADMIN') navigate('/admin');
        else if (user.roleName === 'CALL_CENTER_AGENT') navigate('/agent');
        else if (user.roleName === 'GROSSELLER') navigate('/grosseller');
        else navigate('/dashboard');
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
      const userRes = await googleAuth({ credential: response.credential, role: formData.role });
      toast.success('Compte Google connecté avec succès !');
      const user = userRes.user;
      
      if (user?.roleName === 'SUPER_ADMIN' || user?.roleName === 'FINANCE_ADMIN') navigate('/admin');
      else if (user?.roleName === 'CALL_CENTER_AGENT') navigate('/agent');
      else if (user?.roleName === 'GROSSELLER') navigate('/grosseller');
      else if (user?.roleName === 'INFLUENCER') navigate('/influencer');
      else navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'inscription avec Google');
    } finally {
      setIsLoading(false);
    }
  };

  const currentImage = formData.role === 'VENDOR' 
    ? '/home page silacod copy/images/photo-1622151834677-70f982c9adef.webp' 
    : '/home page silacod copy/images/9b7eeea5895229f0b36694c175ab30ed89bceca4.webp';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-['Inter'] bg-white overflow-x-hidden">
      {/* Left Column: Form Area */}
      <div className="w-full lg:w-[50%] xl:w-[45%] flex flex-col justify-center items-center p-6 bg-[#f8f9fa] relative z-10 min-h-screen">
        
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-8">
          <Link to="/" className="flex items-center gap-2">
            <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-8 h-8 object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-5 object-contain" />
          </Link>
        </div>

        <div className="w-full max-w-[400px] py-6">
            <div className="text-center space-y-2 mb-6 mt-8 lg:mt-0">
                <h1 className="text-[32px] font-extrabold text-[#2e315e] tracking-tight">Welcome To Silacod</h1>
                <p className="text-[17px] font-medium text-[#ff5722]">Please Follow the steps to continue</p>
            </div>

            {/* Role Toggle Switch */}
            <div className="flex bg-[#f4f5f7] p-1 rounded-2xl mb-6 relative max-w-[340px] mx-auto">
                <button
                    type="button"
                    onClick={() => { setFormData({ ...formData, role: 'VENDOR' }); setStep(1); }}
                    className={`flex-1 py-3 rounded-xl text-[13px] font-bold transition-all duration-300 ${
                        formData.role === 'VENDOR' ? 'bg-[#ff5722] text-white shadow-md' : 'text-[#2e315e] hover:bg-slate-200/50'
                    }`}
                >
                    I'm a Seller
                </button>
                <button
                    type="button"
                    onClick={() => { setFormData({ ...formData, role: 'INFLUENCER' }); setStep(1); }}
                    className={`flex-1 py-3 rounded-xl text-[13px] font-bold transition-all duration-300 ${
                        formData.role === 'INFLUENCER' ? 'bg-[#ff5722] text-white shadow-md' : 'text-[#2e315e] hover:bg-slate-200/50'
                    }`}
                >
                    I'm an Influencer
                </button>
            </div>

          <div className="bg-white rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <form onSubmit={handleSubmit} className="space-y-5">
              {formData.role === 'INFLUENCER' && (
                <div className="mb-6 w-full max-w-[360px] mx-auto relative px-2">
                    {/* Background line */}
                    <div className="absolute top-3.5 left-[10%] w-[80%] h-1.5 bg-[#f4f5f7] rounded-full -z-10"></div>
                    
                    {/* Active line */}
                    <div className="absolute top-3.5 left-[10%] h-1.5 bg-[#ff5722] rounded-full -z-10 transition-all duration-500" style={{ width: step === 1 ? '0%' : step === 2 ? '40%' : '80%' }}></div>
                    
                    <div className="flex justify-between relative">
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= 1 ? 'bg-[#ff5722] text-white shadow-[0_0_0_4px_#fff]' : 'bg-[#e2e8f0] text-slate-400'}`}>1</div>
                            <span className={`text-[14px] font-bold mt-2 ${step >= 1 ? 'text-[#ff5722]' : 'text-slate-300'}`}>Account</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= 2 ? 'bg-[#ff5722] text-white shadow-[0_0_0_4px_#fff]' : 'bg-[#e2e8f0] text-slate-400'}`}>2</div>
                            <span className={`text-[14px] font-bold mt-2 ${step >= 2 ? 'text-slate-400' : 'text-slate-300'}`}>Social Media</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= 3 ? 'bg-[#ff5722] text-white shadow-[0_0_0_4px_#fff]' : 'bg-[#e2e8f0] text-slate-400'}`}>3</div>
                            <span className={`text-[14px] font-bold mt-2 ${step >= 3 ? 'text-slate-400' : 'text-slate-300'}`}>Password</span>
                        </div>
                    </div>
                </div>
              )}
              
              {(formData.role === 'VENDOR' || step === 1) && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1 flex justify-between">
                        <span>Nom & Prénom</span>
                        {touched.fullName && (errors.fullName ? <span className="text-red-500 text-[10px]">Incomplet</span> : <span className="text-green-500 text-[10px]">Valide</span>)}
                    </label>
                    <div className="relative group/input">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <User size={18} />
                      </div>
                      <input
                        type="text"
                        name="fullName"
                        className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 pl-11 transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400 ${touched.fullName && errors.fullName ? '!border-red-300 !ring-red-500/10' : ''}`}
                        placeholder="Votre nom complet"
                        value={formData.fullName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 ml-1 flex justify-between">
                            <span>Email <span className="text-[#ff5722]">*</span></span>
                            {touched.email && errors.email && <span className="text-red-500 text-[10px] font-bold">Invalide</span>}
                        </label>
                        <div className="relative group/input">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <Mail size={18} />
                          </div>
                          <input
                            type="email"
                            name="email"
                            className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 pl-11 transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400 ${touched.email && errors.email ? '!border-red-300 !ring-red-500/10' : ''}`}
                            placeholder="votre@email.com"
                            value={formData.email}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            required
                          />
                        </div>
                        {touched.email && errors.email && (
                          <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.email}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 ml-1 flex justify-between">
                            <span>Numéro de téléphone <span className="text-[#ff5722]">*</span></span>
                            {touched.phone && errors.phone && <span className="text-red-500 text-[10px] font-bold">Invalide</span>}
                        </label>
                        <div className="relative group/input">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <Phone size={18} />
                          </div>
                          <input
                            type="tel"
                            name="phone"
                            className={`w-full bg-[#f8f9fa] focus:bg-white border-transparent focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 rounded-xl py-2.5 px-4 pl-11 transition-all outline-none border text-[13px] text-slate-700 font-medium placeholder:text-slate-400 ${touched.phone && errors.phone ? '!border-red-300 !ring-red-500/10' : ''}`}
                            placeholder="+212 6XX-XXXXXX"
                            value={formData.phone}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            required
                          />
                        </div>
                        {touched.phone && errors.phone && (
                          <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.phone}</p>
                        )}
                      </div>
                  </div>
                </>
              )}

              {/* Influencer Specific Fields */}
              {formData.role === 'INFLUENCER' && step === 2 && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden px-2 -mx-2"
                >
                    <div className="py-2 border-t border-slate-100 mt-2 pt-4 space-y-4 px-2">
                        <label className="block text-xs font-bold text-slate-700 ml-1 -mx-2">Vos Réseaux Sociaux <span className="text-[#ff5722]">*</span></label>
                        <div className="flex flex-wrap gap-3 py-2">
                            <button type="button" onClick={() => setActiveSocial('instagram')} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${activeSocial === 'instagram' || formData.instagramUsername ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white shadow-md' : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'} ${activeSocial === 'instagram' ? 'ring-4 ring-offset-2 ring-pink-500/40 scale-105' : ''}`}><FaInstagram className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setActiveSocial('tiktok')} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${activeSocial === 'tiktok' || formData.tiktokUsername ? 'bg-black text-white shadow-md' : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'} ${activeSocial === 'tiktok' ? 'ring-4 ring-offset-2 ring-black/30 scale-105' : ''}`}><FaTiktok className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setActiveSocial('facebook')} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${activeSocial === 'facebook' || formData.facebookUsername ? 'bg-[#1877F2] text-white shadow-md' : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'} ${activeSocial === 'facebook' ? 'ring-4 ring-offset-2 ring-[#1877F2]/40 scale-105' : ''}`}><FaFacebook className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setActiveSocial('youtube')} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${activeSocial === 'youtube' || formData.youtubeUsername ? 'bg-[#FF0000] text-white shadow-md' : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'} ${activeSocial === 'youtube' ? 'ring-4 ring-offset-2 ring-[#FF0000]/40 scale-105' : ''}`}><FaYoutube className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setActiveSocial('snapchat')} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${activeSocial === 'snapchat' || formData.snapchatUsername ? 'bg-[#FFFC00] text-black shadow-md' : 'bg-[#f8f9fa] text-slate-400 hover:bg-slate-200'} ${activeSocial === 'snapchat' ? 'ring-4 ring-offset-2 ring-[#FFFC00]/60 scale-105' : ''}`}><FaSnapchatGhost className="w-4 h-4" /></button>
                        </div>

                        <div className="space-y-4 pt-4">
                            {activeSocial === 'instagram' && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-bold">@</span>
                                        <input type="text" name="instagramUsername" className="w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 pl-10 pr-12 border border-transparent focus:bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700" placeholder="Instagram Username" value={formData.instagramUsername} onChange={handleChange} onBlur={handleBlur} />
                                        <button type="button" onClick={() => toggleUrlInput('instagram')} className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors ${showUrlInputs['instagram'] ? 'text-pink-500' : 'text-slate-400 hover:text-slate-600'}`}>
                                            <LinkIcon size={20} />
                                        </button>
                                    </div>
                                    {showUrlInputs['instagram'] && (
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                                <LinkIcon size={16} />
                                            </span>
                                            <input type="url" name="instagramUrl" className="w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 pl-10 border border-transparent focus:bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700" placeholder="https://instagram.com/..." value={formData.instagramUrl} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeSocial === 'tiktok' && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-bold">@</span>
                                        <input type="text" name="tiktokUsername" className="w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 pl-10 pr-12 border border-transparent focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700" placeholder="TikTok Username" value={formData.tiktokUsername} onChange={handleChange} onBlur={handleBlur} />
                                        <button type="button" onClick={() => toggleUrlInput('tiktok')} className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors ${showUrlInputs['tiktok'] ? 'text-black' : 'text-slate-400 hover:text-slate-600'}`}>
                                            <LinkIcon size={20} />
                                        </button>
                                    </div>
                                    {showUrlInputs['tiktok'] && (
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                                <LinkIcon size={16} />
                                            </span>
                                            <input type="url" name="tiktokUrl" className="w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 pl-10 border border-transparent focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700" placeholder="https://tiktok.com/@..." value={formData.tiktokUrl} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeSocial === 'facebook' && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-bold">@</span>
                                        <input type="text" name="facebookUsername" className="w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 pl-10 pr-12 border border-transparent focus:bg-white focus:border-[#1877F2] focus:ring-4 focus:ring-[#1877F2]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700" placeholder="Facebook Username" value={formData.facebookUsername} onChange={handleChange} onBlur={handleBlur} />
                                        <button type="button" onClick={() => toggleUrlInput('facebook')} className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors ${showUrlInputs['facebook'] ? 'text-[#1877F2]' : 'text-slate-400 hover:text-slate-600'}`}>
                                            <LinkIcon size={20} />
                                        </button>
                                    </div>
                                    {showUrlInputs['facebook'] && (
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                                <LinkIcon size={16} />
                                            </span>
                                            <input type="url" name="facebookUrl" className="w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 pl-10 border border-transparent focus:bg-white focus:border-[#1877F2] focus:ring-4 focus:ring-[#1877F2]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700" placeholder="https://facebook.com/..." value={formData.facebookUrl} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeSocial === 'youtube' && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-bold">@</span>
                                        <input type="text" name="youtubeUsername" className="w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 pl-10 pr-12 border border-transparent focus:bg-white focus:border-[#FF0000] focus:ring-4 focus:ring-[#FF0000]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700" placeholder="YouTube Username" value={formData.youtubeUsername} onChange={handleChange} onBlur={handleBlur} />
                                        <button type="button" onClick={() => toggleUrlInput('youtube')} className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors ${showUrlInputs['youtube'] ? 'text-[#FF0000]' : 'text-slate-400 hover:text-slate-600'}`}>
                                            <LinkIcon size={20} />
                                        </button>
                                    </div>
                                    {showUrlInputs['youtube'] && (
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                                <LinkIcon size={16} />
                                            </span>
                                            <input type="url" name="youtubeUrl" className="w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 pl-10 border border-transparent focus:bg-white focus:border-[#FF0000] focus:ring-4 focus:ring-[#FF0000]/10 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700" placeholder="https://youtube.com/@..." value={formData.youtubeUrl} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeSocial === 'snapchat' && (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-bold">@</span>
                                        <input type="text" name="snapchatUsername" className="w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 pl-10 pr-12 border border-transparent focus:bg-white focus:border-[#FFFC00] focus:ring-4 focus:ring-[#FFFC00]/20 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700" placeholder="Snapchat Username" value={formData.snapchatUsername} onChange={handleChange} onBlur={handleBlur} />
                                        <button type="button" onClick={() => toggleUrlInput('snapchat')} className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors ${showUrlInputs['snapchat'] ? 'text-[#d6d400]' : 'text-slate-400 hover:text-slate-600'}`}>
                                            <LinkIcon size={20} />
                                        </button>
                                    </div>
                                    {showUrlInputs['snapchat'] && (
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                                                <LinkIcon size={16} />
                                            </span>
                                            <input type="url" name="snapchatUrl" className="w-full bg-[#f8f9fa] rounded-xl py-2.5 px-4 pl-10 border border-transparent focus:bg-white focus:border-[#FFFC00] focus:ring-4 focus:ring-[#FFFC00]/20 outline-none transition-all text-[13px] font-medium placeholder:text-slate-400 text-slate-700" placeholder="https://snapchat.com/add/..." value={formData.snapchatUrl} onChange={handleChange} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
              )}

              {(formData.role === 'VENDOR' || step === 3) && (
                <div className="space-y-5 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                      <div className="relative group/input">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500">
                          <Lock size={20} />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          className={`w-full bg-transparent focus:bg-transparent border border-green-500 focus:ring-4 focus:ring-green-500/10 rounded-xl py-2.5 px-4 pl-12 pr-11 transition-all outline-none text-[13px] text-green-500 font-medium placeholder:text-green-500/60 ${touched.password && errors.password ? '!border-red-300 !ring-red-500/10 !text-red-500 placeholder:!text-red-400' : ''}`}
                          placeholder="Password"
                          value={formData.password}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          required
                          minLength={8}
                        />
                        <button
                          type="button"
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500/60 hover:text-green-500 transition-colors"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      {touched.password && errors.password && (
                        <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.password}</p>
                      )}
 
                      <div className="bg-[#f8f9fa] rounded-xl p-4 mt-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold mb-2">
                          <span className={hasLength ? 'text-green-500' : 'text-slate-400'}>+8 Characters</span>
                          <span className="text-slate-200">|</span>
                          <span className={hasUppercase ? 'text-green-500' : 'text-slate-400'}>A-Z</span>
                          <span className="text-slate-200">|</span>
                          <span className={hasLowercase ? 'text-green-500' : 'text-slate-400'}>a-z</span>
                          <span className="text-slate-200">|</span>
                          <span className={hasNumber ? 'text-green-500' : 'text-slate-400'}>0-9</span>
                          <span className="text-slate-200">|</span>
                          <span className={hasSymbol ? 'text-green-500' : 'text-slate-400'}>Symbols</span>
                        </div>
                        
                        <div className={`text-xs font-bold mb-2 ${isPasswordStrong ? 'text-green-500' : (formData.password.length > 0 ? 'text-orange-500' : 'text-slate-400')}`}>
                          {isPasswordStrong ? 'Good' : (formData.password.length > 0 ? 'Weak' : ' ')}
                        </div>
                        
                        <div className="flex h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${isPasswordStrong ? 'bg-[#51a729]' : (formData.password.length > 0 ? 'bg-[#ff9800]' : 'bg-transparent')}`} style={{ width: `${getStrengthPercentage()}%` }}></div>
                        </div>
 
                        {isPasswordStrong && (
                          <div className="text-xs text-slate-600 mt-3 flex items-center gap-1">
                            Good job! This password is strong and secure
                          </div>
                        )}
                      </div>
                    </div>
 
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 ml-1">Repeat Password</label>
                      <div className="relative group/input">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500">
                          <Lock size={20} />
                        </div>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          className={`w-full bg-transparent focus:bg-transparent border border-green-500 focus:ring-4 focus:ring-green-500/10 rounded-xl py-2.5 px-4 pl-12 pr-11 transition-all outline-none text-[13px] text-green-500 font-medium placeholder:text-green-500/60 ${touched.confirmPassword && errors.confirmPassword ? '!border-red-300 !ring-red-500/10 !text-red-500 placeholder:!text-red-400' : ''}`}
                          placeholder="Password"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500/60 hover:text-green-500 transition-colors"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      {touched.confirmPassword && errors.confirmPassword && (
                        <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.confirmPassword}</p>
                      )}
                    </div>
                </div>
              )}

              <div className="pt-3 flex gap-3">
                {formData.role === 'INFLUENCER' && step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="w-[120px] bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-200 transition-all text-sm"
                  >
                    Retour
                  </button>
                )}
                
                {formData.role === 'INFLUENCER' && step < 3 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex-1 bg-[#ff5722] text-white font-bold py-2.5 rounded-xl hover:bg-[#e64a19] transition-all text-sm shadow-[0_4px_14px_0_rgba(255,87,34,0.39)]"
                  >
                    Suivant
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="flex-1 bg-[#ff5722] text-white font-bold py-2.5 rounded-xl hover:bg-[#e64a19] transition-all text-sm shadow-[0_4px_14px_0_rgba(255,87,34,0.39)]"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Création...' : (formData.role === 'VENDOR' ? 'Créer le compte Vendeur' : 'Créer le compte Influenceur')}
                  </button>
                )}
              </div>
            </form>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="w-full flex justify-center">
                <GoogleLogin 
                  onSuccess={handleGoogleSuccess} 
                  onError={() => toast.error('Google login failed')}
                  useOneTap
                  theme="outline"
                  shape="pill"
                  size="large"
                  width="100%"
                />
              </div>
              <p className="text-[13px] font-semibold text-slate-500 mt-2">
                Vous avez déjà un compte ?{' '}
                <Link to="/login" className="text-[#ff5722] hover:text-[#e64a19] transition-colors font-bold">
                  Connectez-vous
                </Link>
              </p>
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-[11px] font-semibold text-slate-400">
                <a href="/privacy" className="hover:text-[#ff5722] transition-colors">Privacy Notice</a>
                {' | '}
                <a href="/terms" className="hover:text-[#ff5722] transition-colors">Term of service</a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Visual Area */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[55%] relative overflow-hidden bg-[#f4f6fa] items-center justify-center">
        {/* Desktop Logo */}
        <div className="absolute top-10 right-12 z-20">
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.img whileHover={{ rotateY: 15, scale: 1.05 }} src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 origin-center object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
          </Link>
        </div>

        {/* Dynamic Image */}
        <div className="relative w-full h-full p-12 flex items-center justify-center">
            <AnimatePresence mode="wait">
                <motion.img
                    key={formData.role}
                    src={currentImage}
                    initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="w-full max-w-[600px] max-h-[80vh] object-contain rounded-[2rem] shadow-2xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
                    alt={formData.role === 'VENDOR' ? 'Seller Preview' : 'Influencer Preview'}
                />
            </AnimatePresence>

            {/* Decorative background circle */}
            <motion.div 
                className="absolute inset-0 z-[-1] flex items-center justify-center pointer-events-none"
                animate={{ scale: formData.role === 'INFLUENCER' ? 1.1 : 1 }}
                transition={{ duration: 0.8 }}
            >
                <div className={`w-[600px] h-[600px] rounded-full blur-[100px] transition-colors duration-1000 ${formData.role === 'INFLUENCER' ? 'bg-[#ff5722]/10' : 'bg-[#2e315e]/10'}`}></div>
            </motion.div>
        </div>
      </div>
    </div>
  );
}


