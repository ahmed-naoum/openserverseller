import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown } from 'lucide-react';

interface LanguageSwitcherWidgetProps {
  variant?: 'header' | 'footer' | 'dashboard-header';
}

export default function LanguageSwitcherWidget({ variant = 'header' }: LanguageSwitcherWidgetProps) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'ar', label: 'العربية', flag: 'ma' },
    { code: 'fr', label: 'Français', flag: 'fr' },
    { code: 'en', label: 'English', flag: 'gb' },
  ];

  const currentLang = languages.find(l => l.code === language) || languages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buttonClasses = variant === 'footer'
    ? "h-12 px-4 rounded-xl bg-white text-slate-900 flex items-center justify-center hover:bg-slate-100 transition-all gap-2 font-black text-sm focus:outline-none shadow-sm cursor-pointer"
    : variant === 'dashboard-header'
    ? "relative p-0 w-[33px] h-[33px] bg-white rounded-lg border border-slate-100 hover:border-primary-200 transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center focus:outline-none"
    : "flex items-center gap-2 px-4 h-[42px] rounded-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-700 font-semibold text-sm transition-all shadow-sm focus:outline-none";

  const dropdownClasses = variant === 'footer'
    ? `absolute bottom-full mb-2 w-36 rounded-2xl bg-white border border-slate-150 shadow-xl z-[100] overflow-hidden focus:outline-none ${
        language === 'ar' ? 'left-0 origin-bottom-left' : 'right-0 origin-bottom-right'
      }`
    : `absolute mt-2 w-36 rounded-2xl bg-white border border-slate-150 shadow-xl z-[100] overflow-hidden focus:outline-none ${
        language === 'ar' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
      }`;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClasses}
      >
        {variant === 'dashboard-header' ? (
          <div className="flex items-center justify-center relative w-full h-full">
            <img src={`https://flagcdn.com/w20/${currentLang.flag}.png`} srcSet={`https://flagcdn.com/w40/${currentLang.flag}.png 2x`} width="20" alt="" className="w-5 h-auto rounded-[2px] shadow-sm" title={currentLang.label} />
            <span className="hidden lg:inline-flex absolute -bottom-1 -right-1 items-center px-2 py-[2px] rounded bg-slate-100 text-[7.5px] font-black text-slate-400 border border-slate-200 shadow-sm leading-none transition-colors">
              {currentLang.code.toUpperCase()}
            </span>
          </div>
        ) : variant === 'header' ? (
          <>
            <img src={`https://flagcdn.com/w20/${currentLang.flag}.png`} srcSet={`https://flagcdn.com/w40/${currentLang.flag}.png 2x`} width="20" alt="" className="w-4 h-auto rounded-[2px]" />
            <span className="hidden sm:inline">{currentLang.label}</span>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <img src={`https://flagcdn.com/w20/${currentLang.flag}.png`} srcSet={`https://flagcdn.com/w40/${currentLang.flag}.png 2x`} width="20" alt="" className="w-4 h-auto rounded-[2px]" />
            <span>{currentLang.label}</span>
          </div>
        )}
        {variant !== 'dashboard-header' && (
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </motion.div>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: variant === 'footer' ? -8 : 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: variant === 'footer' ? -8 : 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={dropdownClasses}
          >
            <div className="py-1 text-slate-700">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={async () => {
                    await setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-all hover:bg-slate-50 ${
                    lang.code === language ? 'text-[#ff5722] bg-[#ff5722]/5' : 'text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <img src={`https://flagcdn.com/w20/${lang.flag}.png`} srcSet={`https://flagcdn.com/w40/${lang.flag}.png 2x`} width="20" alt="" className="w-4.5 h-auto rounded-[2px] shadow-sm" />
                    <span>{lang.label}</span>
                  </span>
                  {lang.code === language && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722]" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
