import { useEffect, useState } from 'react';
import { Crown, Star, Shield, Medal, Lock, Check, ShoppingBag, Package, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { motion, animate, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * One palette per tier. Every tier keeps its identity whether or not it is
 * unlocked: a locked tier is drawn as an outline in its own colour, never
 * flattened to grey, so the seller can see what they are climbing towards.
 *
 * `ink` is the icon colour on the filled medal — the light metals (silver,
 * gold) need dark ink, the saturated ones take white.
 */
const TIERS = [
  {
    id: 0, name: 'tier_beginner', min: 0, icon: Shield,
    medal: 'from-amber-400 via-orange-500 to-orange-700', ink: 'text-white',
    text: 'text-orange-600', soft: 'bg-orange-50', ring: 'ring-orange-200',
    bar: 'from-amber-400 to-orange-600', glow: 'rgba(249,115,22,0.45)', spark: '#fb923c',
  },
  {
    id: 1, name: 'tier_silver', min: 100000, icon: Medal,
    medal: 'from-white via-slate-200 to-slate-400', ink: 'text-slate-700',
    text: 'text-slate-500', soft: 'bg-slate-100', ring: 'ring-slate-200',
    bar: 'from-slate-300 to-slate-400', glow: 'rgba(148,163,184,0.45)', spark: '#cbd5e1',
  },
  {
    id: 2, name: 'tier_gold', min: 1000000, icon: Star,
    medal: 'from-yellow-200 via-amber-400 to-amber-600', ink: 'text-amber-900',
    text: 'text-amber-600', soft: 'bg-amber-50', ring: 'ring-amber-200',
    bar: 'from-yellow-300 to-amber-500', glow: 'rgba(245,158,11,0.45)', spark: '#fbbf24',
  },
  {
    id: 3, name: 'tier_platine', min: 10000000, icon: Crown,
    medal: 'from-sky-300 via-violet-400 to-fuchsia-500', ink: 'text-white',
    text: 'text-violet-600', soft: 'bg-violet-50', ring: 'ring-violet-200',
    bar: 'from-violet-400 to-fuchsia-500', glow: 'rgba(167,139,250,0.45)', spark: '#c084fc',
  },
];

/**
 * Hover and tap need their own transition. An element's `transition` prop
 * applies to every animation on it, entrance included — so a card that enters
 * with `delay: 0.7` would also wait 0.7s before reacting to the pointer. These
 * are deliberately short: a hover that takes longer than ~0.2s reads as lag.
 */
const HOVER = { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const };
const TAP = { duration: 0.08, ease: 'easeOut' as const };

const compact = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`
  : n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`
  : `${n}`;

/**
 * Counts from 0 to `value` over `duration` seconds. Numbers that land in one
 * frame read as static; a short count-up is what makes them feel earned.
 * Respects reduced motion by snapping straight to the value.
 */
function useCountUp(value: number, duration = 1.4, reduced = false) {
  const [n, setN] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setN(value); return; }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration, reduced]);
  return n;
}

