import { ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { publicApi } from '@/lib/api';
import { useEffect, useState } from 'react';

export default function BlockedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const path = query.get('path') || 'this page';
  const [checking, setChecking] = useState(false);

  // Auto-verify if the block is still valid on the server
  const verifyBlock = async () => {
    setChecking(true);
    try {
      const serverPath = path === 'all pages' ? '*' : path;
      const res = await publicApi.checkBlock(serverPath);
      const isStillBlocked = res.data?.data?.isBlocked === true;
      if (!isStillBlocked) {
        // Clear local storage and return
        const blockedPages = JSON.parse(localStorage.getItem('blocked_pages') || '[]');
        const newBlocked = blockedPages.filter((p: string) => p !== path && !(path === 'all pages' && p === '*'));
        localStorage.setItem('blocked_pages', JSON.stringify(newBlocked));
        
        // Ensure they go to home if path was 'all pages'
        navigate(path === 'all pages' ? '/' : path, { replace: true });
      }
    } catch {
      // Ignore network errors
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    verifyBlock();
  }, [path]);

  return (
    <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-6 font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] relative overflow-hidden">
      {/* Background grids and lights */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
      <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-red-900/20 blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-red-900/10 blur-[120px] pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-red-500/20 rounded-2xl p-8 text-center relative z-10 shadow-2xl">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="text-red-500 w-10 h-10" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-3">
          Access Denied
        </h1>
        
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          You have been blocked from accessing <span className="text-red-400 font-mono text-xs bg-red-500/10 px-2 py-0.5 rounded">{path}</span>. 
          Your session for this specific area was terminated by an administrator due to security policies or an active restriction.
        </p>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-white rounded-xl transition-all font-semibold text-sm"
          >
            <ArrowLeft size={16} />
            Return to Dashboard
          </button>

          <button 
            onClick={verifyBlock}
            disabled={checking}
            className="flex items-center justify-center gap-2 w-full py-3 bg-transparent hover:bg-slate-800/50 border border-transparent text-slate-400 hover:text-white rounded-xl transition-all font-semibold text-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
            Check Access Status
          </button>
        </div>
      </div>
    </div>
  );
}
