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
  ShieldCheck
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

const BackupManager = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await adminApi.listBackups();
      console.log('Backups API response:', res.data);
      setBackups(res.data.data || []);
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

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
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

      {/* Stats / Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <p className="text-xl font-black text-slate-900">{backups.length} / 10,000</p>
          </div>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Historique des Sauvegardes</h2>
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Filtrer par nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl w-64 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all font-medium text-xs shadow-sm"
            />
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
      </div>

      {/* Info Card */}
      <div className="bg-indigo-900 rounded-[32px] p-8 text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3">
            <h3 className="text-2xl font-black tracking-tight">Sécurité des Données</h3>
            <p className="text-indigo-200 font-medium max-w-xl">
              Chaque fichier de sauvegarde est un snapshot compressé (format .dump) qui contient l'intégralité de votre base de données. 
              En cas de besoin de restauration, contactez votre administrateur système.
            </p>
          </div>
          <div className="p-6 bg-white/10 rounded-[32px] backdrop-blur-md border border-white/10 flex items-center gap-4 shrink-0">
            <div className="p-3 bg-white/20 rounded-2xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs font-black text-indigo-200 uppercase tracking-widest">Alerte Rétention</p>
              <p className="text-lg font-black">99% d'espace libre</p>
            </div>
          </div>
        </div>
        
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-indigo-600 rounded-full blur-[100px] opacity-50" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-96 h-96 bg-indigo-400 rounded-full blur-[100px] opacity-30" />
      </div>
    </div>
  );
};

export default BackupManager;
