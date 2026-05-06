import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Trash2, 
  Play, 
  Clock, 
  HardDrive, 
  AlertCircle,
  CheckCircle2,
  FileCode,
  Search,
  RefreshCcw,
  ShieldCheck,
  RotateCcw,
  X,
  AlertTriangle
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const BackupManager = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ 
    totalSize: 0, 
    storage: { total: 0, free: 0, used: 0 },
    totalPages: 1,
    totalCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [confirmationText, setConfirmationText] = useState('');

  useEffect(() => {
    fetchBackups();
  }, [currentPage, startDate, endDate]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await adminApi.listBackups({
        page: currentPage,
        limit: 50,
        search,
        startDate,
        endDate
      });
      console.log('Backups API response:', res.data);
      const { backups: backupList, totalSize, storage, totalPages, totalCount } = res.data.data;
      setBackups(backupList || []);
      setStats({ totalSize, storage, totalPages, totalCount });
    } catch (error) {
      console.error('Failed to fetch backups:', error);
      toast.error('Erreur lors du chargement des sauvegardes');
    } finally {
      setLoading(false);
    }
  };

  const handleManualBackup = async () => {
    try {
      setTriggering(true);
      await adminApi.triggerBackup();
      toast.success('Sauvegarde effectuée avec succès');
      fetchBackups();
    } catch (error) {
      console.error('Manual backup failed:', error);
      toast.error('Échec de la sauvegarde manuelle');
    } finally {
      setTriggering(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette sauvegarde ?')) return;
    try {
      await adminApi.deleteBackup(filename);
      toast.success('Sauvegarde supprimée');
      fetchBackups();
    } catch (error) {
      console.error('Delete failed:', error);
       toast.error('Erreur lors de la suppression');
    }
  };

  const handleRestore = async () => {
    if (confirmationText !== 'RESTAURER') {
      toast.error('Veuillez taper "RESTAURER" pour confirmer');
      return;
    }

    const filename = selectedBackup;
    if (!filename) return;

    try {
      setShowRestoreModal(false);
      setRestoring(filename);
      const loadingToast = toast.loading('Restauration de la base de données en cours...');
      await adminApi.restoreBackup(filename);
      toast.dismiss(loadingToast);
      toast.success('Base de données restaurée avec succès !');
      fetchBackups();
    } catch (error) {
      console.error('Restoration failed:', error);
      toast.error('Échec de la restauration. Vérifiez les logs serveur.');
    } finally {
      setRestoring(null);
      setSelectedBackup(null);
      setConfirmationText('');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredBackups = backups.filter(b => b.filename.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
              <Database size={24} />
            </div>
            Gestionnaire de Sauvegardes
          </h1>
          <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-500" />
            Protection automatique de vos données toutes les minutes (Limite: 10,000 fichiers)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBackups}
            className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95"
            title="Rafraîchir"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleManualBackup}
            disabled={triggering}
            className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50"
          >
            {triggering ? <RefreshCcw size={18} className="animate-spin" /> : <Play size={18} />}
            Sauvegarder Maintenant
          </button>
        </div>
      </div>

      {/* Info Card - Storage Metrics */}
      <div className="bg-indigo-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3">
            <h3 className="text-2xl font-black tracking-tight">Sécurité des Données</h3>
            <p className="text-indigo-200 font-medium max-w-xl text-sm leading-relaxed">
              Chaque fichier de sauvegarde est un snapshot compressé (format .dump) qui contient l'intégralité de votre base de données. 
              En cas de besoin de restauration, contactez votre administrateur système.
            </p>
          </div>
          
          <div className="p-6 bg-white/10 rounded-[32px] backdrop-blur-md border border-white/10 flex items-center gap-5 shrink-0 min-w-[340px]">
            <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
              <HardDrive size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4 mb-3">
                <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">Stockage Serveur</p>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                  {stats.storage.total > 0 ? Math.round((stats.storage.free / stats.storage.total) * 100) : 0}% Libre
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                <div 
                  className="h-full bg-emerald-400 transition-all duration-1000 ease-out"
                  style={{ width: `${stats.storage.total > 0 ? (stats.storage.free / stats.storage.total) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-white/90">{formatSize(stats.storage.free)} libres</span>
                <span className="text-indigo-300">sur {formatSize(stats.storage.total)}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-indigo-600 rounded-full blur-[100px] opacity-40" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-96 h-96 bg-indigo-400 rounded-full blur-[100px] opacity-20" />
      </div>

      {/* Stats / Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">État du Système</p>
            <p className="text-xl font-black text-slate-900">Actif & Sécurisé</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Fréquence</p>
            <p className="text-xl font-black text-slate-900">1 Minute</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl">
            <HardDrive size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Total Fichiers</p>
            <p className="text-xl font-black text-slate-900">{stats.totalCount} / 10,000</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl">
            <Database size={24} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Taille Totale</p>
            <p className="text-xl font-black text-slate-900">{formatSize(stats.totalSize)}</p>
          </div>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Historique des Sauvegardes</h2>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Filters */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
              <Clock size={14} className="text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs font-bold focus:outline-none bg-transparent"
              />
              <span className="text-slate-300 text-xs font-black">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs font-bold focus:outline-none bg-transparent"
              />
              {(startDate || endDate) && (
                <button 
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setCurrentPage(1);
                  }}
                  className="ml-1 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {/* Search Bar */}
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
              <form onSubmit={(e) => {
                e.preventDefault();
                setCurrentPage(1);
                fetchBackups();
              }}>
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl w-48 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all font-medium text-xs shadow-sm"
                />
              </form>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/20 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Fichier</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Taille</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider">Date de Création</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-6"><div className="h-4 bg-slate-100 rounded-full w-full" /></td>
                  </tr>
                ))
              ) : filteredBackups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-500 font-bold">
                    Aucune sauvegarde trouvée
                  </td>
                </tr>
              ) : (
                filteredBackups.map((backup) => (
                  <tr key={backup.filename} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          <FileCode size={18} />
                        </div>
                        <span className="text-sm font-bold text-slate-900">{backup.filename}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-600">{formatSize(backup.size)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">
                        {format(new Date(backup.createdAt), 'dd MMMM yyyy', { locale: fr })}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {format(new Date(backup.createdAt), 'HH:mm:ss')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedBackup(backup.filename);
                            setShowRestoreModal(true);
                            setConfirmationText('');
                          }}
                          disabled={restoring !== null || triggering}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-100 transition-all shadow-sm border border-amber-100 disabled:opacity-50"
                          title="Restaurer cette sauvegarde"
                        >
                          {restoring === backup.filename ? <RefreshCcw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                          Restaurer
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem('accessToken');
                              const response = await fetch(adminApi.downloadBackupUrl(backup.filename), {
                                headers: {
                                  'Authorization': `Bearer ${token}`
                                }
                              });
                              if (!response.ok) throw new Error('Download failed');
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = backup.filename;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            } catch (error) {
                              console.error('Download failed:', error);
                              toast.error('Erreur lors du téléchargement');
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-100 transition-all shadow-sm border border-indigo-100"
                        >
                          <Download size={14} />
                          Télécharger
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.filename)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {!loading && stats.totalPages > 1 && (
          <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-bold text-slate-500">
              Affichage de <span className="text-slate-900 font-black">{(currentPage - 1) * 50 + 1}-{Math.min(currentPage * 50, stats.totalCount)}</span> sur <span className="text-slate-900 font-black">{stats.totalCount}</span>
            </p>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white disabled:opacity-50 transition-all"
              >
                Précédent
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, stats.totalPages) }).map((_, i) => {
                  let pageNum = i + 1;
                  // Show pages around current page if total pages > 5
                  if (stats.totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 3 + i + 1;
                    if (pageNum > stats.totalPages) pageNum = stats.totalPages - (4 - i);
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                        currentPage === pageNum 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(stats.totalPages, p + 1))}
                disabled={currentPage === stats.totalPages}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white disabled:opacity-50 transition-all"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-amber-500 p-8 text-white relative">
              <button 
                onClick={() => setShowRestoreModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-[24px] flex items-center justify-center mb-6">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-2xl font-black tracking-tight">Restauration Critique</h2>
              <p className="text-amber-100 font-medium mt-2">Opération irréversible sur la base de données</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-sm text-amber-900 font-medium leading-relaxed">
                  ⚠️ <span className="font-black">ATTENTION:</span> Vous êtes sur le point de restaurer le fichier :
                  <br />
                  <code className="bg-amber-100 px-2 py-0.5 rounded font-black text-amber-700 break-all mt-1 inline-block">
                    {selectedBackup}
                  </code>
                </p>
                <p className="text-xs text-amber-700 mt-3 font-bold">
                  Toute donnée créée après cette sauvegarde sera <span className="underline uppercase">définitivement perdue</span>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                  Confirmation de Sécurité
                </label>
                <p className="text-xs text-slate-500 mb-3 font-medium">
                  Pour confirmer, veuillez taper <span className="font-black text-slate-900">RESTAURER</span> ci-dessous :
                </p>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value.toUpperCase())}
                  placeholder="Tapez RESTAURER ici"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-black uppercase tracking-widest text-center"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRestore}
                  disabled={confirmationText !== 'RESTAURER'}
                  className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
                >
                  Confirmer la Restauration
                </button>
                <button
                  onClick={() => setShowRestoreModal(false)}
                  className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-[0.98]"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupManager;
