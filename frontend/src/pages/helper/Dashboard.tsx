import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Users, TrendingUp, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byPayment: Record<string, number>;
}

export default function HelperDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/leads?limit=1000');
        const leads = res.data?.data?.leads || [];

        const byStatus: Record<string, number> = {};
        const byPayment: Record<string, number> = { NOT_PAID: 0, PAID: 0, FACTURED: 0 };

        for (const l of leads) {
          byStatus[l.status] = (byStatus[l.status] || 0) + 1;
          const ps = l.paymentSituation || 'NOT_PAID';
          byPayment[ps] = (byPayment[ps] || 0) + 1;
        }

        setStats({ total: leads.length, byStatus, byPayment });
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    {
      label: 'Total Leads',
      value: stats?.total ?? '—',
      icon: Users,
      color: 'from-violet-500 to-indigo-500',
      bg: 'bg-violet-50',
      text: 'text-violet-700',
    },
    {
      label: 'Non Payés',
      value: stats?.byPayment['NOT_PAID'] ?? '—',
      icon: AlertCircle,
      color: 'from-rose-500 to-pink-500',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
    },
    {
      label: 'Payés',
      value: stats?.byPayment['PAID'] ?? '—',
      icon: CheckCircle,
      color: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
    },
    {
      label: 'Facturés',
      value: stats?.byPayment['FACTURED'] ?? '—',
      icon: TrendingUp,
      color: 'from-blue-500 to-cyan-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 mt-1">Vue d'ensemble de vos leads et leur situation de paiement.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-3xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3 hover:shadow-lg transition-shadow"
              >
                <div className={`w-12 h-12 rounded-2xl ${card.bg} flex items-center justify-center`}>
                  <Icon size={22} className={card.text} />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{card.value}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-0.5">{card.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stats && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-lg font-extrabold text-gray-900 mb-6 flex items-center gap-2">
            <Clock size={20} className="text-indigo-500" /> Répartition par statut
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <div className="w-2 h-8 bg-indigo-400 rounded-full" />
                <div>
                  <p className="text-lg font-black text-gray-800">{count}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{status.replace(/_/g, ' ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
