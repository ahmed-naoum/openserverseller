import { Link } from 'react-router-dom';
import { Clock, Mail, Sparkles, CheckCircle2, UserCheck } from 'lucide-react';

export default function PendingVerificationPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-['Inter'] bg-white overflow-x-hidden">
      {/* Left Column: Content Area */}
      <div className="w-full lg:w-[50%] xl:w-[45%] flex flex-col justify-center items-center p-6 bg-[#f8f9fa] relative z-10 min-h-screen">
        
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-8 left-8">
          <Link to="/" className="flex items-center gap-2">
            <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-8 h-8 object-contain" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-5 object-contain" />
          </Link>
        </div>

        <div className="w-full max-w-[400px] py-6">
          <div className="text-center space-y-2 mb-6 mt-8 lg:mt-0">
            <h1 className="text-[32px] font-extrabold text-[#2e315e] tracking-tight">مرحباً بك في سيلاكود</h1>
            <p className="text-[17px] font-medium text-[#ff5722]">حسابك في انتظار التفعيل والمراجعة</p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-right" dir="rtl">
            {/* Animated Icon */}
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 bg-[#ff5722]/10 rounded-full animate-ping opacity-25" />
              <div className="absolute inset-[-4px] bg-[#ff5722]/5 rounded-full animate-pulse" />
              <div className="relative w-16 h-16 bg-[#ff5722] rounded-full flex items-center justify-center shadow-lg shadow-[#ff5722]/20">
                <Clock className="w-8 h-8 text-white" />
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-[20px] font-black text-[#2e315e] mb-2">في انتظار مراجعة الحساب</h2>
              <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                لقد تم إنشاء حسابك بنجاح! يقوم فريقنا الآن بمراجعة طلبك، وستتلقى إشعاراً فور تفعيل الحساب.
              </p>
            </div>

            {/* Steps Timeline */}
            <div className="bg-[#f8f9fa] rounded-2xl p-5 mb-6 space-y-4">
              {/* Step 1 */}
              <div className="flex gap-4 relative">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/10 z-10">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="w-0.5 h-8 bg-emerald-300 mt-1 animate-in fade-in duration-500" />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-xs font-bold text-slate-800">تم التسجيل بنجاح</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">لقد تم حفظ معلومات حسابك في نظامنا.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4 relative">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-[#ff5722] rounded-full flex items-center justify-center flex-shrink-0 shadow-md shadow-[#ff5722]/10 z-10 animate-pulse">
                    <UserCheck className="w-4 h-4 text-white" />
                  </div>
                  <div className="w-0.5 h-8 bg-slate-200 mt-1" />
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-xs font-bold text-[#2e315e]">مراجعة الطلب</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">يقوم المشرف حالياً بالتحقق من بياناتك وتنشيط الحساب.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4 relative">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 z-10">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-xs font-bold text-slate-400">إشعار التفعيل</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">ستصلك رسالة تأكيد بمجرد تفعيل الحساب بالكامل.</p>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-[#ff5722]/5 border border-[#ff5722]/10 rounded-2xl p-4 mb-6 flex gap-3">
              <div className="bg-[#ff5722]/10 text-[#ff5722] w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <p className="text-[11px] text-[#ff5722] font-semibold leading-relaxed">
                يستغرق التفعيل عادةً من <strong>24 إلى 48 ساعة</strong>. ستصلك رسالة بريد إلكتروني أو رسالة واتساب فور الانتهاء.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link 
                to="/login" 
                className="w-full flex items-center justify-center gap-2 bg-[#ff5722] hover:bg-[#ff5722]/90 text-white font-bold py-3 rounded-xl shadow-lg shadow-[#ff5722]/10 transition-all hover:scale-[1.02] active:scale-[0.98] text-[13px]"
              >
                العودة لتسجيل الدخول
              </Link>
              <Link 
                to="/" 
                className="w-full flex items-center justify-center gap-2 bg-[#f4f5f7] hover:bg-slate-200/60 text-slate-600 font-bold py-3 rounded-xl transition-all active:scale-[0.98] text-[12px]"
              >
                الرجوع للرئيسية
              </Link>
            </div>

            {/* Footer */}
            <p className="text-center mt-6 text-xs text-slate-400 font-semibold" dir="rtl">
              هل تحتاج إلى مساعدة؟{' '}
              <a href="mailto:support@silacod.com" className="text-[#ff5722] hover:text-[#ff5722]/90 font-bold hover:underline">
                support@silacod.com
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Visual Area */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[55%] relative overflow-hidden bg-[#f4f6fa] items-center justify-center">
        {/* Desktop Logo */}
        <div className="absolute top-10 right-12 z-20">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 object-contain animate-pulse" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain" />
          </Link>
        </div>

        {/* Dynamic Image */}
        <div className="relative w-full h-full p-12 flex items-center justify-center">
          <img
            src="/home page silacod copy/images/photo-1622151834677-70f982c9adef.webp"
            className="w-full max-w-[600px] max-h-[80vh] object-contain rounded-[2rem] shadow-2xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
            alt="Seller Preview"
          />

          {/* Decorative background circle */}
          <div className="absolute inset-0 z-[-1] flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[600px] rounded-full blur-[100px] bg-[#ff5722]/5"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
