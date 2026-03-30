import { motion } from 'framer-motion';
import { Package, Truck, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 selection:bg-influencer-100 selection:text-influencer-900">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-[2rem] p-8 shadow-2xl shadow-gray-200/50 border border-gray-100 max-w-lg w-full text-center"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
          className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 relative"
        >
          <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20" />
          <CheckCircle2 className="w-12 h-12 text-green-500 relative z-10" />
        </motion.div>

        <h1 className="text-3xl font-black text-gray-900 mb-4">
          Félicitations !
        </h1>
        
        <p className="text-gray-500 text-lg mb-8 leading-relaxed">
          Votre commande a été confirmée avec succès. Un agent vous contactera très prochainement pour valider la livraison.
        </p>

        <div className="bg-gray-50 rounded-2xl p-6 mb-8 text-left space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-influencer-600" />
            Ce qui va se passer ensuite :
          </h3>
          
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-influencer-600 shadow-sm shrink-0">1</div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Appel de confirmation</p>
              <p className="text-gray-500 text-xs mt-1">Notre équipe vous appellera dans les prochaines 24h.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-influencer-600 shadow-sm shrink-0">2</div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Expédition rapide</p>
              <p className="text-gray-500 text-xs mt-1">Votre produit est préparé et expédié vers votre ville.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-influencer-600 shadow-sm shrink-0">3</div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Paiement à la livraison</p>
              <p className="text-gray-500 text-xs mt-1">Vous payez uniquement lorsque vous recevez le colis.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm font-bold text-gray-500 mb-8">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-influencer-500" />
            Partout au Maroc
          </div>
          <div className="hidden sm:block text-gray-300">•</div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-influencer-500" />
            Paiement Sécurisé
          </div>
        </div>

      </motion.div>
    </div>
  );
}
