import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function YouCanCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const processedRef = useRef(false);

  useEffect(() => {
    const exchangeToken = async () => {
      // Prevent double firing in React strict mode
      if (processedRef.current) return;
      processedRef.current = true;

      if (error) {
        toast.error('L\'autorisation YouCan a été refusée ou a échoué.');
        navigate('/dashboard/settings?tab=integrations');
        return;
      }

      if (!code) {
        toast.error('Code d\'autorisation manquant. Veuillez réessayer.');
        navigate('/dashboard/settings?tab=integrations');
        return;
      }

      try {
        await api.post('/youcan/token', { code });
        toast.success('Boutique YouCan connectée avec succès !');
        navigate('/dashboard/settings?tab=integrations');
      } catch (err: any) {
        console.error('YouCan Callback Error:', err);
        toast.error(err.response?.data?.message || 'Erreur lors de la connexion à YouCan.');
        navigate('/dashboard/settings?tab=integrations');
      }
    };

    exchangeToken();
  }, [code, error, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-8 text-center">
      <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-indigo-100">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Connexion à YouCan en cours...</h2>
      <p className="text-gray-500 mt-3 font-medium">
        Veuillez patienter pendant que nous sécurisons l'accès à votre boutique. <br />
        Vous allez être redirigé automatiquement.
      </p>
    </div>
  );
}
