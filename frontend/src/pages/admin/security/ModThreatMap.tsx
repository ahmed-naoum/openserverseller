import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { securityApi } from '../../../lib/api';
import { useSocket } from '../../../contexts/SocketContext';
import toast from 'react-hot-toast';
import { Globe, Shield, RefreshCw, ChevronLeft, ChevronRight, Activity, Cpu } from 'lucide-react';

const CardStyle = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';

const FLAGS: Record<string, string> = {
  MA: '🇲🇦', BR: '🇧🇷', US: '🇺🇸', CL: '🇨🇱', IN: '🇮🇳',
  NL: '🇳🇱', IT: '🇮🇹', CA: '🇨🇦', YE: '🇾🇪', BE: '🇧🇪',
  FR: '🇫🇷', AE: '🇦🇪', DE: '🇩🇪', CN: '🇨🇳', SG: '🇸🇬',
  GB: '🇬🇧', FI: '🇫🇮', JP: '🇯🇵', TW: '🇹🇼', HK: '🇭🇰',
  BD: '🇧🇩', UA: '🇺🇦'
};

// Map size and projection config
const MAP_WIDTH = 900;
const MAP_HEIGHT = 450;

function project(lon: number, lat: number) {
  // Equirectangular (Plate Carrée) projection mapping
  const x = ((lon + 180) * MAP_WIDTH) / 360;
  // Shift slightly up to center non-polar continents
  const y = ((90 - lat) * MAP_HEIGHT) / 180;
  return { x, y };
}

// Convert GeoJSON geometry to SVG Path string
function geoJsonToSvgPath(geometry: any): string {
  if (!geometry) return '';

  const projectPoint = (coord: [number, number]) => {
    const { x, y } = project(coord[0], coord[1]);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring: any) => {
      return 'M ' + ring.map(projectPoint).join(' L ') + ' Z';
    }).join(' ');
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((polygon: any) => {
      return polygon.map((ring: any) => {
        return 'M ' + ring.map(projectPoint).join(' L ') + ' Z';
      }).join(' ');
    }).join(' ');
  }
  return '';
}

