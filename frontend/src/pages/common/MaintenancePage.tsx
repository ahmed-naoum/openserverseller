import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { Lock, Wrench, Hammer, Construction, Sparkles, Send, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MaintenancePage() {
  const navigate = useNavigate();
  const [showBypass, setShowBypass] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'LOADING' | 'ENABLED' | 'DISABLED'>('LOADING');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await settingsApi.getMaintenanceStatus();
      if (!res.data.data.enabled) {
        setStatus('DISABLED');
        // If maintenance is disabled, clear any old bypass and go home
        localStorage.removeItem('maintenance_bypass');
        navigate('/');
      } else {
        setStatus('ENABLED');
      }
    } catch (error) {
      setStatus('ENABLED');
    }
  };

  const handleBypass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    
    setLoading(true);
    try {
      const res = await settingsApi.verifyMaintenanceBypass(password);
      localStorage.setItem('maintenance_bypass', res.data.data.token);
      toast.success('Accès développeur activé !');
      window.location.href = '/';
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'LOADING') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-['Inter']">
      
      {/* Background Decorations */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-600/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-600/10 rounded-full blur-[120px] animate-pulse transition-duration-3000"></div>
      
      {/* Animated Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 text-center max-w-2xl"
      >
        <div className="inline-flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl mb-8 shadow-2xl relative group">
          <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <Construction size={48} className="text-primary-400 relative z-10 animate-bounce" />
        </div>

        <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight leading-tight">
          SILACOD est en <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">Maintenance</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 font-medium mb-10 leading-relaxed max-w-xl mx-auto">
          Nous préparons quelque chose d'exceptionnel pour vous. Notre plateforme sera de retour en ligne d'ici quelques instants après des optimisations majeures.
        </p>

        <div className="flex flex-wrap justify-center gap-4 mb-12">
            {[
              { icon: Wrench, label: 'Optimisations' },
              { icon: ShieldCheck, label: 'Sécurité' },
              { icon: Sparkles, label: 'Nouvelles Fonctions' }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-slate-300 text-sm font-semibold">
                <item.icon size={16} className="text-primary-400" />
                {item.label}
              </div>
            ))}
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl p-4 border border-white/5 inline-block text-sm text-slate-500 font-medium italic">
          💡 Merci pour votre patience. Nous serons bientôt de retour !
        </div>
      </motion.div>

      {/* Hidden Padlock for Developer Access */}
      <div className="absolute bottom-6 right-6 z-20">
        <button 
          onClick={() => setShowBypass(true)}
          className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-slate-600 hover:text-primary-400 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <Lock size={20} />
        </button>
      </div>

      {/* Bypass Modal */}
      <AnimatePresence>
        {showBypass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-[2rem] w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <button onClick={() => setShowBypass(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Hammer size={32} className="text-primary-500" />
              </div>

              <h3 className="text-2xl font-bold mb-2">Accès Développeur</h3>
              <p className="text-slate-400 text-sm mb-6">Identifiez-vous pour bypasser le mode maintenance.</p>

              <form onSubmit={handleBypass} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Mot de passe secret</label>
                  <input 
                    autoFocus
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-4 bg-slate-950 border-2 border-white/5 rounded-xl focus:border-primary-500/50 outline-none transition-all text-white font-medium"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading || !password}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-black rounded-xl shadow-lg shadow-primary-500/20 transition-all border border-primary-500/50"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send size={18} />}
                  Débloquer l'accès
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Details */}
      <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
        <p className="text-[10px] text-slate-700 font-black uppercase tracking-[0.3em]">© 2026 SILACOD Platform • All Rights Reserved</p>
      </div>
    </div>
  );
}
