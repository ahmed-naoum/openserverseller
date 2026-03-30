import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { ordersApi, leadsApi, walletApi, brandsApi, dashboardApi } from '../../lib/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import StatsCard from '../../components/dashboard/StatsCard';
import { 
  CreditCard, 
  ShoppingCart, 
  Phone, 
  Tag, 
  Palette, 
  Upload, 
  Banknote,
  ChevronRight,
  TrendingUp,
  PackageCheck,
  Zap
} from 'lucide-react';

export default function VendorDashboard() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: dashboardData } = useQuery({
    queryKey: ['vendor-dashboard'],
    queryFn: () => dashboardApi.sellerAffiliate(),
  });

  const switchModeMutation = useMutation({
    mutationFn: (mode: 'SELLER' | 'AFFILIATE') => dashboardApi.switchMode(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-dashboard'] });
      refreshUser();
      toast.success('Mode switched successfully!');
    },
    onError: () => {
      toast.error('Failed to switch mode');
    },
  });

  const currentMode = dashboardData?.data?.mode || user?.mode || 'SELLER';

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.get(),
  });

  const { data: ordersData } = useQuery({
    queryKey: ['orders', { limit: 5 }],
    queryFn: () => ordersApi.list({ limit: 5 }),
  });

  const { data: leadsData } = useQuery({
    queryKey: ['leads', { limit: 5 }],
    queryFn: () => leadsApi.list({ limit: 5 }),
  });

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.list(),
  });

  const wallet = walletData?.data?.data;
  const orders = ordersData?.data?.data?.orders || [];
  const leads = leadsData?.data?.data?.leads || [];
  const brands = brandsData?.data?.data?.brands || [];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[#2c2f74] p-10 text-white shadow-2xl shadow-primary-200/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-4xl font-black tracking-tight">
              Salut, {user?.fullName?.split(' ')[0] || 'Vendeur'}! 👋
            </h2>
            <p className="text-primary-100/70 font-medium text-lg max-w-xl">
              Votre boutique se porte bien aujourd'hui. Voici les dernières mises à jour.
            </p>
          </div>
          
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => switchModeMutation.mutate('SELLER')}
              disabled={currentMode === 'SELLER'}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                currentMode === 'SELLER'
                  ? 'bg-white text-primary-900 shadow-xl scale-100'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Mode Vendeur
            </button>
            <button
              onClick={() => switchModeMutation.mutate('AFFILIATE')}
              disabled={currentMode === 'AFFILIATE'}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                currentMode === 'AFFILIATE'
                  ? 'bg-accent-500 text-white shadow-xl scale-100'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Mode Affilié
            </button>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-400/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -ml-10 -mb-10" />
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Solde Portefeuille"
          value={`${Number(wallet?.balanceMad || 0).toLocaleString()} MAD`}
          icon={CreditCard}
          color="emerald"
        />
        <StatsCard
          title="Commandes"
          value={orders.length}
          change={8}
          changeLabel="ce mois"
          icon={ShoppingCart}
          color="amber"
          subtitle="Dernières 30 jours"
        />
        <StatsCard
          title="Prospects"
          value={leads.length}
          icon={Phone}
          color="indigo"
          subtitle="Total leads collectés"
        />
        <StatsCard
          title="Marques"
          value={brands.length}
          icon={Tag}
          color="primary"
          subtitle="Actives sur SILACOD"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions & Recent Orders */}
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Orders Card */}
          <div className="bento-card bg-white h-fit">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 text-primary-600 rounded-xl">
                  <PackageCheck size={20} />
                </div>
                <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Commandes Récentes</h3>
              </div>
              <Link to="/dashboard/orders" className="text-xs font-black text-primary-600 hover:text-primary-700 uppercase tracking-widest flex items-center gap-1 group">
                Voir tout <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center opacity-30">
                  <ShoppingCart size={40} className="mb-2" />
                  <p className="text-xs font-black uppercase tracking-widest">Aucune commande</p>
                </div>
              ) : (
                orders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 hover:bg-white border border-transparent hover:border-slate-100 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:bg-primary-50 transition-colors">
                        <Zap size={18} className="text-slate-400 group-hover:text-primary-600" />
                      </div>
                      <div>
                        <div className="font-black text-slate-900 text-sm tracking-tight">{order.orderNumber}</div>
                        <div className="text-[11px] font-bold text-slate-400 tracking-wide">{order.customerName}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 leading-none">{Number(order.totalAmountMad).toLocaleString()} MAD</div>
                      <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600' : 
                        order.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : 
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Leads Card */}
          <div className="bento-card bg-white h-fit">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Phone size={20} />
                </div>
                <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Prospects Récents</h3>
              </div>
              <Link to="/dashboard/leads" className="text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1 group">
                Voir tout <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leads.length === 0 ? (
                <div className="col-span-2 py-12 text-center flex flex-col items-center opacity-30">
                  <Phone size={40} className="mb-2" />
                  <p className="text-xs font-black uppercase tracking-widest">Aucun prospect</p>
                </div>
              ) : (
                leads.map((lead: any) => (
                  <div key={lead.id} className="p-4 rounded-2xl bg-slate-50/50 hover:bg-white border border-transparent hover:border-slate-100 transition-all flex items-center justify-between group">
                    <div>
                      <div className="font-black text-slate-900 text-sm">{lead.fullName}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1">{lead.city}</div>
                    </div>
                    <div className="text-right">
                       <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                         lead.status === 'NEW' ? 'bg-indigo-50 text-indigo-600' : 
                         lead.status === 'INTERESTED' ? 'bg-emerald-50 text-emerald-600' : 
                         'bg-slate-100 text-slate-500'
                       }`}>
                         {lead.status}
                       </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions Sidebar */}
        <div className="space-y-6">
           <div className="bento-card border-none bg-gradient-to-br from-primary-600 to-indigo-700 p-8 text-white">
              <h3 className="font-black uppercase tracking-widest text-xs opacity-70 mb-6">Actions Rapides</h3>
              <div className="space-y-4">
                <Link to="/dashboard/brands" className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-all group">
                   <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                      <Palette size={20} />
                   </div>
                   <div className="text-left">
                     <p className="text-sm font-black tracking-tight">Créer Marque</p>
                     <p className="text-[10px] font-bold opacity-60">Design identité</p>
                   </div>
                </Link>
                <Link to="/dashboard/leads" className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-all group">
                   <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                      <Upload size={20} />
                   </div>
                   <div className="text-left">
                     <p className="text-sm font-black tracking-tight">Importer Leads</p>
                     <p className="text-[10px] font-bold opacity-60">CSV / API</p>
                   </div>
                </Link>
                <Link to="/dashboard/wallet" className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-all group">
                   <div className="p-2.5 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                      <Banknote size={20} />
                   </div>
                   <div className="text-left">
                     <p className="text-sm font-black tracking-tight">Retrait Fonds</p>
                     <p className="text-[10px] font-bold opacity-60">RIB / ICE</p>
                   </div>
                </Link>
              </div>
           </div>

           <div className="bento-card bg-emerald-50 border-emerald-100 p-8">
              <div className="flex items-center gap-3 mb-4">
                 <TrendingUp size={24} className="text-emerald-600" />
                 <h4 className="font-black text-emerald-900 uppercase tracking-widest text-xs">Performance</h4>
              </div>
              <p className="text-lg font-black text-emerald-900 leading-tight">
                Votre taux de conversion est en <span className="underline decoration-emerald-300">hausse de 15%</span> cette semaine.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
