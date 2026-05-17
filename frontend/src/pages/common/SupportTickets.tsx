import { useState, useEffect } from 'react';
import { supportApi, adminApi, chatApi, BACKEND_URL } from '../../lib/api';
import { 
  Search, 
  Plus, 
  MessageSquare, 
  Clock, 
  ChevronRight, 
  X,
  AlertCircle,
  CheckCircle2,
  Filter,
  Eye,
  Package,
  ChevronDown,
  Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ProCard } from '../../components/common/ProCard';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['General', 'Payment', 'Delivery', 'Product Issue', 'Bug', 'Account'];

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaiming, setIsClaiming] = useState<number | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'General',
    description: ''
  });

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const isAgent = ['SUPER_ADMIN', 'SYSTEM_SUPPORT'].includes(user?.role || '');
      const res = isAgent 
        ? await adminApi.getSupportRequests({ status: getMappedStatus(statusFilter) })
        : await supportApi.list({ status: getMappedStatus(statusFilter) });
      setTickets(res.data.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.description) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    try {
      setIsSubmitting(true);
      await supportApi.create({
        subject: newTicket.subject,
        type: newTicket.category,
        description: newTicket.description
      });
      toast.success('Ticket créé avec succès');
      setIsModalOpen(false);
      setNewTicket({ subject: '', category: 'General', description: '' });
      fetchTickets();
    } catch (error) {
      toast.error('Erreur lors de la création du ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMappedStatus = (uiStatus: string) => {
    switch (uiStatus) {
      case 'PENDING': return 'OPEN';
      case 'CLAIMED': return 'IN_PROGRESS';
      case 'CLOSED': return 'CLOSED';
      default: return undefined;
    }
  };

  const getDisplayStatus = (backendStatus: string) => {
    switch (backendStatus) {
      case 'OPEN': return 'PENDING';
      case 'IN_PROGRESS': return 'CLAIMED';
      case 'RESOLVED': return 'CLOSED';
      case 'CLOSED': return 'CLOSED';
      default: return backendStatus;
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-400/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-violet-400/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[35%] h-[35%] bg-emerald-400/5 rounded-full blur-[130px]" />
      </div>

      <div className="max-w-7xl mx-auto space-y-12 relative z-10">
        
        {/* Header Section: Pro Max Style */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-6 flex-1">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm border border-slate-200/50 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Support Center</span>
              </div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">Centre d'Assistance</h1>
              <p className="text-base font-medium text-slate-500/80">Gérez vos demandes d'assistance et suivez leur progression en temps réel.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {[
                { id: 'ALL', label: 'Tout', icon: Filter },
                { id: 'PENDING', label: 'En Attente', icon: Clock },
                { id: 'CLAIMED', label: 'Pris en charge', icon: Headphones },
                { id: 'CLOSED', label: 'Terminé', icon: CheckCircle2 }
              ].map((status) => (
                <button
                  key={status.id}
                  onClick={() => setStatusFilter(status.id)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${
                    statusFilter === status.id 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.2)] scale-105' 
                      : 'bg-white text-slate-400 border-slate-200/60 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <status.icon size={12} strokeWidth={3} />
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group w-full sm:w-80">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
              <input
                type="text"
                placeholder="Rechercher par sujet..."
                className="w-full bg-white border border-slate-200/60 rounded-3xl py-4.5 pl-12 pr-4 text-sm font-bold focus:outline-none focus:border-primary-500/50 focus:ring-[6px] focus:ring-primary-500/5 transition-all shadow-sm group-hover:shadow-md"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-10 py-4.5 bg-slate-900 text-white rounded-3xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 shadow-[0_20px_40px_-10px_rgba(15,23,42,0.3)] hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3 shrink-0"
            >
              <Plus size={20} strokeWidth={3} />
              Nouveau Ticket
            </button>
          </div>
        </div>

        {/* Tickets Grid/List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode='popLayout'>
            {isLoading ? (
              [1, 2, 3].map(n => (
                <div key={n} className="bg-[#111] border border-[#1a1a1a] rounded-[2.5rem] p-8 h-64 animate-pulse" />
              ))
            ) : filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => (
                <ProCard
                  key={ticket.id}
                  variant="white"
                  className="group relative border border-slate-200/50 hover:border-primary-500/30 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)]"
                >
                  {/* Subtle Gradient Glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  {/* Status Indicator Dot */}
                  <div className={`absolute top-6 right-6 w-2.5 h-2.5 rounded-full ${
                    ticket.status === 'OPEN' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 
                    ticket.status === 'CLOSED' ? 'bg-slate-300' : 'bg-primary-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
                  }`} />

                  <div className="space-y-6 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <span className="text-slate-400 font-black text-[9px] uppercase tracking-wider mb-0.5">Ref: #{ticket.id}</span>
                          <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                            ticket.status === 'OPEN' ? 'text-amber-700 bg-amber-50 border border-amber-100' :
                            ticket.status === 'IN_PROGRESS' ? 'text-violet-700 bg-violet-50 border border-violet-100' :
                            ticket.status === 'CLOSED' || ticket.status === 'RESOLVED' ? 'text-slate-600 bg-slate-100 border border-slate-200' :
                            'text-primary-700 bg-primary-50 border border-primary-100'
                          }`}>
                            {getDisplayStatus(ticket.status)}
                          </span>
                        </div>
                      </div>
                      
                      <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all duration-500 ${
                        ticket.type === 'Bug' || ticket.type === 'Account' 
                          ? 'text-rose-500 border-rose-100 bg-rose-50/50 group-hover:bg-rose-500 group-hover:text-white group-hover:rotate-12' 
                          : 'text-slate-400 border-slate-200 bg-slate-50/50 group-hover:bg-slate-900 group-hover:text-white group-hover:-rotate-12'
                      }`}>
                        <AlertCircle size={18} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight group-hover:text-primary-600 transition-colors">
                        {ticket.subject}
                      </h3>
                      <div className="relative">
                        <p className="text-slate-500 text-sm font-medium line-clamp-2 leading-relaxed pl-4 border-l-2 border-slate-100 italic group-hover:border-primary-200 transition-colors">
                          "{ticket.description}"
                        </p>
                      </div>

                      {/* Brand Info Section */}
                      {(ticket.brandName || ticket.requestedQty) && (
                        <div className="bg-slate-50/50 rounded-2xl p-4 space-y-3 border border-slate-200/30 group-hover:bg-white group-hover:border-primary-100 transition-all duration-500">
                          <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                            <Package size={12} className="text-primary-500" />
                            Production Data
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {ticket.brandName && (
                              <div className="space-y-0.5">
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Marque</p>
                                <p className="text-xs font-black text-slate-900">{ticket.brandName}</p>
                              </div>
                            )}
                            {ticket.requestedQty && (
                              <div className="space-y-0.5 text-right">
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Quantité</p>
                                <p className="text-xs font-black text-slate-900">{ticket.requestedQty} Unités</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PDF Viewer Button */}
                      {(ticket.brandingLabelPrintUrl || ticket.brandingLabelMockupUrl) && (
                        <div className="pt-2">
                          {(() => {
                            const pdfUrl = ticket.brandingLabelPrintUrl || ticket.brandingLabelMockupUrl;
                            return (
                              <a 
                                href={pdfUrl.startsWith('http') ? pdfUrl : `${BACKEND_URL}${pdfUrl}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-3 px-5 py-2.5 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 hover:text-white transition-all border border-slate-200/60 shadow-sm hover:shadow-lg active:scale-95"
                              >
                                <Eye size={14} className="group-hover:animate-pulse" />
                                Voir Document PDF
                              </a>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-900 border border-white shadow-sm ring-4 ring-slate-50/50">
                          {ticket.user?.profile?.fullName?.charAt(0) || 'U'}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-900 leading-none mb-1 capitalize">
                            {ticket.user?.profile?.fullName || 'Utilisateur'}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            {format(new Date(ticket.createdAt), 'dd MMMM yyyy', { locale: fr })}
                          </span>
                        </div>
                      </div>
                      
                      {ticket.conversationId ? (
                        <button
                          onClick={() => {
                            const isAgent = ['SUPER_ADMIN', 'SYSTEM_SUPPORT'].includes(user?.role || '');
                            const prefix = isAgent ? '/admin' : (user?.role === 'VENDOR' ? '/dashboard' : `/${user?.role?.toLowerCase()}`);
                            navigate(`${prefix}/chat?convId=${ticket.conversationId}`);
                          }}
                          className="px-6 py-2.5 bg-primary-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 shadow-[0_10px_20px_-5px_rgba(59,130,246,0.4)] hover:shadow-slate-900/30 transition-all active:scale-95 flex items-center gap-2 group/btn"
                        >
                          <MessageSquare size={14} className="group-hover/btn:rotate-12 transition-transform" />
                          Ouvrir Chat
                        </button>
                      ) : (
                        ['SUPER_ADMIN', 'SYSTEM_SUPPORT'].includes(user?.role || '') && (
                          <button
                            onClick={async () => {
                              try {
                                setIsClaiming(ticket.id);
                                toast.error('Chat non disponible pour ce ticket ancien');
                              } finally {
                                setIsClaiming(null);
                              }
                            }}
                            className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-600 shadow-xl shadow-slate-900/20 transition-all flex items-center gap-2"
                          >
                            <Headphones size={14} />
                            Claim & Chat
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </ProCard>
              ))
            ) : (
              <div className="col-span-full py-32 flex flex-col items-center text-center space-y-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary-500/20 blur-3xl rounded-full" />
                  <div className="relative w-32 h-32 bg-white rounded-[3rem] shadow-xl border border-slate-100 flex items-center justify-center text-slate-200">
                    <MessageSquare size={48} strokeWidth={1} className="text-slate-300" />
                  </div>
                </div>
                <div className="space-y-3 max-w-xs mx-auto">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">C'est bien calme ici...</h3>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    Vous n'avez pas encore de tickets d'assistance. Si vous avez besoin d'aide, n'hésitez pas à en créer un.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
                >
                  Ouvrir un ticket maintenant
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white border border-slate-200/60 rounded-[2.5rem] shadow-[0_30px_100px_-20px_rgba(15,23,42,0.3)] overflow-hidden"
            >
              {/* Decorative Accent */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-500 via-violet-500 to-emerald-500" />
              
              <div className="p-8 sm:p-12 space-y-10">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 mb-1">
                      <Plus className="w-3 h-3 text-slate-500" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nouvelle Demande</span>
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-none">Comment pouvons-nous vous aider ?</h2>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)} 
                    className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all active:scale-90"
                  >
                    <X size={20} strokeWidth={3} />
                  </button>
                </div>

                <form onSubmit={handleCreateTicket} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Sujet du ticket</label>
                      <div className="relative group">
                        <input
                          type="text"
                          placeholder="Ex: Problème de livraison..."
                          required
                          className="w-full bg-slate-50/50 border border-slate-200/60 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/5 transition-all"
                          value={newTicket.subject}
                          onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Catégorie</label>
                      <div className="relative group">
                        <select
                          className="w-full bg-slate-50/50 border border-slate-200/60 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/5 transition-all appearance-none cursor-pointer"
                          value={newTicket.category}
                          onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-primary-500 transition-colors" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Détails de votre demande</label>
                    <textarea
                      placeholder="Décrivez votre situation avec le plus de précisions possible..."
                      required
                      rows={5}
                      className="w-full bg-slate-50/50 border border-slate-200/60 rounded-[2rem] py-5 px-6 text-sm font-medium focus:outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/5 transition-all resize-none text-slate-600 leading-relaxed"
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    />
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-8 py-5 bg-slate-50 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-[2] bg-slate-900 text-white py-5 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-primary-600 shadow-[0_20px_40px_-10px_rgba(15,23,42,0.3)] hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
                    >
                      {isSubmitting ? 'Création en cours...' : 'Envoyer ma demande'}
                      <ChevronRight size={18} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
