import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi, influencerApi } from '../../lib/api';
import { ReferralLink, InfluencerCampaign, InfluencerCommission } from '../../types';
import { Copy, Link as LinkIcon, DollarSign, TrendingUp, Star } from 'lucide-react';

export default function InfluencerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'links' | 'commissions' | 'campaigns'>('overview');
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [campaigns, setCampaigns] = useState<InfluencerCampaign[]>([]);
  const [commissions, setCommissions] = useState<InfluencerCommission[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashboardRes, linksRes, campaignsRes, commissionsRes] = await Promise.all([
        dashboardApi.influencer(),
        influencerApi.getLinks(),
        influencerApi.getCampaigns(),
        influencerApi.getCommissions()
      ]);
      setReferralLinks(linksRes.data);
      setCampaigns(campaignsRes.data);
      setCommissions(commissionsRes.data.commissions);
      setTotalEarnings(dashboardRes.data.totalEarnings);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = (code: string) => {
    const link = `${window.location.origin}/ref/${code}`;
    navigator.clipboard.writeText(link);
  };

  const enableInfluencer = async () => {
    try {
      await influencerApi.enable();
      window.location.reload();
    } catch (error) {
      console.error('Failed to enable influencer:', error);
    }
  };

  if (!user?.isInfluencer) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <Star className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
          <h1 className="text-2xl font-bold mb-4">Become an Influencer</h1>
          <p className="text-gray-600 mb-6">
            Join our influencer program and earn commissions by promoting products!
          </p>
          <button
            onClick={enableInfluencer}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Enable Influencer Mode
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Influencer Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user.fullName}!</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Earnings</p>
              <p className="text-2xl font-bold text-green-600">{totalEarnings.toFixed(2)} MAD</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Referral Links</p>
              <p className="text-2xl font-bold">{referralLinks.length}</p>
            </div>
            <LinkIcon className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Clicks</p>
              <p className="text-2xl font-bold">{referralLinks.reduce((sum, l) => sum + l.clicks, 0)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Conversions</p>
              <p className="text-2xl font-bold">{referralLinks.reduce((sum, l) => sum + l.conversions, 0)}</p>
            </div>
            <Star className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex space-x-8">
          {['overview', 'links', 'commissions', 'campaigns'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Your Referral Code</h3>
            <div className="flex items-center gap-2">
              <code className="bg-gray-100 px-4 py-2 rounded text-lg font-mono">{user.referralCode}</code>
              <button
                onClick={() => navigator.clipboard.writeText(user.referralCode || '')}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Share this code to earn commissions!
            </p>
          </div>
        </div>
      )}

      {activeTab === 'links' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clicks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conversions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Earnings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {referralLinks.map((link) => (
                <tr key={link.id}>
                  <td className="px-6 py-4">{link.product?.nameFr || `Product #${link.productId}`}</td>
                  <td className="px-6 py-4 font-mono">{link.code}</td>
                  <td className="px-6 py-4">{link.clicks}</td>
                  <td className="px-6 py-4">{link.conversions}</td>
                  <td className="px-6 py-4 text-green-600">{link.earnings.toFixed(2)} MAD</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => copyReferralLink(link.code)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {referralLinks.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No referral links yet. Browse products to create links!
            </div>
          )}
        </div>
      )}

      {activeTab === 'commissions' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {commissions.map((commission) => (
                <tr key={commission.id}>
                  <td className="px-6 py-4">{commission.referralLink?.product?.nameFr || 'N/A'}</td>
                  <td className="px-6 py-4 text-green-600">{commission.amount.toFixed(2)} MAD</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      commission.status === 'PAID' ? 'bg-green-100 text-green-800' :
                      commission.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {commission.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{new Date(commission.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {commissions.length === 0 && (
            <div className="p-6 text-center text-gray-500">No commissions yet</div>
          )}
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">{campaign.name}</h3>
              <p className="text-sm text-gray-600 mb-2">{campaign.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-primary-600 font-bold">{campaign.commission}% commission</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {campaign.status}
                </span>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-8">
              No active campaigns
            </div>
          )}
        </div>
      )}
    </div>
  );
}
