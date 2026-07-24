import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  ChevronRight,
  Send,
  Loader2,
  CheckSquare,
  Square,
  Headphones
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { shopifyApi, leadsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr, ar } from 'date-fns/locale';

interface ShopifyOrder {
  id: string | number;
  name?: string;
  order_number?: string | number;
  created_at: string;
  customer?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
  phone?: string;
  shipping_address?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address1?: string;
    city?: string;
    country?: string;
  };
  billing_address?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address1?: string;
    city?: string;
  };
  fulfillment_status?: string | null;
  financial_status?: string;
  total_price?: number | string;
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

// Utility functions to prevent runtime exceptions and accurately parse order totals
export const toStatusString = (val: any, fallback = ''): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.name || val.title || val.label || val.status || JSON.stringify(val);
  }
  return String(val);
};

export const extractOrderTotal = (order: any): number => {
  if (!order) return 0;
  
  const possibleFields = [
    order.total,
    order.total_price,
    order.price,
    order.grand_total,
    order.total_amount,
    order.sub_total,
    order.pricing?.total,
    order.pricing?.total_price,
    order.total_price_set?.shop_money?.amount,
    order.current_total_price,
  ];

  for (const field of possibleFields) {
    const num = Number(field);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }

  if (Array.isArray(order.line_items) && order.line_items.length > 0) {
    const itemsSum = order.line_items.reduce((sum: number, item: any) => {
      const price = Number(item.price || item.unit_price || 0);
      const qty = Number(item.quantity || 1);
      return sum + (price * qty);
    }, 0);
    if (itemsSum > 0) return itemsSum;
  }

  return 0;
};

