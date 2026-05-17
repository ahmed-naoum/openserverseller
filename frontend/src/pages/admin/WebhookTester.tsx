import { useState, useEffect } from 'react';
import { webhooksApi, adminApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  Send, 
  Terminal, 
  Package, 
  Activity, 
  Clock, 
  MessageSquare, 
  Calendar,
  Code,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  History,
  User,
  MapPin,
  ExternalLink,
  DollarSign,
  FileText,
  Receipt
} from 'lucide-react';

const COLIATY_STATUSES = [
  // Cycle de vie
  { value: 'NEW_PARCEL', label: 'NEW_PARCEL (Nouveau colis)', group: 'Cycle de vie' },
  { value: 'WAITING_PICKUP', label: 'WAITING_PICKUP (Attente collecte)', group: 'Cycle de vie' },
  { value: 'PICKED_UP', label: 'PICKED_UP (Collecté)', group: 'Cycle de vie' },
  
  // En transit
  { value: 'SENT', label: 'SENT (Expédié)', group: 'En transit' },
  { value: 'RECEIVED', label: 'RECEIVED (Reçu destination)', group: 'En transit' },
  { value: 'DISTRIBUTION', label: 'DISTRIBUTION (En livraison)', group: 'En transit' },
  { value: 'PROGRAMMER_AUTO', label: 'PROGRAMMER_AUTO (Auto)', group: 'En transit' },
  { value: 'POSTPONED', label: 'POSTPONED (Reporté)', group: 'En transit' },
  
  // Livraison terminée
  { value: 'DELIVERED', label: 'DELIVERED (Livré)', group: 'Terminé' },
  { value: 'RETURNED', label: 'RETURNED (Retourné)', group: 'Terminé' },
  
  // Stock
  { value: 'WAITING_PREPARATION', label: 'WAITING_PREPARATION (Stock)', group: 'Stock' },
  { value: 'PREPARED', label: 'PREPARED (Préparé)', group: 'Stock' },
  { value: 'ENCORE_PREPARED', label: 'ENCORE_PREPARED (En cours)', group: 'Stock' },
  
  // Annulations
  { value: 'CANCELED_BY_SELLER', label: 'CANCELED_BY_SELLER', group: 'Annulations' },
  { value: 'CANCELED_BY_SYSTEM', label: 'CANCELED_BY_SYSTEM', group: 'Annulations' },
  { value: 'REFUSE', label: 'REFUSE (Refusé)', group: 'Annulations' },
  
  // Échecs
  { value: 'NOANSWER', label: 'NOANSWER (Pas de réponse)', group: 'Échecs' },
  { value: 'CANCELED', label: 'CANCELED (Annulé au client)', group: 'Échecs' },
  { value: 'ERR', label: 'ERR (Tél erroné)', group: 'Échecs' },
  { value: 'PROGRAMMER', label: 'PROGRAMMER (Planifié)', group: 'Échecs' },
  { value: 'INCORRECT_ADDRESS', label: 'INCORRECT_ADDRESS (Adresse)', group: 'Échecs' },
];

