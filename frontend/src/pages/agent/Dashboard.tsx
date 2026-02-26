import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../lib/api';

export default function AgentDashboard() {
  const { data: leadsData } = useQuery({
    queryKey: ['leads'],
    queryFn: () => leadsApi.list(),
  });

  const leads = leadsData?.data?.data?.leads || [];

  const stats = {
    total: leads.length,
    new: leads.filter((l: any) => l.status === 'NEW').length,
    contacted: leads.filter((l: any) => l.status === 'CONTACTED').length,
    interested: leads.filter((l: any) => l.status === 'INTERESTED').length,
    ordered: leads.filter((l: any) => l.status === 'ORDERED').length,
  };

  const statusColors: Record<string, string> = {
    NEW: 'primary',
    ASSIGNED: 'purple',
    CONTACTED: 'warning',
    INTERESTED: 'success',
    NOT_INTERESTED: 'danger',
    ORDERED: 'success',
    UNREACHABLE: 'gray',
    INVALID: 'danger',
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900">Bienvenue, Agent! 🎧</h2>
        <p className="text-gray-600 mt-1">Voici vos prospects à traiter aujourd'hui</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
          <div className="text-sm text-gray-500">Nouveaux</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.contacted}</div>
          <div className="text-sm text-gray-500">Contactés</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-600">{stats.interested}</div>
          <div className="text-sm text-gray-500">Intéressés</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-emerald-600">{stats.ordered}</div>
          <div className="text-sm text-gray-500">Commandés</div>
        </div>
      </div>

      {/* Priority Leads */}
      <div className="card">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Prospects prioritaires</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {leads.filter((l: any) => l.status === 'NEW' || l.status === 'ASSIGNED').slice(0, 10).map((lead: any) => (
            <div key={lead.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-700 font-semibold">{lead.fullName.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">{lead.fullName}</div>
                  <div className="text-sm text-gray-500">{lead.phone}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge-${statusColors[lead.status]}`}>{lead.status}</span>
                <button className="btn-primary btn-sm">Appeler</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
