import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { productsApi, publicApi, adminApi } from '../../lib/api';
import AddProductModal from '../grosseller/AddProductModal';
import toast from 'react-hot-toast';
import { 
  Trash2, Pencil, Package, ChevronLeft, ChevronRight, 
  ShieldAlert, Search, Plus, Filter, LayoutGrid, 
  List as ListIcon, Calendar, DollarSign, Tag, Eye,
  Clock, CheckCircle
} from 'lucide-react';

export default function AdminProducts() {
  const { user } = useAuth();

  // Permission Guard for Helpers
  if (user?.role === 'HELPER' && !user?.canManageProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-rose-100 animate-in zoom-in duration-500">
          <ShieldAlert size={48} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Accès Restreint</h2>
        <p className="text-slate-500 max-w-md mb-8 font-medium leading-relaxed">
          Vous n'avez pas les habilitations nécessaires pour accéder au catalogue. Contactez votre superviseur.
        </p>
        <Link 
          to="/helper" 
          className="group relative px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-slate-200 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          <span className="relative">Retour au Tableau de Bord</span>
        </Link>
      </div>
    );
  }

  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => publicApi.categories(),
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => adminApi.users({ role: 'VENDOR', limit: 1000 }),
  });

  const { data: influencersData } = useQuery({
    queryKey: ['influencers'],
    queryFn: () => adminApi.users({ role: 'INFLUENCER', limit: 1000 }),
  });

  const productOwners = [
    ...(vendorsData?.data?.data?.users || []),
    ...(influencersData?.data?.data?.users || []),
  ];

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', { category: selectedCategory, status: statusFilter, page, search }],
    queryFn: () => productsApi.list({ 
      category: selectedCategory || undefined, 
      status: statusFilter, 
      page, 
      limit,
      search: search || undefined
    }),
  });

  const pagination = data?.data?.data?.pagination;

  const handleStatusChange = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await productsApi.updateStatus(id, { status });
      toast.success(`Produit ${status === 'APPROVED' ? 'approuvé' : 'rejeté'}`);
      refetch();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleEdit = async (product: any) => {
    try {
      const response = await productsApi.get(product.id.toString());
      setEditingProduct(response.data.data.product);
    } catch (error) {
      setEditingProduct(product);
    }
  };



  const categories = categoriesData?.data?.data?.categories || [];
  const products = data?.data?.data?.products || [];

  return (
    <div className="space-y-8 pb-12">
      {/* Premium Header Area */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-violet-600 rounded-3xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200 flex-shrink-0 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
              <Package size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Catalogue Produits</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-200/50">
                  <Filter size={12} /> Gestion Global
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 bg-primary-50 text-primary-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-primary-100/50">
                  <Tag size={12} /> {pagination?.total || 0} Produits
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsAddProductModalOpen(true)} 
            className="relative group/btn overflow-hidden px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-slate-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-violet-600 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
            <Plus size={20} className="relative z-10" />
            <span className="relative z-10">NOUVEAU PRODUIT</span>
          </button>
        </div>
      </div>

      {/* Glassmorphism Filters Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Search */}
        <div className="xl:col-span-4 relative group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Rechercher par nom, SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-14 pr-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all shadow-lg shadow-slate-100"
          />
        </div>

        {/* Status Scroller */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-lg shadow-slate-100 flex items-center overflow-x-auto scrollbar-hide gap-1">
          {[
            { id: 'ALL', label: 'TOUS LES PRODUITS', icon: <Package size={16} /> }, 
            { id: 'PENDING', label: 'EN ATTENTE', icon: <Clock size={16} /> }, 
            { id: 'APPROVED', label: 'APPROUVÉS', icon: <CheckCircle size={16} /> }, 
            { id: 'REJECTED', label: 'REJETÉS', icon: <Trash2 size={16} /> }
          ].map((status) => (
            <button
              key={status.id}
              onClick={() => { setStatusFilter(status.id); setPage(1); }}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${
                statusFilter === status.id
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 scale-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 scale-95'
              }`}
            >
              {status.icon}
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Scroller */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => { setSelectedCategory(''); setPage(1); }}
          className={`px-5 py-2.5 rounded-xl whitespace-nowrap text-[11px] font-black tracking-wider transition-all border ${
            !selectedCategory 
              ? 'bg-primary-50 text-primary-700 border-primary-200 shadow-sm' 
              : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
          }`}
        >
          TOUTES CATÉGORIES
        </button>
        {categories.map((cat: any) => (
          <button
            key={cat.id}
            onClick={() => { setSelectedCategory(cat.slug); setPage(1); }}
            className={`px-5 py-2.5 rounded-xl whitespace-nowrap text-[11px] font-black tracking-wider transition-all border ${
              selectedCategory === cat.slug 
                ? 'bg-primary-50 text-primary-700 border-primary-200 shadow-sm' 
                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
            }`}
          >
            {cat.nameFr.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Pro Table Section */}
      <div className="relative group/table">
        <div className="absolute -inset-2 bg-gradient-to-b from-slate-100 to-transparent rounded-[2.5rem] opacity-50 pointer-events-none" />
        <div className="relative bg-white border border-slate-200/60 rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-200/30">
          <div className="overflow-x-auto scrollbar-pro">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="text-left py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Produit</th>
                  <th className="text-left py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Vendeur</th>
                  <th className="text-left py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">SKU & Cat</th>
                  <th className="text-left py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date de Création</th>
                  <th className="text-left py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tarification</th>
                  <th className="text-left py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Visibilité</th>
                  <th className="text-left py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Statut</th>
                  <th className="text-right py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="py-8 px-6"><div className="h-12 bg-slate-100 rounded-2xl w-full" /></td>
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-24 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mb-4">
                          <Package size={40} />
                        </div>
                        <p className="text-slate-400 font-bold">Aucun produit trouvé</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map((product: any) => (
                    <tr key={product.id} className="group/row hover:bg-slate-50/50 transition-all duration-300">
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-white rounded-2xl shadow-lg shadow-slate-200 border border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 relative group-hover/row:scale-105 transition-transform duration-500">
                            {product.primaryImage ? (
                              <img src={product.primaryImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package size={24} className="text-slate-200" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 text-sm truncate max-w-[200px] mb-1 leading-tight">{product.nameFr}</div>
                            <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                              <Tag size={10} /> {product.sku}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-primary-600/60 uppercase tracking-tighter leading-none mb-1">PROPRIÉTAIRE</span>
                          <span className="text-xs font-bold text-slate-700">{product.ownerName || 'Système'}</span>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {product.categories?.map((c: any, idx: number) => (
                            <span key={idx} className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-white border border-slate-200 text-slate-500 uppercase tracking-tighter">
                              {c.nameFr}
                            </span>
                          )) || <span className="text-[10px] text-slate-300 italic">Sans cat.</span>}
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-slate-100 rounded-xl text-slate-400">
                            <Calendar size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900">
                              {product.createdAt ? format(new Date(product.createdAt), 'dd MMM yyyy') : '—'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              À {product.createdAt ? format(new Date(product.createdAt), 'HH:mm') : '—'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-8 text-[9px] font-black text-slate-300">COÛT</span>
                            <span className="text-xs font-black text-slate-600">{Number(product.baseCostMad).toLocaleString()} MAD</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-8 text-[9px] font-black text-primary-400">VTE</span>
                            <span className="text-xs font-black text-primary-600">{Number(product.retailPriceMad).toLocaleString()} MAD</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex gap-1 flex-wrap max-w-[120px]">
                          {product.visibility?.map((vis: string) => (
                            <span key={vis} className={`px-2 py-1 text-[8px] font-black rounded-md border tracking-tighter ${
                              vis === 'REGULAR' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                              vis === 'AFFILIATE' ? 'bg-purple-50 text-purple-600 border-purple-100' : 
                              vis === 'INFLUENCER' ? 'bg-pink-50 text-pink-600 border-pink-100' : 
                              'bg-slate-50 text-slate-500 border-slate-100'
                            }`}>
                              {vis}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest border transition-all ${
                          product.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm shadow-emerald-50' : 
                          product.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100 shadow-sm shadow-amber-50' : 
                          'bg-rose-50 text-rose-700 border-rose-100 shadow-sm shadow-rose-50'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            product.status === 'APPROVED' ? 'bg-emerald-500 animate-pulse' : 
                            product.status === 'PENDING' ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          {product.status === 'APPROVED' ? 'ACTIF' : product.status === 'PENDING' ? 'ATTENTE' : 'REJETÉ'}
                        </div>
                      </td>
                      <td className="py-5 px-8 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {product.status === 'PENDING' && (
                            <div className="flex items-center gap-1 pr-2 mr-2 border-r border-slate-100">
                              <button 
                                onClick={() => handleStatusChange(product.id, 'APPROVED')}
                                className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-emerald-200"
                                title="Approuver"
                              >
                                <CheckCircle size={14} />
                              </button>
                              <button 
                                onClick={() => handleStatusChange(product.id, 'REJECTED')}
                                className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-rose-200"
                                title="Rejeter"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                          
                          <button 
                            onClick={() => handleEdit(product)}
                            className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all group/btn2"
                            title="Modifier"
                          >
                            <Pencil size={16} className="group-hover/btn2:rotate-12 transition-transform" />
                          </button>

             
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pro Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-8 py-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Page</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-900 shadow-sm">{pagination.page}</span>
                  <span className="text-[10px] font-black text-slate-300">/</span>
                  <span className="text-[10px] font-black text-slate-400">{pagination.totalPages}</span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
                  disabled={pagination.page === 1}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black tracking-widest text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
                >
                  <ChevronLeft size={14} /> PRÉCÉDENT
                </button>
                <button
                  onClick={() => { setPage(p => Math.min(pagination.totalPages, p + 1)); window.scrollTo(0, 0); }}
                  disabled={pagination.page === pagination.totalPages}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black tracking-widest text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
                >
                  SUIVANT <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals remain same logic but could be updated too if needed */}
      <AddProductModal 
        isOpen={isAddProductModalOpen || !!editingProduct} 
        onClose={() => { setIsAddProductModalOpen(false); setEditingProduct(null); }} 
        onSuccess={() => refetch()} 
        isAdmin={true} 
        vendors={productOwners}
        editProduct={editingProduct}
      />
    </div>
  );
}
