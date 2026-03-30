import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
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
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'VENDOR',
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
      const error = validateField(name, processedValue, formData);
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

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;
    
    ['fullName', 'email', 'phone', 'password', 'confirmPassword'].forEach(field => {
      const error = validateField(field, formData[field as keyof typeof formData], formData);
      if (error) {
        newErrors[field as keyof FormErrors] = error;
        isValid = false;
      }
    });
    
    setErrors(newErrors);
    setTouched({ fullName: true, email: true, phone: true, password: true, confirmPassword: true });
    
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
    
    if (step === 1) {
      if (!validateStep1()) {
        return;
      }
      setStep(2);
      return;
    }

    setIsLoading(true);

    try {
      const user = await register({
        email: formData.email,
        phone: formData.phone || undefined,
        password: formData.password,
        fullName: formData.fullName,
        role: formData.role,
      });
      toast.success('Compte créé avec succès!');
      if (!user.user?.isActive) {
        navigate('/pending-verification');
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
      toast.success('Compte Google connecté avec succès!');
      
      if (!user.user?.isActive) {
        navigate('/verify');
      } else {
        // Redirect based on role
        if (user.user?.roleName === 'SUPER_ADMIN' || user.user?.roleName === 'FINANCE_ADMIN') {
          navigate('/admin');
        } else if (user.user?.roleName === 'CALL_CENTER_AGENT') {
          navigate('/agent');
        } else if (user.user?.roleName === 'GROSSELLER') {
          navigate('/grosseller');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'inscription avec Google');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo-icon.svg" alt="SILACOD" className="w-10 h-10" />
            <img src="/logo-full.svg" alt="SILACOD" className="h-7" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Créer votre compte</h1>
          <p className="text-gray-600 mt-2">Rejoignez des centaines de vendeurs</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 1 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              1
            </div>
            <div className={`w-20 h-1 ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              2
            </div>
          </div>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 && (
              <>
                <div>
                  <label className="label">Nom complet</label>
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
                  <label className="label">Email</label>
                  <input
                    type="email"
                    name="email"
                    className={getInputClass('email')}
                    placeholder="votre@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                  />
                  {touched.email && errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="label">Téléphone (optionnel)</label>
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

                <div>
                  <label className="label">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      className={`${getInputClass('password')} pr-10`}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {touched.password && errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="label">Confirmer le mot de passe</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      className={`${getInputClass('confirmPassword')} pr-10`}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {touched.confirmPassword && errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
                  )}
                </div>

                <button type="submit" className="btn-primary w-full">
                  Continuer
                </button>

                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">ou avec</span>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-center">
                    <GoogleLogin 
                      onSuccess={handleGoogleSuccess} 
                      onError={() => toast.error('La connexion avec Google a échoué')}
                      useOneTap
                      theme="outline"
                      shape="rectangular"
                      size="large"
                      text="signup_with"
                      width="100%"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Choisissez votre rôle</h3>
                  <p className="text-gray-600 text-sm mt-1">Comment souhaitez-vous utiliser SILACOD?</p>
                </div>

                <div className="space-y-3">
                  <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${formData.role === 'VENDOR' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="role"
                      value="VENDOR"
                      checked={formData.role === 'VENDOR'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <span className="text-xl">🏪</span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Vendeur / Affilié</div>
                        <div className="text-sm text-gray-500">Créez votre marque et vendez des produits</div>
                      </div>
                    </div>
                  </label>

                  <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${formData.role === 'GROSSELLER' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="role"
                      value="GROSSELLER"
                      checked={formData.role === 'GROSSELLER'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-xl">🏪</span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">groseller</div>
                        <div className="text-sm text-gray-500">Achetez et vendez en gros volume</div>
                      </div>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary flex-1"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Création...' : 'Créer mon compte'}
                  </button>
                </div>
              </>
            )}
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            En créant un compte, vous acceptez nos{' '}
            <a href="#" className="text-primary-600 hover:text-primary-700">Conditions d'utilisation</a>
            {' '}et notre{' '}
            <a href="#" className="text-primary-600 hover:text-primary-700">Politique de confidentialité</a>
          </p>
        </div>

        <p className="text-center mt-6 text-gray-600">
          Déjà un compte?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
