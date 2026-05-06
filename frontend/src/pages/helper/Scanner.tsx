import { useState, useEffect, useRef } from 'react';
import { helperApi } from '../../lib/api';
import { ScanLine, CheckCircle, XCircle, Clock, PackageX, Camera, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';

interface ScanResult {
  code: string;
  status: 'success' | 'error';
  message: string;
  timestamp: Date;
}

export default function HelperScanner() {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Audio refs
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    successAudioRef.current = new Audio('/soundes/success.mp3');
    errorAudioRef.current = new Audio('/soundes/error.mp3');
    
    // Auto-focus on mount and keep focus if not in camera mode
    const focusInput = () => {
      if (!isCameraMode) {
        inputRef.current?.focus();
      }
    };
    focusInput();
    window.addEventListener('click', focusInput);
    return () => window.removeEventListener('click', focusInput);
  }, [isCameraMode]);

  const playSound = (type: 'success' | 'error') => {
    try {
      if (type === 'success' && successAudioRef.current) {
        successAudioRef.current.currentTime = 0;
        successAudioRef.current.play();
      } else if (type === 'error' && errorAudioRef.current) {
        errorAudioRef.current.currentTime = 0;
        errorAudioRef.current.play();
      }
    } catch (e) {
      console.error('Audio play error:', e);
    }
  };

  const processCode = async (code: string) => {
    if (!code.trim() || isProcessing) return;
    
    setIsProcessing(true);
    const trimmedCode = code.trim();
    
    try {
      const res = await helperApi.scanReturn(trimmedCode);
      playSound('success');
      setHistory(prev => [{
        code: trimmedCode,
        status: 'success',
        message: res.data.message || 'Retour traité',
        timestamp: new Date()
      }, ...prev].slice(0, 50));
    } catch (error: any) {
      playSound('error');
      setHistory(prev => [{
        code: trimmedCode,
        status: 'error',
        message: error.response?.data?.message || 'Erreur lors du traitement',
        timestamp: new Date()
      }, ...prev].slice(0, 50));
    } finally {
      setIsProcessing(false);
      setInputValue(''); // Clear input for next scan
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processCode(inputValue);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center border-4 border-white shadow-xl shadow-red-500/20">
          <PackageX className="w-8 h-8 text-red-600" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Scanner de Retours</h1>
          <p className="text-gray-500 font-medium mt-1">Scannez le code Coliaty pour traiter automatiquement un retour (-3 DH)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Scanner Input Area */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl shadow-gray-200/40 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500" />
            
            <div className="flex flex-col mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Mode de scan</h2>
              <div className="flex p-1 bg-gray-100/80 backdrop-blur-sm rounded-2xl">
                <button
                  onClick={() => setIsCameraMode(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${!isCameraMode ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Keyboard className="w-4 h-4" /> Douchette
                </button>
                <button
                  onClick={() => setIsCameraMode(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${isCameraMode ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Camera className="w-4 h-4" /> Caméra
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isCameraMode ? (
                <motion.div
                  key="camera"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="mb-6 relative"
                >
                  <div className="relative aspect-square sm:aspect-[4/3] w-full rounded-3xl overflow-hidden bg-black shadow-inner shadow-black/50 border border-gray-200">
                    <Scanner
                      onScan={(result) => {
                        if (result && result.length > 0) {
                          processCode(result[0].rawValue);
                        }
                      }}
                      formats={['qr_code', 'ean_13', 'code_128']}
                      styles={{
                        container: { width: '100%', height: '100%' },
                        video: { objectFit: 'cover' }
                      }}
                    />
                    
                    {/* Viewfinder Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 sm:w-64 sm:h-64 border-2 border-white/20 rounded-2xl relative">
                        {/* Corner Accents */}
                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-xl"></div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-xl"></div>
                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-xl"></div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-xl"></div>
                        
                        {/* Scanning Line Animation */}
                        <motion.div 
                          className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                          animate={{ y: [0, 192, 0] }}
                          transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-xs font-semibold text-gray-400 mt-4 uppercase tracking-wider">Pointez la caméra vers le code-barres</p>
                </motion.div>
              ) : (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-col items-center text-center space-y-4 mb-8">
                    <div className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${isProcessing ? 'bg-gray-50 scale-95' : 'bg-red-50 shadow-inner shadow-red-200/50'}`}>
                      <ScanLine className={`w-12 h-12 ${isProcessing ? 'text-gray-400' : 'text-red-500'}`} />
                      {!isProcessing && (
                        <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping" style={{ animationDuration: '3s' }}></div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {isProcessing ? 'Traitement en cours...' : 'Prêt à scanner'}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 font-medium">
                        Utilisez votre douchette ou tapez manuellement
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="relative group">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isProcessing}
                        placeholder="Scanner le code..."
                        className="w-full bg-gray-50/50 border-2 border-gray-200 rounded-2xl py-4 px-6 text-center font-mono font-bold text-xl focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 outline-none transition-all duration-300 disabled:opacity-50 uppercase tracking-widest group-hover:border-gray-300"
                        autoFocus
                      />
                      <div className="absolute inset-y-0 right-4 flex items-center">
                        {isProcessing && <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />}
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => processCode(inputValue)}
                      disabled={!inputValue.trim() || isProcessing}
                      className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-gray-800 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-gray-900/10 flex justify-center items-center gap-2"
                    >
                      <Keyboard className="w-5 h-5" /> Traiter Manuellement
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* History Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm h-[600px] flex flex-col">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" /> Historique des scans
            </h2>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <AnimatePresence>
                {history.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-gray-400"
                  >
                    <PackageX className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium text-sm">Aucun scan récent</p>
                  </motion.div>
                ) : (
                  history.map((item, idx) => (
                    <motion.div
                      key={`${item.code}-${item.timestamp.getTime()}-${idx}`}
                      initial={{ opacity: 0, y: -20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex items-center gap-4 p-4 rounded-2xl border ${
                        item.status === 'success' 
                          ? 'bg-emerald-50/50 border-emerald-100' 
                          : 'bg-red-50/50 border-red-100'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        item.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {item.status === 'success' ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono font-bold text-gray-900 truncate uppercase">{item.code}</p>
                          <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                            {item.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className={`text-sm font-medium truncate mt-1 ${
                          item.status === 'success' ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {item.message}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
