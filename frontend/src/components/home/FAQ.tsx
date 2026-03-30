import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "C'est quoi exactement le Dropshipping White-Label ?",
      a: "Le Dropshipping White-Label avec SILACOD, c'est la liberté totale. Vous choisissez un produit de beauté (sérum, crème, etc.) de notre catalogue vierge. Vous uploadez votre Logo. Nous collons votre logo sur le produit. Vous n'avez pas besoin d'acheter de stock à l'avance ! Quand vous vendez sur votre site via Facebook Ads, nous expédions directement à votre client et nous gardons simplement notre commission."
    },
    {
      q: "Comment fonctionne le programme Influenceur (Espace VIP) ?",
      a: "Si vous avez +5,000 followers, vous pouvez vous inscrire en tant qu'Influenceur VIP. Vous choisissez des produits du catalogue, générez des liens, et parlez de ces produits dans vos vidéos ou stories. À chaque vente confirmée via votre lien, vous gagnez une grosse commission instantanée. Vous pouvez même créer votre propre marque sans rien investir et la dévoiler à votre audience (Reality Challenge) !"
    },
    {
      q: "Je n'ai pas de capital. Puis-je utiliser SILACOD ?",
      a: "Absolument. Vous pouvez vous inscrire en tant qu'Affilié. Vous prenez les liens des produits déjà existants et vous les promouvez sur les réseaux sociaux (TikTok, Instagram, groupes Facebook). Vous toucherez une commission sur chaque vente sans avoir dépensé 1 dirham en stock ou en création de marque."
    },
    {
      q: "Comment sont gérés les retours et les confirmations de commandes au Maroc ?",
      a: "SILACOD possède son propre centre d'appels et sa flotte de livraison. Dès qu'un client commande sur votre page, notre équipe technique l'appelle pour confirmer. Ensuite, le produit est expédié en Cash On Delivery (COD). Nous gérons 100% des retours et des refus. Vous ne vous occupez de rien d'autre que du marketing."
    },
    {
      q: "Comment je récupère mon argent ?",
      a: "Chaque fois qu'une commande est livrée et payée, l'argent atterrit dans votre Wallet virtuel sur la plateforme SILACOD. Vous pouvez demander un virement bancaire ou Wafacash de vos fonds à tout moment depuis votre Dashboard. Les paiements sont ultra-rapides."
    }
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 border-t border-gray-100">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-6">Questions Fréquentes</h2>
          <p className="text-xl text-gray-600">Tout ce que vous devez savoir avant de dominer le e-commerce marocain.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
              >
                <span className="font-bold text-lg text-gray-900 pr-8">{faq.q}</span>
                <ChevronDown 
                  className={`w-6 h-6 text-primary-500 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="p-6 pt-0 text-gray-600 leading-relaxed border-t border-gray-50 mt-2">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
