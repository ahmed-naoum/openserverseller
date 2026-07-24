import { 
  Users, 
  Search, 
  Power, 
  Trash2, 
  Download, 
  Phone, 
  Mail, 
  Calendar, 
  HelpCircle, 
  CheckCircle2, 
  XCircle,
  Eye,
  MessageSquare,
  RefreshCw,
  BellRing
} from 'lucide-react';
import { eventApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EventRegistrationItem {
  id: number;
  fullName: string;
  phone: string;
  whatsapp: string;
  email: string;
  experience: string;
  stock: string;
  ordersVolume: string;
  biggestChallenge?: string;
  createdAt: string;
}

export default function AdminEventRegistrations() {
  const [registrations, setRegistrations] = useState<EventRegistrationItem[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EventRegistrationItem | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [volumeFilter, setVolumeFilter] = useState('ALL');

  const fetchRegistrations = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await eventApi.getAdminRegistrations();
      const data = res.data?.data || res.data;
      const newItems: EventRegistrationItem[] = data?.registrations || [];

      // Check if new registrations arrived
      setRegistrations(prev => {
        if (prev.length > 0 && newItems.length > prev.length) {
          const diff = newItems.length - prev.length;
          toast.success(`🎉 ${diff} تسجيل(ات) جديد(ة) فـ الميتينغ !`, {
            duration: 5000,
            icon: '🔔',
          });
        }
        return newItems;
      });

      setEnabled(data?.enabled ?? true);
    } catch (err: any) {
      console.error('Error fetching admin event registrations:', err);
    } finally {
      if (showLoading) setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRegistrations(true);
    // Poll every 10 seconds for real-time new registration notifications
    const interval = setInterval(() => {
      fetchRegistrations(false);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleStatus = async () => {
    setIsToggling(true);
    try {
      const nextState = !enabled;
      await eventApi.toggleAdminStatus(nextState);
      setEnabled(nextState);
      toast.success(nextState ? 'تم تفعيل صفحة التسجيل بنجاح !' : 'تم إيقاف صفحة التسجيل مؤقتاً');
    } catch (err) {
      toast.error('تعذر تغيير حالة صفحة التسجيل');
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('هل أنت تأكد من رغبتك في حذف هذا التسجيل؟')) return;
    try {
      await eventApi.deleteAdminRegistration(id);
      setRegistrations(prev => prev.filter(r => r.id !== id));
      toast.success('تم حذف التسجيل بنجاح');
      if (selectedItem?.id === id) setSelectedItem(null);
    } catch (err) {
      toast.error('فشل حذف التسجيل');
    }
  };

  const exportToCSV = () => {
    if (registrations.length === 0) return;
    const headers = ['ID', 'Nom Complet', 'Téléphone', 'WhatsApp', 'Email', 'Expérience', 'Stock', 'Volume Ventes', 'Obstacle', 'Date'];
    const rows = registrations.map(r => [
      r.id,
      `"${r.fullName.replace(/"/g, '""')}"`,
      `"${r.phone}"`,
      `"${r.whatsapp}"`,
      `"${r.email}"`,
      r.experience === 'yes' ? 'Oui' : 'Non',
      r.stock === 'yes' ? 'Oui' : 'Non',
      r.ordersVolume,
      `"${(r.biggestChallenge || '').replace(/"/g, '""')}"`,
      format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm')
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `silacod_event_registrations_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Volume text formatting
  const formatVolume = (vol: string) => {
    switch (vol) {
      case 'beginner': return '0 (مبتدئ)';
      case '1_to_50': return '< 50 طلبية / شهر';
      case '50_to_300': return '50 - 300 طلبية / شهر';
      case '300_plus': return '+300 طلبية (Scale)';
      default: return vol;
    }
  };

  // Filtering
  const filteredRegistrations = registrations.filter(item => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = 
      item.fullName.toLowerCase().includes(query) ||
      item.phone.toLowerCase().includes(query) ||
      item.whatsapp.toLowerCase().includes(query) ||
      item.email.toLowerCase().includes(query) ||
      (item.biggestChallenge || '').toLowerCase().includes(query);

    const matchesVolume = volumeFilter === 'ALL' || item.ordersVolume === volumeFilter;

    return matchesSearch && matchesVolume;
  });

  const totalCount = registrations.length;
  const experiencedCount = registrations.filter(r => r.experience === 'yes').length;
  const stockCount = registrations.filter(r => r.stock === 'yes').length;

  return (
    <div dir="rtl" className="space-y-6 pt-4 pb-12 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-[#F05023] to-orange-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-orange-500/20 ring-4 ring-white">
            <Users size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
              تسجيلات الميتينغ (Masterclass Invitations)
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-semibold">
              إدارة قائمة الحاضرين والتحكم في إتاحة صفحة التسجيل للميتينغ
            </p>
          </div>
        </div>

        {/* Top Actions: Toggle Enable & CSV Export */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchRegistrations(true);
            }}
            disabled={isRefreshing || loading}
            className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-extrabold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="تحديث التسجيلات الفوري"
          >
            <RefreshCw size={16} className={isRefreshing || loading ? 'animate-spin text-[#F05023]' : ''} />
            <span>تحديث</span>
          </button>

          <button
            onClick={handleToggleStatus}
            disabled={isToggling}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50 ${
              enabled 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            <Power size={16} />
            <span>{enabled ? 'الصفحة مفعلة (مفتوحة)' : 'الصفحة معطلة (مغلقة)'}</span>
          </button>

          <button
            onClick={exportToCSV}
            disabled={registrations.length === 0}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Download size={16} />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي المباشرين المسجلين</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{totalCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F05023] flex items-center justify-center font-bold">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">لديهم تجربة سابقة</p>
            <p className="text-3xl font-black text-emerald-600 mt-1">
              {totalCount > 0 ? Math.round((experiencedCount / totalCount) * 100) : 0}% <span className="text-xs text-slate-400 font-bold">({experiencedCount})</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">يمتلكون سلع (Stock)</p>
            <p className="text-3xl font-black text-indigo-600 mt-1">
              {totalCount > 0 ? Math.round((stockCount / totalCount) * 100) : 0}% <span className="text-xs text-slate-400 font-bold">({stockCount})</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="بحث بالحجم، الاسم، رقم الهاتف، الواتساب أو الإيميل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-11 pl-4 py-2.5 bg-white border border-slate-200 focus:border-[#F05023] rounded-2xl text-xs font-semibold transition-all outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={volumeFilter}
              onChange={(e) => setVolumeFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-700 outline-none focus:border-[#F05023] cursor-pointer"
            >
              <option value="ALL">حجم المبيعات (الكل)</option>
              <option value="beginner">مبتدئ (0 مبيعة)</option>
              <option value="1_to_50">أقل من 50</option>
              <option value="50_to_300">من 50 إلى 300</option>
              <option value="300_plus">+300 طلبية (Scale)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">الاسم الكامل</th>
                <th className="py-4 px-6">رقم الهاتف / الواتساب</th>
                <th className="py-4 px-6">Gmail</th>
                <th className="py-4 px-6 text-center">التجربة</th>
                <th className="py-4 px-6 text-center">السلعة</th>
                <th className="py-4 px-6">المبيعات الشهرية</th>
                <th className="py-4 px-6">التاريخ</th>
                <th className="py-4 px-6 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-10 h-10 border-4 border-[#F05023] border-t-transparent rounded-full animate-spin" />
                      <p className="font-bold">جاري تحميل التسجيلات...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Users size={32} className="text-slate-300" />
                      <p className="font-bold text-sm text-slate-600">لا توجد تسجيلات مطابقة حتى الآن</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((item) => (
                  <tr key={item.id} className="hover:bg-orange-50/20 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900">
                      {item.fullName}
                    </td>

                    <td className="py-4 px-6 font-mono font-bold text-slate-800 dir-ltr text-right">
                      <div>📞 {item.phone}</div>
                      <div className="text-emerald-600 text-[11px]">💬 {item.whatsapp}</div>
                    </td>

                    <td className="py-4 px-6 font-mono text-slate-600 text-[11px]">
                      {item.email}
                    </td>

                    <td className="py-4 px-6 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        item.experience === 'yes' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.experience === 'yes' ? 'نعم' : 'لا'}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        item.stock === 'yes' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.stock === 'yes' ? 'نعم' : 'لا'}
                      </span>
                    </td>

                    <td className="py-4 px-6 font-bold text-slate-900">
                      {formatVolume(item.ordersVolume)}
                    </td>

                    <td className="py-4 px-6 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm')}
                    </td>

                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition-all"
                          title="عرض التفاصيل"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 hover:bg-rose-50 rounded-xl text-rose-500 transition-all"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer" onClick={() => setSelectedItem(null)} />
          <div className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900">تفاصيل تسجيل: {selectedItem.fullName}</h3>
              <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl space-y-2">
                <p><strong className="text-slate-500">الاسم الكامل:</strong> {selectedItem.fullName}</p>
                <p><strong className="text-slate-500">رقم الاتصال:</strong> <span className="font-mono">{selectedItem.phone}</span></p>
                <p><strong className="text-slate-500">رقم الواتساب:</strong> <span className="font-mono text-emerald-600 font-bold">{selectedItem.whatsapp}</span></p>
                <p><strong className="text-slate-500">البريد الإلكتروني:</strong> <span className="font-mono">{selectedItem.email}</span></p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl space-y-2">
                <p><strong className="text-slate-500">تجربة سابقة فـ E-commerce:</strong> {selectedItem.experience === 'yes' ? 'نعم، لديه تجربة' : 'لا، مبتدئ'}</p>
                <p><strong className="text-slate-500">السلعة متوفرة حالياً:</strong> {selectedItem.stock === 'yes' ? 'نعم، متوفرة' : 'لا'}</p>
                <p><strong className="text-slate-500">حجم المبيعات الشهرية:</strong> {formatVolume(selectedItem.ordersVolume)}</p>
              </div>

              {selectedItem.biggestChallenge && (
                <div className="p-3 bg-orange-50 border border-orange-100 rounded-2xl space-y-1">
                  <span className="font-black text-[#F05023]">أكبر عائق / التحدي الحالي:</span>
                  <p className="text-slate-800 font-medium leading-relaxed">{selectedItem.biggestChallenge}</p>
                </div>
              )}
            </div>

            <div className="pt-2 text-left">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
