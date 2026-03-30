import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  color?: 'primary' | 'accent' | 'emerald' | 'amber' | 'rose' | 'indigo';
  subtitle?: string;
}

export default function StatsCard({ 
  title, 
  value, 
  change, 
  changeLabel, 
  icon: Icon, 
  color = 'primary',
  subtitle 
}: StatsCardProps) {
  const colorStyles = {
    primary: 'bg-primary-50 text-primary-600 border-primary-100',
    accent: 'bg-accent-50 text-accent-600 border-accent-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };

  return (
    <div className="bento-card group">
      <div className="flex items-start justify-between">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-primary-500 transition-colors">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h3>
              {change !== undefined && (
                <div className={`flex items-center text-[11px] font-black px-2 py-0.5 rounded-full ${
                  change >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  {change >= 0 ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
                  {Math.abs(change)}%
                </div>
              )}
            </div>
          </div>
          
          {subtitle && (
            <p className="text-xs font-bold text-slate-400">{subtitle}</p>
          )}
          
          {changeLabel && !subtitle && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{changeLabel}</p>
          )}
        </div>

        <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm ${colorStyles[color]}`}>
          <Icon size={28} strokeWidth={2.5} />
        </div>
      </div>
      
      {/* Decorative background element */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-gradient-to-br from-slate-100/50 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
}