export default function WebhookTester() {
  const [eventType, setEventType] = useState<'PARCEL_STATUS_CHANGED' | 'PARCEL_SITUATION_CHANGED'>('PARCEL_STATUS_CHANGED');
  const [tracking, setTracking] = useState('FS05268027YI');
  const [status, setStatus] = useState('DELIVERED');
  const [comment, setComment] = useState('Facture P-FCT-030426-0320360-90-770 payée');
  const [date, setDate] = useState(new Date().toLocaleDateString('fr-FR').replace(/-/g, '/'));
  const [situation, setSituation] = useState('PAID');
  const [invoiceRef, setInvoiceRef] = useState('P-FCT-030426-0320360-90-770');
  const [price, setPrice] = useState(100);
  const [fees, setFees] = useState(33);
  const [net, setNet] = useState(67);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    fetchRecentOrders();
  }, []);

  const fetchRecentOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await adminApi.getOrders({ limit: 10 });
      // Extract tracking codes from orders that have them
      const ordersWithTracking = res.data.data.orders.filter((o: any) => o.coliatyPackageCode);
      setRecentOrders(ordersWithTracking);
    } catch (err) {
      console.error('Failed to fetch recent orders', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleTest = async () => {
    if (!tracking) {
      toast.error('Veuillez entrer un numéro de tracking');
      return;
    }

    setLoading(true);
    setResponse(null);

    const payload = eventType === 'PARCEL_SITUATION_CHANGED'
      ? {
          EVENT: 'PARCEL_SITUATION_CHANGED',
          TRACKING: tracking,
          SITUATION: situation,
          ...(comment ? { COMMENT: comment } : {}),
          INVOICE_REF: invoiceRef,
          STATUS: status,
          PRICE: price,
          FEES: fees,
          NET: net,
          DATE: date
        }
      : {
          EVENT: 'PARCEL_STATUS_CHANGED',
          TRACKING: tracking,
          STATUS: status,
          COMMENT: comment,
          DATE: date
        };

    try {
      const res = await webhooksApi.simulateColiaty(payload);
      setResponse(res.data);
      toast.success('Simulation envoyée avec succès !');
    } catch (err: any) {
      setResponse(err.response?.data || { error: 'Connection failed' });
      toast.error('Erreur lors de la simulation');
    } finally {
      setLoading(false);
    }
  };

  const groups = Array.from(new Set(COLIATY_STATUSES.map(s => s.group)));

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Terminal className="text-white w-6 h-6" />
            </div>
            Webhook Simulator
          </h1>
          <p className="text-slate-500 font-medium mt-2">
            Testez l'intégration Coliaty en simulant des notifications de changement de statut.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">Environnement de Test</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500">
                  <Package size={18} />
                </div>
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Paramètres de Simulation</h2>
              </div>
              <button 
                onClick={fetchRecentOrders}
                className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
              >
                <RefreshCw size={16} className={loadingOrders ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Event Type Toggle */}
            <div className="flex rounded-2xl bg-slate-100 p-1 gap-1">
              <button
                onClick={() => setEventType('PARCEL_STATUS_CHANGED')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  eventType === 'PARCEL_STATUS_CHANGED'
                    ? 'bg-white text-indigo-600 shadow-lg shadow-indigo-100'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                📦 Status Changed
              </button>
              <button
                onClick={() => { setEventType('PARCEL_SITUATION_CHANGED'); setStatus('DELIVERED'); }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  eventType === 'PARCEL_SITUATION_CHANGED'
                    ? 'bg-white text-emerald-600 shadow-lg shadow-emerald-100'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                💰 Situation Changed
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tracking Number */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                  Tracking Code (TRACKING)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Activity size={18} />
                  </div>
                  <input
                    type="text"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="ex: FS05264019FV"
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-bold text-slate-700"
                  />
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                  Nouveau Statut (STATUS)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Clock size={18} />
                  </div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-bold text-slate-700 appearance-none"
                  >
                    {groups.map(group => (
                      <optgroup key={group} label={group}>
                        {COLIATY_STATUSES.filter(s => s.group === group).map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* Comment */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                  Commentaire (COMMENT)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <MessageSquare size={18} />
                  </div>
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-bold text-slate-700"
                  />
                </div>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                  Date (DATE)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Calendar size={18} />
                  </div>
                  <input
                    type="text"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-bold text-slate-700"
                  />
                </div>
              </div>

              {/* Situation-specific fields */}
              {eventType === 'PARCEL_SITUATION_CHANGED' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                      Situation
                    </label>
                    <select
                      value={situation}
                      onChange={(e) => setSituation(e.target.value)}
                      className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none font-bold text-slate-700 appearance-none"
                    >
                      <option value="PAID">PAID (Facture réglée)</option>
                      <option value="UNPAID">UNPAID (Non payée)</option>
                      <option value="PENDING">PENDING (En attente)</option>
                      <option value="no payed">no payed (Non réglée)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                      <FileText size={12} /> Invoice Ref
                    </label>
                    <input
                      type="text"
                      value={invoiceRef}
                      onChange={(e) => setInvoiceRef(e.target.value)}
                      className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none font-bold text-slate-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PRICE (MAD)</label>
                    <input type="number" value={price} onChange={(e) => { setPrice(Number(e.target.value)); setNet(Number(e.target.value) - fees); }}
                      className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none font-bold text-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">FEES (MAD)</label>
                    <input type="number" value={fees} onChange={(e) => { setFees(Number(e.target.value)); setNet(price - Number(e.target.value)); }}
                      className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none font-bold text-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NET (MAD)</label>
                    <input type="number" value={net} onChange={(e) => setNet(Number(e.target.value))}
                      className={`w-full px-4 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none font-bold ${net < 0 ? 'text-red-600' : 'text-slate-700'}`} />
                  </div>
                </>
              )}

              <div className="flex items-end md:col-span-2">
                <button
                  onClick={handleTest}
                  disabled={loading}
                  className={`w-full py-4 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-3 ${
                    eventType === 'PARCEL_SITUATION_CHANGED'
                      ? 'bg-emerald-500 shadow-emerald-200 hover:bg-emerald-600'
                      : 'bg-indigo-500 shadow-indigo-200 hover:bg-indigo-600'
                  }`}
                >
                  {loading ? (
                    <RefreshCw className="animate-spin w-5 h-5" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {eventType === 'PARCEL_SITUATION_CHANGED' ? 'Simuler Situation' : 'Simuler Status'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guide Section */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                  <Code className="text-indigo-400 w-5 h-5" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Format Coliaty</h3>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-slate-800/50 rounded-2xl font-mono text-[10px] text-indigo-300">
                  <p>{"{"}</p>
                  <p className="ml-4">"EVENT": "{eventType}",</p>
                  <p className="ml-4">"TRACKING": "{tracking || 'TRK12345'}",</p>
                  {eventType === 'PARCEL_SITUATION_CHANGED' && (
                    <><p className="ml-4">"SITUATION": "{situation}",</p>
                    <p className="ml-4">"INVOICE_REF": "{invoiceRef}",</p></>
                  )}
                  <p className="ml-4">"STATUS": "{status}",</p>
                  {eventType === 'PARCEL_SITUATION_CHANGED' && (
                    <><p className="ml-4">"PRICE": {price}, "FEES": {fees}, "NET": {net},</p></>
                  )}
                  <p className="ml-4">"DATE": "{date}"</p>
                  <p>{"}"}</p>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                  {eventType === 'PARCEL_SITUATION_CHANGED'
                    ? 'PARCEL_SITUATION_CHANGED: met à jour le paymentSituation et enregistre les données financières.'
                    : 'PARCEL_STATUS_CHANGED: met à jour le statut du colis et du lead associé.'}
                </p>
              </div>
            </div>

            {/* Response Section */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Réponse API</h2>
                {response && (
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    response.success || response.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                  }`}>
                    HTTP 200
                  </span>
                )}
              </div>

              <div className="flex-1 bg-slate-900 rounded-2xl p-4 font-mono overflow-auto min-h-[150px]">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-slate-500 gap-3">
                    <RefreshCw className="animate-spin" size={14} />
                    <span className="text-[10px] font-bold">Traitement...</span>
                  </div>
                ) : response ? (
                  <pre className="text-[10px] text-indigo-300 leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                ) : (
                  <div className="h-full flex items-center justify-center opacity-20">
                    <Terminal size={32} className="text-white" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Orders */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 h-full">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
                <History size={18} />
              </div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Commandes Récentes</h2>
            </div>

            <div className="space-y-4">
              {loadingOrders ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
                ))
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                  <Package size={40} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucun colis trouvé</p>
                </div>
              ) : (
                recentOrders.map(order => (
                  <button
                    key={order.id}
                    onClick={() => setTracking(order.coliatyPackageCode)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all group ${
                      tracking === order.coliatyPackageCode 
                        ? 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-100' 
                        : 'bg-slate-50/50 border-transparent hover:bg-slate-50 hover:border-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter">
                        {order.coliatyPackageCode}
                      </span>
                      <ExternalLink size={12} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <User size={12} className="text-slate-400" />
                      <p className="text-xs font-black text-slate-800 truncate">{order.customerName}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                        <MapPin size={10} />
                        {order.customerCity}
                      </div>
                      <span className="w-1 h-1 rounded-full bg-slate-200" />
                      <div className={`text-[9px] font-black uppercase tracking-widest ${
                        order.status === 'DELIVERED' ? 'text-emerald-500' : 'text-amber-500'
                      }`}>
                        {order.status}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-[10px] text-indigo-700 font-bold leading-relaxed">
                💡 Cliquez sur un colis pour copier automatiquement son numéro de tracking dans le formulaire.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
