import React, { useState, useEffect } from 'react';
import { eventApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { CheckCircle2, Lock, Sparkles, Calendar, Clock, Video, AlertTriangle } from 'lucide-react';

export default function EventMasterclass() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    whatsapp: '',
    email: '',
    experience: '',
    stock: '',
    ordersVolume: '',
    biggestChallenge: '',
  });

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await eventApi.getStatus();
      setEnabled(res.data?.data?.enabled ?? true);
    } catch (err) {
      console.error('Error fetching event status:', err);
      setEnabled(true);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.experience || !formData.stock || !formData.ordersVolume) {
      toast.error('يرجى ملء جميع الخيارات المطلوبة');
      return;
    }

    setSubmitting(true);
    try {
      await eventApi.register(formData);
      setSubmitted(true);
      toast.success('تم حجز مقعدك بنجاح! 🎉');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء إرسال البيانات');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#F05023] border-t-transparent rounded-full animate-spin" />
          <p className="font-bold text-slate-600 text-sm">جاري تحميل الصفحة...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-['Cairo',sans-serif] py-8 px-4 relative overflow-hidden selection:bg-[#F05023]/20">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#F05023]/10 via-[#1D1D5B]/5 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="max-w-3xl mx-auto space-y-8">
        {/* Brand Header */}
        <div className="flex justify-center items-center">
          <img 
            src="/new logo/logo filess-25.svg" 
            alt="SILACOD" 
            className="h-12 sm:h-14 w-auto object-contain transition-all hover:scale-105" 
          />
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#fff5f2] border border-[#F05023]/30 text-[#F05023] px-4.5 py-1.5 rounded-full text-xs sm:text-sm font-extrabold uppercase tracking-wide">
            <Sparkles size={16} />
            <span>🔥 لقاء حصري خاص بالمهتمين بالتجارة الإلكترونية</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-[#0f172a] leading-tight tracking-tight">
            كيفاش تسلم اللوجيستيك وتسيير الطلبيات لـ{' '}
            <img 
              src="/new logo/logo filess-25.svg" 
              alt="SILACOD" 
              className="h-8 sm:h-9 inline-block object-contain align-middle mx-1.5" 
            />{' '}
            وتكبّر تجارتك الإلكترونية
          </h1>

          <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto font-medium leading-relaxed">
            جلسة عمل استراتيجية ومباشرة كنشرحوا فيها طريقة العمل بـ Dashboard، والجواب على أسئلتكم المتعلقة بالتجارة الإلكترونية والتسويق.
          </p>

          {/* Event Info Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm text-center">
            <div className="flex flex-col items-center space-y-1">
              <span className="text-xl">📅</span>
              <span className="text-xs text-slate-500 font-semibold">تاريخ الميتينغ</span>
              <strong className="text-sm text-slate-900 font-extrabold">الاثنين 27 يوليوز</strong>
            </div>
            <div className="flex flex-col items-center space-y-1 border-t sm:border-t-0 sm:border-r border-slate-100 pt-3 sm:pt-0">
              <span className="text-xl">⏰</span>
              <span className="text-xs text-slate-500 font-semibold">التوقيت بالضبط</span>
              <strong className="text-sm text-slate-900 font-extrabold">8:00 مساءً (20:00)</strong>
            </div>
            <div className="flex flex-col items-center space-y-1 border-t sm:border-t-0 sm:border-r border-slate-100 pt-3 sm:pt-0">
              <span className="text-xl">💻</span>
              <span className="text-xs text-slate-500 font-semibold">طريقة الحضور</span>
              <strong className="text-sm text-slate-900 font-extrabold">Google Meet</strong>
            </div>
          </div>
        </div>

        {/* Value Stack Grid */}
        <div className="space-y-3">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-7 h-7 bg-[#F05023] text-white rounded-full flex items-center justify-center font-black text-xs shrink-0">✓</div>
            <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
              شرح شامل لـ <span className="text-[#F05023]">Dashboard</span> وكيفاش تتبع كل طلبياتك والمبيعات لحظة بلحظة.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-7 h-7 bg-[#F05023] text-white rounded-full flex items-center justify-center font-black text-xs shrink-0">✓</div>
            <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
              طريقة الاستفادة من الـ <span className="text-[#F05023]">Warehousing والتخزين</span> وتفادي مشاكل الـ Stock.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-7 h-7 bg-[#F05023] text-white rounded-full flex items-center justify-center font-black text-xs shrink-0">✓</div>
            <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
              الجواب على أسئلتكم المتعلقة بـ <span className="text-[#F05023]">التجارة الإلكترونية والتسويق</span>.
            </p>
          </div>
        </div>

        {/* Disabled Event Notice */}
        {enabled === false ? (
          <div className="bg-white border border-amber-200 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-900">التسجيل مغلق حالياً</h2>
            <p className="text-sm text-slate-600 font-medium max-w-md mx-auto leading-relaxed">
              انتهت جميع المقاعد المتاحة لهذا الميتينغ أو تم إغلاق باب التسجيل مؤقتاً. تابعونا للحصول على مواعيد الميتينغ القادمة!
            </p>
          </div>
        ) : submitted ? (
          /* Confirmation Success Modal */
          <div className="bg-white border border-emerald-200 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">تم حجز مقعدك بنجاح! 🚀</h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium max-w-lg mx-auto leading-relaxed">
              شكراً لك <strong className="text-slate-900">{formData.fullName}</strong>. لقد توصلنا بمعلوماتك وسنرسل لك رابط الحضور عبر الواتساب برقم <span className="font-mono dir-ltr font-bold text-slate-900">{formData.whatsapp}</span> والبريد الإلكتروني قبل انطلاق الميتينغ.
            </p>
          </div>
        ) : (
          /* Registration Form Card */
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xl space-y-6">
            <div className="text-center space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">احجز المقعد ديالك فـ الميتينغ المباشر</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                عمر المعلومات ديالك باش نوصلوك برابط الحضور فـ الواتساب والبريد الإلكتروني
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-900">الاسم الكامل <span className="text-[#F05023]">*</span></label>
                <input
                  type="text"
                  placeholder="مثال: يونس العلوي"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-[#F05023] focus:ring-4 focus:ring-[#F05023]/10 transition-all"
                  required
                />
              </div>

              {/* Phone & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-900">رقم الهاتف للاتصال <span className="text-[#F05023]">*</span></label>
                  <input
                    type="tel"
                    placeholder="06XXXXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-[#F05023] focus:ring-4 focus:ring-[#F05023]/10 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-900">رقم الواتساب (لإرسال الرابط) <span className="text-[#F05023]">*</span></label>
                  <input
                    type="tel"
                    placeholder="06XXXXXXXX"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-[#F05023] focus:ring-4 focus:ring-[#F05023]/10 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Gmail */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-900">البريد الإلكتروني (Gmail) <span className="text-[#F05023]">*</span></label>
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-[#F05023] focus:ring-4 focus:ring-[#F05023]/10 transition-all"
                  required
                />
              </div>

              {/* Experience */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900">واش فايت ليك درتي التجارة الإلكترونية (E-commerce)؟ <span className="text-[#F05023]">*</span></label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 bg-[#f8fafc] border rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                    formData.experience === 'yes' ? 'border-[#F05023] bg-[#fff5f2]' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="experience"
                      value="yes"
                      checked={formData.experience === 'yes'}
                      onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                      className="accent-[#F05023]"
                      required
                    />
                    <span className="text-xs font-bold text-slate-800">نعم، عندي تجربة</span>
                  </label>

                  <label className={`p-3 bg-[#f8fafc] border rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                    formData.experience === 'no' ? 'border-[#F05023] bg-[#fff5f2]' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="experience"
                      value="no"
                      checked={formData.experience === 'no'}
                      onChange={(e) => setFormData(prev => ({ ...prev, experience: e.target.value }))}
                      className="accent-[#F05023]"
                      required
                    />
                    <span className="text-xs font-bold text-slate-800">لا، يلاه باغي نبدا</span>
                  </label>
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900">واش عندك السلعة (Stock) متوفر حالياً؟ <span className="text-[#F05023]">*</span></label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 bg-[#f8fafc] border rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                    formData.stock === 'yes' ? 'border-[#F05023] bg-[#fff5f2]' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="stock"
                      value="yes"
                      checked={formData.stock === 'yes'}
                      onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                      className="accent-[#F05023]"
                      required
                    />
                    <span className="text-xs font-bold text-slate-800">نعم، متوفر</span>
                  </label>

                  <label className={`p-3 bg-[#f8fafc] border rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
                    formData.stock === 'no' ? 'border-[#F05023] bg-[#fff5f2]' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="stock"
                      value="no"
                      checked={formData.stock === 'no'}
                      onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                      className="accent-[#F05023]"
                      required
                    />
                    <span className="text-xs font-bold text-slate-800">لا، معنديش</span>
                  </label>
                </div>
              </div>

              {/* Orders Volume */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-900">شحال من مبيعة/طلبية كتدير فـ الشهر تقريباً؟ <span className="text-[#F05023]">*</span></label>
                <select
                  value={formData.ordersVolume}
                  onChange={(e) => setFormData(prev => ({ ...prev, ordersVolume: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-[#F05023] focus:ring-4 focus:ring-[#F05023]/10 transition-all cursor-pointer"
                  required
                >
                  <option value="" disabled>اختر حجم المبيعات الشهرية</option>
                  <option value="beginner">يلاه غنبدا (0 مبيعة)</option>
                  <option value="1_to_50">أقل من 50 طلبية / شهرياً</option>
                  <option value="50_to_300">من 50 إلى 300 طلبية / شهرياً</option>
                  <option value="300_plus">+300 طلبية فـ الشهر (Scale)</option>
                </select>
              </div>

              {/* Biggest Challenge */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-900">شنو هو أكبر عائق كيعطلك فـ تجارتك حالياً؟</label>
                <textarea
                  rows={3}
                  placeholder="مثال: التأكيد والـ Call Center، التوصيل، اختيار المنتجات، ولا السيولة المالية..."
                  value={formData.biggestChallenge}
                  onChange={(e) => setFormData(prev => ({ ...prev, biggestChallenge: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-[#F05023] focus:ring-4 focus:ring-[#F05023]/10 transition-all resize-none"
                />
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-gradient-to-r from-[#ff6b3d] to-[#F05023] hover:from-[#ff7a4d] hover:to-[#d94115] text-white rounded-2xl text-base sm:text-lg font-black shadow-lg shadow-[#F05023]/30 transition-all active:scale-[0.99] flex flex-col items-center justify-center gap-0.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{submitting ? 'جاري التأكيد...' : 'تأكيد الحضور وحجز المقعد مجاناً 🚀'}</span>
                <span className="text-[11px] font-medium opacity-90">المقاعد محدودة لضمان الإجابة على كافة الأسئلة</span>
              </button>

              <div className="text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-1.5 pt-2">
                <span>🔒 البيانات ديالك آمنة 100% وغادي نتوصلوا بيها مباشرة فـ سيستم</span>
                <img 
                  src="/new logo/logo filess-25.svg" 
                  alt="SILACOD" 
                  className="h-4.5 w-auto inline-block object-contain align-middle" 
                />
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
