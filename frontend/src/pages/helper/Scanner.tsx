import { useState, useEffect, useRef } from 'react';
import { helperApi } from '../../lib/api';
import { ScanLine, CheckCircle, XCircle, Clock, PackageX, Camera, Keyboard, User, Trash2, CheckSquare, Square, ChevronDown, ChevronRight, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';

interface ScannedOrder {
  orderId: number;
  orderNumber: string;
  coliatyCode: string;
  customerName: string;
  ownerName: string;
  ownerId: number;
  alreadyReturned: boolean;
  scannedAt: Date;
}

interface ScanHistory {
  code: string;
  status: 'success' | 'error';
  message: string;
  timestamp: Date;
}

export default function HelperScanner() {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  
  // Initialize state from localStorage
  const [history, setHistory] = useState<ScanHistory[]>(() => {
    const saved = localStorage.getItem('helper_scan_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((h: any) => ({ ...h, timestamp: new Date(h.timestamp) }));
      } catch (e) { return []; }
    }
    return [];
  });

  const [scannedOrders, setScannedOrders] = useState<ScannedOrder[]>(() => {
    const saved = localStorage.getItem('helper_scanned_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((o: any) => ({ ...o, scannedAt: new Date(o.scannedAt) }));
      } catch (e) { return []; }
    }
    return [];
  });

  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    const saved = localStorage.getItem('helper_selected_ids');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  const [expandedUsers, setExpandedUsers] = useState<string[]>([]);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Audio refs
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    successAudioRef.current = new Audio('/soundes/success.mp3');
    errorAudioRef.current = new Audio('/soundes/error.mp3');
    
    const focusInput = () => {
      if (!isCameraMode) {
        inputRef.current?.focus();
      }
    };
    focusInput();
    window.addEventListener('click', focusInput);
    return () => window.removeEventListener('click', focusInput);
  }, [isCameraMode]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('helper_scanned_orders', JSON.stringify(scannedOrders));
  }, [scannedOrders]);

  useEffect(() => {
    localStorage.setItem('helper_selected_ids', JSON.stringify(selectedIds));
  }, [selectedIds]);

  useEffect(() => {
    localStorage.setItem('helper_scan_history', JSON.stringify(history));
  }, [history]);

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

  const playDoubleBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (startTime: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'square';
        gain.gain.value = 0.3;
        osc.start(startTime);
        osc.stop(startTime + 0.15);
      };
      playBeep(ctx.currentTime);
      playBeep(ctx.currentTime + 0.25);
    } catch (e) {
      console.error('Double beep error:', e);
    }
  };

  const processCode = async (code: string) => {
    if (!code.trim() || isProcessing) return;
    
    const trimmedCode = code.trim();
    
    if (scannedOrders.some(o => o.coliatyCode === trimmedCode || o.orderNumber === trimmedCode)) {
       toast.error('Ce colis est déjà dans la liste');
       playDoubleBeep();
       setInputValue('');
       setTimeout(() => inputRef.current?.focus(), 50);
       return;
    }

    setIsProcessing(true);
    
    try {
      const res = await helperApi.verifyReturnCode(trimmedCode);
      const orderData = res.data.data;

      if (orderData.alreadyReturned) {
        toast.error('Ce colis a déjà été retourné et facturé.');
        playSound('error');
      } else {
        playSound('success');
        const newOrder: ScannedOrder = {
          ...orderData,
          scannedAt: new Date()
        };
        setScannedOrders(prev => [newOrder, ...prev]);
        setSelectedIds(prev => [...prev, newOrder.orderId]);
        
        if (!expandedUsers.includes(orderData.ownerName)) {
           setExpandedUsers(prev => [...prev, orderData.ownerName]);
        }
      }

      setHistory(prev => [{
        code: trimmedCode,
        status: (orderData.alreadyReturned ? 'error' : 'success') as 'success' | 'error',
        message: orderData.alreadyReturned ? 'Déjà retourné' : `Colis de ${orderData.ownerName}`,
        timestamp: new Date()
      }, ...prev].slice(0, 50));

    } catch (error: any) {
      playSound('error');
      const msg = error.response?.data?.message || 'Colis non trouvé';
      toast.error(msg);
      setHistory(prev => [{
        code: trimmedCode,
        status: 'error' as 'success' | 'error',
        message: msg,
        timestamp: new Date()
      }, ...prev].slice(0, 50));
    } finally {
      setIsProcessing(false);
      setInputValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleBulkProcess = async () => {
    if (selectedIds.length === 0) return;
    
    setIsBulkProcessing(true);
    try {
      await helperApi.bulkScanReturns(selectedIds);
      toast.success(`${selectedIds.length} retours traités avec succès !`);
      
      setScannedOrders(prev => prev.filter(o => !selectedIds.includes(o.orderId)));
      setSelectedIds([]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du traitement groupé');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const removeOrder = (id: number) => {
    setScannedOrders(prev => prev.filter(o => o.orderId !== id));
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const toggleUserExpand = (ownerName: string) => {
    setExpandedUsers(prev => 
      prev.includes(ownerName) ? prev.filter(u => u !== ownerName) : [...prev, ownerName]
    );
  };

  const toggleUserSelect = (ownerName: string, orders: ScannedOrder[]) => {
    const orderIds = orders.map(o => o.orderId);
    const allSelected = orderIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !orderIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...orderIds])]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processCode(inputValue);
    }
  };

  const groupedOrders = scannedOrders.reduce((acc, order) => {
    const owner = order.ownerName;
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(order);
    return acc;
  }, {} as Record<string, ScannedOrder[]>);

  const sortedOwners = Object.keys(groupedOrders).sort();

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center border-4 border-white shadow-xl shadow-red-500/20">
            <PackageX className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Scanner de Retours</h1>
            <p className="text-gray-500 font-medium mt-1 tracking-tight">Collectez les retours et facturez automatiquement les utilisateurs (-3 DH / colis)</p>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleBulkProcess}
            disabled={isBulkProcessing}
            className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-3"
          >
            {isBulkProcessing ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            Valider {selectedIds.length} Retours ({selectedIds.length * 3} DH)
          </motion.button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Scanner Area */}
        <div className="lg:col-span-4 space-y-6">
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
                <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                   <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-black border border-gray-200">
                    <Scanner
                      onScan={(result) => result?.[0]?.rawValue && processCode(result[0].rawValue)}
                      formats={['qr_code', 'ean_13', 'code_128']}
                      styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
                    />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                       <div className="w-48 h-48 border-2 border-white/20 rounded-2xl relative">
                          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-xl" />
                          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-xl" />
                          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-xl" />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-xl" />
                          <motion.div className="w-full h-0.5 bg-red-500" animate={{ y: [0, 192, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }} />
                       </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                   <div className="flex flex-col items-center text-center space-y-4 mb-8">
                    <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${isProcessing ? 'bg-gray-50' : 'bg-red-50'}`}>
                      <ScanLine className={`w-10 h-10 ${isProcessing ? 'text-gray-400' : 'text-red-500'}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{isProcessing ? 'Recherche...' : 'Prêt à scanner'}</h3>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isProcessing}
                      placeholder="SCANNER LE CODE..."
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl py-4 text-center font-mono font-black text-xl focus:border-red-500 focus:bg-white outline-none transition-all tracking-widest"
                    />
                    <button 
                      onClick={() => processCode(inputValue)}
                      disabled={!inputValue.trim() || isProcessing}
                      className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-gray-800 transition-all flex justify-center items-center gap-2"
                    >
                      Traiter Manuellement
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mini History */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm max-h-[300px] overflow-y-auto custom-scrollbar">
             <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Clock className="w-3 h-3" /> Derniers Scans
             </h3>
             <div className="space-y-3">
               {history.map((item, i) => (
                 <div key={i} className="flex items-center gap-3 text-[11px]">
                   <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${item.status === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                     {item.status === 'success' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="font-bold text-gray-900 truncate">{item.code}</p>
                     <p className="text-gray-400 truncate">{item.message}</p>
                   </div>
                   <span className="text-gray-300 font-medium">{item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                 </div>
               ))}
               {history.length === 0 && <p className="text-center text-gray-300 py-4 font-medium italic text-xs">Aucun scan</p>}
             </div>
          </div>
        </div>

        {/* Scanned Items Grouped by User */}
        <div className="lg:col-span-8">
           <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[700px]">
             <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                <div>
                  <h2 className="text-lg font-black text-gray-900 tracking-tight">File d'attente de facturation</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase mt-1 tracking-wider">{scannedOrders.length} colis répartis sur {sortedOwners.length} utilisateurs</p>
                </div>
                {scannedOrders.length > 0 && (
                  <button 
                    onClick={() => {
                      if (selectedIds.length === scannedOrders.length) setSelectedIds([]);
                      else setSelectedIds(scannedOrders.map(o => o.orderId));
                    }}
                    className="text-[10px] font-black text-gray-400 hover:text-gray-900 uppercase tracking-widest flex items-center gap-2 transition-all"
                  >
                    {selectedIds.length === scannedOrders.length ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
                    Tout Sélectionner
                  </button>
                )}
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar">
               {sortedOwners.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-300 p-12">
                   <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                      <PackageX className="w-10 h-10 opacity-10" />
                   </div>
                   <p className="font-bold text-sm">Prêt pour le scan</p>
                   <p className="text-xs mt-1 font-medium">Les colis seront groupés par propriétaire automatiquement.</p>
                 </div>
               ) : (
                 <div className="divide-y divide-gray-100">
                    {sortedOwners.map((ownerName) => {
                      const orders = groupedOrders[ownerName];
                      const isExpanded = expandedUsers.includes(ownerName);
                      const userSelectedCount = orders.filter(o => selectedIds.includes(o.orderId)).length;
                      const allUserSelected = userSelectedCount === orders.length;

                      return (
                        <div key={ownerName} className="flex flex-col">
                           <div className={`p-4 flex items-center gap-4 transition-all ${allUserSelected ? 'bg-emerald-50/20' : 'bg-white hover:bg-gray-50/50'}`}>
                              <button onClick={() => toggleUserSelect(ownerName, orders)} className="flex-shrink-0">
                                {allUserSelected ? (
                                  <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-100">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  </div>
                                ) : userSelectedCount > 0 ? (
                                  <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
                                    <div className="w-2.5 h-0.5 bg-emerald-600 rounded-full" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 border-2 border-gray-200 rounded-lg" />
                                )}
                              </button>

                              <button 
                                onClick={() => toggleUserExpand(ownerName)}
                                className="flex-1 flex items-center gap-3 text-left"
                              >
                                 <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-400" />
                                 </div>
                                 <div className="flex-1">
                                    <h3 className="font-black text-gray-900 text-sm tracking-tight">{ownerName}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{orders.length} colis à traiter</p>
                                 </div>
                                 <div className="text-right mr-4">
                                    <span className="block text-sm font-black text-red-600">-{orders.length * 3}.00 DH</span>
                                    <span className="text-[10px] font-bold text-gray-300 uppercase">Frais de retour</span>
                                 </div>
                                 {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-300" /> : <ChevronRight className="w-5 h-5 text-gray-300" />}
                              </button>
                           </div>

                           <AnimatePresence>
                              {isExpanded && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden bg-gray-50/30 divide-y divide-gray-100/50"
                                >
                                   {orders.map((order) => (
                                     <div key={order.orderId} className="p-4 pl-14 flex items-center gap-4 group">
                                        <button onClick={() => toggleSelect(order.orderId)} className="flex-shrink-0">
                                          {selectedIds.includes(order.orderId) ? (
                                            <div className="w-5 h-5 bg-emerald-500 rounded-md flex items-center justify-center">
                                              <CheckCircle className="w-3.5 h-3.5 text-white" />
                                            </div>
                                          ) : (
                                            <div className="w-5 h-5 border-2 border-gray-200 rounded-md" />
                                          )}
                                        </button>

                                        <div className="flex-1">
                                           <div className="flex items-center gap-2">
                                              <span className="font-mono font-bold text-gray-900 text-sm">{order.coliatyCode || order.orderNumber}</span>
                                              <span className="text-[9px] font-black text-gray-400 uppercase">#{order.orderNumber}</span>
                                           </div>
                                           <p className="text-[11px] text-gray-500 font-medium">Client: <span className="text-gray-900 font-bold">{order.customerName}</span></p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                           <span className="text-[11px] font-bold text-gray-400">{order.scannedAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                           <button 
                                             onClick={() => removeOrder(order.orderId)}
                                             className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                           >
                                              <Trash2 className="w-3.5 h-3.5" />
                                           </button>
                                        </div>
                                     </div>
                                   ))}
                                </motion.div>
                              )}
                           </AnimatePresence>
                        </div>
                      );
                    })}
                 </div>
               )}
             </div>

             {scannedOrders.length > 0 && (
               <div className="p-8 bg-white border-t-2 border-gray-50">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Colis</span>
                           <span className="text-2xl font-black text-gray-900">{selectedIds.length}</span>
                        </div>
                        <div className="w-px h-10 bg-gray-100" />
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                             <Calculator className="w-3 h-3" /> Montant à déduire
                           </span>
                           <span className="text-2xl font-black text-emerald-600">{(selectedIds.length * 3).toFixed(2)} MAD</span>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed max-w-[240px]">
                          La validation générera des factures individuelles par utilisateur avec déduction immédiate des soldes.
                        </p>
                     </div>
                  </div>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
