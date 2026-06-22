import { useState, useEffect, useCallback, useMemo } from 'react';
import { securityApi } from '../../../lib/api';
import toast from 'react-hot-toast';
import { Database, HardDrive, Table2, ArrowUpDown, ArrowUp, ArrowDown, Plug, BarChart3, RefreshCw } from 'lucide-react';

const S = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

type SortKey = 'name' | 'totalBytes' | 'rowCount' | 'totalOps' | 'inserts' | 'updates' | 'deletes';
type SortDir = 'asc' | 'desc';

export default function ModDataProtection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('totalBytes');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = useCallback(async () => {
    try {
      const res = await securityApi.getDatabaseStats();
      setData(res.data.data);
    } catch {
      toast.error('Failed to load database stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedTables = useMemo(() => {
    if (!data?.tables) return [];
    return [...data.tables].sort((a: any, b: any) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data?.tables, sortKey, sortDir]);

  const biggestTable = useMemo(() => {
    if (!data?.tables?.length) return null;
    return [...data.tables].sort((a: any, b: any) => b.totalBytes - a.totalBytes)[0];
  }, [data?.tables]);

  const busiestTable = useMemo(() => {
    if (!data?.tables?.length) return null;
    return [...data.tables].sort((a: any, b: any) => b.totalOps - a.totalOps)[0];
  }, [data?.tables]);

  const mostRows = useMemo(() => {
    if (!data?.tables?.length) return null;
    return [...data.tables].sort((a: any, b: any) => b.rowCount - a.rowCount)[0];
  }, [data?.tables]);

  if (loading) return <div className="text-slate-500 text-sm text-center py-20 animate-pulse">Querying PostgreSQL system catalogs...</div>;
  if (!data) return null;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={11} className="text-slate-600" />;
    return sortDir === 'asc' ? <ArrowUp size={11} className="text-teal-400" /> : <ArrowDown size={11} className="text-teal-400" />;
  };

  const fmtNum = (n: number) => n.toLocaleString();

  // Compute size bar width for visual comparison
  const maxBytes = biggestTable?.totalBytes || 1;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={S + ' text-center'}>
          <HardDrive size={20} className="text-teal-400 mx-auto mb-2" />
          <p className="text-2xl font-black text-white">{data.database.totalSize}</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Database Size</p>
        </div>
        <div className={S + ' text-center'}>
          <Table2 size={20} className="text-cyan-400 mx-auto mb-2" />
          <p className="text-2xl font-black text-white">{data.database.tableCount}</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Total Tables</p>
        </div>
        <div className={S + ' text-center'}>
          <Plug size={20} className="text-violet-400 mx-auto mb-2" />
          <p className="text-2xl font-black text-white">{data.connections.total}</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Connections</p>
          <p className="text-[9px] text-slate-600 mt-0.5">
            <span className="text-emerald-500">{data.connections.active} active</span> · {data.connections.idle} idle
          </p>
        </div>
        <div className={S + ' text-center'}>
          <BarChart3 size={20} className="text-amber-400 mx-auto mb-2" />
          <p className="text-2xl font-black text-white">
            {fmtNum(data.tables.reduce((s: number, t: any) => s + t.rowCount, 0))}
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Total Rows</p>
        </div>
      </div>

      {/* Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {biggestTable && (
          <div className={S + ' border-teal-500/30'}>
            <p className="text-[10px] text-teal-400 font-bold uppercase mb-1">🏋️ Largest Table</p>
            <p className="text-lg font-black text-white font-mono">{biggestTable.name}</p>
            <p className="text-sm text-slate-400">{biggestTable.totalSize} · {fmtNum(biggestTable.rowCount)} rows</p>
          </div>
        )}
        {busiestTable && (
          <div className={S + ' border-amber-500/30'}>
            <p className="text-[10px] text-amber-400 font-bold uppercase mb-1">🔥 Most Active Table</p>
            <p className="text-lg font-black text-white font-mono">{busiestTable.name}</p>
            <p className="text-sm text-slate-400">
              {fmtNum(busiestTable.totalOps)} total ops
              <span className="text-[10px] ml-2 text-slate-500">
                ({fmtNum(busiestTable.inserts)} INS · {fmtNum(busiestTable.updates)} UPD · {fmtNum(busiestTable.deletes)} DEL)
              </span>
            </p>
          </div>
        )}
        {mostRows && (
          <div className={S + ' border-cyan-500/30'}>
            <p className="text-[10px] text-cyan-400 font-bold uppercase mb-1">📊 Most Records</p>
            <p className="text-lg font-black text-white font-mono">{mostRows.name}</p>
            <p className="text-sm text-slate-400">{fmtNum(mostRows.rowCount)} rows · {mostRows.totalSize}</p>
          </div>
        )}
      </div>

      {/* Tables Inventory */}
      <div className={S}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database size={16} className="text-teal-400" /> All Tables
          </h3>
          <button onClick={() => { setLoading(true); load(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-300 transition-all">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="pb-3 pr-4 cursor-pointer select-none" onClick={() => handleSort('name')}>
                  <span className="flex items-center gap-1">Table <SortIcon col="name" /></span>
                </th>
                <th className="pb-3 pr-4 cursor-pointer select-none" onClick={() => handleSort('totalBytes')}>
                  <span className="flex items-center gap-1">Size <SortIcon col="totalBytes" /></span>
                </th>
                <th className="pb-3 pr-4">Size Bar</th>
                <th className="pb-3 pr-4 cursor-pointer select-none" onClick={() => handleSort('rowCount')}>
                  <span className="flex items-center gap-1">Rows <SortIcon col="rowCount" /></span>
                </th>
                <th className="pb-3 pr-4 cursor-pointer select-none" onClick={() => handleSort('inserts')}>
                  <span className="flex items-center gap-1">INS <SortIcon col="inserts" /></span>
                </th>
                <th className="pb-3 pr-4 cursor-pointer select-none" onClick={() => handleSort('updates')}>
                  <span className="flex items-center gap-1">UPD <SortIcon col="updates" /></span>
                </th>
                <th className="pb-3 pr-4 cursor-pointer select-none" onClick={() => handleSort('deletes')}>
                  <span className="flex items-center gap-1">DEL <SortIcon col="deletes" /></span>
                </th>
                <th className="pb-3 pr-4 cursor-pointer select-none" onClick={() => handleSort('totalOps')}>
                  <span className="flex items-center gap-1">Total Ops <SortIcon col="totalOps" /></span>
                </th>
                <th className="pb-3 pr-4">Index Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs">
              {sortedTables.map((t: any) => {
                const sizePercent = maxBytes > 0 ? (t.totalBytes / maxBytes) * 100 : 0;
                const isHot = t.totalOps === busiestTable?.totalOps && t.totalOps > 0;
                const isBig = t.totalBytes === biggestTable?.totalBytes && t.totalBytes > 0;
                return (
                  <tr key={t.name} className={`hover:bg-slate-800/30 ${isHot ? 'bg-amber-500/5' : ''}`}>
                    <td className="py-3 pr-4">
                      <span className="font-mono font-semibold text-white">{t.name}</span>
                      {isBig && <span className="ml-1.5 text-[8px] px-1.5 py-0.5 bg-teal-500/20 text-teal-400 rounded-full font-bold">LARGEST</span>}
                      {isHot && <span className="ml-1.5 text-[8px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-bold">BUSIEST</span>}
                    </td>
                    <td className="py-3 pr-4 text-slate-300 font-mono">{t.totalSize}</td>
                    <td className="py-3 pr-4 min-w-[120px]">
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isBig ? 'bg-teal-500' : 'bg-slate-600'}`}
                          style={{ width: `${Math.max(sizePercent, 1)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-300 font-mono">{fmtNum(t.rowCount)}</td>
                    <td className="py-3 pr-4 text-emerald-400/80 font-mono">{fmtNum(t.inserts)}</td>
                    <td className="py-3 pr-4 text-amber-400/80 font-mono">{fmtNum(t.updates)}</td>
                    <td className="py-3 pr-4 text-rose-400/80 font-mono">{fmtNum(t.deletes)}</td>
                    <td className="py-3 pr-4 text-white font-mono font-bold">{fmtNum(t.totalOps)}</td>
                    <td className="py-3 pr-4 text-slate-500 font-mono text-[10px]">{t.indexSize}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
