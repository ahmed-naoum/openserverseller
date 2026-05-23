import { useState, useEffect, useRef, ReactNode } from 'react';
import { motion } from 'framer-motion';

/* ─────────────────────────────────────────────
   ANIMATED COUNTER — counts up when in view
───────────────────────────────────────────── */
export function Counter({ to, suffix = '', prefix = '', duration = 2000 }: {
  to: number; suffix?: string; prefix?: string; duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const steps = 60;
        const step = duration / steps;
        let i = 0;
        const timer = setInterval(() => {
          i++;
          setCount(Math.floor((to / steps) * i));
          if (i >= steps) { clearInterval(timer); setCount(to); }
        }, step);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

/* ─────────────────────────────────────────────
   INFINITE MARQUEE — horizontal scrolling text
───────────────────────────────────────────── */
export function Marquee({ children, speed = 30, reverse = false, className = '' }: {
  children: ReactNode; speed?: number; reverse?: boolean; className?: string;
}) {
  return (
    <div className={`overflow-hidden whitespace-nowrap ${className}`}>
      <motion.div
        className="inline-flex gap-12"
        animate={{ x: reverse ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   GLOW CARD — card with animated border glow
───────────────────────────────────────────── */
export function GlowCard({ children, className = '', glowColor = 'rgba(99,102,241,0.15)' }: {
  children: ReactNode; className?: string; glowColor?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative group ${className}`}
      style={{
        background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor}, transparent 40%)`,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   FLOATING BADGE — animated floating element
───────────────────────────────────────────── */
export function FloatingBadge({ children, delay = 0, className = '' }: {
  children: ReactNode; delay?: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className={className}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3 + delay, repeat: Infinity, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   GRADIENT MESH BG — animated gradient mesh
───────────────────────────────────────────── */
export function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, 45, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-transparent blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], rotate: [0, -30, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        className="absolute -bottom-1/4 -left-1/4 w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-orange-500/15 via-pink-500/10 to-transparent blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent blur-[100px]"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   BENTO CARD — for bento grid layouts
───────────────────────────────────────────── */
export function BentoCard({ children, className = '', delay = 0, hover = true }: {
  children: ReactNode; className?: string; delay?: number; hover?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
      className={`relative rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden transition-all duration-300 ${hover ? 'hover:border-white/[0.15] hover:bg-white/[0.06]' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   NEON TEXT — text with glow effect
───────────────────────────────────────────── */
export function NeonText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`relative ${className}`}>
      <span className="relative z-10">{children}</span>
      <span className="absolute inset-0 blur-2xl opacity-50 z-0">{children}</span>
    </span>
  );
}

/* ─────────────────────────────────────────────
   GRID PATTERN — subtle dot grid overlay
───────────────────────────────────────────── */
export function GridPattern({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION LABEL — styled section badge
───────────────────────────────────────────── */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-bold tracking-[0.2em] uppercase text-white/60 ${className}`}
    >
      {children}
    </motion.div>
  );
}