// Calculate the geographic centroid of a GeoJSON country feature
function getCountryCentroid(geometry: any) {
  if (!geometry) return null;

  const getPolygonCentroid = (polygon: any) => {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    polygon.forEach((ring: any) => {
      ring.forEach((pt: any) => {
        const { x, y } = project(pt[0], pt[1]);
        sumX += x;
        sumY += y;
        count++;
      });
    });
    return count > 0 ? { x: sumX / count, y: sumY / count } : null;
  };

  if (geometry.type === 'Polygon') {
    return getPolygonCentroid(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    // Find the polygon with the maximum number of points (representing the main landmass)
    let maxPoints = 0;
    let mainPolygon = null;
    
    geometry.coordinates.forEach((polygon: any) => {
      let pointsCount = 0;
      polygon.forEach((ring: any) => { pointsCount += ring.length; });
      if (pointsCount > maxPoints) {
        maxPoints = pointsCount;
        mainPolygon = polygon;
      }
    });

    return mainPolygon ? getPolygonCentroid(mainPolygon) : null;
  }
  return null;
}

function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;
  const width = 120;
  const height = 30;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function ModThreatMap() {
  const [data, setData] = useState<any>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredCountry, setHoveredCountry] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [expandedIp, setExpandedIp] = useState<string | null>(null);
  const [expandedPathKey, setExpandedPathKey] = useState<string | null>(null);
  const { socket } = useSocket();

  const groupedRequests = useMemo(() => {
    if (!data?.recentRequests) return [];
    const groups: Record<string, any[]> = {};
    data.recentRequests.forEach((req: any) => {
      if (!groups[req.ip]) groups[req.ip] = [];
      groups[req.ip].push(req);
    });
    // Sort IPs by the timestamp of their most recent request
    return Object.entries(groups).sort((a, b) => {
      const maxA = Math.max(...a[1].map(r => new Date(r.timestamp).getTime()));
      const maxB = Math.max(...b[1].map(r => new Date(r.timestamp).getTime()));
      return maxB - maxA;
    });
  }, [data?.recentRequests]);

  const errorRequests = useMemo(() => {
    if (!data?.recentRequests) return [];
    const errors = data.recentRequests.filter((req: any) => req.status >= 400);
    
    const groups: Record<string, any> = {};
    errors.forEach((req: any) => {
      const key = `${req.ip}-${req.method}-${req.path}-${req.status}`;
      if (!groups[key]) {
        groups[key] = { ...req, count: 1, lastTimestamp: new Date(req.timestamp).getTime() };
      } else {
        groups[key].count += 1;
        groups[key].lastTimestamp = Math.max(groups[key].lastTimestamp, new Date(req.timestamp).getTime());
      }
    });

    return Object.values(groups).sort((a: any, b: any) => b.lastTimestamp - a.lastTimestamp);
  }, [data?.recentRequests]);

  // Load geo map boundaries locally
  useEffect(() => {
    fetch('/world-countries.json')
      .then(r => r.json())
      .then(json => {
        // Filter out Antarctica to maximize center visibility
        if (json && json.features) {
          json.features = json.features.filter((f: any) => f.properties?.name !== 'Antarctica');
        }
        setGeoData(json);
      })
      .catch(err => console.error('Failed to load world map GeoJSON outline:', err));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await securityApi.getAnalytics();
      setData(res.data.data);
    } catch {
      toast.error('Failed to load global threat analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time update via WebSockets
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      load();
    };
    const handleActiveUsers = (payload: any) => {
      if (payload && payload.details) {
        setActiveSessions(payload.details);
      }
    };
    socket.on('security_event', handleUpdate);
    socket.on('security:update', handleUpdate);
    socket.on('active_users:update', handleActiveUsers);
    return () => {
      socket.off('security_event', handleUpdate);
      socket.off('security:update', handleUpdate);
      socket.off('active_users:update', handleActiveUsers);
    };
  }, [socket, load]);

  // Compute centroids mapping for loaded countries in dataset
  const countryCoords = useMemo(() => {
    const coords: Record<string, { x: number; y: number }> = {};
    if (!geoData) return coords;

    geoData.features.forEach((feature: any) => {
      const code = feature.properties?.iso_a2?.toUpperCase();
      if (code) {
        const centroid = getCountryCentroid(feature.geometry);
        if (centroid) {
          coords[code] = centroid;
        }
      }
    });

    return coords;
  }, [geoData]);

  if (loading) {
    return (
      <div className="text-slate-500 text-sm text-center py-20 animate-pulse">
        Loading Global Threat Intelligence Map...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-red-400 text-sm text-center py-20">
        Failed to connect to analytics services.
      </div>
    );
  }

  const { summary, countries, security, cache, errors, network, statusCodesBar, rankings } = data;

  const pageSize = 10;
  const paginatedCountries = countries.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(countries.length / pageSize);

  // Dynamic status codes bar ratios
  const totalStatusCodes = 
    statusCodesBar.code2xx.count + 
    statusCodesBar.code3xx.count + 
    statusCodesBar.code4xx.count + 
    statusCodesBar.code5xx.count;

  const codeRatios = {
    pct2xx: totalStatusCodes > 0 ? (statusCodesBar.code2xx.count / totalStatusCodes) * 100 : 0,
    pct3xx: totalStatusCodes > 0 ? (statusCodesBar.code3xx.count / totalStatusCodes) * 100 : 0,
    pct4xx: totalStatusCodes > 0 ? (statusCodesBar.code4xx.count / totalStatusCodes) * 100 : 0,
    pct5xx: totalStatusCodes > 0 ? (statusCodesBar.code5xx.count / totalStatusCodes) * 100 : 0,
  };

  const moroccoCenter = countryCoords['MA'] || { x: 426.3, y: 153.1 };

  return (
    <div className="space-y-6">
      {/* 4 Summary Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Requests', val: summary.requests.value, change: summary.requests.change, spark: summary.requests.sparkline, color: '#3b82f6' },
          { label: 'Bandwidth', val: summary.bandwidth.value, change: summary.bandwidth.change, spark: summary.bandwidth.sparkline, color: '#10b981' },
          { label: 'Visits', val: summary.visits.value, change: summary.visits.change, spark: summary.visits.sparkline, color: '#f59e0b' },
          { label: 'Page views', val: summary.pageViews.value, change: summary.pageViews.change, spark: summary.pageViews.sparkline, color: '#8b5cf6' },
        ].map((item, idx) => (
          <div key={idx} className={CardStyle + ' flex flex-col justify-between'}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.label}</span>
              <span className={`text-[10px] font-bold ${item.change.startsWith('↗') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {item.change}
              </span>
            </div>
            <div className="flex items-end justify-between mt-4">
              <span className="text-2xl font-black text-white">{item.val}</span>
              <Sparkline data={item.spark} color={item.color} />
            </div>
          </div>
        ))}
      </div>

      {/* World Map & Sidebar Table */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* World Map SVG */}
        <div className={CardStyle + ' xl:col-span-2 relative flex flex-col justify-between'}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe size={16} className="text-emerald-400" /> Global Threat Heatmap (Live Traffic & Attacks)
            </h3>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 animate-pulse">
              LIVE BROADCAST
            </span>
          </div>

          <div className="relative w-full h-[400px] bg-slate-950/40 rounded-xl overflow-hidden border border-slate-800/50 flex items-center justify-center">
            {/* World Map Grid */}
            <svg
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              className="w-full h-full text-slate-800"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltipPos({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top
                });
              }}
            >
              {/* Actual outline-mapped world geography paths */}
              {geoData && geoData.features.map((feature: any, idx: number) => {
                const code = feature.properties?.iso_a2?.toUpperCase();
                const isHovered = hoveredCountry?.code === code;
                const pathStr = geoJsonToSvgPath(feature.geometry);
                if (!pathStr) return null;

                return (
                  <path
                    key={`country-${idx}`}
                    d={pathStr}
                    fill={isHovered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.4)'}
                    stroke={isHovered ? '#10b981' : 'rgba(71, 85, 105, 0.2)'}
                    strokeWidth="1"
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => {
                      const matched = countries.find((c: any) => c.code === code);
                      if (matched) setHoveredCountry(matched);
                    }}
                    onMouseLeave={() => setHoveredCountry(null)}
                  />
                );
              })}

              {/* Dynamic Bezier curved attack paths targeting Morocco (MA) */}
              {countries.filter((c: any) => c.code !== 'MA' && c.requests > 0).slice(0, 10).map((c: any, idx: number) => {
                const start = countryCoords[c.code];
                if (!start) return null;
                const controlX = (start.x + moroccoCenter.x) / 2;
                const controlY = Math.min(start.y, moroccoCenter.y) - 60;

                return (
                  <path
                    key={`line-${idx}`}
                    d={`M ${start.x} ${start.y} Q ${controlX} ${controlY} ${moroccoCenter.x} ${moroccoCenter.y}`}
                    fill="none"
                    stroke="rgba(239, 68, 68, 0.25)"
                    strokeWidth="1.5"
                    strokeDasharray="6 6"
                    className="animate-[dash_10s_linear_infinite]"
                  />
                );
              })}

              {/* Active hot-nodes glow effect and pin positioning */}
              {countries.filter((c: any) => c.requests > 0).map((c: any) => {
                const coord = countryCoords[c.code] || (c.code === 'LOCALIP' ? countryCoords['MA'] : null);
                if (!coord) return null;
                const isMorocco = c.code === 'MA' || c.code === 'LOCALIP';
                const isHovered = hoveredCountry?.code === c.code;

                return (
                  <g key={c.code} className="cursor-pointer"
                    onMouseEnter={() => setHoveredCountry(c)}
                    onMouseLeave={() => setHoveredCountry(null)}>
                    {/* Pulsing Threat Wave */}
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={isMorocco ? 14 : Math.min(20, 5 + c.requests * 0.015)}
                      fill={isMorocco ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}
                      className={isMorocco ? 'animate-ping' : 'animate-pulse'}
                    />
                    {/* Node Center Pin */}
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={isMorocco ? 5 : 4}
                      fill={isMorocco ? '#10b981' : isHovered ? '#f43f5e' : '#ef4444'}
                      className="transition-all duration-300"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Card placed relative to cursor */}
            {hoveredCountry && (
              <div className="absolute bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl z-20 pointer-events-none transition-all duration-75"
                style={{
                  top: `${tooltipPos.y}px`,
                  left: `${tooltipPos.x}px`,
                  transform: 'translate(-50%, -110%)'
                }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm">{FLAGS[hoveredCountry.code] || '🌐'}</span>
                  <span className="text-xs font-bold text-white">{hoveredCountry.name}</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <p className="text-slate-400">Requests: <span className="text-white font-mono font-bold">{hoveredCountry.requests}</span></p>
                  <p className="text-slate-400">Bandwidth: <span className="text-white font-mono font-bold">{hoveredCountry.bandwidth}</span></p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Data Table */}
        <div className={CardStyle + ' flex flex-col justify-between'}>
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">
              Requests by Country
            </h3>
            <div className="divide-y divide-slate-800/60">
              {paginatedCountries.map((c: any) => (
                <div key={c.code} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-800/10 px-1 rounded">
                  <div className="flex items-center gap-2 w-28">
                    <span>{FLAGS[c.code] || '🌐'}</span>
                    <span className="font-semibold text-slate-300 truncate" title={c.name}>{c.name}</span>
                  </div>
                  <div className="text-right w-12">
                    <span className="font-mono font-bold text-white">{c.requests}</span>
                  </div>
                  <div className="hidden sm:block">
                    <Sparkline data={c.reqSparkline} color="#ef4444" />
                  </div>
                  <div className="text-right font-mono font-bold text-slate-400 w-20">
                    {c.bandwidth}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-4 text-[10px] font-bold text-slate-500">
            <span>{page * pageSize + 1} to {Math.min(countries.length, (page + 1) * pageSize)} of {countries.length} items</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1 rounded bg-slate-950 border border-slate-800 hover:text-white disabled:opacity-50">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="p-1 rounded bg-slate-950 border border-slate-800 hover:text-white disabled:opacity-50">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cloudflare Detail panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Summary Panel */}
        <div className={CardStyle + ' space-y-4'}>
          <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
            <span>Security Layer</span>
            <Shield size={12} className="text-blue-400" />
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Encrypted requests', val: security.encryptedRequests.value, change: security.encryptedRequests.change, spark: security.encryptedRequests.sparkline },
              { label: 'Encrypted requests rate', val: security.encryptedRequestsRate.value, change: security.encryptedRequestsRate.change, spark: security.encryptedRequestsRate.sparkline },
              { label: 'Encrypted bandwidth', val: security.encryptedBandwidth.value, change: security.encryptedBandwidth.change, spark: security.encryptedBandwidth.sparkline },
              { label: 'Encrypted bandwidth rate', val: security.encryptedBandwidthRate.value, change: security.encryptedBandwidthRate.change, spark: security.encryptedBandwidthRate.sparkline },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{item.label}</p>
                  <p className="text-base font-black text-white mt-1">{item.val}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold ${item.change.startsWith('↗') ? 'text-emerald-400' : 'text-rose-400'}`}>{item.change}</span>
                  <div className="mt-1"><Sparkline data={item.spark} color="#3b82f6" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cache Summary Panel */}
        <div className={CardStyle + ' space-y-4'}>
          <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
            <span>Cache Efficiency</span>
            <Activity size={12} className="text-emerald-400" />
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Cached requests', val: cache.cachedRequests.value, change: cache.cachedRequests.change, spark: cache.cachedRequests.sparkline },
              { label: 'Cached requests rate', val: cache.cachedRequestsRate.value, change: cache.cachedRequestsRate.change, spark: cache.cachedRequestsRate.sparkline },
              { label: 'Cached bandwidth', val: cache.cachedBandwidth.value, change: cache.cachedBandwidth.change, spark: cache.cachedBandwidth.sparkline },
              { label: 'Cached bandwidth rate', val: cache.cachedBandwidthRate.value, change: cache.cachedBandwidthRate.change, spark: cache.cachedBandwidthRate.sparkline },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{item.label}</p>
                  <p className="text-base font-black text-white mt-1">{item.val}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold ${item.change.startsWith('↗') ? 'text-emerald-400' : 'text-rose-400'}`}>{item.change}</span>
                  <div className="mt-1"><Sparkline data={item.spark} color="#10b981" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Errors Summary Panel */}
        <div className={CardStyle + ' space-y-4'}>
          <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
            <span>Error Diagnostics</span>
            <Cpu size={12} className="text-rose-400" />
          </h3>
          <div className="space-y-4">
            {[
              { label: '4xx errors', val: errors.errors4xx.value, change: errors.errors4xx.change, spark: errors.errors4xx.sparkline },
              { label: '4xx error rate', val: errors.errors4xxRate.value, change: errors.errors4xxRate.change, spark: errors.errors4xxRate.sparkline },
              { label: '5xx errors', val: errors.errors5xx.value, change: errors.errors5xx.change, spark: errors.errors5xx.sparkline },
              { label: '5xx error rate', val: errors.errors5xxRate.value, change: errors.errors5xxRate.change, spark: errors.errors5xxRate.sparkline },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{item.label}</p>
                  <p className="text-base font-black text-white mt-1">{item.val}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold ${item.change.startsWith('↗') ? 'text-emerald-400' : 'text-rose-400'}`}>{item.change}</span>
                  <div className="mt-1"><Sparkline data={item.spark} color="#ef4444" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Network & HTTP Versions */}
      <div className={CardStyle + ' space-y-5'}>
        <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">
          Network Protocols & Traffic served
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Client HTTP Version Used */}
          <div className="space-y-3">
            <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Client HTTP Version Used</h4>
            <div className="space-y-2">
              {network.httpVersions.map((v: any, i: number) => (
                <div key={i} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 font-semibold">{v.label}</span>
                    <span className="text-white font-bold">{v.value}</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${v.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic Served Over SSL */}
          <div className="space-y-3">
            <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Traffic Served Over SSL</h4>
            <div className="space-y-2">
              {network.sslTraffic.map((v: any, i: number) => (
                <div key={i} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 font-semibold">{v.label}</span>
                    <span className="text-white font-bold">{v.value}</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${v.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Content Types */}
          <div className="space-y-3">
            <h4 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Top Content Types</h4>
            <div className="space-y-2">
              {network.contentTypes.map((v: any, i: number) => (
                <div key={i} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 font-semibold">{v.label}</span>
                    <span className="text-white font-bold">{v.value}</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-violet-500 h-full rounded-full" style={{ width: `${v.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HTTP Status Codes Breakdown */}
      <div className={CardStyle + ' space-y-4'}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-white">Status Codes</h3>
          <div className="flex gap-4 text-[10px] font-bold">
            <span className="text-blue-400">2xx: {statusCodesBar.code2xx.value}</span>
            <span className="text-amber-400">3xx: {statusCodesBar.code3xx.value}</span>
            <span className="text-rose-400">4xx: {statusCodesBar.code4xx.value}</span>
            <span className="text-purple-400">5xx: {statusCodesBar.code5xx.value}</span>
          </div>
        </div>
        <div className="w-full h-4 bg-slate-950 rounded-full flex overflow-hidden">
          <div className="bg-blue-500 h-full" style={{ width: `${codeRatios.pct2xx}%` }} title={`2xx: ${codeRatios.pct2xx.toFixed(1)}%`}></div>
          <div className="bg-amber-500 h-full" style={{ width: `${codeRatios.pct3xx}%` }} title={`3xx: ${codeRatios.pct3xx.toFixed(1)}%`}></div>
          <div className="bg-rose-500 h-full" style={{ width: `${codeRatios.pct4xx}%` }} title={`4xx: ${codeRatios.pct4xx.toFixed(1)}%`}></div>
          <div className="bg-purple-500 h-full" style={{ width: `${codeRatios.pct5xx}%` }} title={`5xx: ${codeRatios.pct5xx.toFixed(1)}%`}></div>
        </div>
      </div>

      {/* Rankings Grid (Paths, Hosts, IPs) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Paths, Hosts, IPs */}
        <div className="grid grid-cols-1 gap-6 lg:col-span-3">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Top Page Views */}
            <div className={CardStyle + ' space-y-4'}>
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                <Globe size={14} className="text-emerald-400" />
                Top Pages Visited
              </h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {rankings.pageViews?.map((p: any, i: number) => {
                  const maxVal = Math.max(...rankings.pageViews.map((x: any) => x.value), 1);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-emerald-300 font-mono break-all pr-4" title={p.label}>{p.label}</span>
                        <span className="text-white font-mono font-bold">{p.value}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(p.value / maxVal) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
                {(!rankings.pageViews || rankings.pageViews.length === 0) && (
                  <div className="text-slate-500 italic text-center py-4">No pages captured</div>
                )}
              </div>
            </div>

            {/* Top Paths */}
            <div className={CardStyle + ' space-y-4'}>
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">Top API Endpoints</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {rankings.paths.map((p: any, i: number) => {
                  const maxVal = Math.max(...rankings.paths.map((x: any) => x.value), 1);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 font-mono break-all pr-4" title={p.label}>{p.label}</span>
                        <span className="text-white font-mono font-bold">{p.value}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(p.value / maxVal) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Hosts */}
            <div className={CardStyle + ' space-y-4'}>
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">Top Hosts</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {rankings.hosts.map((p: any, i: number) => {
                  const maxVal = Math.max(...rankings.hosts.map((x: any) => x.value), 1);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 font-mono break-all pr-4" title={p.label}>{p.label}</span>
                        <span className="text-white font-mono font-bold">{p.value}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(p.value / maxVal) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top IPs */}
            <div className={CardStyle + ' space-y-4'}>
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">Top IPs</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {rankings.ips.map((p: any, i: number) => {
                  const maxVal = Math.max(...rankings.ips.map((x: any) => x.value), 1);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 font-mono break-all pr-4" title={p.label}>{p.label}</span>
                        <span className="text-white font-mono font-bold">{p.value}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full" style={{ width: `${(p.value / maxVal) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Browsers, OS, User Agents */}
        <div className="grid grid-cols-1 gap-6 lg:col-span-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Browsers */}
            <div className={CardStyle + ' space-y-4'}>
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">Top Browsers</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {rankings.browsers.map((p: any, i: number) => {
                  const maxVal = Math.max(...rankings.browsers.map((x: any) => x.value), 1);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 truncate w-48" title={p.label}>{p.label}</span>
                        <span className="text-white font-bold">{p.value}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-violet-500 h-full rounded-full" style={{ width: `${(p.value / maxVal) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top OS */}
            <div className={CardStyle + ' space-y-4'}>
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">Top Operating Systems</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {rankings.operatingSystems.map((p: any, i: number) => {
                  const maxVal = Math.max(...rankings.operatingSystems.map((x: any) => x.value), 1);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 truncate w-48" title={p.label}>{p.label}</span>
                        <span className="text-white font-bold">{p.value}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-pink-500 h-full rounded-full" style={{ width: `${(p.value / maxVal) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top User Agents */}
            <div className={CardStyle + ' space-y-4'}>
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">Top User Agents</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {rankings.userAgents.map((p: any, i: number) => {
                  const maxVal = Math.max(...rankings.userAgents.map((x: any) => x.value), 1);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 truncate w-48 text-[10px] font-mono" title={p.label}>{p.label}</span>
                        <span className="text-white font-bold">{p.value}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(p.value / maxVal) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* HTTP Versions, Cache Status, Origin Status Codes */}
        <div className="grid grid-cols-1 gap-6 lg:col-span-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top HTTP Versions */}
            <div className={CardStyle + ' space-y-4'}>
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">Top HTTP Versions</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {rankings.httpVersions.map((p: any, i: number) => {
                  const maxVal = Math.max(...rankings.httpVersions.map((x: any) => x.value), 1);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 truncate w-48" title={p.label}>{p.label}</span>
                        <span className="text-white font-bold">{p.value}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(p.value / maxVal) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Cache Statuses */}
            <div className={CardStyle + ' space-y-4'}>
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">Top Cache Statuses</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {rankings.cacheStatuses.map((p: any, i: number) => {
                  const maxVal = Math.max(...rankings.cacheStatuses.map((x: any) => x.value), 1);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 truncate w-48" title={p.label}>{p.label}</span>
                        <span className="text-white font-bold">{p.value}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-teal-500 h-full rounded-full" style={{ width: `${(p.value / maxVal) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Origin Status Codes */}
            <div className={CardStyle + ' space-y-4'}>
              <h3 className="text-xs font-bold text-white border-b border-slate-800 pb-3">Top Origin Status Codes</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {rankings.originStatusCodes.map((p: any, i: number) => {
                  const maxVal = Math.max(...rankings.originStatusCodes.map((x: any) => x.value), 1);
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300 truncate w-48" title={p.label}>{p.label}</span>
                        <span className="text-white font-bold">{p.value}</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full" style={{ width: `${(p.value / maxVal) * 100}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Request Stream & Active Sessions */}
      <div className={CardStyle + ' mt-6'}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity size={16} className="text-emerald-400" /> Live Traffic Stream & Active Sessions
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">Last 100 requests</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="p-3 font-medium">Visitor IP & Geo</th>
                <th className="p-3 font-medium">Client Device</th>
                <th className="p-3 font-medium">Last Request Path</th>
                <th className="p-3 font-medium">Total Requests</th>
                <th className="p-3 font-medium text-right">Active Session Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {groupedRequests.map(([ip, requests]) => {
                const req = requests[0]; // Latest request
                const session = activeSessions.find(s => s.ip === ip);
                const isExpanded = expandedIp === ip;
                
                return (
                  <React.Fragment key={ip}>
                    <tr 
                      className={`hover:bg-slate-800/40 transition-colors cursor-pointer group ${isExpanded ? 'bg-slate-800/20' : ''}`}
                      onClick={() => setExpandedIp(isExpanded ? null : ip)}
                    >
                      <td className="p-3 align-top">
                        <div className="text-sm text-white font-mono flex items-center gap-2">
                          {ip}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isExpanded ? 'bg-[#ff5722] text-white' : 'bg-slate-700 text-slate-300'}`}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <span className="text-lg">{FLAGS[req.country] || '🌐'}</span>
                          {req.country}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <div className="text-xs text-slate-300 flex items-center gap-1">
                          {req.browser}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          {req.os}
                        </div>
                      </td>
                      <td className="p-3 align-top max-w-xs">
                        <div className="text-xs text-white font-mono break-all line-clamp-1">
                          {req.path}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 break-all line-clamp-1" title={req.referer}>
                          Ref: {req.referer || 'Direct'}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <div className="text-xl font-black text-white">{requests.length}</div>
                        <div className="text-[10px] text-slate-500">requests logged</div>
                      </td>
                      <td className="p-3 align-top text-right">
                        {session ? (
                          <>
                            <div className="text-xs text-emerald-400 font-bold">
                              {session.tabsCount} Tabs Open
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 flex flex-col items-end">
                              {session.pages?.slice(0, 2).map((pg: any, pIdx: number) => (
                                <span key={pIdx} className="break-all w-48 text-right pr-1 border-r border-slate-700">{pg.path} <span className="text-slate-600">({pg.count})</span></span>
                              ))}
                              {session.pages?.length > 2 && <span>+{session.pages.length - 2} more</span>}
                            </div>
                          </>
                        ) : (
                          <div className="text-[10px] text-slate-600 italic">No live socket</div>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded Details Row */}
                    {isExpanded && (() => {
                      const groupedInner = Object.values(
                        requests.reduce((acc: any, r: any) => {
                          const key = `${r.method}-${r.path}-${r.status}`;
                          if (!acc[key]) {
                            acc[key] = { ...r, count: 1, key, requests: [r] };
                          } else {
                            acc[key].count += 1;
                            acc[key].requests.push(r);
                          }
                          return acc;
                        }, {})
                      );

                      return (
                        <tr className="bg-slate-900/50">
                          <td colSpan={5} className="p-4 space-y-4">
                            
                            {/* Device & Browser Profile */}
                            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 flex flex-col lg:flex-row gap-6">
                              <div className="flex-1 space-y-2">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 border-b border-slate-800 pb-2 flex items-center gap-2">
                                  <span>🌍</span> Location
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  <div className="text-slate-500">IP Address:</div><div className="text-white font-mono">{ip}</div>
                                  <div className="text-slate-500">Country:</div><div className="text-white">{req.country || '-'}</div>
                                  <div className="text-slate-500">City:</div><div className="text-white">{req.city || '-'}</div>
                                  <div className="text-slate-500">Latitude:</div><div className="text-white font-mono">{req.latitude || '-'}</div>
                                  <div className="text-slate-500">Longitude:</div><div className="text-white font-mono">{req.longitude || '-'}</div>
                                </div>
                              </div>
                              <div className="flex-1 space-y-2">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 border-b border-slate-800 pb-2 flex items-center gap-2">
                                  <span>🌐</span> Browser Information
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  <div className="text-slate-500">Browser Name:</div><div className="text-white">{req.browser || '-'}</div>
                                  <div className="text-slate-500">Browser Version:</div><div className="text-white font-mono">{req.browserVersion || '-'}</div>
                                  <div className="text-slate-500">JavaScript:</div><div className={req.jsEnabled ? "text-emerald-400 font-bold" : "text-slate-500"}>{req.jsEnabled ? 'Enabled' : (req.jsEnabled === false ? 'Disabled' : 'Unknown')}</div>
                                  <div className="text-slate-500">Cookies:</div><div className={req.cookiesEnabled ? "text-emerald-400 font-bold" : "text-slate-500"}>{req.cookiesEnabled ? 'Enabled' : (req.cookiesEnabled === false ? 'Disabled' : 'Unknown')}</div>
                                  <div className="text-slate-500">Screen Resolution:</div><div className="text-white font-mono">{req.screenResolution || '-'}</div>
                                  <div className="text-slate-500">Window Size:</div><div className="text-white font-mono">{req.windowSize || '-'}</div>
                                </div>
                              </div>
                              <div className="flex-1 space-y-2">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 border-b border-slate-800 pb-2 flex items-center gap-2">
                                  <span>💻</span> Device Information
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  <div className="text-slate-500">OS Name:</div><div className="text-white">{req.os || '-'}</div>
                                  <div className="text-slate-500">Platform:</div><div className="text-white">{req.platform || '-'}</div>
                                  <div className="text-slate-500">Device Type:</div><div className="text-white">{req.deviceType || '-'}</div>
                                  <div className="text-slate-500">User Agent:</div><div className="text-white font-mono line-clamp-2" title={req.userAgent}>{req.userAgent || '-'}</div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 text-xs font-bold text-white flex justify-between">
                                <span>Navigation History for {ip}</span>
                                <span className="text-slate-500">{requests.length} Total Entries ({groupedInner.length} Unique)</span>
                              </div>
                              <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-900/50 text-slate-400 sticky top-0 backdrop-blur-sm z-10">
                                    <tr>
                                      <th className="p-2 font-medium w-24">Last Time</th>
                                      <th className="p-2 font-medium w-16">Method</th>
                                      <th className="p-2 font-medium w-16">Status</th>
                                      <th className="p-2 font-medium">Path</th>
                                      <th className="p-2 font-medium w-16">Hits</th>
                                      <th className="p-2 font-medium">Referer</th>
                                      <th className="p-2 font-medium w-20">Cached</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/30">
                                    {groupedInner.map((r: any, rIdx: number) => {
                                      const isPathExpanded = expandedPathKey === r.key;
                                      return (
                                        <React.Fragment key={rIdx}>
                                          <tr 
                                            className={`hover:bg-slate-800/30 cursor-pointer ${isPathExpanded ? 'bg-slate-800/40' : ''}`}
                                            onClick={() => setExpandedPathKey(isPathExpanded ? null : r.key)}
                                          >
                                            <td className="p-2 text-slate-400 font-mono">
                                              <span className={`inline-block mr-1 text-[8px] transition-transform ${isPathExpanded ? 'text-[#ff5722] rotate-90' : 'text-slate-500'}`}>
                                                ▶
                                              </span>
                                              {new Date(r.timestamp).toLocaleTimeString()}
                                            </td>
                                            <td className="p-2 font-mono text-slate-300">{r.method}</td>
                                            <td className="p-2 font-mono">
                                              <span className={r.status >= 400 ? 'text-rose-400' : 'text-emerald-400'}>{r.status}</span>
                                            </td>
                                            <td className="p-2 text-white font-mono break-all">{r.path}</td>
                                            <td className="p-2">
                                              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-bold">{r.count}</span>
                                            </td>
                                            <td className="p-2 text-slate-500 break-all">{r.referer || '-'}</td>
                                            <td className="p-2">
                                              <span className={`px-1.5 py-0.5 rounded text-[9px] ${r.cached ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-800 text-slate-500'}`}>
                                                {r.cached ? 'HIT' : 'MISS'}
                                              </span>
                                            </td>
                                          </tr>
                                          {isPathExpanded && r.requests.map((req: any, reqIdx: number) => (
                                            <tr key={`${rIdx}-${reqIdx}`} className="bg-slate-900/80 text-[10px] border-l-2 border-l-[#ff5722]/50">
                                              <td className="p-2 pl-6 text-slate-500 font-mono">
                                                {new Date(req.timestamp).toLocaleTimeString()}
                                              </td>
                                              <td className="p-2 font-mono text-slate-500">{req.method}</td>
                                              <td className="p-2 font-mono">
                                                <span className={req.status >= 400 ? 'text-rose-500/70' : 'text-emerald-500/70'}>{req.status}</span>
                                              </td>
                                              <td colSpan={2} className="p-2 text-slate-400 font-mono break-all border-l border-slate-700/50">
                                                <span className="text-slate-600 mr-2">Query/Body:</span>
                                                {req.query && Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : '-'}
                                              </td>
                                              <td className="p-2 text-slate-500 break-all border-l border-slate-700/50">
                                                <span className="text-slate-600 mr-2">UA/Device:</span>
                                                {req.browser || '-'} / {req.os || '-'}
                                              </td>
                                              <td className="p-2 border-l border-slate-700/50">
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] ${req.cached ? 'bg-teal-500/10 text-teal-500/70' : 'bg-slate-800/50 text-slate-600'}`}>
                                                  {req.cached ? 'HIT' : 'MISS'}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </React.Fragment>
                );
              })}
              {groupedRequests.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                    No recent traffic recorded in the current buffer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4xx and 5xx Error Log */}
      <div className={CardStyle + ' mt-6'}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Shield size={16} className="text-rose-400" /> Blocked & Failed Requests (4xx & 5xx)
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">Errors in buffer: {errorRequests.length}</span>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 sticky top-0 z-10">
              <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                <th className="p-3 font-medium">Time</th>
                <th className="p-3 font-medium">IP & Geo</th>
                <th className="p-3 font-medium">Method</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Path & Referer</th>
                <th className="p-3 font-medium">User Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {errorRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 text-sm">
                    No 4xx or 5xx errors recorded in the current buffer.
                  </td>
                </tr>
              ) : (
                errorRequests.map((req: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 text-slate-400 font-mono whitespace-nowrap">
                      {new Date(req.lastTimestamp || req.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-mono text-slate-300">
                      <div>{req.ip}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <span className="text-sm">{FLAGS[req.country] || '🌐'}</span> {req.country}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-slate-300">
                      {req.method}
                    </td>
                    <td className="p-3 font-mono font-bold">
                      <span className={req.status >= 500 ? 'text-red-500' : 'text-rose-400'}>
                        {req.status}
                      </span>
                    </td>
                    <td className="p-3 max-w-[250px]">
                      <div className="flex items-center gap-2 text-white font-mono break-all line-clamp-1" title={req.path}>
                        {req.path}
                        {req.count > 1 && (
                          <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 rounded-full font-bold text-[9px] shrink-0">
                            {req.count} hits
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 truncate" title={req.referer}>
                        Ref: {req.referer || 'Direct'}
                      </div>
                    </td>
                    <td className="p-3 text-slate-400 max-w-[200px] truncate" title={req.userAgent}>
                      {req.userAgent}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
