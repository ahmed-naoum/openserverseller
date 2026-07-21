import React from 'react';
import { Crown, Star, Shield, Medal, Flame, Plus, ShoppingBag, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';

export const TierProgressBanner = ({ 
  totalEarned, 
  title,
  productsUrl = '/influencer/inventory',
  marketplaceUrl = '/influencer/marketplace'
}: { 
  totalEarned: number; 
  title?: string;
  productsUrl?: string;
  marketplaceUrl?: string;
}) => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const tiers = [
    { id: 0, name: 'tier_beginner', min: 0, max: 100000, color: 'text-orange-700', bg: 'bg-orange-700', badgeFrom: 'from-orange-500', badgeTo: 'to-orange-800', icon: Shield },
    { id: 1, name: 'tier_silver', min: 100000, max: 1000000, color: 'text-gray-400', bg: 'bg-gray-400', badgeFrom: 'from-gray-300', badgeTo: 'to-gray-500', icon: Medal },
    { id: 2, name: 'tier_gold', min: 1000000, max: 10000000, color: 'text-yellow-500', bg: 'bg-yellow-500', badgeFrom: 'from-yellow-400', badgeTo: 'to-amber-500', icon: Star },
    { id: 3, name: 'tier_platine', min: 10000000, max: 20000000, color: 'text-indigo-500', bg: 'bg-indigo-500', badgeFrom: 'from-indigo-400', badgeTo: 'to-indigo-600', icon: Crown }
  ];

  // Calculate overall percentage for the runner (0 to 100%)
  // Since we have 4 segments, each tier takes up exactly 25% of the visual bar.
  let overallPercentage = 0;
  
  if (totalEarned >= tiers[3].min) {
    // In Platine
    const progressInTier = Math.min((totalEarned - tiers[3].min) / (tiers[3].max - tiers[3].min), 1);
    overallPercentage = 75 + (progressInTier * 25);
  } else if (totalEarned >= tiers[2].min) {
    // In Gold
    const progressInTier = (totalEarned - tiers[2].min) / (tiers[2].max - tiers[2].min);
    overallPercentage = 50 + (progressInTier * 25);
  } else if (totalEarned >= tiers[1].min) {
    // In Silver
    const progressInTier = (totalEarned - tiers[1].min) / (tiers[1].max - tiers[1].min);
    overallPercentage = 25 + (progressInTier * 25);
  } else {
    // In Débutant
    const progressInTier = totalEarned / tiers[0].max;
    overallPercentage = progressInTier * 25;
  }

  // Cap at 100%
  overallPercentage = Math.min(Math.max(overallPercentage, 0), 100);

  return (
    <div className="bg-slate-900 rounded-[2.5rem] py-6 px-8 md:py-8 md:px-12 border border-slate-800 shadow-2xl relative overflow-hidden mb-8">
      {/* Background decorations */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[radial-gradient(circle_at_center,#f59e0b_0%,transparent_70%)] opacity-30 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[radial-gradient(circle_at_center,#6366f1_0%,transparent_70%)] opacity-30 blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
              <span className="text-xl">🚀</span>
              <span className="text-xs font-black uppercase tracking-widest text-white">{title || t('tier_banner_title', 'dashboard')}</span>
            </div>
            <h2 className="text-white text-3xl font-black uppercase tracking-tight">{t('tier_banner_evolution', 'dashboard')}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to={productsUrl} className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl text-xs font-black text-white transition-all">
              <Package className="w-3.5 h-3.5" /> {t('nav_my_products', 'dashboard')}
            </Link>
            <Link to={marketplaceUrl} className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-2xl text-xs font-black hover:shadow-2xl transition-all">
              <ShoppingBag className="w-3.5 h-3.5" /> {t('nav_public_market', 'dashboard')}
            </Link>
          </div>
        </div>

        {/* Badges Container */}
        <div className={`flex justify-between items-end mb-6 relative px-4 md:px-8 ${isRtl ? 'flex-row-reverse' : ''}`}>
          {tiers.map((tier, index) => {
            const isUnlocked = totalEarned >= tier.min;
            const isCurrent = totalEarned >= tier.min && totalEarned < tier.max;
            // The last tier is current if earned > min
            const isActuallyCurrent = index === tiers.length - 1 ? totalEarned >= tier.min : isCurrent;
            const Icon = tier.icon;

            return (
              <div key={tier.id} className="flex flex-col items-center relative w-1/4">
                <motion.div 
                   initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative z-10 flex flex-col items-center transition-all duration-500 ${isUnlocked ? 'scale-110' : 'scale-90 opacity-50 grayscale'}`}
                >
                  {/* Badge shape */}
                  <div className={`w-16 h-20 md:w-20 md:h-24 bg-gradient-to-br ${tier.badgeFrom} ${tier.badgeTo} rounded-t-full rounded-b-xl flex flex-col items-center justify-center shadow-lg border border-white/10 ring-2 ring-white/20`}>
                    <Icon className="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-md mb-1" />
                    <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-wider drop-shadow-md">{t(tier.name, 'dashboard')}</span>
                    <span className="text-[8px] md:text-[10px] font-bold text-white/80">{tier.min === 0 ? '0' : tier.min >= 1000000 ? `${(tier.min / 1000000).toFixed(0)}M` : `${(tier.min / 1000).toFixed(0)}K`}</span>
                  </div>
                  {/* Ribbon tails */}
                  <div className="absolute -bottom-2 flex gap-1 z-[-1]">
                    <div className={`w-4 h-6 bg-gradient-to-b ${tier.badgeFrom} ${tier.badgeTo} transform -skew-y-[20deg] rounded-bl-sm`} />
                    <div className={`w-4 h-6 bg-gradient-to-b ${tier.badgeFrom} ${tier.badgeTo} transform skew-y-[20deg] rounded-br-sm`} />
                  </div>
                </motion.div>
                
                {isActuallyCurrent && (
                  <div className="absolute -bottom-8 md:-bottom-10">
                    <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-white text-[10px] font-bold border border-white/20 whitespace-nowrap animate-pulse">
                      {t('tier_banner_current_position', 'dashboard')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress Bar Container */}
        <div className="relative mt-12 px-4 md:px-8" style={{ direction: 'ltr' }}>
          {/* Base empty track */}
          <div className="h-4 bg-slate-800 rounded-full w-full overflow-hidden flex shadow-inner">
            {tiers.map((tier, index) => (
              <div key={tier.id} className="h-full flex-1 border-r border-slate-700/50 last:border-0" />
            ))}
          </div>

          {/* Filled track */}
          <div className="absolute top-0 left-4 right-4 md:left-8 md:right-8 h-4 rounded-full overflow-hidden pointer-events-none flex">
            {tiers.map((tier, index) => {
              const minPercent = index * 25;
              const maxPercent = (index + 1) * 25;
              let slotPercentage = 0;
              if (overallPercentage >= maxPercent) {
                slotPercentage = 100;
              } else if (overallPercentage <= minPercent) {
                slotPercentage = 0;
              } else {
                slotPercentage = ((overallPercentage - minPercent) / 25) * 100;
              }

              return (
                <div key={tier.id} className="h-full flex-1 relative overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${slotPercentage}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={`h-full ${tier.bg}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Runner Track (same left/right offsets as the filled track) */}
          <div className="absolute top-0 h-4 left-4 right-4 md:left-8 md:right-8 pointer-events-none">
            {/* Runner Icon */}
            <motion.div 
              initial={{ left: '0%' }}
              animate={{ left: `${overallPercentage}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute top-1/2 -translate-y-1/2 z-20 group cursor-pointer -ml-2.5 md:-ml-3 pointer-events-auto"
            >
              <motion.div 
                animate={{
                  boxShadow: [
                    "0 0 6px rgba(249,115,22,0.4)",
                    "0 0 16px rgba(249,115,22,0.9)",
                    "0 0 6px rgba(249,115,22,0.4)"
                  ],
                  scale: [1, 1.12, 1]
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-5 h-5 md:w-6 md:h-6 bg-white rounded-full flex items-center justify-center border-[2px] border-orange-500"
              >
                <Flame className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-orange-500 fill-orange-500 animate-pulse" />
              </motion.div>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30">
                <div className="bg-slate-800 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg whitespace-nowrap shadow-xl border border-slate-700">
                  {totalEarned.toLocaleString()} DH
                  {/* Tooltip Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Markers / Labels */}
          <div className="flex justify-between mt-4 relative z-10">
            <div className="flex flex-col w-1/4 items-start">
               <span className="text-[10px] md:text-xs font-black text-slate-500 tracking-wider -ml-2">0 DH</span>
            </div>
            <div className="flex flex-col items-center w-1/4 relative">
               <span className="text-[10px] md:text-xs font-black text-slate-500 tracking-wider absolute -left-4">100K</span>
            </div>
            <div className="flex flex-col items-center w-1/4 relative">
               <span className="text-[10px] md:text-xs font-black text-slate-500 tracking-wider absolute -left-3">1M</span>
            </div>
            <div className="flex flex-col w-1/4 relative items-end">
               <span className="text-[10px] md:text-xs font-black text-slate-500 tracking-wider absolute -left-4">10M</span>
               <span className="text-[10px] md:text-xs font-black text-slate-500 tracking-wider -mr-2">+</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