export default function ShopifyLeads() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentMode = searchParams.get('mode')?.toUpperCase() === 'AFFILIATE' ? 'AFFILIATE' : 'SELLER';

  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ShopifyOrder | null>(null);

  // Checkbox multi-select state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string | number>>(new Set());

  // Push to Call Center Modal state
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [isPushing, setIsPushing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [shippingFilter, setShippingFilter] = useState('ALL');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await shopifyApi.getOrders();
      const rawData = res.data?.data || res.data || [];
      setOrders(Array.isArray(rawData) ? rawData : []);
    } catch (err: any) {
      console.error('Error loading Shopify orders:', err);
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
      const res = await shopifyApi.syncNow();
      toast.success(res.data?.message || (isRtl ? 'تمت مزامنة الطلبيات والعملاء من Shopify بنجاح !' : 'Mise à jour Shopify effectuée avec succès !'));
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (isRtl ? 'فشلت المزامنة المباشرة مع Shopify' : 'Erreur lors de la synchronisation Shopify'));
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

  const handleOpenPushModal = async () => {
    if (selectedOrderIds.size === 0) {
      toast.error(isRtl ? 'الرجاء تحديد طلبية واحدة على الأقل' : 'Veuillez sélectionner au moins une commande');
      return;
    }
    setIsPushModalOpen(true);
    setLoadingProducts(true);
    try {
      const res = await leadsApi.getMyProducts({ mode: currentMode });
      const rawProds = res.data?.data?.products || res.data?.products || res.data?.data || res.data || [];
      const prodsList = Array.isArray(rawProds) ? rawProds : [];
      setProducts(prodsList);
      if (prodsList.length > 0) {
        setSelectedProductId(prodsList[0].id);
      }
    } catch (err) {
      console.error('Error fetching inventory products:', err);
      toast.error(isRtl ? 'فشل تحميل قائمة المنتجات من المخزون' : 'Erreur lors du chargement des produits');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleConfirmPushLeads = async () => {
    if (!selectedProductId) {
      toast.error(isRtl ? 'اختر منتجاً من القائمة' : 'Veuillez sélectionner un produit');
      return;
    }
    const selectedOrdersList = orders.filter(o => selectedOrderIds.has(o.id));
    if (selectedOrdersList.length === 0) return;

    setIsPushing(true);
    try {
      const payloadOrders = selectedOrdersList.map(o => ({
        id: o.id,
        number: o.order_number || o.name || o.id,
        customerName: getCustomerName(o),
        phone: getCustomerPhone(o),
        city: o.shipping_address?.city || o.billing_address?.city || '',
        address: o.shipping_address?.address1 || o.billing_address?.address1 || '',
        total: extractOrderTotal(o),
        currency: o.currency || 'MAD',
      }));

      const res = await leadsApi.pushIntegrationLeads({
        source: 'SHOPIFY',
        mode: currentMode,
        productId: selectedProductId,
        orders: payloadOrders,
      });

      toast.success(res.data?.message || (isRtl ? 'تم إرسال الطلبيات بنجاح إلى مركز الاتصال!' : 'Prospects envoyés au Call Center avec succès !'));
      setIsPushModalOpen(false);
      setSelectedOrderIds(new Set());
      
      navigate(`/dashboard/leads?mode=${currentMode}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || (isRtl ? 'فشل إرسال الطلبيات إلى مركز الاتصال' : 'Erreur lors de l\'envoi au Call Center'));
    } finally {
      setIsPushing(false);
    }
  };

  // Helper formatting
  const formatOrderRef = (order: ShopifyOrder, index: number) => {
    if (order.name) return order.name.startsWith('#') ? order.name : `#${order.name}`;
    if (order.order_number) return `#${order.order_number}`;
    if (order.id) return `#${String(order.id).slice(-4)}`;
    return `#${String(orders.length - index).padStart(3, '0')}`;
  };

  const getCustomerName = (order: ShopifyOrder) => {
    if (order.customer?.first_name || order.customer?.last_name) {
      return `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim();
    }
    if (order.shipping_address?.first_name || order.shipping_address?.last_name) {
      return `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim();
    }
    if (order.billing_address?.first_name || order.billing_address?.last_name) {
      return `${order.billing_address.first_name || ''} ${order.billing_address.last_name || ''}`.trim();
    }
    return isRtl ? 'عميل غير مسمى' : 'Client Inconnu';
  };

  const getCustomerPhone = (order: ShopifyOrder) => {
    return order.customer?.phone || order.shipping_address?.phone || order.billing_address?.phone || order.phone || '';
  };

  const getTotalAmount = (order: ShopifyOrder) => {
    const val = extractOrderTotal(order);
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

  // Filtering
  const filteredOrders = orders.filter((order, idx) => {
    const ref = formatOrderRef(order, idx).toLowerCase();
    const name = getCustomerName(order).toLowerCase();
    const phone = getCustomerPhone(order).toLowerCase();
    const query = searchTerm.toLowerCase();

    const matchesSearch = ref.includes(query) || name.includes(query) || phone.includes(query);
    const matchesPayment = paymentFilter === 'ALL' || toStatusString(order.financial_status, 'pending').toUpperCase() === paymentFilter.toUpperCase();
    const matchesShipping = shippingFilter === 'ALL' || toStatusString(order.fulfillment_status, 'unfulfilled').toUpperCase() === shippingFilter.toUpperCase();

    return matchesSearch && matchesPayment && matchesShipping;
  });

  // Calculate Statistics
  const totalOrdersCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + extractOrderTotal(o), 0);
  const unfulfilledCount = orders.filter(o => !o.fulfillment_status || toStatusString(o.fulfillment_status).toLowerCase() === 'unfulfilled').length;
  const pendingPaymentCount = orders.filter(o => toStatusString(o.financial_status, 'pending').toLowerCase() !== 'paid').length;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6 pt-4 pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-emerald-500/20 ring-4 ring-white">
            SF
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">
              {isRtl ? 'مجرى الطلبيات Shopify' : 'Flux Shopify Orders & Leads'}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium">
              {isRtl 
                ? 'الطلبات والعملاء المتزامنون تلقائيًا من متجر Shopify الخاص بك في الوقت الفعلي.' 
                : 'Commandes et prospects synchronisés automatiquement depuis votre boutique Shopify.'}
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
            {isRtl ? 'مزامنة الآن' : 'Mise à jour Shopify'}
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
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
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
              <p className="text-2xl font-black text-rose-600 mt-1">{pendingPaymentCount}</p>
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
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs font-semibold transition-all outline-none rtl:pr-11 rtl:pl-4"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">{isRtl ? 'جميع حالات الأداء' : 'Paiements (Tous)'}</option>
              <option value="PAID">Paid / مدفوع</option>
              <option value="PENDING">Pending / غير مدفوع</option>
            </select>

            <select
              value={shippingFilter}
              onChange={(e) => setShippingFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">{isRtl ? 'جميع حالات الشحن' : 'Expédition (Tous)'}</option>
              <option value="UNFULFILLED">Unfulfilled / غير مشحون</option>
              <option value="FULFILLED">Fulfilled / تم الشحن</option>
            </select>

            <button
              onClick={handleOpenPushModal}
              disabled={selectedOrderIds.size === 0}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md ${
                selectedOrderIds.size > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 scale-105'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
            >
              <Send size={15} />
              <span>
                {isRtl 
                  ? `إرسال إلى مركز الاتصال (${selectedOrderIds.size})` 
                  : `Envoyer au Call Center (${selectedOrderIds.size})`}
              </span>
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-4 text-center w-12">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    checked={filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.has(o.id))}
                    onChange={(e) => {
                      const next = new Set(selectedOrderIds);
                      if (e.target.checked) {
                        filteredOrders.forEach(o => next.add(o.id));
                      } else {
                        filteredOrders.forEach(o => next.delete(o.id));
                      }
                      setSelectedOrderIds(next);
                    }}
                  />
                </th>
                <th className="py-4 px-6">Ref</th>
                <th className="py-4 px-6">{isRtl ? 'تاريخ الإنشاء' : 'Date de Création'}</th>
                <th className="py-4 px-6">{isRtl ? 'اسم العميل' : 'Nom du Client'}</th>
                <th className="py-4 px-6">{isRtl ? 'الهاتف' : 'Téléphone'}</th>
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
                      <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                      <p className="font-bold">{isRtl ? 'جاري تحميل طلبيات Shopify...' : 'Chargement des commandes Shopify...'}</p>
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
                        {searchTerm || paymentFilter !== 'ALL' || shippingFilter !== 'ALL' 
                          ? (isRtl ? 'لا توجد طلبيات تطابق الفلتر' : 'Aucune commande ne correspond aux filtres')
                          : (isRtl ? 'لا توجد طلبيات مسجلة من Shopify حتى الآن' : 'Aucune commande Shopify synchronisée pour le moment')}
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

                  const payStatus = order.financial_status || 'pending';
                  const shipStatus = order.fulfillment_status || 'unfulfilled';
                  const isSelected = selectedOrderIds.has(order.id);

                  return (
                    <tr key={order.id || idx} className={`transition-colors group ${isSelected ? 'bg-emerald-50/40' : 'hover:bg-emerald-50/20'}`}>
                      {/* Checkbox */}
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          checked={isSelected}
                          onChange={() => {
                            const next = new Set(selectedOrderIds);
                            if (next.has(order.id)) next.delete(order.id);
                            else next.add(order.id);
                            setSelectedOrderIds(next);
                          }}
                        />
                      </td>

                      {/* Ref */}
                      <td className="py-4 px-6">
                        <span className="font-mono font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
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

                      {/* Payment Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          payStatus.toLowerCase() === 'paid' 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : 'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {payStatus}
                        </span>
                      </td>

                      {/* Shipping Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          shipStatus.toLowerCase() === 'fulfilled'
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
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
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                  SF
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {isRtl ? 'تفاصيل طلبية Shopify' : 'Détails de la commande Shopify'} {formatOrderRef(selectedOrder, 0)}
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

                {(selectedOrder.shipping_address?.address1 || selectedOrder.billing_address?.address1) && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      {isRtl ? 'العنوان والمدينة' : 'Adresse & Ville'}
                    </span>
                    <p className="font-medium text-slate-800 flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400" /> 
                      {selectedOrder.shipping_address?.address1 || selectedOrder.billing_address?.address1}, {selectedOrder.shipping_address?.city || selectedOrder.billing_address?.city || ''} {selectedOrder.shipping_address?.country || ''}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Summary */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Paiement</span>
                  <span className="text-xs font-black text-emerald-600">{selectedOrder.financial_status || 'pending'}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Livraison</span>
                  <span className="text-xs font-black text-slate-700">{selectedOrder.fulfillment_status || 'unfulfilled'}</span>
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

      {/* Push to Call Center Product Selection Modal */}
      {isPushModalOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
            onClick={() => !isPushing && setIsPushModalOpen(false)}
          />
          <div 
            className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-200">
                  <Headphones size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {isRtl ? `إرسال ${selectedOrderIds.size} طلبية إلى مركز الاتصال` : `Envoyer ${selectedOrderIds.size} commande(s) au Call Center`}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">
                      {currentMode === 'AFFILIATE' ? (isRtl ? 'وضع المسوق (Affilié)' : 'Mode Affilié') : (isRtl ? 'وضع البائع (Vendeur)' : 'Mode Vendeur')}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => !isPushing && setIsPushModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="text-xs font-black text-slate-700 block mb-1.5">
                  {isRtl ? 'اختر المنتج من المخزون المتاح:' : 'Sélectionnez le produit de votre inventaire :'}
                </label>

                {/* Search Bar */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto" size={16} />
                  <input
                    type="text"
                    placeholder={isRtl ? 'بحث في المنتجات...' : 'Rechercher un produit...'}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-600 rtl:pr-9 rtl:pl-3"
                  />
                </div>
              </div>

              {loadingProducts ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
                  <p className="text-xs font-bold">{isRtl ? 'جاري تحميل منتجات المخزون...' : 'Chargement de votre inventaire...'}</p>
                </div>
              ) : products.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <Package className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">
                    {isRtl ? 'لم يتم العثور على أي منتج في المخزون المتاح لهذا الوضع.' : 'Aucun produit disponible dans votre inventaire pour ce mode.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {products
                    .filter(p => (p.name || p.nameFr || p.nameAr || '').toLowerCase().includes(productSearch.toLowerCase()))
                    .map((prod) => {
                      const isSelected = selectedProductId === prod.id;
                      const prodName = prod.nameFr || prod.nameAr || prod.name || `Produit #${prod.id}`;
                      const prodImage = prod.image || prod.images?.[0]?.imageUrl;

                      return (
                        <div
                          key={prod.id}
                          onClick={() => setSelectedProductId(prod.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                              : 'border-slate-100 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {prodImage ? (
                              <img src={prodImage} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-100 flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">
                                <Package size={18} />
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-black text-slate-900 line-clamp-1">{prodName}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                SKU: {prod.sku || prod.id} {prod.retailPrice ? `| ${prod.retailPrice} MAD` : ''}
                              </p>
                            </div>
                          </div>

                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
              <button
                onClick={() => setIsPushModalOpen(false)}
                disabled={isPushing}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-200 transition-all"
              >
                {isRtl ? 'إلغاء' : 'Annuler'}
              </button>

              <button
                onClick={handleConfirmPushLeads}
                disabled={isPushing || !selectedProductId || products.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPushing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{isRtl ? 'جاري الإرسال...' : 'Envoi en cours...'}</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>{isRtl ? `تأكيد وإرسال (${selectedOrderIds.size} طلبية)` : `Confirmer et Envoyer (${selectedOrderIds.size})`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
