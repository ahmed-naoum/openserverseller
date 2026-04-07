import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FaTiktok, FaFacebook, FaEye, FaEyeSlash, FaInstagram, FaSnapchatGhost, FaYoutube } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { User, Mail, Phone, Lock, Sparkles, Camera, Star, Heart, Share2, Store } from 'lucide-react';

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  instagramUsername?: string;
  tiktokUsername?: string;
  facebookUsername?: string;
  xUsername?: string;
  youtubeUsername?: string;
  snapchatUsername?: string;
}

interface FormDataType {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  instagramUsername: string;
  tiktokUsername: string;
  facebookUsername: string;
  xUsername: string;
  youtubeUsername: string;
  snapchatUsername: string;
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
    case 'instagramUsername':
    case 'tiktokUsername':
    case 'facebookUsername':
      if (value && value.trim().includes(' ')) return 'Le pseudo ne doit pas contenir d\'espaces';
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

export default function InfluencerRegister() {
  const [formData, setFormData] = useState<FormDataType>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    instagramUsername: '',
    tiktokUsername: '',
    facebookUsername: '',
    xUsername: '',
    youtubeUsername: '',
    snapchatUsername: '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showInstagram, setShowInstagram] = useState(true);
  const [showTiktok, setShowTiktok] = useState(false);
  const [showFacebook, setShowFacebook] = useState(false);
  const [showX, setShowX] = useState(false);
  const [showYoutube, setShowYoutube] = useState(false);
  const [showSnapchat, setShowSnapchat] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { registerInfluencer } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'phone') {
        processedValue = normalizePhone(value);
    } else if (['instagramUsername', 'tiktokUsername', 'facebookUsername', 'xUsername', 'youtubeUsername', 'snapchatUsername'].includes(name)) {
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
    } else if (['instagramUsername', 'tiktokUsername', 'facebookUsername', 'xUsername', 'youtubeUsername', 'snapchatUsername'].includes(name)) {
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
    
    ['fullName', 'email', 'phone', 'instagramUsername', 'tiktokUsername', 'facebookUsername', 'xUsername', 'youtubeUsername', 'snapchatUsername', 'password', 'confirmPassword'].forEach(field => {
      const error = validateField(field, formData[field as keyof typeof formData], formData);
      if (error) {
        newErrors[field as keyof FormErrors] = error;
        isValid = false;
      }
    });

    if (!formData.email && !formData.phone) {
        newErrors.email = 'Requis';
        newErrors.phone = 'Requis';
        isValid = false;
    }

    if (!formData.instagramUsername && !formData.tiktokUsername && !formData.facebookUsername && !formData.xUsername && !formData.youtubeUsername && !formData.snapchatUsername) {
        toast.error('Veuillez fournir au moins un réseau social');
        isValid = false;
    }
    
    setErrors(newErrors);
    setTouched({ fullName: true, email: true, phone: true, instagramUsername: true, tiktokUsername: true, facebookUsername: true, xUsername: true, youtubeUsername: true, snapchatUsername: true, password: true, confirmPassword: true });
    
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (registerInfluencer) {
        await registerInfluencer({
            email: formData.email,
            phone: formData.phone || undefined,
            password: formData.password,
            fullName: formData.fullName,
            instagramUsername: formData.instagramUsername || undefined,
            tiktokUsername: formData.tiktokUsername || undefined,
            facebookUsername: formData.facebookUsername || undefined,
            xUsername: formData.xUsername || undefined,
            youtubeUsername: formData.youtubeUsername || undefined,
            snapchatUsername: formData.snapchatUsername || undefined,
        });
        toast.success('Compte créateur créé avec succès ! Bienvenue 🎉');
        navigate('/influencer/verification');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#F8FAFC] p-4 overflow-hidden font-['Inter'] bg-noise">
      {/* Decorative Background Icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-[15%] left-[10%] animate-float [animation-delay:0s] text-primary-200">
           <Camera size={64} strokeWidth={1} />
        </div>
        <div className="absolute bottom-[20%] left-[5%] animate-float [animation-delay:2s] text-accent-200">
           <Heart size={80} strokeWidth={1} />
        </div>
        <div className="absolute top-[30%] right-[10%] animate-float [animation-delay:4s] text-indigo-200">
           <Share2 size={70} strokeWidth={1} />
        </div>
        <div className="absolute bottom-[10%] right-[15%] animate-float [animation-delay:6s] text-emerald-200">
           <Sparkles size={90} strokeWidth={1} />
        </div>
        <div className="absolute top-[10%] right-[30%] animate-float [animation-delay:1s] text-slate-200">
           <Star size={40} strokeWidth={1} />
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
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-accent-500">
              Programme Influenceurs
            </h1>
            <p className="text-slate-500 font-semibold tracking-wide uppercase text-[10px]">
              Monétisez votre audience (+5000 abonnés requis)
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="soft-card rounded-[2.5rem] p-6 sm:p-8 relative overflow-hidden group/card shadow-2xl bg-white/90 backdrop-blur-xl border border-white/50">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-primary-400/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700" />

          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex justify-between">
                  <span>Nom & Prénom / Agence</span>
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
                  <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em]">Contact Email</label>
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

              {/* Social Networks Selector */}
              <div className="py-4 border-t border-slate-100 mt-6 pt-6">
                <label className="block text-center text-xs font-black text-[#2c2f74] uppercase tracking-widest mb-4">
                  Vos Canaux Sociaux <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap justify-center gap-3 mb-6">
                  {/* Instagam */}
                  <button
                    type="button"
                    onClick={() => setShowInstagram(!showInstagram)}
                    className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all duration-300 shadow-sm ${
                      showInstagram 
                        ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white shadow-pink-500/30 shadow-lg scale-110 ring-2 ring-pink-500/50 ring-offset-2' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300 hover:text-pink-500 hover:shadow-md hover:-translate-y-1'
                    }`}
                  >
                    <FaInstagram className="w-6 h-6" />
                  </button>
                  {/* TikTok */}
                  <button
                    type="button"
                    onClick={() => setShowTiktok(!showTiktok)}
                    className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all duration-300 shadow-sm ${
                      showTiktok 
                        ? 'bg-black text-white shadow-black/30 shadow-lg scale-110 ring-2 ring-black/50 ring-offset-2' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300 hover:text-black hover:shadow-md hover:-translate-y-1'
                    }`}
                  >
                    <FaTiktok className="w-6 h-6" />
                  </button>
                  {/* Facebook */}
                  <button
                    type="button"
                    onClick={() => setShowFacebook(!showFacebook)}
                    className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all duration-300 shadow-sm ${
                      showFacebook 
                        ? 'bg-[#1877F2] text-white shadow-blue-500/30 shadow-lg scale-110 ring-2 ring-[#1877F2]/50 ring-offset-2' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300 hover:text-[#1877F2] hover:shadow-md hover:-translate-y-1'
                    }`}
                  >
                    <FaFacebook className="w-6 h-6" />
                  </button>
                  {/* X / Twitter */}
                  <button
                    type="button"
                    onClick={() => setShowX(!showX)}
                    className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all duration-300 shadow-sm ${
                      showX 
                        ? 'bg-black text-white shadow-black/30 shadow-lg scale-110 ring-2 ring-black/50 ring-offset-2' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300 hover:text-black hover:shadow-md hover:-translate-y-1'
                    }`}
                  >
                    <FaXTwitter className="w-6 h-6" />
                  </button>
                  {/* YouTube */}
                  <button
                    type="button"
                    onClick={() => setShowYoutube(!showYoutube)}
                    className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all duration-300 shadow-sm ${
                      showYoutube 
                        ? 'bg-[#FF0000] text-white shadow-red-500/30 shadow-lg scale-110 ring-2 ring-[#FF0000]/50 ring-offset-2' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300 hover:text-[#FF0000] hover:shadow-md hover:-translate-y-1'
                    }`}
                  >
                    <FaYoutube className="w-6 h-6" />
                  </button>
                  {/* Snapchat */}
                  <button
                    type="button"
                    onClick={() => setShowSnapchat(!showSnapchat)}
                    className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all duration-300 shadow-sm ${
                      showSnapchat 
                        ? 'bg-[#FFFC00] text-black shadow-yellow-500/30 shadow-lg scale-110 ring-2 ring-[#FFFC00]/50 ring-offset-2' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300 hover:text-[#FFFC00] hover:shadow-md hover:-translate-y-1'
                    }`}
                  >
                    <FaSnapchatGhost className="w-6 h-6" />
                  </button>
                </div>

                <div className="bg-primary-50 p-4 rounded-full border border-primary-100 flex gap-3 items-start mb-6">
                  <div className="bg-primary-200 text-primary-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <p className="text-xs text-primary-800 font-bold mt-1">
                      Les influenceurs vérifiés avec plusieurs plateformes bénéficient de taux de commissions exclusifs !
                  </p>
                </div>

                {/* Dynamic Fields */}
                {(showInstagram || showTiktok || showFacebook || showX || showYoutube || showSnapchat) && (
                  <div className="space-y-4 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 shadow-inner animate-in fade-in slide-in-from-top-2 duration-300">
                    
                    {showInstagram && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                        <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex items-center gap-1.5">
                          <FaInstagram className="text-pink-500" /> Profil Instagram
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-black">@</span>
                            <input
                                type="text"
                                name="instagramUsername"
                                className="w-full bg-white rounded-full py-3 px-5 pl-10 border border-slate-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all shadow-sm focus:shadow-md"
                                placeholder="votre_pseudo"
                                value={formData.instagramUsername}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                        </div>
                        {touched.instagramUsername && errors.instagramUsername && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.instagramUsername}</p>}
                      </div>
                    )}

                    {showTiktok && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                        <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex items-center gap-1.5">
                          <FaTiktok className="text-black" /> Profil TikTok
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-black">@</span>
                            <input
                                type="text"
                                name="tiktokUsername"
                                className="w-full bg-white rounded-full py-3 px-5 pl-10 border border-slate-200 focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all shadow-sm focus:shadow-md"
                                placeholder="votre_pseudo"
                                value={formData.tiktokUsername}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                        </div>
                        {touched.tiktokUsername && errors.tiktokUsername && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.tiktokUsername}</p>}
                      </div>
                    )}

                    {showFacebook && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                        <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex items-center gap-1.5">
                          <FaFacebook className="text-[#1877F2]" /> Profil Facebook
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-black">@</span>
                            <input
                                type="text"
                                name="facebookUsername"
                                className="w-full bg-white rounded-full py-3 px-5 pl-10 border border-slate-200 focus:border-[#1877F2] focus:ring-4 focus:ring-[#1877F2]/10 outline-none transition-all shadow-sm focus:shadow-md"
                                placeholder="votre_pseudo"
                                value={formData.facebookUsername}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                        </div>
                        {touched.facebookUsername && errors.facebookUsername && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.facebookUsername}</p>}
                      </div>
                    )}

                    {showX && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                        <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex items-center gap-1.5">
                          <FaXTwitter className="text-black" /> Profil X (Twitter)
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-black">@</span>
                            <input
                                type="text"
                                name="xUsername"
                                className="w-full bg-white rounded-full py-3 px-5 pl-10 border border-slate-200 focus:border-black focus:ring-4 focus:ring-black/5 outline-none transition-all shadow-sm focus:shadow-md"
                                placeholder="votre_pseudo"
                                value={formData.xUsername}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                        </div>
                        {touched.xUsername && errors.xUsername && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.xUsername}</p>}
                      </div>
                    )}

                    {showYoutube && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                        <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex items-center gap-1.5">
                          <FaYoutube className="text-[#FF0000]" /> Chaîne YouTube
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-black">@</span>
                            <input
                                type="text"
                                name="youtubeUsername"
                                className="w-full bg-white rounded-full py-3 px-5 pl-10 border border-slate-200 focus:border-[#FF0000] focus:ring-4 focus:ring-[#FF0000]/10 outline-none transition-all shadow-sm focus:shadow-md"
                                placeholder="votre_chaine"
                                value={formData.youtubeUsername}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                        </div>
                        {touched.youtubeUsername && errors.youtubeUsername && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.youtubeUsername}</p>}
                      </div>
                    )}

                    {showSnapchat && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                        <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex items-center gap-1.5">
                          <FaSnapchatGhost className="text-[#FFFC00]" /> Profil Snapchat
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-black">@</span>
                            <input
                                type="text"
                                name="snapchatUsername"
                                className="w-full bg-white rounded-full py-3 px-5 pl-10 border border-slate-200 focus:border-[#FFFC00] focus:ring-4 focus:ring-yellow-400/20 outline-none transition-all shadow-sm focus:shadow-md"
                                placeholder="votre_pseudo"
                                value={formData.snapchatUsername}
                                onChange={handleChange}
                                onBlur={handleBlur}
                            />
                        </div>
                        {touched.snapchatUsername && errors.snapchatUsername && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.snapchatUsername}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Password & Confirm Grid */}
              <div className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em]">Sécurité</label>
                  <div className="relative group/input">
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${touched.password && errors.password ? 'text-red-400' : touched.password ? 'text-green-500' : 'text-slate-400 group-focus-within/input:text-primary-600'}`}>
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      className={`w-full bg-slate-50/80 focus:bg-white rounded-full py-3.5 px-5 pl-11 pr-11 transition-all outline-none border hover:border-slate-300 shadow-sm ${touched.password && errors.password ? 'border-red-300 ring-4 ring-red-500/10' : touched.password ? 'border-green-300 ring-2 ring-green-500/10' : 'border-slate-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10'}`}
                      placeholder="Mot de passe secret"
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
                      {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
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
                      {showConfirmPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                    </button>
                  </div>
                  {touched.confirmPassword && errors.confirmPassword && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.confirmPassword}</p>}
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-primary-600 text-white font-bold py-4 rounded-full shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-[0.98] mt-8 overflow-hidden relative group"
                disabled={isLoading}
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Phase de vérification...
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        Créer mon compte Créateur
                        <Sparkles className="w-4 h-4" />
                    </span>
                )}
              </button>
            </div>
          </form>


        </div>

        <p className="text-center text-sm text-slate-500 font-medium">
          Vous êtes déjà de la famille ?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-black hover:underline underline-offset-4 decoration-2">
            Identifiez-vous
          </Link>
        </p>

        {/* Back to regular register */}
        <div className="flex justify-center mt-4 mb-10">
          <Link to="/register" className="text-xs text-slate-400 hover:text-primary-600 font-medium flex items-center gap-1 transition-colors">
            <Store size={12} />
            Retour à l'inscription E-Commerce (Classique)
          </Link>
        </div>
      </div>
    </div>
  );
}
