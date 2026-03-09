import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  Bell, DollarSign, AlertTriangle, Info,
  Zap, ShoppingBag, Shield, Star, Check, Archive
} from 'lucide-react';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function InfluencerNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'important'>('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data || res.data || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      // Set sample notifications for demonstration
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'COMMISSION': return { icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' };
      case 'CAMPAIGN': return { icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' };
      case 'VERIFICATION': return { icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'PRODUCT': return { icon: ShoppingBag, color: 'text-indigo-600', bg: 'bg-indigo-50' };
      case 'FRAUD': return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' };
      case 'MILESTONE': return { icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' };
      default: return { icon: Info, color: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'important') return ['FRAUD', 'VERIFICATION', 'COMMISSION'].includes(n.type);
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-influencer-200 border-t-influencer-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est à jour!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-influencer-600 hover:bg-influencer-50 rounded-xl transition-all">
            <Check className="w-3.5 h-3.5" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {([['all', 'Tout'], ['unread', 'Non lus'], ['important', 'Importants']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === key
                ? 'bg-influencer-50 text-influencer-700 ring-1 ring-influencer-200'
                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {label}
            {key === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 bg-influencer-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filteredNotifications.length > 0 ? (
        <div className="space-y-2">
          {filteredNotifications.map((notif) => {
            const { icon: Icon, color, bg } = getNotificationIcon(notif.type);
            return (
              <div
                key={notif.id}
                className={`card p-4 flex items-start gap-4 transition-all hover:shadow-md ${
                  !notif.isRead ? 'border-l-4 border-l-influencer-500 bg-influencer-50/30' : ''
                }`}
              >
                <div className={`p-2.5 rounded-xl ${bg} ${color} flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!notif.isRead ? 'font-bold' : 'font-medium'} text-gray-900`}>{notif.title}</p>
                    {!notif.isRead && <div className="w-2 h-2 rounded-full bg-influencer-500 flex-shrink-0" />}
                  </div>
                  {notif.body && <p className="text-sm text-gray-500 mt-0.5">{notif.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                </div>
                <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex-shrink-0">
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucune notification</p>
          <p className="text-gray-400 text-sm mt-1">Vous serez notifié des commissions, campagnes et événements importants.</p>
        </div>
      )}
    </div>
  );
}
