import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../lib/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authApi.forgotPassword({ email });
      setIsSent(true);
      toast.success('Code de révision envoyé!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">O</span>
            </div>
            <span className="font-bold text-2xl text-gray-900">OpenSeller.ma</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Mot de passe oublié</h1>
          <p className="text-gray-600 mt-2">Nous vous enverrons un code de révision</p>
        </div>

        <div className="card p-8">
          {isSent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Email envoyé!</h3>
              <p className="text-gray-600 mb-6">
                Vérifiez votre boîte de réception pour le code de révision.
              </p>
              <Link to="/login" className="btn-primary w-full">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Envoi...' : 'Envoyer le code'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-gray-600">
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
