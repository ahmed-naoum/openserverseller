import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

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
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      if (formData.password !== formData.confirmPassword) {
        toast.error('Les mots de passe ne correspondent pas');
        return;
      }
      setStep(2);
      return;
    }

    setIsLoading(true);

    try {
      await register({
        email: formData.email,
        phone: formData.phone || undefined,
        password: formData.password,
        fullName: formData.fullName,
        role: formData.role,
      });
      toast.success('Compte créé avec succès!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'inscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">O</span>
            </div>
            <span className="font-bold text-2xl text-gray-900">OpenSeller.ma</span>
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
                    className="input"
                    placeholder="Votre nom complet"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="votre@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Téléphone (optionnel)</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+212 6XX-XXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Mot de passe</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="label">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" className="btn-primary w-full">
                  Continuer
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Choisissez votre rôle</h3>
                  <p className="text-gray-600 text-sm mt-1">Comment souhaitez-vous utiliser OpenSeller?</p>
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
                        <div className="font-semibold text-gray-900">Vendeur / Brand Owner</div>
                        <div className="text-sm text-gray-500">Créez votre marque et vendez des produits</div>
                      </div>
                    </div>
                  </label>

                  <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${formData.role === 'CALL_CENTER_AGENT' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="role"
                      value="CALL_CENTER_AGENT"
                      checked={formData.role === 'CALL_CENTER_AGENT'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-xl">🎧</span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Agent Call Center</div>
                        <div className="text-sm text-gray-500">Transformez les prospects en clients</div>
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
