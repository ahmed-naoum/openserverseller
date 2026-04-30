import { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, TrendingUp, TrendingDown, Users, CheckCircle, Truck, DollarSign, Megaphone, Calculator, ChevronDown } from 'lucide-react';

interface ProfitSimulatorProps {
  retailPrice: number;
  productName: string;
  commissionMad?: number;
}

interface SimulatorState {
  leads: number;
  confirmationRate: number;
  deliveryRate: number;
  commissionPerSale: number;
  marketingCostPerLead: number;
}

const DEFAULTS: SimulatorState = {
  leads: 500,
  confirmationRate: 65,
  deliveryRate: 60,
  commissionPerSale: 0,
  marketingCostPerLead: 0,
};

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(value);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(displayed);
  const startTimeRef = useRef(0);

  useEffect(() => {
    startRef.current = displayed;
    startTimeRef.current = performance.now();
    const duration = 400;

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startRef.current + (value - startRef.current) * eased;
      setDisplayed(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  const formatted = displayed < 0
    ? `-${Math.abs(displayed).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`
    : `${displayed.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;

  return <span>{formatted}</span>;
}

export default function ProfitSimulator({ retailPrice, productName, commissionMad = 0 }: ProfitSimulatorProps) {
  const defaultCommission = commissionMad > 0 ? commissionMad : Math.round(retailPrice * 0.1 * 100) / 100;

  const [state, setState] = useState<SimulatorState>({
    ...DEFAULTS,
    commissionPerSale: defaultCommission,
  });

  useEffect(() => {
    setState(prev => ({
      ...prev,
      commissionPerSale: defaultCommission
    }));
  }, [defaultCommission]);

  const [isExpanded, setIsExpanded] = useState(true);

  const update = useCallback((key: keyof SimulatorState, value: number) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setState({
      ...DEFAULTS,
      commissionPerSale: defaultCommission,
    });
  }, [defaultCommission]);

  // Calculations
  const confirmedOrders = Math.round(state.leads * (state.confirmationRate / 100));
  const deliveredOrders = Math.round(confirmedOrders * (state.deliveryRate / 100));
  const totalCommission = deliveredOrders * state.commissionPerSale;
  const totalMarketing = state.leads * state.marketingCostPerLead;
  const netProfit = totalCommission - totalMarketing;
  const isProfit = netProfit >= 0;
  const roi = totalMarketing > 0 ? ((netProfit / totalMarketing) * 100) : (totalCommission > 0 ? Infinity : 0);

  const inputFields = [
    { key: 'leads' as const, label: 'Nombre de Leads', icon: Users, unit: '', color: '#818cf8', min: 0, max: 99999, step: 1 },
    { key: 'confirmationRate' as const, label: 'Taux de Confirmation', icon: CheckCircle, unit: '%', color: '#fbbf24', min: 0, max: 100, step: 1 },
    { key: 'deliveryRate' as const, label: 'Taux de Livraison', icon: Truck, unit: '%', color: '#34d399', min: 0, max: 100, step: 1 },
    { key: 'commissionPerSale' as const, label: 'Commission / Vente', icon: DollarSign, unit: 'MAD', color: '#a78bfa', min: 0, max: 9999, step: 1 },
    { key: 'marketingCostPerLead' as const, label: 'Coût Marketing / Lead', icon: Megaphone, unit: 'MAD', color: '#f472b6', min: 0, max: 9999, step: 0.5 },
  ];

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden my-4">
      {/* Header */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center shadow-sm border border-primary-200">
            <Calculator size={16} />
          </div>
          <div className="text-left">
            <div className="text-sm font-black text-gray-900 uppercase tracking-tight">Simulateur de Profit</div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
              {productName ? `Estimez vos gains pour ${productName}` : 'Calculez votre rentabilité prévisionnelle'}
            </div>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Body */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-100">
          
          {/* Inputs Grid (2 columns on sm) */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {inputFields.map(({ key, label, icon: Icon, unit, color, min, max, step }) => (
                <div key={key} className={`flex items-center justify-between p-2.5 rounded-lg bg-gray-50/50 border border-gray-100 hover:border-primary-200 transition-colors ${key === 'marketingCostPerLead' ? 'sm:col-span-2' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
                       <Icon size={12} strokeWidth={2.5} />
                    </div>
                    <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">{label}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-1 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 shadow-sm">
                    <input
                      type="number"
                      className="w-16 text-right text-sm font-bold text-gray-900 bg-transparent outline-none p-0 border-none focus:ring-0"
                      value={state[key]}
                      min={min}
                      max={max}
                      step={step}
                      onChange={(e) => {
                        let v = parseFloat(e.target.value) || 0;
                        if (max === 100) v = Math.min(100, Math.max(0, v));
                        else v = Math.max(min, v);
                        update(key, v);
                      }}
                    />
                    {unit && <span className="text-[10px] text-gray-400 font-bold uppercase">{unit}</span>}
                  </div>
                </div>
              ))}
           </div>

           {/* Results Area */}
           <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
             {/* Funnel Stats (Compact) */}
             <div className="md:col-span-4 bg-gray-50 rounded-xl p-3 border border-gray-100 flex justify-between items-center shadow-inner">
                <div className="text-center w-full">
                   <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400 uppercase font-bold mb-1">
                     <Users size={12} /> Leads
                   </div>
                   <div className="text-sm font-black text-gray-900">{state.leads.toLocaleString()}</div>
                </div>
                <div className="text-gray-300 font-bold text-xs">→</div>
                <div className="text-center w-full">
                   <div className="flex items-center justify-center gap-1 text-[10px] text-amber-500 uppercase font-bold mb-1">
                     <CheckCircle size={12} /> Confirmés
                   </div>
                   <div className="text-sm font-black text-amber-600">{confirmedOrders.toLocaleString()}</div>
                </div>
                <div className="text-gray-300 font-bold text-xs">→</div>
                <div className="text-center w-full">
                   <div className="flex items-center justify-center gap-1 text-[10px] text-green-500 uppercase font-bold mb-1">
                     <Truck size={12} /> Livrés
                   </div>
                   <div className="text-sm font-black text-green-600">{deliveredOrders.toLocaleString()}</div>
                </div>
             </div>

             {/* Final ROI & Profit */}
             <div className={`md:col-span-3 rounded-xl p-3 border flex flex-col justify-center items-center shadow-sm relative overflow-hidden ${isProfit ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {/* Decorative background circle */}
                <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-10 ${isProfit ? 'bg-green-600' : 'bg-red-600'}`}></div>
                
                <div className="text-[10px] uppercase font-bold flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/60 shadow-sm border border-white mb-1.5 z-10">
                   {isProfit ? <TrendingUp size={12} className="text-green-600" /> : <TrendingDown size={12} className="text-red-600" />}
                   <span className={isProfit ? 'text-green-700' : 'text-red-700'}>
                     {isProfit ? 'Profit Net' : 'Perte Nette'}
                   </span>
                </div>
                <div className={`text-2xl font-black z-10 ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                   <AnimatedNumber value={netProfit} suffix=" MAD" />
                </div>
             </div>
           </div>
           
           <div className="mt-4 flex justify-between items-center text-xs">
              <div className="flex gap-4">
                 <div className="text-gray-500 font-medium">Commissions: <span className="font-bold text-gray-900"><AnimatedNumber value={totalCommission} suffix=" MAD" /></span></div>
                 <div className="text-gray-500 font-medium">Coûts: <span className="font-bold text-gray-900"><AnimatedNumber value={totalMarketing} suffix=" MAD" /></span></div>
                 {totalMarketing > 0 && (
                   <div className="text-gray-500 font-medium">ROI: <span className="font-bold text-primary-600">{roi === Infinity ? '∞' : `${roi.toFixed(1)}%`}</span></div>
                 )}
              </div>
              
              <button onClick={reset} className="flex items-center gap-1 text-gray-400 hover:text-gray-700 font-medium transition-colors">
                <RotateCcw size={12} /> Réinitialiser
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
