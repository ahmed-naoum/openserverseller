import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi } from '../../lib/api';
import { Shield, CheckCircle, XCircle, Clock, Users } from 'lucide-react';

interface PendingUser {
  id: number;
  uuid: string;
  email: string | null;
  phone: string | null;
  role: { name: string };
  profile: { fullName: string } | null;
  kycDocuments: { id: number; documentType: string; documentUrl: string; status: string }[];
  createdAt: string;
}

export default function ConfirmationDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [pendingVerifications, setPendingVerifications] = useState<PendingUser[]>([]);
  const [recentVerifications, setRecentVerifications] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await dashboardApi.confirmation();
      setPendingVerifications(response.data.pendingVerifications || []);
      setRecentVerifications(response.data.recentVerifications || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const pending = pendingVerifications;
  const approved = recentVerifications.filter(v => v.kycStatus === 'APPROVED');
  const rejected = recentVerifications.filter(v => v.kycStatus === 'REJECTED');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Confirmation Agent Dashboard</h1>
        <p className="text-gray-600">Verify user accounts and KYC documents</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{pending.length}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Approved Today</p>
              <p className="text-2xl font-bold text-green-600">{approved.length}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Rejected Today</p>
              <p className="text-2xl font-bold text-red-600">{rejected.length}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Processed</p>
              <p className="text-2xl font-bold">{approved.length + rejected.length}</p>
            </div>
            <Shield className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex space-x-8">
          {[
            { key: 'pending', label: 'Pending Verification', count: pending.length },
            { key: 'approved', label: 'Approved', count: approved.length },
            { key: 'rejected', label: 'Rejected', count: rejected.length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">{tab.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {(activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : rejected).length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No verifications found
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email/Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documents</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : rejected).map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-gray-400 mr-3" />
                      <div>
                        <p className="font-medium">{item.profile?.fullName || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">ID: {item.uuid.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm">{item.email || 'N/A'}</p>
                    <p className="text-sm text-gray-500">{item.phone || 'N/A'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {item.role?.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {item.kycDocuments?.length || 0} documents
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    {activeTab === 'pending' && (
                      <div className="flex gap-2">
                        <button className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                          Approve
                        </button>
                        <button className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
