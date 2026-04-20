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
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ProCard } from '../../components/common/ProCard';

const CATEGORIES = ['General', 'Payment', 'Delivery', 'Product Issue', 'Bug', 'Account'];

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const res = await supportApi.list({ 
        status: getMappedStatus(statusFilter)
      });
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
      case 'WAITING': return 'IN_PROGRESS';
      case 'CLOSED': return 'CLOSED';
      default: return undefined;
    }
  };

  const getDisplayStatus = (backendStatus: string) => {
    switch (backendStatus) {
      case 'OPEN': return 'PENDING';
      case 'IN_PROGRESS': return 'WAITING';
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
    <div className="min-h-screen p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Section: Pro Max Style */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-6 flex-1">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 mb-2">
                <MessageSquare className="w-3 h-3 text-primary-600" />
                <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">Support Center</span>
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Centre d'Assistance</h1>
              <p className="text-sm font-medium text-slate-400">Gérez vos tickets et obtenez de l'aide rapidement.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {['ALL', 'PENDING', 'WAITING', 'CLOSED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${
                    statusFilter === status 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200' 
                      : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
              <input
                type="text"
                placeholder="Rechercher un ticket..."
                className="w-full bg-white border border-slate-100 rounded-[1.5rem] py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-primary-500/50 focus:ring-4 focus:ring-primary-500/5 transition-all shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

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
                  variant="glass"
                  className="group relative overflow-hidden"
                >
                  {/* Status Indicator Bar */}
                  <div className={`absolute top-0 left-0 bottom-0 w-1.5 transition-all duration-500 ${
                    ticket.status === 'OPEN' ? 'bg-amber-500' : 
                    ticket.status === 'CLOSED' ? 'bg-slate-300' : 'bg-primary-500'
                  }`} />

                  <div className="space-y-6">
                    <div className="flex items-center justify-between pl-2">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-300 font-black text-[10px] uppercase tracking-tighter">ID: #{ticket.id}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[0.5rem] ${
                          ticket.status === 'OPEN' ? 'text-amber-600 bg-amber-50' :
                          ticket.status === 'CLOSED' || ticket.status === 'RESOLVED' ? 'text-slate-500 bg-slate-50' :
                          'text-primary-600 bg-primary-50'
                        }`}>
                          {getDisplayStatus(ticket.status)}
                        </span>
                      </div>
                      <div className={`p-1.5 rounded-lg border transition-all ${
                        ticket.type === 'Bug' || ticket.type === 'Account' 
                          ? 'text-rose-500 border-rose-100 bg-rose-50/30' 
                          : 'text-slate-400 border-slate-100 bg-slate-50/30'
                      }`}>
                        <AlertCircle size={14} />
                      </div>
                    </div>

                    <div className="space-y-3 pl-2">
                      <h3 className="text-lg font-black text-slate-800 tracking-tight leading-snug group-hover:text-primary-600 transition-colors">
                        {ticket.subject}
                      </h3>
                      <p className="text-slate-400 text-xs font-medium line-clamp-2 leading-relaxed italic">
                        "{ticket.description}"
                      </p>

                      {/* Brand Info Section */}
                      {(ticket.brandName || ticket.requestedQty) && (
                        <div className="bg-slate-50/50 rounded-2xl p-4 space-y-3 border border-slate-100/50">
                          <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            <Package size={12} className="text-primary-500" />
                            Production Data
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {ticket.brandName && (
                              <div className="space-y-0.5">
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Marque</p>
                                <p className="text-[11px] font-black text-slate-900">{ticket.brandName}</p>
                              </div>
                            )}
                            {ticket.requestedQty && (
                              <div className="space-y-0.5 text-right">
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Quantité</p>
                                <p className="text-[11px] font-black text-slate-900">{ticket.requestedQty} Unités</p>
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
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 hover:text-white transition-all border border-slate-100 shadow-sm"
                              >
                                <Eye size={12} />
                                Voir Document PDF
                              </a>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 flex items-center justify-between border-t border-slate-50 ml-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center text-[9px] font-black text-white">
                          {ticket.user?.profile?.fullName?.charAt(0) || 'U'}
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                          {ticket.user?.profile?.fullName || 'Utilisateur'}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-300">
                        {format(new Date(ticket.createdAt), 'dd MMMM', { locale: fr })}
                      </span>
                    </div>
                  </div>
                </ProCard>
              ))
            ) : (
              <div className="col-span-full py-32 text-center space-y-6">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200 border border-slate-100 animate-pulse">
                  <MessageSquare size={40} />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-black text-slate-800 tracking-tight">Aucun ticket trouvé</p>
                  <p className="text-sm font-medium text-slate-400">Vos demandes d'assistance apparaîtront ici.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-3xl overflow-hidden"
            >
              {/* Decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-[60px] -mr-16 -mt-16" />

              <div className="relative z-10 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-none capitalize">Nouveau Ticket</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Support Assistance</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateTicket} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Sujet</label>
                    <input
                      type="text"
                      placeholder="Brève description du problème..."
                      required
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:border-primary-500/50 transition-all font-medium"
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Catégorie</label>
                    <div className="relative">
                      <select
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:border-primary-500/50 transition-all font-medium appearance-none cursor-pointer"
                        value={newTicket.category}
                        onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Description</label>
                    <textarea
                      placeholder="Expliquez votre problème en détail..."
                      required
                      rows={4}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:border-primary-500/50 transition-all font-medium resize-none text-slate-600"
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10 group disabled:opacity-50"
                  >
                    {isSubmitting ? 'Création...' : 'Créer le Ticket'}
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
