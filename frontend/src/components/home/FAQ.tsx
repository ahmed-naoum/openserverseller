import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "هل أحتاج رأس مال للبدء؟",
      a: "لا، لا تحتاج إلى رأس مال كبير لشراء المخزون. مع نظام SILACOD، يمكنك البدء مجاناً كمسوق بالعمولة والترويج للمنتجات الجاهزة، أو استخدام خيار المنتجات ذات العلامة الخاصة والبدء بالبيع الفوري والدفع عند الاستلام."
    },
    {
      q: "متى وكيف أستلم أرباحي؟",
      a: "بمجرد توصيل الطلب للزبون وتحصيل المبلغ، تضاف الأرباح مباشرة لمحفظتك الإلكترونية على SILACOD. يمكنك طلب سحب أرباحك في أي وقت لتصلك عبر حسابك البنكي أو وكالات تحويل الأموال المعتمدة بالمغرب بشكل سريع وبدون تأخير."
    },
    {
      q: "هل المنتجات مضمونة وذات جودة عالية؟",
      a: "نعم، جميع الموردين المتواجدين بالمنصة موثوقون ويمرون بعملية فحص جودة صارمة لضمان رضا الزبائن وتقليل نسب المرتجعات لأدنى حد ممكن."
    },
    {
      q: "كيف أبدأ العمل مع SILACOD خطوة بخطوة؟",
      a: "البدء سهل للغاية: قم بإنشاء حسابك مجاناً بالمنصة، تصفح الماركت بليس واختر المنتجات التي تناسبك، وابدأ التسويق واستقبال الطلبات فوراً بينما نتولى نحن كافة العمليات من تأكيد، تغليف وتوصيل."
    }
  ];

  return (
    <section dir="rtl" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 border-t border-gray-100 text-right font-['29LT_Kaff',Cairo,sans-serif]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-6">الأسئلة الشائعة</h2>
          <p className="text-xl text-gray-600">كل ما تحتاج معرفته لبدء تجارتك الإلكترونية بثقة وسهولة.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-6 text-right focus:outline-none"
              >
                <span className="font-bold text-lg text-gray-900 pl-8">{faq.q}</span>
                <ChevronDown 
                  className={`w-6 h-6 text-primary-500 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="p-6 pt-0 text-gray-600 leading-relaxed border-t border-gray-50 mt-2">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
