import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supportApi, adminApi, chatApi, BACKEND_URL } from '../../lib/api';
import { 
  Search, 
  Plus, 
  MessageSquare, 
  Clock, 
  ChevronRight, 
  ChevronLeft,
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
import { fr, ar, enUS } from 'date-fns/locale';
import { ProCard } from '../../components/common/ProCard';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useLanguage } from '../../contexts/LanguageContext';

const CATEGORIES = ['General', 'Payment', 'Delivery', 'Product Issue', 'Bug', 'Account'];

export default function SupportTickets() {
  const { t, language } = useLanguage();
  console.log('[SupportTickets] Loaded successfully, createPortal available:', !!createPortal);
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const textAlign = language === 'ar' ? 'text-right' : 'text-left';
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaiming, setIsClaiming] = useState<number | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const isAgent = ['SUPER_ADMIN', 'SYSTEM_SUPPORT'].includes(user?.role || '');

  const getLocale = () => {
    if (language === 'ar') return ar;
    if (language === 'en') return enUS;
    return fr;
  };

  const getCategoryLabel = (cat: string) => {
    return t(`cat_${cat.toLowerCase().replace(' ', '_')}`, 'support', cat);
  };

  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'General',
    description: ''
  });

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  // Join the support-queue room to receive real-time ticket events
  useEffect(() => {
    if (!socket || !isAgent) return;

    socket.emit('join-room', 'support-queue');

    const handleNewTicket = (data: { conversation: any }) => {
      fetchTickets();
      toast.custom((tToast) => (
        <div className={`${tToast.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-slate-900 text-white shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="ml-3 flex-1">
                <p className="text-sm font-bold">{t('toast_new_ticket', 'support')}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {data.conversation.metadata?.subject || data.conversation.metadata?.productName || t('toast_new_ticket_default', 'support')}
                </p>
              </div>
            </div>
          </div>
        </div>
      ));

      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    };

    const handleClaimed = (data: { conversationId: number; participant: any }) => {
      fetchTickets();
      if (data.participant.userId !== user?.id) {
        toast.success(t('toast_claimed_by', 'support').replace('{name}', data.participant.fullName || 'un agent'));
      }
    };

    socket.on('new-support-ticket', handleNewTicket);
    socket.on('conversation-claimed', handleClaimed);

    return () => {
      socket.emit('leave-room', 'support-queue');
      socket.off('new-support-ticket', handleNewTicket);
      socket.off('conversation-claimed', handleClaimed);
    };
  }, [socket, isAgent, user]);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const res = isAgent 
        ? await adminApi.getSupportRequests({ status: getMappedStatus(statusFilter) })
        : await supportApi.list({ status: getMappedStatus(statusFilter) });
      setTickets(res.data.data);
    } catch (error) {
      toast.error(t('toast_error_loading', 'support'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.description) {
      toast.error(t('toast_error_fields', 'support'));
      return;
    }

    try {
      setIsSubmitting(true);
      await supportApi.create({
        subject: newTicket.subject,
        type: newTicket.category,
        description: newTicket.description
      });
      toast.success(t('toast_success_created', 'support'));
      setIsModalOpen(false);
      setNewTicket({ subject: '', category: 'General', description: '' });
      fetchTickets();
    } catch (error) {
      toast.error(t('toast_error_creating', 'support'));
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
      case 'OPEN': return t('filter_pending', 'support');
      case 'IN_PROGRESS': return t('filter_claimed', 'support');
      case 'RESOLVED': return t('filter_closed', 'support');
      case 'CLOSED': return t('filter_closed', 'support');
      default: return backendStatus;
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.subject?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative overflow-hidden space-y-6">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-400/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-violet-400/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[35%] h-[35%] bg-emerald-400/5 rounded-full blur-[130px]" />
      </div>

      <div className="relative z-10 space-y-6">
        
        {/* Header Section: Pro Max Style */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-6 flex-1">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white shadow-sm border border-slate-200/50 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('support_center', 'support')}</span>
              </div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">{t('title', 'support')}</h1>
              <p className="text-base font-medium text-slate-500/80">{t('subtitle', 'support')}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {[
                { id: 'ALL', label: t('filter_all', 'support'), icon: Filter },
                { id: 'PENDING', label: t('filter_pending', 'support'), icon: Clock },
                { id: 'CLAIMED', label: t('filter_claimed', 'support'), icon: Headphones },
                { id: 'CLOSED', label: t('filter_closed', 'support'), icon: CheckCircle2 }
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
                placeholder={t('search_placeholder', 'support')}
                className="w-full bg-white border border-slate-200/60 rounded-xl py-3 pl-11 pr-4 text-xs font-bold focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/5 transition-all shadow-sm group-hover:shadow-md"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 shadow-md hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0"
            >
              <Plus size={20} strokeWidth={3} />
              {t('new_ticket', 'support')}
            </button>
          </div>
        </div>

        {/* Tickets Grid/List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode='popLayout'>
            {isLoading ? (
              [1, 2, 3].map(n => (
                <div key={n} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 h-64 animate-pulse" />
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
                          <span className="text-slate-400 font-black text-[9px] uppercase tracking-wider mb-0.5">{t('ref', 'support').replace('{id}', ticket.id.toString())}</span>
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
                      
                      <div 
                        className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all duration-500 ${
                          ticket.type === 'Bug' || ticket.type === 'Account' 
                            ? 'text-rose-500 border-rose-100 bg-rose-50/50 group-hover:bg-rose-500 group-hover:text-white group-hover:rotate-12' 
                            : 'text-slate-400 border-slate-200 bg-slate-50/50 group-hover:bg-slate-900 group-hover:text-white group-hover:-rotate-12'
                        }`}
                        title={getCategoryLabel(ticket.type)}
                      >
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
                                {t('view_pdf', 'support')}
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
                            {ticket.user?.profile?.fullName || t('default_user', 'support')}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            {format(new Date(ticket.createdAt), 'dd MMMM yyyy', { locale: getLocale() })}
                          </span>
                        </div>
                      </div>
                      
                      {isAgent ? (
                        ticket.status === 'OPEN' ? (
                          <button
                            disabled={isClaiming === ticket.id}
                            onClick={async () => {
                              if (!ticket.conversationId) {
                                toast.error(t('toast_error_old_chat', 'support'));
                                return;
                              }
                              try {
                                setIsClaiming(ticket.id);
                                await chatApi.claimConversation(ticket.conversationId.toString());
                                toast.success(t('toast_success_claimed', 'support'));
                                navigate(`/admin/chat?convId=${ticket.conversationId}`);
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || t('toast_error_claiming', 'support'));
                              } finally {
                                setIsClaiming(null);
                              }
                            }}
                            className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-600 shadow-xl shadow-slate-900/20 transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            <Headphones size={14} />
                            {isClaiming === ticket.id ? 'Claiming...' : 'Claim & Chat'}
                          </button>
                        ) : (
                          ticket.conversationId && (
                            <button
                              onClick={() => {
                                navigate(`/admin/chat?convId=${ticket.conversationId}`);
                              }}
                              className="px-6 py-2.5 bg-primary-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 shadow-[0_10px_20px_-5px_rgba(59,130,246,0.4)] hover:shadow-slate-900/30 transition-all active:scale-95 flex items-center gap-2 group/btn"
                            >
                              <MessageSquare size={14} className="group-hover/btn:rotate-12 transition-transform" />
                              {t('open_chat', 'support')}
                            </button>
                          )
                        )
                      ) : (
                        ticket.conversationId && (
                          <button
                            onClick={() => {
                              const prefix = user?.role === 'VENDOR' ? '/dashboard' : `/${user?.role?.toLowerCase()}`;
                              navigate(`${prefix}/chat?convId=${ticket.conversationId}`);
                            }}
                            className="px-6 py-2.5 bg-primary-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 shadow-[0_10px_20px_-5px_rgba(59,130,246,0.4)] hover:shadow-slate-900/30 transition-all active:scale-95 flex items-center gap-2 group/btn"
                          >
                            <MessageSquare size={14} className="group-hover/btn:rotate-12 transition-transform" />
                            {t('open_chat', 'support')}
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
                  <div className="relative w-28 h-28 bg-white rounded-2xl shadow-md border border-slate-100 flex items-center justify-center text-slate-200">
                    <MessageSquare size={48} strokeWidth={1} className="text-slate-300" />
                  </div>
                </div>
                <div className="space-y-3 max-w-xs mx-auto">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">{t('empty_title', 'support')}</h3>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    {t('empty_desc', 'support')}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
                >
                  {t('empty_btn', 'support')}
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {/* Create Ticket Modal */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 cursor-pointer">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-slate-900/65 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-xl bg-white border border-slate-200/60 rounded-2xl shadow-xl overflow-hidden cursor-default z-10"
              >
                {/* Decorative Accent */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-500 via-violet-500 to-emerald-500" />
                
                <div className="p-8 sm:p-12 space-y-10">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 mb-1">
                        <Plus className="w-3 h-3 text-slate-500" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('modal_new_request', 'support')}</span>
                      </div>
                      <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-none">{t('modal_title', 'support')}</h2>
                    </div>
                    <button 
                      onClick={() => setIsModalOpen(false)} 
                      className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all active:scale-90"
                    >
                      <X size={20} strokeWidth={3} />
                    </button>
                  </div>

                  <form onSubmit={handleCreateTicket} className="space-y-8" dir={direction}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2.5">
                        <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest block ${language === 'ar' ? 'pr-2' : 'pl-2'}`}>{t('modal_subject', 'support')}</label>
                        <div className="relative group">
                          <input
                            type="text"
                            placeholder={t('modal_subject_placeholder', 'support')}
                            required
                            dir={direction}
                            className={`w-full bg-slate-50/50 border border-slate-200/60 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/5 transition-all ${textAlign}`}
                            value={newTicket.subject}
                            onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest block ${language === 'ar' ? 'pr-2' : 'pl-2'}`}>{t('modal_category', 'support')}</label>
                        <div className="relative group">
                          <select
                            dir={direction}
                            className={`w-full bg-slate-50/50 border border-slate-200/60 rounded-2xl py-4 ${language === 'ar' ? 'pr-6 pl-12' : 'pl-6 pr-12'} text-sm font-bold focus:outline-none focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-500/5 transition-all appearance-none cursor-pointer ${textAlign}`}
                            value={newTicket.category}
                            onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                          </select>
                          <ChevronDown size={16} className={`absolute ${language === 'ar' ? 'left-5' : 'right-5'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-primary-500 transition-colors`} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest block ${language === 'ar' ? 'pr-2' : 'pl-2'}`}>{t('modal_details', 'support')}</label>
                      <textarea
                        placeholder={t('modal_details_placeholder', 'support')}
                        required
                        rows={5}
                        dir={direction}
                        className={`w-full bg-slate-50/50 border border-slate-200/60 rounded-2xl py-4 px-6 text-sm font-medium focus:outline-none focus:border-primary-500/50 focus:bg-white focus:ring-2 focus:ring-primary-500/5 transition-all resize-none text-slate-600 leading-relaxed ${textAlign}`}
                        value={newTicket.description}
                        onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                      />
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row gap-4">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 px-6 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95"
                      >
                        {t('modal_cancel', 'support')}
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary-600 shadow-md hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                      >
                        {isSubmitting ? t('modal_submitting', 'support') : t('modal_submit', 'support')}
                        {language === 'ar' ? (
                          <ChevronLeft size={18} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
                        ) : (
                          <ChevronRight size={18} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
