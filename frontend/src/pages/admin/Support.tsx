import { useState, useEffect } from 'react';
import { chatApi, BACKEND_URL } from '../../lib/api';
import { 
  Package, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Headphones,
  Ticket,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminSupportQueue() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'QUEUE' | 'MY_ACTIVE'>('QUEUE');

  useEffect(() => {
    fetchQueue();
  }, []);

  // Join the support-queue room to receive real-time ticket events
  useEffect(() => {
    if (!socket) return;

    socket.emit('join-room', 'support-queue');

    return () => {
      socket.emit('leave-room', 'support-queue');
    };
  }, [socket]);

  const fetchQueue = async () => {
    try {
      setIsLoading(true);
      const res = await chatApi.getQueue();
      setQueue(res.data.data.queue);
    } catch (error) {
      toast.error('Erreur lors du chargement de la file d\'attente');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleNewTicket = (data: { conversation: any }) => {
      setQueue(prev => {
        // Prevent duplicates
        if (prev.some(c => c.id === data.conversation.id)) return prev;
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-slate-900 text-white shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="ml-3 flex-1">
                  <p className="text-sm font-bold">🎫 Nouveau ticket Support</p>
                  <p className="mt-1 text-xs text-slate-300">{data.conversation.metadata?.productName || 'Achat en gros'}</p>
                </div>
              </div>
            </div>
          </div>
        ));
        // Audio notification optional
        try {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(() => {}); // ignore auto-play policies
        } catch(e) {}
        
        return [...prev, data.conversation].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
    };

    const handleClaimed = (data: { conversationId: number, participant: any }) => {
      setQueue(prev => prev.filter(c => c.id !== data.conversationId));
      if (data.participant.userId !== user?.id) {
        toast.success(`⚡ Réclamé par ${data.participant.fullName || 'un agent'}`);
      }
    };

    socket.on('new-support-ticket', handleNewTicket);
    socket.on('conversation-claimed', handleClaimed);

    return () => {
      socket.off('new-support-ticket', handleNewTicket);
      socket.off('conversation-claimed', handleClaimed);
    };
  }, [socket, user]);

  const handleClaim = async (convId: number) => {
    try {
      setClaimingId(convId);
      await chatApi.claimConversation(convId.toString());
      navigate(`/admin/chat?convId=${convId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la réclamation');
      fetchQueue(); // Sync just in case
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Headphones className="text-violet-600" /> Support Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">File d'attente en temps réel pour la prise en charge des achats et demandes.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('QUEUE')}
          className={`px-6 py-3 text-sm font-black border-b-2 transition-all ${
            activeTab === 'QUEUE' 
              ? 'border-violet-600 text-violet-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
          }`}
        >
          En attente ({queue.length})
        </button>
        <button
          onClick={() => navigate('/admin/chat')}
          className="px-6 py-3 text-sm font-black border-b-2 border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center gap-2"
        >
          Mes Chats Actifs <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-white rounded-3xl border border-slate-100 flex items-center justify-center">
                 <Loader2 className="animate-spin text-violet-300" />
              </div>
            ))
          ) : queue.length === 0 ? (
             <div className="col-span-full py-20 text-center">
                 <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                 </div>
                 <h3 className="text-xl font-black text-slate-900">La file est vide !</h3>
                 <p className="text-sm text-slate-500 mt-2">Aucun ticket en attente. Beau travail.</p>
             </div>
          ) : (
            queue.map((conv) => {
              const customer = conv.participants?.find((p: any) => p.role === 'MEMBER')?.user;
              const meta = conv.metadata || {};
              const waitingTime = formatDistanceToNow(new Date(conv.createdAt), { locale: fr, addSuffix: true });

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={conv.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/20 overflow-hidden flex flex-col relative group"
                >
                  <div className="p-5 flex-1 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                       <span className="px-3 py-1 bg-violet-50 text-violet-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-violet-100/50">
                         Nouveau Ticket
                       </span>
                       <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                         <Clock size={12} className={new Date().getTime() - new Date(conv.createdAt).getTime() > 1800000 ? 'text-rose-500 animate-pulse' : ''} />
                         Attente {waitingTime}
                       </span>
                    </div>

                    <div className="space-y-4">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                           {customer?.profile?.fullName?.substring(0, 2).toUpperCase() || 'CX'}
                         </div>
                         <div>
                           <p className="text-xs font-black text-slate-900">{customer?.profile?.fullName || 'Client'}</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client</p>
                         </div>
                       </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                           <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                {meta.category || 'SUPPORT'}
                              </span>
                              <p className="text-xs font-bold text-slate-900 line-clamp-1">{meta.subject || 'Aucun sujet'}</p>
                           </div>
                           <p className="text-[10px] text-slate-500 line-clamp-2 italic leading-relaxed">
                             "{meta.description || 'Pas de description'}"
                           </p>
                        </div>

                        {(meta.productName || meta.brandName) && (
                          <div className="grid grid-cols-2 gap-2 text-center">
                             <div className="p-2 border border-slate-100 rounded-xl bg-white shadow-sm">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Marque / Produit</p>
                                <p className="text-[11px] font-black text-slate-900 truncate">{meta.productName || meta.brandName || 'N/A'}</p>
                             </div>
                             <div className="p-2 border border-slate-100 rounded-xl bg-white shadow-sm">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Détails</p>
                                <p className="text-[11px] font-black text-slate-900 truncate">
                                  {meta.productSku ? `SKU: ${meta.productSku}` : (meta.requestedQty ? `${meta.requestedQty} pcs` : 'N/A')}
                                </p>
                             </div>
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="p-2 bg-slate-50 border-t border-slate-100">
                    <button
                      onClick={() => handleClaim(conv.id)}
                      disabled={claimingId === conv.id}
                      className="w-full flex justify-center items-center gap-2 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-violet-600 hover:shadow-lg hover:shadow-violet-500/25 transition-all disabled:opacity-50"
                    >
                      {claimingId === conv.id ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <>Claim & Open Chat <ChevronRight size={16} /></>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
