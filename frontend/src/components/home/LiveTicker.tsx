import { motion } from 'framer-motion';

export default function LiveTicker() {
  const events = [
    "🚀 تم شحن طلب 'ساعة ذكية' إلى طنجة (قبل دقيقتين)",
    "⚡ انضم بائع جديد لبناء علامته التجارية للتو",
    "💰 تم تحويل عمولة بقيمة 450 درهم إلى حساب أمين",
    "📦 تم شحن 150 وحدة من المنتجات الرائجة للشركاء",
    "🌟 انضم مؤثر VIP جديد للمنصة للتو",
    "🚀 تم شحن طلب إلى الدار البيضاء (قبل 5 دقائق)",
    "💰 حققت ليلى أرباحاً صافية بقيمة 2,100 درهم اليوم",
  ];

  return (
    <div dir="rtl" className="bg-gray-900 border-b border-gray-800 py-3 overflow-hidden whitespace-nowrap font-['29LT_Kaff',Cairo,Inter,sans-serif] w-full z-50 relative text-right">
      <div className="flex">
        <motion.div
          animate={{ x: [0, 2000] }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          className="flex space-x-12 px-6 flex-row-reverse"
        >
          {/* Double the array for seamless scrolling */}
          {[...events, ...events].map((event, i) => (
             <div key={i} className="flex items-center gap-2 text-sm font-medium text-gray-300 ml-12">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {event}
             </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
