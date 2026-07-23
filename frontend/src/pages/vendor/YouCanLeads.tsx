import { useState, useEffect } from 'react';
import { 
  Globe, 
  Search, 
  RefreshCw, 
  Copy, 
  Check, 
  Eye, 
  ShoppingBag, 
  DollarSign, 
  Truck, 
  Clock, 
  AlertCircle,
  X,
  Phone,
  User,
  MapPin,
  Calendar,
  CreditCard,
  Package
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { youcanApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr, ar } from 'date-fns/locale';

interface YouCanOrder {
  id: string | number;
  ref?: string;
  order_number?: string;
  created_at: string;
  customer?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
  customer_name?: string;
  phone?: string;
  address?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address1?: string;
    city?: string;
    country_name?: string;
  };
  fulfillment_status?: string;
  payment_status?: string;
  status?: string;
  total_price?: number | string;
  grand_total?: number | string;
  currency?: string;
  line_items?: Array<{
    id?: string | number;
    name?: string;
    title?: string;
    quantity?: number;
    price?: number | string;
    variant_title?: string;
  }>;
}

export default function YouCanLeads() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const [orders, setOrders] = useState<YouCanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<YouCanOrder | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await youcanApi.getOrders();
      const rawData = res.data?.data || res.data || [];
      setOrders(Array.isArray(rawData) ? rawData : []);
    } catch (err: any) {
      console.error('Error loading YouCan orders:', err);
      // Fallback: If no direct YouCan order sync endpoint exists or token isn't linked yet, show helpful empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await youcanApi.syncNow();
      toast.success(res.data?.message || (isRtl ? 'تمت مزامنة الطلبيات من YouCan بنجاح !' : 'Mise à jour YouCan effectuée avec succès !'));
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (isRtl ? 'فشلت المزامنة المباشرة مع YouCan' : 'Erreur lors de la synchronisation YouCan'));
    } finally {
      setIsSyncing(false);
    }
  };

  const copyPhone = (phone: string, id: string | number) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    toast.success(isRtl ? 'تم نسخ رقم الهاتف !' : 'Numéro copié !');
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  // Helper formatting
  const formatOrderRef = (order: YouCanOrder, index: number) => {
    if (order.ref) return order.ref.startsWith('#') ? order.ref : `#${order.ref}`;
    if (order.order_number) return `#${order.order_number}`;
    if (order.id) return `#${String(order.id).slice(-4)}`;
    return `#${String(orders.length - index).padStart(3, '0')}`;
  };

  const getCustomerName = (order: YouCanOrder) => {
    if (order.customer?.first_name || order.customer?.last_name) {
      return `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim();
    }
    if (order.address?.first_name || order.address?.last_name) {
      return `${order.address.first_name || ''} ${order.address.last_name || ''}`.trim();
    }
    if (order.customer_name) return order.customer_name;
    return isRtl ? 'عميل غير مسمى' : 'Client Inconnu';
  };

  const getCustomerPhone = (order: YouCanOrder) => {
    return order.customer?.phone || order.address?.phone || order.phone || '';
  };

  const getTotalAmount = (order: YouCanOrder) => {
    const val = order.total_price ?? order.grand_total ?? 0;
    const currency = order.currency || 'MAD';
    return `${Number(val).toLocaleString()} ${currency}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss', { locale: isRtl ? ar : fr });
    } catch (e) {
      return dateStr || '-';
    }
  };

  // Filtering
  const filteredOrders = orders.filter((order, idx) => {
    const ref = formatOrderRef(order, idx).toLowerCase();
    const name = getCustomerName(order).toLowerCase();
    const phone = getCustomerPhone(order).toLowerCase();
    const query = searchTerm.toLowerCase();

    const matchesSearch = ref.includes(query) || name.includes(query) || phone.includes(query);
    const matchesStatus = statusFilter === 'ALL' || (order.status || 'Open').toUpperCase() === statusFilter.toUpperCase();
    const matchesPayment = paymentFilter === 'ALL' || (order.payment_status || 'Unpaid').toUpperCase() === paymentFilter.toUpperCase();

    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Calculate Statistics
  const totalOrdersCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_price || o.grand_total) || 0), 0);
  const unfulfilledCount = orders.filter(o => (o.fulfillment_status || 'Unfulfilled').toLowerCase().includes('unfulfilled')).length;
  const unpaidCount = orders.filter(o => (o.payment_status || 'Unpaid').toLowerCase().includes('unpaid')).length;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6 pt-4 pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-rose-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-rose-500/20 ring-4 ring-white">
            YC
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">
              {isRtl ? 'مجرى الطلبيات YouCan' : 'Flux YouCan Orders & Leads'}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium">
              {isRtl 
                ? 'الطلبات والعملاء المحتملون المتزامنون تلقائيًا من متجر YouCan الخاص بك في الوقت الفعلي.' 
                : 'Commandes et prospects synchronisés automatiquement depuis votre boutique YouCan.shop.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            {isRtl ? 'مزامنة الآن' : 'Mise à jour YouCan'}
          </button>
        </div>
      </div>

      {/* Stats Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'إجمالي الطلبات' : 'Total Commandes'}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{totalOrdersCount}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ShoppingBag size={22} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'إجمالي المبيعات' : 'Chiffre d\'affaires'}</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{totalRevenue.toLocaleString()} <span className="text-xs">MAD</span></p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign size={22} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'طلبات بانتظار الشحن' : 'Non expédiées'}</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{unfulfilledCount}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Truck size={22} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'طلبات غير مدفوعة' : 'Non payées'}</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{unpaidCount}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Clock size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/40">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-4 rtl:left-auto" size={18} />
            <input 
              type="text"
              placeholder={isRtl ? 'بحث حسب المرجع، اسم العميل أو الهاتف...' : 'Rechercher par ref, nom ou téléphone...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 focus:border-amber-500 rounded-2xl text-xs font-semibold transition-all outline-none rtl:pr-11 rtl:pl-4"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-700 outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">{isRtl ? 'جميع الحالات' : 'Tous les statuts'}</option>
              <option value="OPEN">Open / En attente</option>
              <option value="CONFIRMED">Confirmed / مؤكد</option>
              <option value="CANCELLED">Cancelled / ملغى</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-700 outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">{isRtl ? 'جميع حالات الأداء' : 'Paiements (Tous)'}</option>
              <option value="UNPAID">Unpaid / غير مدفوع</option>
              <option value="PAID">Paid / مدفوع</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">Ref</th>
                <th className="py-4 px-6">{isRtl ? 'تاريخ الإنشاء' : 'Date de Création'}</th>
                <th className="py-4 px-6">{isRtl ? 'اسم العميل' : 'Nom du Client'}</th>
                <th className="py-4 px-6">{isRtl ? 'الهاتف' : 'Téléphone'}</th>
                <th className="py-4 px-6">{isRtl ? 'حالة التأكيد' : 'Confirmation'}</th>
                <th className="py-4 px-6">{isRtl ? 'الأداء' : 'Paiement'}</th>
                <th className="py-4 px-6">{isRtl ? 'الشحن' : 'Expédition'}</th>
                <th className="py-4 px-6">{isRtl ? 'المجموع' : 'Total'}</th>
                <th className="py-4 px-6 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                      <p className="font-bold">{isRtl ? 'جاري تحميل طلبيات YouCan...' : 'Chargement des commandes YouCan...'}</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <ShoppingBag size={24} />
                      </div>
                      <p className="font-bold text-sm text-slate-600">
                        {searchTerm || statusFilter !== 'ALL' || paymentFilter !== 'ALL' 
                          ? (isRtl ? 'لا توجد طلبيات تطابق الفلتر' : 'Aucune commande ne correspond aux filtres')
                          : (isRtl ? 'لا توجد طلبيات مسجلة من YouCan حتى الآن' : 'Aucune commande YouCan synchronisée pour le moment')}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const ref = formatOrderRef(order, idx);
                  const customerName = getCustomerName(order);
                  const phone = getCustomerPhone(order);
                  const total = getTotalAmount(order);
                  const dateFormatted = formatDate(order.created_at);

                  const confStatus = order.status || 'Open';
                  const payStatus = order.payment_status || 'Unpaid';
                  const shipStatus = order.fulfillment_status || 'Unfulfilled';

                  return (
                    <tr key={order.id || idx} className="hover:bg-amber-50/20 transition-colors group">
                      {/* Ref */}
                      <td className="py-4 px-6">
                        <span className="font-mono font-black text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg">
                          {ref}
                        </span>
                      </td>

                      {/* Creation date */}
                      <td className="py-4 px-6 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {dateFormatted}
                      </td>

                      {/* Client name */}
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {customerName}
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {phone ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800">{phone}</span>
                            <button
                              onClick={() => copyPhone(phone, order.id || idx)}
                              className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 transition-all"
                              title="Copier"
                            >
                              {copiedPhoneId === (order.id || idx) ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-normal">-</span>
                        )}
                      </td>

                      {/* Confirmation Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          confStatus.toLowerCase().includes('confirm') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          confStatus.toLowerCase().includes('cancel') ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                          'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {confStatus}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          payStatus.toLowerCase().includes('paid') && !payStatus.toLowerCase().includes('unpaid') 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : 'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {payStatus}
                        </span>
                      </td>

                      {/* Shipping Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          shipStatus.toLowerCase().includes('fulfilled') && !shipStatus.toLowerCase().includes('unfulfilled')
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {shipStatus}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-4 px-6 font-black text-slate-900 whitespace-nowrap">
                        {total}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          <Eye size={14} />
                          <span>Détails</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
            onClick={() => setSelectedOrder(null)}
          />
          <div 
            className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 cursor-default flex flex-col max-h-[90vh]"
            style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {isRtl ? 'تفاصيل الطلب' : 'Détails de la commande'} {formatOrderRef(selectedOrder, 0)}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {formatDate(selectedOrder.created_at)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Customer Info Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    {isRtl ? 'العميل' : 'Client'}
                  </span>
                  <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <User size={14} className="text-slate-400" /> {getCustomerName(selectedOrder)}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    {isRtl ? 'رقم الهاتف' : 'Téléphone'}
                  </span>
                  <p className="font-mono font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-400" /> {getCustomerPhone(selectedOrder) || '-'}
                  </p>
                </div>

                {selectedOrder.address?.address1 && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      {isRtl ? 'العنوان والمدينة' : 'Adresse & Ville'}
                    </span>
                    <p className="font-medium text-slate-800 flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400" /> 
                      {selectedOrder.address.address1}, {selectedOrder.address.city || ''} {selectedOrder.address.country_name || ''}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Summary */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Confirmation</span>
                  <span className="text-xs font-black text-amber-600">{selectedOrder.status || 'Open'}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Paiement</span>
                  <span className="text-xs font-black text-emerald-600">{selectedOrder.payment_status || 'Unpaid'}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Livraison</span>
                  <span className="text-xs font-black text-slate-700">{selectedOrder.fulfillment_status || 'Unfulfilled'}</span>
                </div>
              </div>

              {/* Line Items */}
              {selectedOrder.line_items && selectedOrder.line_items.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Package size={14} />
                    {isRtl ? 'المنتجات المطلوبة' : 'Articles commandés'}
                  </h4>

                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                    {selectedOrder.line_items.map((item, i) => (
                      <div key={item.id || i} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{item.name || item.title || 'Produit'}</p>
                          {item.variant_title && (
                            <p className="text-[10px] text-slate-400 font-medium">{item.variant_title}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900">x{item.quantity || 1}</p>
                          <p className="text-[10px] font-mono text-slate-500">{item.price ? `${item.price} ${selectedOrder.currency || 'MAD'}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Commande</span>
                <span className="text-lg font-black text-slate-900">{getTotalAmount(selectedOrder)}</span>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all"
              >
                {isRtl ? 'إغلاق' : 'Fermer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
