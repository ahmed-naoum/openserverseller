import { Link } from 'react-router-dom';
import { Clock, ShieldCheck, Mail } from 'lucide-react';

export default function PendingVerificationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-4 mb-6">
            <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
          </Link>
        </div>

        <div className="card p-8">
          {/* Animated Icon */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-amber-100 rounded-full animate-ping opacity-20"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Clock className="w-12 h-12 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Compte en attente de vérification
          </h1>
          
          <p className="text-gray-600 mb-6 leading-relaxed">
            Votre compte a été créé avec succès ! Un administrateur doit vérifier et activer votre compte avant que vous puissiez vous connecter.
          </p>

          {/* Steps */}
          <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-left space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Inscription terminée</p>
                <p className="text-xs text-gray-500">Vos informations ont été enregistrées.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Vérification en cours</p>
                <p className="text-xs text-gray-500">Un administrateur examine votre dossier.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Mail className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 text-gray-400">Notification</p>
                <p className="text-xs text-gray-500">Vous serez notifié une fois le compte activé.</p>
              </div>
            </div>
          </div>

          <Link to="/login" className="btn-primary w-full inline-block text-center">
            Retour à la connexion
          </Link>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          Besoin d'aide ? Contactez-nous à{' '}
          <a href="mailto:support@silacod.com" className="text-primary-600 hover:text-primary-700 font-medium">
            support@silacod.com
          </a>
        </p>
      </div>
    </div>
  );
}
