import { useState, useEffect } from 'react';
import { influencerApi, dashboardApi } from '../../lib/api';
import { InfluencerCommission } from '../../types';
import {
  DollarSign, TrendingUp, Clock, ArrowUpRight,
  Wallet as WalletIcon, Download, FileText, Crown
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InfluencerWallet() {
  const [commissions, setCommissions] = useState<InfluencerCommission[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'PAID'>('all');

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const [dashRes, comRes] = await Promise.all([
        dashboardApi.influencer(),
        influencerApi.getCommissions()
      ]);
      setTotalEarnings(dashRes.data.totalEarnings || 0);
      setCommissions(comRes.data.commissions || []);
    } catch (error) {
      console.error('Failed to load wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingAmount = commissions
    .filter(c => c.status === 'PENDING')
    .reduce((sum, c) => sum + c.amount, 0);

  const approvedAmount = commissions
    .filter(c => c.status === 'APPROVED')
    .reduce((sum, c) => sum + c.amount, 0);

  const paidAmount = commissions
    .filter(c => c.status === 'PAID')
    .reduce((sum, c) => sum + c.amount, 0);

  const filteredCommissions = activeFilter === 'all'
    ? commissions
    : commissions.filter(c => c.status === activeFilter);

  const getTier = () => {
    if (totalEarnings >= 50000) return { name: 'Diamond', icon: '💎', rate: '18%', next: null, remaining: 0 };
    if (totalEarnings >= 10000) return { name: 'Gold', icon: '🥇', rate: '15%', next: 'Diamond', remaining: 50000 - totalEarnings };
    return { name: 'Silver', icon: '🥈', rate: '12%', next: 'Gold', remaining: 10000 - totalEarnings };
  };
  const tier = getTier();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-influencer-200 border-t-influencer-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mon Portefeuille</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez vos gains et demandes de retrait.</p>
        </div>
        <button
          disabled={totalEarnings < 50}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-influencer-500 text-white rounded-xl text-sm font-bold hover:bg-influencer-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          onClick={() => toast.error('Le retrait nécessite l\'approbation admin.')}
        >
          <ArrowUpRight className="w-4 h-4" />
          Demander un Retrait
        </button>
      </div>
 {/* Tier Progress */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-5 h-5 text-influencer-500" />
            Progression Tier
          </h2>
          <span className="text-sm font-bold text-influencer-600">Commission actuelle: {tier.rate}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Silver */}
          <div className={`flex-1 text-center p-3 rounded-xl border-2 ${totalEarnings < 10000 ? 'border-influencer-300 bg-influencer-50' : 'border-green-300 bg-green-50'}`}>
            <span className="text-2xl">🥈</span>
            <p className="text-xs font-bold mt-1 text-gray-900">Silver</p>
            <p className="text-[10px] text-gray-500">12%</p>
          </div>
          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-influencer-400 to-influencer-600 rounded-full" style={{ width: `${Math.min(100, (totalEarnings / 10000) * 100)}%` }} />
          </div>
          {/* Gold */}
          <div className={`flex-1 text-center p-3 rounded-xl border-2 ${totalEarnings >= 10000 && totalEarnings < 50000 ? 'border-influencer-300 bg-influencer-50' : totalEarnings >= 50000 ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <span className="text-2xl">🥇</span>
            <p className="text-xs font-bold mt-1">Gold</p>
            <p className="text-[10px] text-gray-500">15%</p>
          </div>
          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-influencer-400 to-influencer-600 rounded-full" style={{ width: `${totalEarnings >= 10000 ? Math.min(100, ((totalEarnings - 10000) / 40000) * 100) : 0}%` }} />
          </div>
          {/* Diamond */}
          <div className={`flex-1 text-center p-3 rounded-xl border-2 ${totalEarnings >= 50000 ? 'border-influencer-300 bg-influencer-50' : 'border-gray-200 bg-gray-50'}`}>
            <span className="text-2xl">💎</span>
            <p className="text-xs font-bold mt-1">Diamond</p>
            <p className="text-[10px] text-gray-500">18%</p>
          </div>
        </div>

        {tier.next && (
          <p className="text-xs text-gray-500 text-center mt-3">
            Plus que <span className="font-bold text-influencer-600">{tier.remaining.toFixed(2)} MAD</span> pour atteindre le tier {tier.next}
          </p>
        )}
      </div> 

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5 bg-gradient-to-br from-influencer-500 to-purple-600 text-white border-0">
          <div className="flex items-center justify-between mb-3">
            <WalletIcon className="w-8 h-8 opacity-80" />
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full text-gray-900">{tier.icon} {tier.name}</span>
          </div>
          <p className="text-sm text-gray-900  font-medium opacity-80">Solde Total</p>
          <h2 className="text-3xl font-black text-gray-900">{totalEarnings.toFixed(2)} <span className="text-lg font-medium opacity-70">MAD</span></h2>
        </div>

        <div className="card p-5 border-l-4 border-l-amber-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">En Attente</p>
              <h3 className="text-xl font-black text-amber-600 mt-1">{pendingAmount.toFixed(2)} MAD</h3>
              <p className="text-xs text-gray-400 mt-1">Rétention 30 jours</p>
            </div>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        <div className="card p-5 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Approuvé</p>
              <h3 className="text-xl font-black text-blue-600 mt-1">{approvedAmount.toFixed(2)} MAD</h3>
              <p className="text-xs text-gray-400 mt-1">Disponible pour retrait</p>
            </div>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
        </div>

        <div className="card p-5 border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Déjà Payé</p>
              <h3 className="text-xl font-black text-green-600 mt-1">{paidAmount.toFixed(2)} MAD</h3>
              <p className="text-xs text-gray-400 mt-1">Total retiré</p>
            </div>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
        </div>
      </div>

     

      {/* Commission History */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-influencer-500" />
              Historique des Commissions
            </h2>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
              <Download className="w-3.5 h-3.5" />
              Exporter
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            {([['all', 'Tout'], ['PENDING', 'En attente'], ['APPROVED', 'Approuvé'], ['PAID', 'Payé']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFilter === key
                    ? 'bg-influencer-50 text-influencer-700 ring-1 ring-influencer-200'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredCommissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Montant</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredCommissions.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">{c.referralLink?.product?.nameFr || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-green-600">{c.amount.toFixed(2)} MAD</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                        c.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        c.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {c.status === 'PAID' ? 'Payé' : c.status === 'APPROVED' ? 'Approuvé' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <DollarSign className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 font-medium">Aucune commission trouvée</p>
          </div>
        )}
      </div>
    </div>
  );
}
