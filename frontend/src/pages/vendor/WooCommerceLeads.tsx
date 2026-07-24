import { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  RefreshCw, 
  Copy, 
  Check, 
  Eye, 
  DollarSign, 
  Truck, 
  Clock, 
  X,
  Phone,
  User,
  MapPin,
  Package,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { wooCommerceApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr, ar } from 'date-fns/locale';

interface WooCommerceOrder {
  id: string | number;
  number?: string | number;
  date_created: string;
  status?: string;
  currency?: string;
  total?: string | number;
  billing?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    address_1?: string;
    city?: string;
    country?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address_1?: string;
    city?: string;
    country?: string;
  };
  line_items?: Array<{
    id?: string | number;
    name?: string;
    quantity?: number;
    price?: number | string;
    total?: number | string;
  }>;
}

export default function WooCommerceLeads() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const [orders, setOrders] = useState<WooCommerceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<WooCommerceOrder | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await wooCommerceApi.getOrders();
      const rawData = res.data?.data || res.data || [];
      setOrders(Array.isArray(rawData) ? rawData : []);
    } catch (err: any) {
      console.error('Error loading WooCommerce orders:', err);
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
      const res = await wooCommerceApi.syncNow();
      toast.success(res.data?.message || (isRtl ? 'تمت مزامنة الطلبيات والعملاء من WooCommerce بنجاح !' : 'Mise à jour WooCommerce effectuée avec succès !'));
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (isRtl ? 'فشلت المزامنة المباشرة مع WooCommerce' : 'Erreur lors de la synchronisation WooCommerce'));
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
  const formatOrderRef = (order: WooCommerceOrder, index: number) => {
    if (order.number) return `#${order.number}`;
    if (order.id) return `#${order.id}`;
    return `#${String(orders.length - index).padStart(3, '0')}`;
  };

  const getCustomerName = (order: WooCommerceOrder) => {
    if (order.billing?.first_name || order.billing?.last_name) {
      return `${order.billing.first_name || ''} ${order.billing.last_name || ''}`.trim();
    }
    if (order.shipping?.first_name || order.shipping?.last_name) {
      return `${order.shipping.first_name || ''} ${order.shipping.last_name || ''}`.trim();
    }
    return isRtl ? 'عميل غير مسمى' : 'Client Inconnu';
  };

  const getCustomerPhone = (order: WooCommerceOrder) => {
    return order.billing?.phone || order.shipping?.phone || '';
  };

  const getOrderTotalVal = (order: WooCommerceOrder) => {
    if (order.line_items && order.line_items.length > 0) {
      const lineSum = order.line_items.reduce((acc, item) => {
        const itemVal = Number(item.total ?? item.subtotal ?? (Number(item.price || 0) * (item.quantity || 1)));
        return acc + (isNaN(itemVal) ? 0 : itemVal);
      }, 0);
      const shippingVal = Number((order as any).shipping_total || 0);
      const totalCalc = lineSum + (isNaN(shippingVal) ? 0 : shippingVal);
      if (totalCalc > 0) return totalCalc;
    }

    const val = Number(order.total);
    return isNaN(val) ? 0 : val;
  };

  const getTotalAmount = (order: WooCommerceOrder) => {
    const val = getOrderTotalVal(order);
    const currency = order.currency || 'MAD';
    return `${val.toLocaleString()} ${currency}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss', { locale: isRtl ? ar : fr });
    } catch (e) {
      return dateStr || '-';
    }
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Filtering
  const filteredOrders = orders.filter((order, idx) => {
    const ref = formatOrderRef(order, idx).toLowerCase();
    const name = getCustomerName(order).toLowerCase();
    const phone = getCustomerPhone(order).toLowerCase();
    const query = searchTerm.toLowerCase();

    const matchesSearch = ref.includes(query) || name.includes(query) || phone.includes(query);
    const matchesStatus = statusFilter === 'ALL' || (order.status || 'pending').toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Calculate Statistics
  const totalOrdersCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + getOrderTotalVal(o), 0);
  const processingCount = orders.filter(o => o.status === 'processing' || o.status === 'pending').length;
  const completedCount = orders.filter(o => o.status === 'completed').length;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6 pt-4 pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-purple-500/20 ring-4 ring-white">
            WOO
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">
              {isRtl ? 'مجرى الطلبيات WooCommerce' : 'Flux WooCommerce Orders & Leads'}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium">
              {isRtl 
                ? 'الطلبات والعملاء المتزامنون تلقائيًا من متجر WooCommerce الخاص بك في الوقت الفعلي.' 
                : 'Commandes et prospects synchronisés automatiquement depuis votre boutique WooCommerce.'}
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
            {isRtl ? 'مزامنة الآن' : 'Mise à jour WooCommerce'}
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
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <ShoppingBag size={22} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'إجمالي المبيعات' : 'Chiffre d\'affaires'}</p>
              <p className="text-2xl font-black text-purple-600 mt-1">{totalRevenue.toLocaleString()} <span className="text-xs">MAD</span></p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <DollarSign size={22} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'قيد المعالجة' : 'En traitement'}</p>
              <p className="text-2xl font-black text-amber-600 mt-1">{processingCount}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Truck size={22} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الطلبيات المكتملة' : 'Commandes complétées'}</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
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
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 focus:border-purple-500 rounded-2xl text-xs font-semibold transition-all outline-none rtl:pr-11 rtl:pl-4"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-700 outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">{isRtl ? 'جميع الحالات' : 'Statut (Tous)'}</option>
              <option value="PROCESSING">Processing / قيد المعالجة</option>
              <option value="COMPLETED">Completed / مكتمل</option>
              <option value="PENDING">Pending / في الانتظار</option>
              <option value="CANCELLED">Cancelled / ملغى</option>
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
                <th className="py-4 px-6">{isRtl ? 'الحالة' : 'Statut'}</th>
                <th className="py-4 px-6">{isRtl ? 'المجموع' : 'Total'}</th>
                <th className="py-4 px-6 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                      <p className="font-bold">{isRtl ? 'جاري تحميل طلبيات WooCommerce...' : 'Chargement des commandes WooCommerce...'}</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <ShoppingBag size={24} />
                      </div>
                      <p className="font-bold text-sm text-slate-600">
                        {searchTerm || statusFilter !== 'ALL' 
                          ? (isRtl ? 'لا توجد طلبيات تطابق الفلتر' : 'Aucune commande ne correspond aux filtres')
                          : (isRtl ? 'لا توجد طلبيات مسجلة من WooCommerce حتى الآن' : 'Aucune commande WooCommerce synchronisée pour le moment')}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, idx) => {
                  const ref = formatOrderRef(order, (currentPage - 1) * itemsPerPage + idx);
                  const customerName = getCustomerName(order);
                  const phone = getCustomerPhone(order);
                  const total = getTotalAmount(order);
                  const dateFormatted = formatDate(order.date_created);

                  const status = (order.status || 'pending').toLowerCase();

                  return (
                    <tr key={order.id || idx} className="hover:bg-purple-50/20 transition-colors group">
                      {/* Ref */}
                      <td className="py-4 px-6">
                        <span className="font-mono font-black text-purple-600 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg">
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

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : status === 'processing'
                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {status}
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-purple-600 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
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

        {/* Pagination Footer */}
        {filteredOrders.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-2">
              <span>{isRtl ? 'عرض' : 'Afficher'}</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-purple-600"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>{isRtl ? `من أصل ${filteredOrders.length} طلبية` : `sur ${filteredOrders.length} commandes`}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>

              <span className="px-3.5 py-1.5 font-mono bg-white border border-slate-200 rounded-xl text-slate-800">
                {isRtl ? `الصفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} sur ${totalPages}`}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        )}
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
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black">
                  WOO
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {isRtl ? 'تفاصيل طلبية WooCommerce' : 'Détails de la commande WooCommerce'} {formatOrderRef(selectedOrder, 0)}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {formatDate(selectedOrder.date_created)}
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

                {(selectedOrder.billing?.address_1 || selectedOrder.shipping?.address_1) && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      {isRtl ? 'العنوان والمدينة' : 'Adresse & Ville'}
                    </span>
                    <p className="font-medium text-slate-800 flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400" /> 
                      {selectedOrder.billing?.address_1 || selectedOrder.shipping?.address_1}, {selectedOrder.billing?.city || selectedOrder.shipping?.city || ''} {selectedOrder.billing?.country || ''}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Summary */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Statut Commande</span>
                <span className="text-xs font-black text-purple-600 uppercase">{selectedOrder.status || 'pending'}</span>
              </div>

              {/* Line Items */}
              {selectedOrder.line_items && selectedOrder.line_items.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Package size={14} />
                    {isRtl ? 'المنتجات المطلوبة' : 'Articles commandés'}
                  </h4>

                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                    {selectedOrder.line_items.map((item, i) => {
                      const itemVal = Number(item.total ?? item.subtotal ?? (Number(item.price || 0) * (item.quantity || 1)));
                      return (
                        <div key={item.id || i} className="p-3 bg-white flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-slate-900">{item.name || 'Produit'}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-slate-900">x{item.quantity || 1}</p>
                            <p className="text-xs font-mono font-bold text-purple-600">
                              {isNaN(itemVal) ? '' : `${itemVal.toLocaleString()} ${selectedOrder.currency || 'MAD'}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
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
