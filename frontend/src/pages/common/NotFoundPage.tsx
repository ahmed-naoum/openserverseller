import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, Package, Rocket, Search } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center px-4 font-inter overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="text-center relative z-10 max-w-2xl"
      >
        <motion.div
           animate={{ 
             y: [0, -20, 0],
             rotate: [0, 5, -5, 0]
           }}
           transition={{ 
             duration: 6,
             repeat: Infinity,
             ease: "easeInOut"
           }}
           className="relative w-64 h-64 mx-auto mb-8"
        >
          {/* Creative floating 404 element */}
          <div className="absolute inset-0 bg-gradient-to-tr from-primary-600 to-primary-400 rounded-full blur-2xl opacity-40 animate-pulse" />
          <div className="relative w-full h-full bg-gray-800 rounded-full border border-gray-700 shadow-2xl flex items-center justify-center overflow-hidden">
             <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
               4
               <motion.span
                 animate={{ rotate: 360 }}
                 transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                 className="inline-block mx-1"
               >
                 <Search className="w-20 h-20 text-primary-500 inline-block align-middle mix-blend-screen" />
               </motion.span>
               4
             </div>
             
             {/* Small floating specs */}
             {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [100, -100],
                    x: Math.random() * 100 - 50,
                    scale: [0, 1, 0],
                  }}
                  transition={{
                    duration: 3 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                  }}
                  className="absolute w-2 h-2 bg-white rounded-full opacity-50"
                  style={{ left: `${20 + Math.random() * 60}%`, bottom: 0 }}
                />
             ))}
          </div>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-gray-800/80 border border-gray-700 text-primary-400 text-sm font-semibold mb-6 backdrop-blur-sm">
            <Rocket className="w-4 h-4 mr-2" /> Mission Perdue dans l'Espace
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
             Houston, nous avons un <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">problème.</span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-10 leading-relaxed max-w-lg mx-auto">
            La page que vous tentez d'atteindre a dérivé dans un trou noir. Même notre meilleur dropshipper ne peut pas la livrer.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button 
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-8 py-4 bg-gray-800 text-white font-bold rounded-2xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 border border-gray-700 shadow-lg"
          >
            <ArrowLeft className="w-5 h-5" /> Repli Tactique
          </button>
          <Link 
            to="/" 
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-bold rounded-2xl hover:from-primary-500 hover:to-primary-400 transition-all shadow-xl shadow-primary-500/25 flex items-center justify-center gap-2 hover:scale-105"
          >
            <Home className="w-5 h-5" /> Retour à la Base
          </Link>
        </motion.div>
      </motion.div>

      {/* Decorative footer line */}
      <div className="absolute bottom-10 text-gray-500 text-sm flex items-center gap-2">
        <Package className="w-4 h-4" /> SILACOD - Espace Non Répertorié
      </div>
    </div>
  );
}
