import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';

export default function SuccessStories() {
  const stories = [
    {
      badge: "بائع",
      title: "بدأت بكمية صغيرة... واليوم أبيع يومياً",
      placeholder: "فيديو قريباً",
      text: "بدأت بدون خبرة كبيرة وبمنتج واحد فقط. ركزت على التسويق، و SILACOD تكفلت بالباقي: التأكيد، التوصيل، والتحصيل. اليوم أحقق مبيعات يومية وأطور تجارتي خطوة بخطوة."
    },
    {
      badge: "مؤثر",
      title: "حوّلت جمهوري إلى مصدر دخل حقيقي",
      placeholder: "فيديو قريباً",
      text: "أنشأت علامتي الخاصة عبر المنصة بسهولة، واخترت منتجات تناسب جمهوري. بفضل النظام الجاهز، أصبحت أبيع مباشرة دون القلق حول التوصيل أو إدارة الطلبات."
    },
    {
      badge: "مسوق بالعمولة",
      title: "أربح من التسويق فقط",
      placeholder: "فيديو قريباً",
      text: "اخترت منتجات من المنصة وبدأت الترويج. كل طلب يتم توصيله بنجاح يمنحني عمولة. أربح بدون شراء أو تخزين."
    }
  ];

  return (
    <section id="success-stories" dir="rtl" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#fafafc] relative overflow-hidden text-right font-['29LT_Kaff',Cairo,sans-serif]">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-14 space-y-4">
          <span className="inline-block bg-[#ff5722]/10 text-[#ff5722] font-black text-xs px-4 py-1.5 rounded-full">
            كن صاحب قصة النجاح القادمة
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.5rem] font-black text-[#2e315e] leading-tight">
            قصص حقيقية... ونتائج ملموسة
          </h2>
          <p className="text-[#2e315e] text-[15px] font-bold max-w-2xl mx-auto">
            آلاف المستخدمين بدؤوا رحلتهم مع SILACOD وحققوا نتائج فعلية. هذه بعض من تجاربهم:
          </p>
        </div>

        {/* 3 Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-16">
          {stories.map((story, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="bg-white rounded-[2rem] p-6 lg:p-8 flex flex-col items-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-center justify-between w-full mb-6">
                <h3 className="text-lg font-black text-slate-700 leading-tight flex-1 text-right pl-4">{story.title}</h3>
                <span className="bg-[#ff5722] text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shrink-0">
                  {story.badge}
                </span>
              </div>
              
              {/* Video Placeholder */}
              <div className="relative w-full aspect-[4/3] bg-slate-100 rounded-[1.5rem] overflow-hidden flex flex-col items-center justify-center mb-6 border border-slate-200/50">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #cbd5e1 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                
                {/* Play Button Overlay */}
                <div className="relative z-10 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md mb-4 text-slate-300">
                  <Play className="w-7 h-7 ml-1 fill-current" />
                </div>
                
                {/* Coming Soon Text */}
                <span className="relative z-10 text-slate-600 font-black text-lg bg-white/80 px-4 py-1 rounded-full backdrop-blur-sm">
                  {story.placeholder}
                </span>
              </div>
              
              <p className="text-slate-500 text-[13px] font-bold leading-relaxed text-right w-full">
                {story.text}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Bottom Banner */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-white rounded-[2rem] p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_8px_40px_rgb(0,0,0,0.06)]"
        >
          {/* Right Text */}
          <div className="text-right space-y-3 w-full md:w-auto flex flex-col items-start">
            <span className="inline-block bg-[#2e315e] text-white font-black text-[11px] px-4 py-1.5 rounded-[10px]">
              ابدأ الآن
            </span>
            <h3 className="text-2xl sm:text-[1.75rem] font-black text-[#2e315e]">
              كن صاحب قصة النجاح القادمة
            </h3>
          </div>
          
          {/* Left Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <Link to="/influencer/register" className="w-full sm:w-auto px-8 py-[14px] border-[1.5px] border-[#2e315e] text-[#2e315e] hover:bg-[#2e315e] hover:text-white rounded-[12px] text-sm font-black transition-all flex items-center justify-center">
              إبدأ الآن كمؤثر
            </Link>
            <Link to="/register" className="w-full sm:w-auto px-8 py-[14px] bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-[12px] text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff5722]/20">
              <span>إبدأ البيع الآن</span>
              <ArrowLeft size={18} />
            </Link>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
