import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { t, language } = useLanguage();

  const faqs = [
    {
      q: t('faq_q1'),
      a: t('faq_a1')
    },
    {
      q: t('faq_q2'),
      a: t('faq_a2')
    },
    {
      q: t('faq_q3'),
      a: t('faq_a3')
    },
    {
      q: t('faq_q4'),
      a: t('faq_a4')
    }
  ];

  return (
    <section dir={language === 'ar' ? 'rtl' : 'ltr'} className={`py-24 px-4 sm:px-6 lg:px-8 bg-slate-50 border-y border-slate-100/80 font-['29LT_Kaff',Cairo,sans-serif] ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-black text-[#2e315e] mb-6">{t('faq_title')}</h2>
          <p className="text-lg text-slate-500 font-bold">{t('faq_subtitle')}</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className={`w-full flex items-center justify-between p-6 focus:outline-none ${language === 'ar' ? 'text-right' : 'text-left'}`}
              >
                <span className={`font-bold text-lg text-[#2e315e] ${language === 'ar' ? 'pl-8' : 'pr-8'}`}>{faq.q}</span>
                <ChevronDown 
                  className={`w-6 h-6 text-[#ff5722] transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`}
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
                    <div className={`p-6 pt-0 text-slate-600 font-bold leading-relaxed border-t border-slate-50 mt-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
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
