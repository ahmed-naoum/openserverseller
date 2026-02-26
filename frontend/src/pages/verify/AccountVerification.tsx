import { useAuth } from '../../contexts/AuthContext';

export default function AccountVerification() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compte en attente</h1>
          <p className="mt-2 text-gray-600">
            Bonjour {user?.fullName}, votre compte est actuellement en cours de vérification par nos équipes.
          </p>
        </div>
        
        <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-xl text-left">
          <p className="font-medium">Où sont mes accès ?</p>
          <p className="mt-1">Dès que votre demande sera approuvée, vous pourrez accéder à votre tableau de bord selon le rôle choisi.</p>
        </div>

        <button 
          onClick={() => window.location.href = '/login'} 
          className="text-gray-500 hover:text-gray-700 text-sm font-medium"
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  );
}
