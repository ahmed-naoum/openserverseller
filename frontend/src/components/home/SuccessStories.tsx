import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Play } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function SuccessStories() {
  const { t, language } = useLanguage();

  const stories = [
    {
      badge: t('story1_badge'),
      title: t('story1_title'),
      placeholder: t('story1_placeholder'),
      text: t('story1_text')
    },
    {
      badge: t('story2_badge'),
      title: t('story2_title'),
      placeholder: t('story2_placeholder'),
      text: t('story2_text')
    },
    {
      badge: t('story3_badge'),
      title: t('story3_title'),
      placeholder: t('story3_placeholder'),
      text: t('story3_text')
    }
  ];

  return (
    <section id="success-stories" dir={language === 'ar' ? 'rtl' : 'ltr'} className={`py-24 px-4 sm:px-6 lg:px-8 bg-[#fafafc] relative overflow-hidden font-['29LT_Kaff',Cairo,sans-serif] ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-14 space-y-4">
          <span className="inline-block bg-[#ff5722]/10 text-[#9a3412] font-black text-xs px-4 py-1.5 rounded-full">
            {t('stories_badge')}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.5rem] font-black text-[#2e315e] leading-tight">
            {t('stories_title')}
          </h2>
          <p className="text-[#2e315e] text-[15px] font-bold max-w-2xl mx-auto">
            {t('stories_subtitle')}
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
                <h3 className={`text-lg font-black text-slate-700 leading-tight flex-1 ${language === 'ar' ? 'text-right pl-4' : 'text-left pr-4'}`}>{story.title}</h3>
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
              
              <p className={`text-slate-500 text-[13px] font-bold leading-relaxed w-full ${language === 'ar' ? 'text-right' : 'text-left'}`}>
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
          {/* Text alignment based on direction */}
          <div className={`space-y-3 w-full md:w-auto flex flex-col ${language === 'ar' ? 'items-start text-right' : 'items-start text-left'}`}>
            <span className="inline-block bg-[#2e315e] text-white font-black text-[11px] px-4 py-1.5 rounded-[10px]">
              {t('start_now')}
            </span>
            <h3 className="text-2xl sm:text-[1.75rem] font-black text-[#2e315e]">
              {t('stories_badge')}
            </h3>
          </div>
          
          {/* Left Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <Link to="/influencer/register" className="w-full sm:w-auto px-8 py-[14px] border-[1.5px] border-[#2e315e] text-[#2e315e] hover:bg-[#2e315e] hover:text-white rounded-[12px] text-sm font-black transition-all flex items-center justify-center">
              {t('banner_influencer_cta')}
            </Link>
            <Link to="/register" className="w-full sm:w-auto px-8 py-[14px] bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-[12px] text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff5722]/20">
              <span>{t('banner_seller_cta')}</span>
              {language === 'ar' ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </Link>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
