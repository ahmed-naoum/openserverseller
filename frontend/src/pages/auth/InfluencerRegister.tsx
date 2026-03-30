import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FaTiktok, FaFacebook, FaEye, FaEyeSlash, FaInstagram, FaSnapchatGhost, FaYoutube } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

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
      if (value && value.trim().includes(' ')) return 'Le pseudo ne doit pas contenir d\'espaces';
      return undefined;
    case 'tiktokUsername':
      if (value && value.trim().includes(' ')) return 'Le pseudo ne doit pas contenir d\'espaces';
      return undefined;
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
    // Strip the @ from instagram username if they add it
    let processedValue = value;
    if (name === 'phone') {
        processedValue = normalizePhone(value);
    } else if (['instagramUsername', 'tiktokUsername', 'facebookUsername', 'xUsername', 'youtubeUsername', 'snapchatUsername'].includes(name)) {
        processedValue = value.replace('@', '');
    }

    setFormData({ ...formData, [name]: processedValue });
    
    if (touched[name]) {
      const error = validateField(name, processedValue, formData);
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
        newErrors.email = 'Veuillez fournir un email ou un numéro de téléphone';
        newErrors.phone = 'Veuillez fournir un email ou un numéro de téléphone';
        isValid = false;
    }

    if (!formData.instagramUsername && !formData.tiktokUsername && !formData.facebookUsername && !formData.xUsername && !formData.youtubeUsername && !formData.snapchatUsername) {
        const socialError = 'Veuillez fournir au moins un réseau social (Instagram, TikTok, Facebook, X, YouTube ou Snapchat)';
        newErrors.instagramUsername = socialError;
        newErrors.tiktokUsername = socialError;
        newErrors.facebookUsername = socialError;
        newErrors.xUsername = socialError;
        newErrors.youtubeUsername = socialError;
        newErrors.snapchatUsername = socialError;
        toast.error(socialError);
        isValid = false;
    }
    
    setErrors(newErrors);
    setTouched({ fullName: true, email: true, phone: true, instagramUsername: true, tiktokUsername: true, facebookUsername: true, xUsername: true, youtubeUsername: true, snapchatUsername: true, password: true, confirmPassword: true });
    
    return isValid;
  };

  const getInputClass = (fieldName: string) => {
    const baseClass = 'input';
    if (touched[fieldName] && errors[fieldName as keyof FormErrors]) {
      return `${baseClass} border-red-500 focus:border-red-500 focus:ring-red-500`;
    }
    if (touched[fieldName] && !errors[fieldName as keyof FormErrors]) {
      return `${baseClass} border-green-500 focus:border-green-500 focus:ring-green-500`;
    }
    return baseClass;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      if (registerInfluencer) {
        const user = await registerInfluencer({
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
        setIsSuccess(true);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
            <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl text-center border border-gray-100">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Inscription réussie !</h2>
                <p className="text-gray-600 mb-6">
                    Votre compte influenceur a été créé. Comme vous êtes un influenceur, votre compte doit être vérifié par notre équipe (KYC PENDING).
                </p>
                <div className="bg-orange-50 text-orange-800 p-4 rounded-lg mb-8 text-sm">
                    Votre nombre d'abonnés Instagram a été validé ! Nous examinerons votre profil dans les plus brefs délais.
                </div>
                <button 
                    onClick={() => navigate('/login')}
                    className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-medium py-3 px-4 flex items-center justify-center rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                >
                    Aller à la connexion
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo-icon.svg" alt="SILACOD" className="w-10 h-10" />
            <span className="font-bold text-2xl text-gray-900">SILACOD Influenceur</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Rejoignez le programme</h1>
          <p className="text-gray-600 mt-2">Monétisez votre audience avec vos produits préférés<br/>(+5000 abonnés requis)</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                <input
                type="text"
                name="fullName"
                className={getInputClass('fullName')}
                placeholder="Votre nom complet"
                value={formData.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                />
                {touched.fullName && errors.fullName && (
                <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                type="email"
                name="email"
                className={getInputClass('email')}
                placeholder="votre@email.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                />
                {touched.email && errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone (Optionnel si Email)</label>
                <input
                type="tel"
                name="phone"
                className={getInputClass('phone')}
                placeholder="+212 6XX-XXXXXX"
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                />
                {touched.phone && errors.phone && (
                <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
                )}
            </div>

            {/* Socials Toggle */}
            <div className="pt-2 border-t border-gray-100 mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                Réseaux sociaux <span className="text-red-500">*</span> (Au moins un requis)
              </label>
              <div className="flex justify-center gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => setShowInstagram(!showInstagram)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
                    showInstagram 
                      ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white ring-2 ring-pink-500 ring-offset-2' 
                      : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-pink-500 hover:shadow-md hover:-translate-y-1'
                  }`}
                  title="Ajouter Instagram"
                >
                  <FaInstagram className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTiktok(!showTiktok)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
                    showTiktok 
                      ? 'bg-black text-white ring-2 ring-black ring-offset-2' 
                      : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-black hover:shadow-md hover:-translate-y-1'
                  }`}
                  title="Ajouter TikTok"
                >
                  <FaTiktok className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowFacebook(!showFacebook)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
                    showFacebook 
                      ? 'bg-[#1877F2] text-white ring-2 ring-[#1877F2] ring-offset-2' 
                      : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-[#1877F2] hover:shadow-md hover:-translate-y-1'
                  }`}
                  title="Ajouter Facebook"
                >
                  <FaFacebook className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowX(!showX)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
                    showX 
                      ? 'bg-black text-white ring-2 ring-black ring-offset-2' 
                      : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-black hover:shadow-md hover:-translate-y-1'
                  }`}
                  title="Ajouter X (Twitter)"
                >
                  <FaXTwitter className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowYoutube(!showYoutube)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
                    showYoutube 
                      ? 'bg-[#FF0000] text-white ring-2 ring-[#FF0000] ring-offset-2' 
                      : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-[#FF0000] hover:shadow-md hover:-translate-y-1'
                  }`}
                  title="Ajouter YouTube"
                >
                  <FaYoutube className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSnapchat(!showSnapchat)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
                    showSnapchat 
                      ? 'bg-[#FFFC00] text-black ring-2 ring-[#FFFC00] ring-offset-2' 
                      : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-[#FFFC00] hover:shadow-md hover:-translate-y-1'
                  }`}
                  title="Ajouter Snapchat"
                >
                  <FaSnapchatGhost className="w-5 h-5" />
                </button>
              </div>

              {(showInstagram || showTiktok || showFacebook || showX || showYoutube || showSnapchat) && (
                <div className="space-y-4 p-5 bg-gray-50/80 rounded-2xl border border-gray-100 shadow-inner animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Instagram Input */}
                  {showInstagram && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <FaInstagram className="text-pink-500 w-4 h-4" /> Profil Instagram
                      </label>
                      <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium">@</span>
                          <input
                              type="text"
                              name="instagramUsername"
                              className={`${getInputClass('instagramUsername')} pl-8 bg-white border-gray-200 focus:border-pink-500 focus:ring-pink-500/10 transition-colors`}
                              placeholder="votre_pseudo_instagram"
                              value={formData.instagramUsername}
                              onChange={handleChange}
                              onBlur={handleBlur}
                          />
                      </div>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <svg className="w-3 h-3 text-cyan-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path></svg>
                          Une vérification sera effectuée pour s'assurer que vous avez +5000 abonnés.
                      </p>
                      {touched.instagramUsername && errors.instagramUsername && (
                      <p className="text-red-500 text-xs mt-1">{errors.instagramUsername}</p>
                      )}
                    </div>
                  )}

                  {/* TikTok Input */}
                  {showTiktok && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <FaTiktok className="text-black w-4 h-4" /> Profil TikTok
                      </label>
                      <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium">@</span>
                          <input
                              type="text"
                              name="tiktokUsername"
                              className={`${getInputClass('tiktokUsername')} pl-8 bg-white border-gray-200 focus:border-black focus:ring-black/10 transition-colors`}
                              placeholder="votre_pseudo_tiktok"
                              value={formData.tiktokUsername}
                              onChange={handleChange}
                              onBlur={handleBlur}
                          />
                      </div>
                      {touched.tiktokUsername && errors.tiktokUsername && (
                      <p className="text-red-500 text-xs mt-1">{errors.tiktokUsername}</p>
                      )}
                    </div>
                  )}

                  {/* Facebook Input */}
                  {showFacebook && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <FaFacebook className="text-[#1877F2] w-4 h-4" /> Profil Facebook
                      </label>
                      <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium">@</span>
                          <input
                              type="text"
                              name="facebookUsername"
                              className={`${getInputClass('facebookUsername')} pl-8 bg-white border-gray-200 focus:border-[#1877F2] focus:ring-[#1877F2]/10 transition-colors`}
                              placeholder="votre_pseudo_facebook"
                              value={formData.facebookUsername}
                              onChange={handleChange}
                              onBlur={handleBlur}
                          />
                      </div>
                      {touched.facebookUsername && errors.facebookUsername && (
                      <p className="text-red-500 text-xs mt-1">{errors.facebookUsername}</p>
                      )}
                    </div>
                  )}

                  {/* X (Twitter) Input */}
                  {showX && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <FaXTwitter className="w-4 h-4 text-black" /> 
                        Profil X (Twitter)
                      </label>
                      <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium">@</span>
                          <input
                              type="text"
                              name="xUsername"
                              className={`${getInputClass('xUsername')} pl-8 bg-white border-gray-200 focus:border-black focus:ring-black/10 transition-colors`}
                              placeholder="votre_pseudo_x"
                              value={formData.xUsername}
                              onChange={handleChange}
                              onBlur={handleBlur}
                          />
                      </div>
                      {touched.xUsername && errors.xUsername && (
                      <p className="text-red-500 text-xs mt-1">{errors.xUsername}</p>
                      )}
                    </div>
                  )}

                  {/* YouTube Input */}
                  {showYoutube && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <FaYoutube className="w-4 h-4 text-[#FF0000]" />
                        Chaîne YouTube
                      </label>
                      <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium">@</span>
                          <input
                              type="text"
                              name="youtubeUsername"
                              className={`${getInputClass('youtubeUsername')} pl-8 bg-white border-gray-200 focus:border-[#FF0000] focus:ring-[#FF0000]/10 transition-colors`}
                              placeholder="votre_pseudo_youtube"
                              value={formData.youtubeUsername}
                              onChange={handleChange}
                              onBlur={handleBlur}
                          />
                      </div>
                      {touched.youtubeUsername && errors.youtubeUsername && (
                      <p className="text-red-500 text-xs mt-1">{errors.youtubeUsername}</p>
                      )}
                    </div>
                  )}

                  {/* Snapchat Input */}
                  {showSnapchat && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                         <FaSnapchatGhost className="w-4 h-4 text-[#FFFC00]" />
                        Profil Snapchat
                      </label>
                      <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium">@</span>
                          <input
                              type="text"
                              name="snapchatUsername"
                              className={`${getInputClass('snapchatUsername')} pl-8 bg-white border-gray-200 focus:border-[#FFFC00] focus:ring-[#FFFC00]/10 transition-colors`}
                              placeholder="votre_pseudo_snapchat"
                              value={formData.snapchatUsername}
                              onChange={handleChange}
                              onBlur={handleBlur}
                          />
                      </div>
                      {touched.snapchatUsername && errors.snapchatUsername && (
                      <p className="text-red-500 text-xs mt-1">{errors.snapchatUsername}</p>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>

            <div className="bg-purple-100/50 p-3 rounded-xl border border-purple-100 flex gap-3 items-start mt-2">
                    <div className="bg-purple-200 text-purple-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    </div>
                    <p className="text-xs text-purple-800 font-medium leading-tight pt-0.5">
                        Ajouter plus de réseaux augmente vos chances d'obtenir de meilleures commissions et des campagnes exclusives !
                    </p>
                  </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            className={getInputClass('password')}
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            required
                            minLength={8}
                        />
                        <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                        </button>
                    </div>
                    {touched.password && errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            name="confirmPassword"
                            className={getInputClass('confirmPassword')}
                            placeholder="••••••••"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            required
                        />
                        <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                            {showConfirmPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                        </button>
                    </div>
                    {touched.confirmPassword && errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
                    )}
                </div>
            </div>

            <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-medium py-3 px-4 flex items-center justify-center rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 mt-6 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading}
            >
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Vérification Instagram en cours...
                    </span>
                ) : 'S\'inscrire comme Influenceur'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6 pt-6 border-t border-gray-100">
            En créant un compte, vous acceptez nos{' '}
            <a href="#" className="text-fuchsia-600 hover:text-fuchsia-700">Conditions</a>
            {' '}et notre{' '}
            <a href="#" className="text-fuchsia-600 hover:text-fuchsia-700">Politique</a>
          </p>
        </div>

        <p className="text-center mt-6 text-gray-600">
          Déjà influenceur chez nous?{' '}
          <Link to="/login" className="text-fuchsia-600 hover:text-fuchsia-700 font-medium whitespace-nowrap">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
