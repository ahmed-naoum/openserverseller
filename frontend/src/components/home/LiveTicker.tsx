import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';

export default function LiveTicker() {
  const { t, language } = useLanguage();

  const events = [
    t('ticker_event1'),
    t('ticker_event2'),
    t('ticker_event3'),
    t('ticker_event4'),
    t('ticker_event5'),
  ];

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`bg-gray-900 border-b border-gray-800 py-3 overflow-hidden whitespace-nowrap font-['29LT_Kaff',Cairo,Inter,sans-serif] w-full z-50 relative ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      <div className="flex">
        <motion.div
          animate={{ x: language === 'ar' ? [0, 2000] : [0, -2000] }}
          transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
          className={`flex space-x-12 px-6 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}
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
