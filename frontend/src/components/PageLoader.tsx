import { useEffect, useState, useRef } from 'react';

interface Props {
  onComplete?: () => void;
}

export default function PageLoader({ onComplete }: Props) {
  const [phase, setPhase] = useState<'enter' | 'pulse' | 'exit'>('enter');
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  useEffect(() => {
    // Animate progress bar
    const interval = setInterval(() => {
      progressRef.current += Math.random() * 18 + 5;
      if (progressRef.current >= 100) {
        progressRef.current = 100;
        clearInterval(interval);
      }
      setProgress(Math.min(progressRef.current, 100));
    }, 80);

    // Phase transitions
    const t1 = setTimeout(() => setPhase('pulse'), 400);
    const t2 = setTimeout(() => setPhase('exit'), 1600);
    const t3 = setTimeout(() => onComplete?.(), 2100);

    return () => {
      clearInterval(interval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
        opacity: phase === 'exit' ? 0 : 1,
        transform: phase === 'exit' ? 'scale(1.04)' : 'scale(1)',
        transition: 'opacity 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: phase === 'exit' ? 'none' : 'all',
      }}
    >
      {/* Animated grid background */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.08) 1px, transparent 0)',
        backgroundSize: '44px 44px',
      }} />

      {/* Glowing orbs */}
      <div style={{
        position: 'absolute', top: '15%', left: '10%',
        width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)',
        animation: 'loaderOrb 3s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '10%',
        width: 250, height: 250,
        background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)',
        animation: 'loaderOrb 4s ease-in-out infinite reverse',
      }} />

      {/* Main content */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32,
        opacity: phase === 'enter' ? 0 : 1,
        transform: phase === 'enter' ? 'translateY(16px)' : 'translateY(0)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>

        {/* Logo container */}
        <div style={{ position: 'relative' }}>
          {/* Outer rotating ring */}
          <div style={{
            position: 'absolute', inset: -20,
            borderRadius: '50%',
            border: '1.5px solid transparent',
            backgroundClip: 'border-box',
            WebkitBackgroundClip: 'border-box',
            animation: 'spin 3s linear infinite',
            mask: 'conic-gradient(from 0deg, transparent 0deg 270deg, black 270deg 360deg)',
            WebkitMask: 'conic-gradient(from 0deg, transparent 0deg 270deg, black 270deg 360deg)',
          }} />

          {/* Inner pulse ring */}
          <div style={{
            position: 'absolute', inset: -8,
            borderRadius: '50%',
            border: '1px solid rgba(99,102,241,0.3)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', inset: -14,
            borderRadius: '50%',
            border: '1px solid rgba(168,85,247,0.15)',
            animation: 'pulse 2s ease-in-out infinite 0.5s',
          }} />

          {/* Logo icon */}
          <div style={{
            width: 88, height: 88,
            borderRadius: 100,
            background: 'linear-gradient(135deg, #ffffff 0%, rgba(248,250,252,0.8) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(99,102,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(99,102,241,0.15), 0 0 80px rgba(99,102,241,0.05), inset 0 1px 0 rgba(255,255,255,0.5)',
            animation: 'loaderIconPulse 2s ease-in-out infinite',
          }}>
            <img
              src="/new logo/logo filess-25.png"
              alt="SILACOD"
              style={{ width: 62, height: 62, objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* Wordmark */}
        <div style={{ textAlign: 'center' }}>
          <img
            src="/new logo/logo filess-24.png"
            alt="SILACOD"
            style={{
              height: 42,
              objectFit: 'contain',
              animation: 'shimmer 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* Progress bar */}
        <div style={{ width: 220 }}>
          <div style={{
            height: 2,
            background: 'rgba(15,23,42,0.06)',
            borderRadius: 99,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #6366f1, #a855f7, #6366f1)',
              backgroundSize: '200% 100%',
              borderRadius: 99,
              transition: 'width 0.12s ease',
              animation: 'shimmerBar 1.5s linear infinite',
            }} />
          </div>
          <p style={{
            marginTop: 10,
            textAlign: 'center',
            fontSize: 11,
            color: 'rgba(100,116,139,0.7)',
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.05em',
          }}>
            Chargement {Math.round(progress)}%
          </p>
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: i === 0 ? '#6366f1' : i === 1 ? '#a855f7' : '#06b6d4',
              animation: `dotBounce 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
              opacity: 0.8,
            }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes loaderOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -20px) scale(1.1); }
        }
        @keyframes loaderIconPulse {
          0%, 100% { box-shadow: 0 10px 30px rgba(99,102,241,0.15), 0 0 60px rgba(99,102,241,0.05), inset 0 1px 0 rgba(255,255,255,0.5); }
          50% { box-shadow: 0 15px 40px rgba(99,102,241,0.25), 0 0 90px rgba(99,102,241,0.1), inset 0 2px 0 rgba(255,255,255,0.8); }
        }
        @keyframes shimmer {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(99,102,241,0.15)); }
          50% { filter: drop-shadow(0 0 16px rgba(99,102,241,0.3)); }
        }
        @keyframes shimmerBar {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(1); opacity: 0.5; }
          40% { transform: scale(1.5) translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
