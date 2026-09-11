import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  /** Lucide icon rendered in the gradient tile. */
  icon?: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons, chips and stats that sit on the right of the title row. */
  actions?: ReactNode;
  /**
   * Replaces the default spacing rather than adding to it. Two margin
   * utilities on one element resolve by stylesheet order, not by the order
   * they appear in the string, so appending an override would be a coin
   * flip; substituting is deterministic.
   */
  className?: string;
}

/**
 * The dashboard's page title block: a gradient icon tile, the title, an
 * optional subtitle, and an actions slot.
 *
 * It exists so a page does not have to re-derive the shell's language every
 * time. Weights and sizes here match the layout's header and sidebar (600/700,
 * -0.015em tracking); the global skin in styles/dashboard-skin.css handles the
 * surfaces of everything below it.
 */
export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className = 'mb-6',
}: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 flex-wrap ${className}`}>
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-accent-500 text-white flex items-center justify-center shadow-lg shadow-primary-600/25 shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          {/* No `truncate` here on purpose: several pages pass a title that
              contains a status badge beside the text, and clipping would cut
              the badge off on a narrow viewport. Long titles wrap instead. */}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