/** Three small sparks orbiting a medal, each on its own radius and period. */
const Sparks = ({ colour }: { colour: string }) => (
  <>
    {[
      { r: 58, d: 6, s: 6, delay: 0 },
      { r: 66, d: 9, s: 4, delay: 1.2 },
      { r: 52, d: 7.5, s: 5, delay: 2.4 },
    ].map((p, i) => (
      <motion.span
        key={i}
        className="absolute left-1/2 top-1/2 pointer-events-none"
        style={{ width: p.r * 2, height: p.r * 2, marginLeft: -p.r, marginTop: -p.r }}
        animate={{ rotate: 360 }}
        transition={{ duration: p.d, repeat: Infinity, ease: 'linear', delay: -p.delay }}
      >
        <motion.span
          className="absolute top-0 left-1/2 rounded-full"
          style={{ width: p.s, height: p.s, marginLeft: -p.s / 2, background: colour, boxShadow: `0 0 10px ${colour}` }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.2, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: p.delay * 0.4 }}
        />
      </motion.span>
    ))}
  </>
);

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
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const reduced = !!useReducedMotion();

  // The highest tier whose threshold has been reached.
  const currentIndex = TIERS.reduce((acc, tier, i) => (totalEarned >= tier.min ? i : acc), 0);
  const current = TIERS[currentIndex];
  const next = TIERS[currentIndex + 1] ?? null;
  const span = next ? next.min - current.min : 1;
  const progressInTier = next ? Math.min(Math.max((totalEarned - current.min) / span, 0), 1) : 1;
  const remaining = next ? Math.max(next.min - totalEarned, 0) : 0;
  const CurrentIcon = current.icon;

  const earnedShown = useCountUp(totalEarned, 1.6, reduced);
  const remainingShown = useCountUp(remaining, 1.6, reduced);
  const percentShown = useCountUp(Math.round(progressInTier * 100), 1.4, reduced);

  // Reusable "breathing" for glows — a slow opacity swell.
  const breathe = reduced
    ? {}
    : { animate: { opacity: [0.55, 1, 0.55], scale: [0.96, 1.06, 0.96] }, transition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' } };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      /* Near-opaque on purpose: a translucent card lets its own drop shadow
         show through from underneath, which reads as a dirty grey surface.
         The shadow itself is light and tight — a hint of lift, not a bar. */
      className="relative overflow-hidden rounded-[1.75rem] bg-white/95 ring-1 ring-slate-200/70 shadow-[0_12px_32px_-20px_rgba(17,19,68,0.18)] mb-8"
    >
      {/* Colour washes: the current tier's on the hero side, brand navy on the
          other, both drifting slowly so the surface never looks printed. Kept
          faint — at full strength the tier colour looked like a stain in the
          corner rather than light. */}
      <motion.div
        className={`absolute -top-32 ${isRtl ? '-right-32' : '-left-32'} w-[30rem] h-[30rem] rounded-full blur-3xl pointer-events-none opacity-50`}
        style={{ background: `radial-gradient(circle at center, ${current.glow} 0%, transparent 65%)` }}
        animate={reduced ? undefined : { x: [0, 30, 0], y: [0, 18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={`absolute -bottom-40 ${isRtl ? '-left-24' : '-right-24'} w-[26rem] h-[26rem] rounded-full blur-3xl pointer-events-none bg-[radial-gradient(circle_at_center,rgba(44,47,116,0.10)_0%,transparent_65%)]`}
        animate={reduced ? undefined : { x: [0, -26, 0], y: [0, -14, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ─────────────── Hero: the rank you hold ─────────────── */}
        <div className="p-6 md:p-8 lg:border-r border-slate-200/60 flex flex-col">
          <motion.div
            initial={reduced ? false : { opacity: 0, x: isRtl ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white/80 ring-1 ring-inset ring-slate-200 self-start"
          >
            <motion.span
              animate={reduced ? undefined : { rotate: [0, 20, -12, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
            </motion.span>
            <span className="text-[11px] font-semibold text-slate-600">{title || t('tier_banner_title', 'dashboard')}</span>
          </motion.div>

          <div className="flex items-center gap-5 mt-5">
            {/* Big medal: turning conic ring, breathing halo, orbiting sparks,
                a light sweep, and a gentle float. */}
            <motion.div
              className="relative shrink-0"
              animate={reduced ? undefined : { y: [0, -5, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <motion.div
                className="absolute -inset-5 rounded-full blur-xl pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${current.glow} 0%, transparent 70%)` }}
                {...breathe}
              />
              <motion.div
                className="absolute -inset-1.5 rounded-full"
                style={{ background: `conic-gradient(from 0deg, ${current.glow}, transparent 40%, ${current.glow} 70%, transparent)` }}
                animate={reduced ? undefined : { rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <div className="absolute -inset-1.5 rounded-full bg-white/70 backdrop-blur-sm" />
              {!reduced && <Sparks colour={current.spark} />}
              <motion.div
                initial={reduced ? false : { scale: 0.6, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.2 }}
                whileHover={reduced ? undefined : { scale: 1.06, rotate: 4, transition: HOVER }}
                className={`relative w-[88px] h-[88px] rounded-full bg-gradient-to-br ${current.medal} flex items-center justify-center shadow-xl ring-4 ring-white overflow-hidden`}
              >
                {/* Light sweep across the medal face */}
                {!reduced && (
                  <motion.span
                    className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/70 to-transparent skew-x-[-20deg] pointer-events-none"
                    initial={{ x: -80 }}
                    animate={{ x: 130 }}
                    transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3.4, ease: 'easeInOut', delay: 1 }}
                  />
                )}
                <motion.span
                  animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-flex"
                >
                  <CurrentIcon className={`w-9 h-9 ${current.ink} drop-shadow`} />
                </motion.span>
              </motion.div>
            </motion.div>

            <div className="min-w-0">
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400"
              >
                {t('tier_banner_evolution', 'dashboard')}
              </motion.p>
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, type: 'spring', stiffness: 200, damping: 18 }}
                className={`text-3xl font-bold tracking-tight leading-none mt-1 ${current.text}`}
              >
                {t(current.name, 'dashboard')}
              </motion.p>
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="text-sm text-slate-500 mt-2"
              >
                <span className="font-semibold text-slate-900 tabular-nums">{earnedShown.toLocaleString()} DH</span>{' '}
                {t('tier_earned', 'dashboard', 'gagnés au total')}
              </motion.p>
            </div>
          </div>

          {/* Progress to the NEXT rank only — the one number that matters */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6"
          >
            <div className="flex items-baseline justify-between gap-3 text-xs">
              {next ? (
                <>
                  <span className="text-slate-500">
                    {t('tier_next', 'dashboard', 'Prochain palier')}{' '}
                    <span className={`font-semibold ${next.text}`}>{t(next.name, 'dashboard')}</span>
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {remainingShown.toLocaleString()} DH {t('tier_remaining', 'dashboard', 'restants')}
                  </span>
                </>
              ) : (
                <span className="font-semibold text-slate-900">{t('tier_max', 'dashboard', 'Palier maximum atteint')}</span>
              )}
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-slate-200/70 overflow-hidden ring-1 ring-inset ring-white/60 relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(progressInTier * 100, 1.5)}%` }}
                transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                className={`h-full rounded-full bg-gradient-to-r ${current.bar} relative overflow-hidden`}
              >
                {/* Shimmer travelling along the fill */}
                {!reduced && (
                  <motion.span
                    className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '400%' }}
                    transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut', delay: 2 }}
                  />
                )}
              </motion.div>
              {/* Glowing head of the bar */}
              {!reduced && next && (
                <motion.span
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full -ml-1.5"
                  style={{ background: current.spark, boxShadow: `0 0 12px 2px ${current.spark}` }}
                  initial={{ left: '0%', opacity: 0 }}
                  animate={{ left: `${Math.max(progressInTier * 100, 1.5)}%`, opacity: [0, 1, 0.6, 1] }}
                  transition={{ left: { duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.4 }, opacity: { duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 2 } }}
                />
              )}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] font-medium text-slate-400 tabular-nums">
              <span>{compact(current.min)}</span>
              <span>{percentShown}%</span>
              <span>{next ? compact(next.min) : '∞'}</span>
            </div>
          </motion.div>

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap items-center gap-2.5 mt-6"
          >
            <motion.div whileHover={reduced ? undefined : { y: -2, transition: HOVER }} whileTap={{ scale: 0.97, transition: TAP }}>
              <Link
                to={productsUrl}
                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white ring-1 ring-inset ring-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors duration-150"
              >
                <Package className="w-3.5 h-3.5 text-slate-400" /> {t('nav_my_products', 'dashboard')}
              </Link>
            </motion.div>
            <motion.div whileHover={reduced ? undefined : { y: -2, transition: HOVER }} whileTap={{ scale: 0.97, transition: TAP }} className="group">
              <Link
                to={marketplaceUrl}
                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-gradient-to-r from-primary-700 to-primary-500 text-white text-xs font-semibold shadow-lg shadow-primary-600/25 hover:brightness-105 transition"
              >
                <ShoppingBag className="w-3.5 h-3.5" /> {t('nav_public_market', 'dashboard')}
                <Arrow className={`w-3.5 h-3.5 opacity-70 transition-transform ${isRtl ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`} />
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* ─────────────── Path: the four ranks as steps ─────────────── */}
        <div className="p-6 md:p-8 relative flex flex-col">
          <motion.div
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between mb-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {t('tier_path', 'dashboard', 'Parcours des paliers')}
            </p>
            <span className="text-[11px] font-medium text-slate-400 tabular-nums">
              {currentIndex + 1} / {TIERS.length}
            </span>
          </motion.div>

          {/* The four ranks, each step a little higher than the last */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end flex-1" dir={isRtl ? 'rtl' : 'ltr'}>
            {TIERS.map((tier, i) => {
              const unlocked = i <= currentIndex;
              const isCurrent = i === currentIndex;
              const Icon = tier.icon;
              return (
                <motion.div
                  key={tier.id}
                  initial={reduced ? false : { y: 28, opacity: 0, scale: 0.92 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 + 0.12 * i, type: 'spring', stiffness: 240, damping: 20 }}
                  whileHover={reduced ? undefined : { y: -6, scale: 1.03, transition: HOVER }}
                  // Each step sits a little higher than the last: a staircase.
                  style={{ marginBottom: `${i * 10}px` }}
                  className={`relative flex flex-col items-center text-center rounded-2xl p-4 pt-3 transition-shadow cursor-default ${
                    isCurrent
                      ? 'bg-white ring-2 ring-primary-500/70 shadow-[0_18px_40px_-20px_rgba(44,47,116,0.5)]'
                      : unlocked
                      ? 'bg-white/80 ring-1 ring-inset ring-white hover:shadow-[0_18px_40px_-22px_rgba(17,19,68,0.35)]'
                      : 'bg-white/40 ring-1 ring-inset ring-slate-200/70 hover:bg-white/70'
                  }`}
                >
                  {/* Medal */}
                  <motion.div
                    className="relative"
                    animate={isCurrent && !reduced ? { y: [0, -3, 0] } : undefined}
                    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {unlocked && (
                      <motion.div
                        className="absolute -inset-2 rounded-full blur-lg pointer-events-none"
                        style={{ background: `radial-gradient(circle at center, ${tier.glow} 0%, transparent 70%)` }}
                        {...breathe}
                        transition={{ duration: 3.6 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
                      />
                    )}
                    <motion.div
                      initial={reduced ? false : { rotateY: 90 }}
                      animate={{ rotateY: 0 }}
                      transition={{ delay: 0.55 + 0.12 * i, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className={`relative w-14 h-14 rounded-full flex items-center justify-center overflow-hidden ${
                        unlocked
                          ? `bg-gradient-to-br ${tier.medal} shadow-md ring-2 ring-white`
                          : `bg-white ring-2 ${tier.ring}`
                      }`}
                    >
                      {unlocked && !reduced && (
                        <motion.span
                          className="absolute inset-y-0 w-6 bg-gradient-to-r from-transparent via-white/70 to-transparent skew-x-[-20deg] pointer-events-none"
                          initial={{ x: -50 }}
                          animate={{ x: 90 }}
                          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 4 + i, ease: 'easeInOut', delay: 2 + i * 0.6 }}
                        />
                      )}
                      <motion.span
                        className="inline-flex"
                        whileHover={!unlocked && !reduced ? { rotate: [0, -12, 12, -6, 0], transition: { duration: 0.35, ease: 'easeInOut' } } : undefined}
                      >
                        <Icon className={`w-6 h-6 ${unlocked ? tier.ink : `${tier.text} opacity-70`}`} />
                      </motion.span>
                    </motion.div>
                    {/* State pin pops in after the medal */}
                    <motion.span
                      initial={reduced ? false : { scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.95 + 0.12 * i, type: 'spring', stiffness: 400, damping: 14 }}
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white ${
                        isCurrent ? 'bg-primary-600 text-white' : unlocked ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {unlocked ? <Check className="w-3 h-3" strokeWidth={3} /> : <Lock className="w-2.5 h-2.5" />}
                    </motion.span>
                  </motion.div>

                  <p className={`mt-3 text-[13px] font-semibold ${unlocked ? 'text-slate-900' : 'text-slate-500'}`}>
                    {t(tier.name, 'dashboard')}
                  </p>
                  <p className={`text-[11px] font-medium tabular-nums ${unlocked ? tier.text : 'text-slate-400'}`}>
                    {tier.min === 0 ? '0 DH' : `${compact(tier.min)} DH`}
                  </p>

                  <motion.span
                    animate={isCurrent && !reduced ? { scale: [1, 1.06, 1] } : undefined}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className={`mt-2.5 inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold ${
                      isCurrent
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                        : unlocked
                        ? 'bg-emerald-50 text-emerald-700'
                        : `${tier.soft} ${tier.text}`
                    }`}
                  >
                    {isCurrent
                      ? t('tier_banner_current_position', 'dashboard')
                      : unlocked
                      ? t('tier_unlocked', 'dashboard', 'Débloqué')
                      : t('tier_locked', 'dashboard', 'Verrouillé')}
                  </motion.span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
