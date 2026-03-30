import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import StatsCard from '../../components/dashboard/StatsCard';
import { 
  Users, 
  ShoppingCart, 
  DollarSign, 
  Tag, 
  Target, 
  CreditCard, 
  Package, 
  TrendingUp,
  Award
} from 'lucide-react';

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminApi.dashboard(),
  });

  const dashboardData = data?.data?.data;
  const stats = dashboardData?.stats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-1000 ease-out">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[#2c2f74] p-10 text-white shadow-2xl shadow-primary-200/50">
        <div className="relative z-10 space-y-2">
          <h2 className="text-4xl font-black tracking-tight">Tableau de bord Admin <span className="text-primary-400">🛡️</span></h2>
          <p className="text-primary-100/70 font-medium text-lg max-w-xl">
            Bienvenue sur votre centre de contrôle SILACOD. Gérez votre écosystème en temps réel.
          </p>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-400/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -ml-10 -mb-10" />
      </div>

      {/* Main Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Utilisateurs"
          value={stats?.users?.total || 0}
          subtitle={`${stats?.users?.vendors || 0} vendeurs actifs`}
          icon={Users}
          color="primary"
        />
        <StatsCard
          title="Commandes"
          value={stats?.orders?.total || 0}
          change={12}
          changeLabel="vs mois dernier"
          subtitle={`${stats?.orders?.pending || 0} en attente`}
          icon={ShoppingCart}
          color="amber"
        />
        <StatsCard
          title="Revenus Total"
          value={`${Number(stats?.revenue?.total || 0).toLocaleString()} MAD`}
          icon={DollarSign}
          color="emerald"
        />
        <StatsCard
          title="Marques"
          value={stats?.brands?.total || 0}
          subtitle={`${stats?.brands?.pending || 0} nouvelles demandes`}
          icon={Tag}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Secondary Detailed Stats */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bento-card bg-white space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Target size={20} />
                </div>
                <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Gestion des Leads</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Leads</p>
                  <p className="text-2xl font-black text-slate-900">{stats?.leads?.total || 0}</p>
                </div>
                <div className="p-5 rounded-3xl bg-amber-50/50 border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Non assignés</p>
                  <p className="text-2xl font-black text-amber-700">{stats?.leads?.unassigned || 0}</p>
                </div>
              </div>
          </div>

          <div className="bento-card bg-white space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CreditCard size={20} />
                </div>
                <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Paiements & Retraits</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Retiré</p>
                  <p className="text-xl font-black text-slate-900 leading-none mt-1">{Number(stats?.payouts?.total || 0).toLocaleString()} MAD</p>
                </div>
                <div className="p-5 rounded-3xl bg-indigo-50/50 border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">En attente</p>
                  <p className="text-2xl font-black text-indigo-700">{stats?.payouts?.pending || 0}</p>
                </div>
              </div>
          </div>

          <div className="bento-card bg-white md:col-span-2 flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-primary-50 text-primary-600 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                  <Package size={32} />
                </div>
                <div>
                   <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Contenu Platforme</h3>
                   <p className="text-sm font-bold text-slate-400 mt-1">Vous avez actuellement <span className="text-primary-600">{stats?.products || 0}</span> produits au catalogue.</p>
                </div>
              </div>
              <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary-600 transition-all shadow-lg active:scale-95">
                Voir Inventaire
              </button>
          </div>
        </div>

        {/* Top Vendors Ranking */}
        <div className="bento-card bg-white flex flex-col h-full">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                   <Award size={20} />
                </div>
                <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Top Vendeurs</h3>
              </div>
              <TrendingUp size={16} className="text-emerald-500" />
           </div>

           <div className="space-y-4 flex-1">
             {dashboardData?.topVendors?.length > 0 ? (
               dashboardData.topVendors.slice(0, 5).map((vendor: any, index: number) => (
                 <div key={vendor.uuid} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100 group/item hover:bg-white hover:border-primary-100 transition-all duration-300">
                   <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm transition-transform group-hover/item:scale-110 ${
                       index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-400'
                     }`}>
                       #{index + 1}
                     </div>
                     <div className="text-left">
                       <p className="text-sm font-black text-slate-800 group-hover/item:text-primary-600 transition-colors">{vendor.fullName}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-commerce Pro</p>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className="text-sm font-black text-slate-900">{Number(vendor.totalRevenue).toLocaleString()}</p>
                     <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">MAD</p>
                   </div>
                 </div>
               ))
             ) : (
               <div className="flex flex-col items-center justify-center py-10 opacity-30">
                  <Award size={40} className="mb-2" />
                  <p className="text-xs font-black uppercase tracking-widest">Aucun vendeur</p>
               </div>
             )}
           </div>

           <button className="w-full mt-8 py-4 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 text-[11px] font-black uppercase tracking-[0.2em] transition-all">
             Voir le classement complet
           </button>
        </div>
      </div>
    </div>
  );
}
