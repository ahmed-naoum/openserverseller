import { motion } from 'framer-motion';
import { Star, TrendingUp, Users } from 'lucide-react';

export default function SuccessStories() {
  const stories = [
    {
      name: "أمينة، 24 سنة",
      role: "بائعة تجارة إلكترونية",
      image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80",
      stats: "50,000 درهم / شهرياً",
      story: "«بدأت بدون خبرة كبيرة وبمنتج واحد فقط. ركزت على التسويق، وSILACOD تكفلت بالباقي: التأكيد، التوصيل، والتحصيل. اليوم أحقق مبيعات يومية وأطوّر تجارتي خطوة بخطوة وبدأت بناء علامتي التجارية الخاصة AminaGlow بكل سهولة وبدون أي عوائق لوجستية.»",
      icon: <TrendingUp className="w-5 h-5" />
    },
    {
      name: "يوسف VLOG",
      role: "مؤثر VIP وصانع محتوى",
      image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80",
      stats: "15,000 درهم دخل إضافي",
      story: "«أنشأت علامتي الخاصة عبر المنصة بسهولة، واخترت منتجات تناسب جمهوري. بفضل النظام الجاهز، أصبحت أبيع مباشرة وأحوّل متابعيّ إلى مصدر ربح حقيقي دون القلق حول التوصيل أو إدارة الطلبات أو المخازن.»",
      icon: <Users className="w-5 h-5" />
    }
  ];

  return (
    <section dir="rtl" className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative overflow-hidden text-right font-['29LT_Kaff',Cairo,sans-serif]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-primary-600 font-bold tracking-wider uppercase text-sm mb-4 block">قصص النجاح</span>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-6">كن صاحب قصة النجاح القادمة</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">قصص حقيقية… ونتائج ملموسة. آلاف المستخدمين بدؤوا رحلتهم مع SILACOD وحققوا نتائج فعلية.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {stories.map((story, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="bg-gray-50 rounded-[2.5rem] p-8 lg:p-12 relative group hover:-translate-y-2 transition-transform duration-500 shadow-xl shadow-gray-200/50"
            >
              <div className="flex flex-col sm:flex-row gap-8 items-start">
                <div className="relative shrink-0 mx-auto sm:mx-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg z-10 relative">
                    <img src={story.image} alt={story.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-2 -left-2 bg-gradient-to-r from-accent-500 to-pink-500 text-white p-2 rounded-full shadow-lg z-20">
                     {story.icon}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex gap-1 mb-2 justify-start">
                    {[...Array(5)].map((_, j) => <Star key={j} className="w-5 h-5 text-yellow-400 fill-amber-400" />)}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{story.name}</h3>
                  <p className="text-primary-600 font-semibold mb-4">{story.role}</p>
                  <p className="text-gray-700 text-lg leading-relaxed italic mb-6">
                    {story.story}
                  </p>
                  <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-bold">
                    💰 الأرباح: {story.stats}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
