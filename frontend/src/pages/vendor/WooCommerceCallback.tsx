import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';

export default function WooCommerceCallback() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  useEffect(() => {
    toast.success(
      isRtl
        ? 'تمت إضافة وتحقيق ربط متجر WooCommerce بنجاح !'
        : 'Boutique WooCommerce connectée avec succès !'
    );
    navigate('/dashboard/integrations', { replace: true });
  }, [navigate, isRtl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold">
          {isRtl ? 'جاري إنهاء الربط مع WooCommerce...' : 'Finalisation de la connexion WooCommerce...'}
        </p>
      </div>
    </div>
  );
}
