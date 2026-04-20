import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getVerificationStatus } from '../../pages/common/ProfileVerification';
import { UserCheck } from 'lucide-react';

export default function ProfileProgressBanner() {
  const { user } = useAuth();
  const location = useLocation();
  const { percentage } = getVerificationStatus(user);

  // Don't show if 100% complete, on verification page, admin, helper, confirmation, or call center agent
  if (
    percentage === 100 ||
    location.pathname.includes('/verification') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/helper') ||
    location.pathname.startsWith('/confirmation') ||
    location.pathname.startsWith('/agent')
  ) {
    return null;
  }

  // Determine the base path for navigation
  const getBasePath = () => {
    if (location.pathname.startsWith('/admin')) return '/admin';
    if (location.pathname.startsWith('/agent')) return '/agent';
    if (location.pathname.startsWith('/grosseller')) return '/grosseller';
    if (location.pathname.startsWith('/influencer')) return '/influencer';
    if (location.pathname.startsWith('/confirmation')) return '/confirmation';
    return '/dashboard';
  };

  const verificationPath = `${getBasePath()}/verification`;

  return (
    <div className="bg-[#1e2333] mb-6 sm:mb-8 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border border-slate-700/50 relative overflow-hidden group">
      {/* Dynamic background effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-primary-500/10 pointer-events-none" />
      <div className="absolute top-[-50%] left-[-5%] w-[40%] h-[200%] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-700" />

      <div className="flex items-center gap-4 sm:gap-5 z-10 w-full sm:w-auto">
        {/* Circular Progress */}
        <div className="relative w-14 h-14 flex-shrink-0">
          <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-700/50"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              strokeLinecap="round"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-emerald-500 transition-all duration-1000 ease-out"
              strokeWidth="3.5"
              strokeDasharray={`${percentage}, 100`}
              stroke="currentColor"
              fill="none"
              strokeLinecap="round"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-black">
            {percentage}%
          </span>
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white text-sm sm:text-[15px] font-black tracking-tight mb-0.5">
            Complétez votre profil
          </h3>
          <p className="text-slate-400 text-[12px] sm:text-[13px] font-medium leading-snug">
            Votre profil est complété à <span className="text-emerald-400 font-bold">{percentage}%</span>. Complétez-le pour accéder à toutes les fonctionnalités.
          </p>
        </div>
      </div>

      {/* Action Button */}
      <Link
        to={verificationPath}
        className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-black rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all duration-300 z-10"
      >
        <UserCheck size={16} />
        Compléter le Profil
      </Link>
    </div>
  );
}
