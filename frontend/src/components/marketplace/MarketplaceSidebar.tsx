import { useState, useEffect, useRef } from 'react';
import { X, RotateCcw, Tag, ArrowUpDown, Filter, DollarSign, Check, ChevronDown, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';

interface SidebarProps {
  categories: any[];
  selectedCategories: string[];
  setSelectedCategories: (v: string[]) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  priceMin: string;
  setPriceMin: (v: string) => void;
  priceMax: string;
  setPriceMax: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  onReset: () => void;
  onPageReset: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (...args: any[]) => string;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function MarketplaceSidebar({
  categories, selectedCategories, setSelectedCategories,
  sortBy, setSortBy,
  priceMin, setPriceMin, priceMax, setPriceMax,
  statusFilter, setStatusFilter,
  onReset, onPageReset, t, isMobile, isOpen, onClose
}: SidebarProps) {
  const { language } = useLanguage();

  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCatDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCategory = (slug: string) => {
    const updated = selectedCategories.includes(slug)
      ? selectedCategories.filter(s => s !== slug)
      : [...selectedCategories, slug];
    setSelectedCategories(updated);
    onPageReset();
  };

  const handleSort = (s: string) => { setSortBy(s); onPageReset(); };
  const handleStatus = (s: string) => { setStatusFilter(s); onPageReset(); };

  const sortOptions = [
    { id: 'newest', label: t('sort_newest', 'marketplace') },
    { id: 'price_asc', label: t('sort_price_asc', 'marketplace') },
    { id: 'price_desc', label: t('sort_price_desc', 'marketplace') },
  ];

  const statusOptions = [
    { id: 'all', label: t('status_all', 'marketplace') },
    { id: 'available', label: t('status_available', 'marketplace') },
    { id: 'claimed', label: t('status_claimed', 'marketplace') },
    { id: 'pending', label: t('status_pending', 'marketplace') },
  ];

  const priceRanges = [
    { label: t('price_range_all_prices', 'marketplace'), min: '', max: '' },
    { label: t('price_range_0_50', 'marketplace'), min: '0', max: '50' },
    { label: t('price_range_50_plus', 'marketplace'), min: '50', max: '' },
  ];

  const activeFiltersCount =
    (selectedCategories.length > 0 ? 1 : 0) +
    (priceMin || priceMax ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0);

  const getCategoryName = (cat: any) => {
    if (language === 'ar') return cat.nameAr || cat.nameFr;
    if (language === 'en') return cat.nameEn || cat.nameFr;
    return cat.nameFr;
  };

  const filteredCategories = categories.filter((cat: any) =>
    getCategoryName(cat)?.toLowerCase().includes(catSearch.toLowerCase()) ||
    cat.nameAr?.includes(catSearch)
  );

  const content = (
    <div className="space-y-5">

      {/* Categories select */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Tag size={13} className="text-[#FF6B4A]" />
          <h3 className="text-[11px] font-black text-[#232863] uppercase tracking-[0.15em]">
            {t('sidebar_categories', 'marketplace')}
          </h3>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setCatDropdownOpen(!catDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none hover:bg-slate-100/50 transition-all text-left"
          >
            <span className="truncate pr-4 select-none">
              {selectedCategories.length === 0
                ? t('filter_all', 'marketplace')
                : categories
                    .filter(c => selectedCategories.includes(c.slug))
                    .map(c => getCategoryName(c))
                    .join(', ')}
            </span>
            <ChevronDown size={14} className="text-[#FF6B4A] shrink-0" />
          </button>

          {catDropdownOpen && (
            <div className="absolute left-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-30 max-h-60 overflow-hidden flex flex-col min-w-full w-72 md:w-80">
              <div className="p-2 border-b border-slate-50 flex items-center gap-1.5 bg-slate-50/50">
                <Search size={12} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Search category..."
                  value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                  className="w-full bg-transparent text-xs outline-none font-bold text-slate-700 placeholder:text-slate-400"
                />
                {catSearch && (
                  <button type="button" onClick={() => setCatSearch('')}>
                    <X size={12} className="text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1 max-h-48 py-1">
                {filteredCategories.map((cat: any) => {
                  const isChecked = selectedCategories.includes(cat.slug);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.slug)}
                      className="w-full flex items-start gap-2 px-3 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 text-left transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="rounded border-slate-300 text-[#FF6B4A] focus:ring-[#FF6B4A]/30 w-3.5 h-3.5 cursor-pointer accent-[#FF6B4A] shrink-0 mt-0.5"
                      />
                      <span className="select-none leading-tight whitespace-normal break-words flex-1">
                        {getCategoryName(cat)} ({cat.productsCount !== undefined ? cat.productsCount : (cat._count?.products || 0)})
                      </span>
                    </button>
                  );
                })}
                {filteredCategories.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400 text-center font-medium">No results found</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Price Range */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={13} className="text-[#FF6B4A]" />
          <h3 className="text-[11px] font-black text-[#232863] uppercase tracking-[0.15em]">{t('sidebar_price_range', 'marketplace')}</h3>
        </div>
        <div className="space-y-1.5 mb-3">
          {priceRanges.map((r, i) => {
            const isActive = priceMin === r.min && priceMax === r.max;
            return (
              <button
                key={i}
                type="button"
                onClick={() => { setPriceMin(isActive ? '' : r.min); setPriceMax(isActive ? '' : r.max); onPageReset(); }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-[#FF6B4A]/10 text-[#FF6B4A] ring-1 ring-[#FF6B4A]/20' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" placeholder={t('price_min', 'marketplace')} value={priceMin}
            onChange={e => { setPriceMin(e.target.value); onPageReset(); }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-[#FF6B4A]/30 focus:border-[#FF6B4A]/30"
          />
          <span className="text-slate-300 text-xs">—</span>
          <input
            type="number" placeholder={t('price_max', 'marketplace')} value={priceMax}
            onChange={e => { setPriceMax(e.target.value); onPageReset(); }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-[#FF6B4A]/30 focus:border-[#FF6B4A]/30"
          />
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Sort */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpDown size={13} className="text-[#FF6B4A]" />
          <h3 className="text-[11px] font-black text-[#232863] uppercase tracking-[0.15em]">{t('sidebar_sort_by', 'marketplace')}</h3>
        </div>
        <div className="space-y-1">
          {sortOptions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSort(s.id)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                sortBy === s.id ? 'bg-[#232863] text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s.label}
              {sortBy === s.id && <Check size={11} className="text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Claim Status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Filter size={13} className="text-[#FF6B4A]" />
          <h3 className="text-[11px] font-black text-[#232863] uppercase tracking-[0.15em]">{t('sidebar_status', 'marketplace')}</h3>
        </div>
        <div className="space-y-1">
          {statusOptions.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleStatus(s.id)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                statusFilter === s.id ? 'bg-[#232863] text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                s.id === 'all' ? 'bg-slate-400' :
                s.id === 'available' ? 'bg-[#21c55d]' :
                s.id === 'claimed' ? 'bg-blue-500' : 'bg-amber-500'
              }`} />
              <span className="flex-1">{s.label}</span>
              {statusFilter === s.id && <Check size={11} className="text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
          activeFiltersCount > 0
            ? 'bg-[#FF6B4A]/10 text-[#FF6B4A] hover:bg-[#FF6B4A]/20 ring-1 ring-[#FF6B4A]/20'
            : 'bg-slate-50 hover:bg-slate-100 text-slate-400'
        }`}
      >
        <RotateCcw size={12} />
        {t('sidebar_reset', 'marketplace')}
        {activeFiltersCount > 0 && (
          <span className="px-1.5 py-0.5 bg-[#FF6B4A] text-white text-[9px] font-black rounded-md">{activeFiltersCount}</span>
        )}
      </button>
    </div>
  );

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-[300px] bg-white z-50 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-[#232863] uppercase tracking-widest">{t('filters', 'marketplace')}</h2>
                  {activeFiltersCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-[#FF6B4A] text-white text-[9px] font-black rounded-md">{activeFiltersCount}</span>
                  )}
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              <div className="p-5">{content}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop: sticky sidebar
  return (
    <div className="w-[260px] shrink-0 hidden lg:block sticky top-24 self-start z-10">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] font-black text-[#232863] uppercase tracking-[0.2em]">{t('filters', 'marketplace')}</h2>
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.5 bg-[#FF6B4A] text-white text-[9px] font-black rounded-md">{activeFiltersCount}</span>
          )}
        </div>
        {content}
      </div>
    </div>
  );
}
