import { motion } from 'framer-motion';

export default function LiveTicker() {
  const events = [
    "🚀 Commande #8942 livrée à Tanger (Il y a 2 min)",
    "⚡ Nouvelle vendeuse Amina inscrite",
    "💰 Commission de 450 MAD versée à Amine",
    "📦 150 unités de Sérum Glow expédiées",
    "🌟 Youssef VLOG a rejoint l'espace VIP",
    "🚀 Commande #8943 livrée à Casablanca (Il y a 5 min)",
    "💰 2,100 MAD de profit généré par Leila aujourd'hui",
  ];

  return (
    <div className="bg-gray-900 border-b border-gray-800 py-3 overflow-hidden whitespace-nowrap mt-24 font-inter">
      <div className="flex">
        <motion.div
          animate={{ x: [0, -2000] }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          className="flex space-x-12 px-6"
        >
          {/* Double the array for seamless scrolling */}
          {[...events, ...events].map((event, i) => (
             <div key={i} className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                {event}
             </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
