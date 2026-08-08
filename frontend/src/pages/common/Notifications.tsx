import { useState, useEffect } from 'react';
import { notificationsApi } from '../../lib/api';
import { useSocket } from '../../contexts/SocketContext';
import { 
  Bell, 
  Trash2, 
  CheckCheck, 
  Search, 
  Package, 
  Tag, 
  CreditCard, 
  Users, 
  X,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { useLanguage } from '../../contexts/LanguageContext';
import { translateNotification } from '../../utils/notificationTranslator';
import { useAuth } from '../../contexts/AuthContext';
import { currentBasePath } from '../../lib/dashboardBase';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const { socket } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  // Confirmation Modal states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const getRoleTheme = () => {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) {
      return {
        primary: 'bg-rose-600 hover:bg-rose-700 shadow-rose-100',
        text: 'text-rose-600',
        border: 'border-rose-100 focus:border-rose-200 focus:ring-rose-200',
        hoverBg: 'hover:bg-rose-50',
        hoverBorder: 'hover:border-rose-200',
        accentBg: 'bg-rose-50',
        spinBorder: 'border-rose-200 border-t-rose-600',
        gradient: 'from-rose-500 to-red-500',
        activeTab: 'bg-rose-600 text-white shadow-md shadow-rose-100/50',
        indicator: 'bg-rose-500/5'
      };
    }
    if (path.startsWith('/agent')) {
      return {
        primary: 'bg-blue-600 hover:bg-blue-700 shadow-blue-100',
        text: 'text-blue-600',
        border: 'border-blue-100 focus:border-blue-200 focus:ring-blue-200',
        hoverBg: 'hover:bg-blue-50',
        hoverBorder: 'hover:border-blue-200',
        accentBg: 'bg-blue-50',
        spinBorder: 'border-blue-200 border-t-blue-600',
        gradient: 'from-blue-500 to-indigo-500',
        activeTab: 'bg-blue-600 text-white shadow-md shadow-blue-100/50',
        indicator: 'bg-blue-500/5'
      };
    }
    if (path.startsWith('/grosseller')) {
      return {
        primary: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100',
        text: 'text-emerald-600',
        border: 'border-emerald-100 focus:border-emerald-200 focus:ring-emerald-200',
        hoverBg: 'hover:bg-emerald-50',
        hoverBorder: 'hover:border-emerald-200',
        accentBg: 'bg-emerald-50',
        spinBorder: 'border-emerald-200 border-t-emerald-600',
        gradient: 'from-emerald-500 to-teal-500',
        activeTab: 'bg-emerald-600 text-white shadow-md shadow-emerald-100/50',
        indicator: 'bg-emerald-500/5'
      };
    }
    if (path.startsWith('/influencer')) {
      return {
        primary: 'bg-influencer-600 hover:bg-influencer-700 shadow-influencer-100',
        text: 'text-influencer-600',
        border: 'border-influencer-100 focus:border-influencer-200 focus:ring-influencer-200',
        hoverBg: 'hover:bg-influencer-50',
        hoverBorder: 'hover:border-influencer-200',
        accentBg: 'bg-influencer-50',
        spinBorder: 'border-influencer-200 border-t-influencer-600',
        gradient: 'from-influencer-500 to-purple-500',
        activeTab: 'bg-influencer-600 text-white shadow-md shadow-influencer-100/50',
        indicator: 'bg-influencer-50/5'
      };
    }
    if (path.startsWith('/confirmation')) {
      return {
        primary: 'bg-teal-600 hover:bg-teal-700 shadow-teal-100',
        text: 'text-teal-600',
        border: 'border-teal-100 focus:border-teal-200 focus:ring-teal-200',
        hoverBg: 'hover:bg-teal-50',
        hoverBorder: 'hover:border-teal-200',
        accentBg: 'bg-teal-50',
        spinBorder: 'border-teal-200 border-t-teal-600',
        gradient: 'from-teal-500 to-cyan-500',
        activeTab: 'bg-teal-600 text-white shadow-md shadow-teal-100/50',
        indicator: 'bg-teal-50/5'
      };
    }
    if (path.startsWith('/helper')) {
      return {
        primary: 'bg-orange-600 hover:bg-orange-700 shadow-orange-100',
        text: 'text-orange-600',
        border: 'border-orange-100 focus:border-orange-200 focus:ring-orange-200',
        hoverBg: 'hover:bg-orange-50',
        hoverBorder: 'hover:border-orange-200',
        accentBg: 'bg-orange-50',
        spinBorder: 'border-orange-200 border-t-orange-600',
        gradient: 'from-orange-500 to-amber-500',
        activeTab: 'bg-orange-600 text-white shadow-md shadow-orange-100/50',
        indicator: 'bg-orange-50/5'
      };
    }
    // Default (Vendor / Dashboard layout)
    return {
      primary: 'bg-primary-600 hover:bg-primary-700 shadow-primary-100',
      text: 'text-primary-600',
      border: 'border-primary-100 focus:border-primary-200 focus:ring-primary-200',
      hoverBg: 'hover:bg-primary-50',
      hoverBorder: 'hover:border-primary-200',
      accentBg: 'bg-primary-50',
      spinBorder: 'border-primary-200 border-t-primary-600',
      gradient: 'from-primary-500 to-indigo-500',
      activeTab: 'bg-primary-600 text-white shadow-md shadow-primary-100/50',
      indicator: 'bg-primary-50/5'
    };
  };

  const theme = getRoleTheme();

  const getNotificationRedirect = (type: string) => {
    const prefix = currentBasePath(user?.role);

    switch (type) {
      case 'PRODUCT_CLAIM_STATUS':
        return `${prefix}/inventory`;
      case 'REFERRAL_LINK_STATUS':
      case 'REFERRAL_LINK_CLICKS':
        return `${prefix}/links`;
      case 'PAYOUT_REQUEST_STATUS':
        return `${prefix}/wallet`;
      case 'NEW_LEAD':
      case 'LEAD_STATUS_CHANGED':
        return `${prefix}/leads`;
      default:
        return prefix;
    }
  };

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await notificationsApi.list({ page: 1, limit: 100 });
      setNotifications(res.data.data.notifications || []);
    } catch (error) {
      toast.error(t('toast_load_error', 'notifications', 'Impossible de charger les notifications'));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Listen to real-time updates when user is viewing this history dashboard
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification: any) => {
      setNotifications(prev => [notification, ...prev]);
    };

    socket.on('new-notification', handleNewNotification);

    return () => {
      socket.off('new-notification', handleNewNotification);
    };
  }, [socket]);

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.isRead) {
        await notificationsApi.markRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
        window.dispatchEvent(new CustomEvent('notification:read', { detail: { id: notif.id } }));
      }
      navigate(getNotificationRedirect(notif.type));
    } catch (err) {
      console.error('Failed to handle notification click:', err);
    }
  };

  const handleMarkRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      toast.success(t('toast_marked_read', 'notifications', 'Marquée comme lue'));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success(t('toast_deleted', 'notifications', 'Notification supprimée'));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success(t('toast_all_marked_read', 'notifications', 'Toutes les notifications ont été marquées comme lues'));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDeleteAll = () => {
    setConfirmData({
      title: t('confirm_delete_all_title', 'notifications', "Vider tout l'historique"),
      message: t('confirm_delete_all_message', 'notifications', "Voulez-vous vraiment supprimer définitivement toutes vos notifications ? Cette action est irréversible."),
      onConfirm: async () => {
        try {
          await notificationsApi.deleteAll();
          setNotifications([]);
          toast.success(t('toast_all_deleted', 'notifications', 'Historique vidé avec succès'));
        } catch (err) {
          toast.error(t('toast_delete_error', 'notifications', 'Erreur lors de la suppression'));
          console.error(err);
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const filteredNotifications = notifications.filter(notif => {
    // Tab filtering
    let matchesFilter = false;
    if (activeFilter === 'ALL') {
      matchesFilter = true;
    } else if (activeFilter === 'INVENTORY') {
      matchesFilter = notif.type === 'PRODUCT_CLAIM_STATUS';
    } else if (activeFilter === 'LINKS') {
      matchesFilter = ['REFERRAL_LINK_STATUS', 'REFERRAL_LINK_CLICKS'].includes(notif.type);
    } else if (activeFilter === 'PAYOUT') {
      matchesFilter = notif.type === 'PAYOUT_REQUEST_STATUS';
    } else if (activeFilter === 'LEADS') {
      matchesFilter = ['NEW_LEAD', 'LEAD_STATUS_CHANGED'].includes(notif.type);
    }

    // Search query filtering
    const matchesSearch = 
      notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.body.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const getNotificationIconDetails = (type: string) => {
    switch (type) {
      case 'PRODUCT_CLAIM_STATUS':
        return { icon: Package, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' };
      case 'REFERRAL_LINK_STATUS':
      case 'REFERRAL_LINK_CLICKS':
        return { icon: Tag, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' };
      case 'PAYOUT_REQUEST_STATUS':
        return { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' };
      case 'NEW_LEAD':
      case 'LEAD_STATUS_CHANGED':
        return { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' };
      default:
        return { icon: Bell, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-100' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className={`w-8 h-8 border-4 rounded-full animate-spin ${theme.spinBorder}`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 ${theme.accentBg}/20 rounded-full blur-2xl pointer-events-none`} />
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className={`p-2 ${theme.accentBg} rounded-xl ${theme.text}`}>
              <Bell size={20} className="animate-pulse" />
            </div>
            {t('title', 'notifications', 'Historique des Notifications')}
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1">
            {t('subtitle', 'notifications', 'Gérez et suivez toutes vos notifications système en temps réel.')}
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-black text-slate-700 shadow-sm hover:shadow active:scale-95 transition-all duration-300"
            >
              <CheckCheck size={14} className="text-emerald-500" />
              <span>{t('btn_mark_all_read', 'notifications', 'Tout marquer comme lu')}</span>
            </button>
            <button
              onClick={handleDeleteAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 rounded-xl text-xs font-black text-rose-600 active:scale-95 transition-all duration-300"
            >
              <Trash2 size={14} />
              <span>{t('btn_clear_all', 'notifications', 'Tout effacer')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters and Search controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-hide py-1">
          {[
            { id: 'ALL', label: t('tab_all', 'notifications', 'Toutes') },
            { id: 'INVENTORY', label: t('tab_inventory', 'notifications', 'Mes Produits') },
            { id: 'LINKS', label: t('tab_links', 'notifications', 'Mes Liens') },
            { id: 'PAYOUT', label: t('tab_payout', 'notifications', 'Portefeuille') },
            { id: 'LEADS', label: t('tab_leads', 'notifications', 'Leads & Ventes') }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all duration-300 active:scale-95 ${
                activeFilter === tab.id
                  ? theme.activeTab
                  : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-100 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder={t('search_placeholder', 'notifications', 'Rechercher une notification...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 bg-white border border-slate-100 hover:border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none transition-all shadow-sm focus:ring-1 ${theme.border}`}
          />
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Notifications List Container */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
        {filteredNotifications.length === 0 ? (
          <div className="py-24 px-6 text-center">
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-4 shadow-inner">
              <Bell size={24} className="text-slate-400/80 animate-bounce" />
            </div>
            <p className="text-sm font-black text-slate-800">{t('no_notifications_found', 'notifications', 'Aucune notification trouvée')}</p>
            <p className="text-xs text-slate-400 font-bold mt-1.5 max-w-sm mx-auto leading-relaxed">
              {searchQuery || activeFilter !== 'ALL' 
                ? t('no_notifications_desc_search', 'notifications', 'Essayez de modifier vos filtres ou vos termes de recherche pour trouver ce que vous cherchez.') 
                : t('no_notifications_desc_empty', 'notifications', 'Vos nouvelles notifications apparaîtront en temps réel dès que des événements se produiront.')}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const { icon: IconComponent, color, bg } = getNotificationIconDetails(notif.type);
            const translated = translateNotification(notif, (k, ns, fb) => t(k, ns || 'notifications', fb));
            const dateObj = new Date(notif.createdAt);
            const formattedDate = dateObj.toLocaleDateString(language, { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = dateObj.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex items-start gap-4 p-5 hover:bg-slate-50/70 cursor-pointer transition-all duration-300 relative group ${
                  !notif.isRead ? theme.indicator : ''
                }`}
              >
                {/* Active Indicator Accent Line */}
                {!notif.isRead && (
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${theme.gradient}`} />
                )}

                {/* Styled Icon */}
                <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center flex-shrink-0 shadow-sm transition-all duration-300 group-hover:scale-110 ${bg}`}>
                  <IconComponent size={16} className={color} />
                </div>

                {/* Body Texts */}
                <div className={`flex-1 min-w-0 ${language === 'ar' ? 'pl-12' : 'pr-12'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4">
                    <p className="text-xs font-black text-slate-900 tracking-tight leading-snug">
                      {translated.title}
                    </p>
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap self-start sm:self-auto bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                      {formattedDate} - {formattedTime}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed mt-1.5">
                    {translated.body}
                  </p>
                </div>

                {/* Right/Left side hover action buttons */}
                <div className={`absolute ${language === 'ar' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300`}>
                  {!notif.isRead && (
                    <button
                      onClick={(e) => handleMarkRead(notif.id, e)}
                      className="p-2 bg-white border border-slate-200 hover:border-emerald-200 rounded-xl text-slate-400 hover:text-emerald-600 shadow-sm transition-all active:scale-95"
                      title={t('btn_read_all_short', 'notifications', 'Marquer comme lu')}
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(notif.id, e)}
                    className="p-2 bg-rose-50 border border-rose-100 hover:border-rose-200 rounded-xl text-rose-500 hover:text-rose-600 shadow-sm transition-all active:scale-95"
                    title={t('confirm_delete_all_btn', 'notifications', 'Supprimer')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        message={confirmData.message}
        type="danger"
        confirmText={t('confirm_delete_all_btn', 'notifications', 'Supprimer')}
      />
    </div>
  );
}
