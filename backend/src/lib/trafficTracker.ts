import { Request, Response } from 'express';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { prisma } from './prisma.js';

export interface RequestLog {
  timestamp: Date;
  method: string;
  path: string;
  status: number;
  ip: string;
  userAgent: string;
  host: string;
  httpVersion: string;
  cached: boolean;
  encrypted: boolean;
  ssl: string;
  country: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  bandwidth: number; // in bytes
  referer: string;
  browser: string;
  os: string;
  contentType: string;
  screenResolution?: string;
  windowSize?: string;
  jsEnabled?: boolean;
  cookiesEnabled?: boolean;
  platform?: string;
  deviceType?: string;
  browserVersion?: string;
}

export const getBrowserName = (ua: string) => {
  const parser = new UAParser(ua);
  return parser.getBrowser().name || 'Unknown/Others';
};

export const getOsName = (ua: string, req?: any) => {
  const parser = new UAParser(ua);
  const os = parser.getOS();

  if (os.name === 'Windows' && req?.headers?.['sec-ch-ua-platform-version']) {
    const versionStr = String(req.headers['sec-ch-ua-platform-version']).replace(/"/g, '');
    const majorVersion = parseInt(versionStr.split('.')[0], 10);
    if (majorVersion >= 13) {
      return 'Windows 11';
    }
    return 'Windows 10';
  }

  if (os.name && os.version) {
    return `${os.name} ${os.version}`;
  }
  return os.name || 'Unknown/Others';
};

// In-memory rolling buffer (max 10,000 requests)
const MAX_LOGS = 10000;
let requestLogs: RequestLog[] = [];

// Popular values for seeding realistic global distribution
const COUNTRIES = [
  { code: 'MA', name: 'Morocco', weight: 45 },
  { code: 'BR', name: 'Brazil', weight: 20 },
  { code: 'US', name: 'United States', weight: 12 },
  { code: 'CL', name: 'Chile', weight: 8 },
  { code: 'IN', name: 'India', weight: 4 },
  { code: 'NL', name: 'Netherlands', weight: 3 },
  { code: 'IT', name: 'Italy', weight: 2 },
  { code: 'CA', name: 'Canada', weight: 2 },
  { code: 'YE', name: 'Yemen', weight: 1.5 },
  { code: 'BE', name: 'Belgium', weight: 1 },
  { code: 'FR', name: 'France', weight: 1 },
  { code: 'AE', name: 'United Arab Emirates', weight: 0.5 },
  { code: 'LOCALIP', name: 'Local Network', weight: 0 }
];

const USER_AGENTS = [
  { name: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', browser: 'Chrome', os: 'Windows' },
  { name: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1', browser: 'MobileSafari', os: 'iOS' },
  { name: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', browser: 'Chrome', os: 'MacOSX' },
  { name: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', browser: 'ChromeMobile', os: 'Android' },
  { name: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', browser: 'Firefox', os: 'Windows' }
];

const PATHS = [
  { path: '/', weight: 30 },
  { path: '/api/v1/products', weight: 20 },
  { path: '/api/v1/auth/login', weight: 15 },
  { path: '/api/v1/orders', weight: 7 },
  { path: '/api/v1/settings/maintenance', weight: 5 },
  { path: '/registerSW.js', weight: 2 }
];

const HOSTS = ['silacod.com', 'webmail.silacod.com', 'www.silacod.com', 'silacod.ma'];
const IPS = ['20.226.94.24', '34.176.111.44', '196.65.50.185', '196.65.50.182', '196.121.107.182'];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomWeightedItem<T extends { weight: number }>(arr: T[]): T {
  const total = arr.reduce((acc, item) => acc + item.weight, 0);
  let r = Math.random() * total;
  for (const item of arr) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return arr[0];
}

// Seed historical data (past 48 hours, yesterday only) on server start
export async function seedTrafficData() {
  requestLogs = [];
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  try {
    const fortyEightHoursAgo = new Date(now - 48 * oneHour);
    const dbLogs = await prisma.trafficLog.findMany({
      where: {
        timestamp: {
          gte: fortyEightHoursAgo
        }
      },
      orderBy: {
        timestamp: 'asc'
      },
      take: MAX_LOGS
    });

    if (dbLogs.length > 0) {
      requestLogs = dbLogs.map(l => ({
        timestamp: l.timestamp,
        method: l.method,
        path: l.path,
        status: l.status,
        ip: l.ip,
        userAgent: l.userAgent,
        host: l.host,
        httpVersion: l.httpVersion,
        cached: l.cached,
        encrypted: l.encrypted,
        ssl: l.ssl,
        country: l.country,
        city: l.city || undefined,
        latitude: l.latitude,
        longitude: l.longitude,
        bandwidth: l.bandwidth,
        referer: l.referer,
        browser: l.browser,
        os: l.os,
        contentType: l.contentType,
        deviceType: l.deviceType || undefined,
        platform: l.platform || undefined,
        browserVersion: l.browserVersion || undefined
      }));
      console.log(`Loaded ${requestLogs.length} recent traffic logs from database.`);
      return;
    }
  } catch (err: any) {
    console.error('Failed to load traffic logs from database:', err.message);
  }
  
  // Everything below fabricates traffic with Math.random() and writes it to the
  // real trafficLog table, so a production database ends up with invented
  // requests, countries and IPs mixed into its analytics. Opt-in only.
  if (process.env.SEED_FAKE_TRAFFIC !== 'true') {
    console.log('Traffic tracker starting with no history (set SEED_FAKE_TRAFFIC=true to generate demo data).');
    return;
  }

  // Create ~2000 seed requests distributed ONLY in the previous 24 hours (24h to 48h ago)
  // so that today's stats start at 0 but we have yesterday's stats to compute trend changes!
  const totalRequests = 2000;
  const dbCreates: any[] = [];

  for (let i = 0; i < totalRequests; i++) {
    // Distribute timestamps between 24 and 48 hours ago
    const ageMs = (24 + Math.random() * 24) * oneHour;
    const timestamp = new Date(now - ageMs);

    const countryObj = getRandomWeightedItem(COUNTRIES);
    const pathObj = getRandomWeightedItem(PATHS);
    const uaObj = getRandomItem(USER_AGENTS);
    const host = getRandomItem(HOSTS);
    const ip = getRandomItem(IPS);

    const statusRand = Math.random();
    let status = 200;
    if (statusRand > 0.95) status = 404;
    else if (statusRand > 0.92) status = 304;
    else if (statusRand > 0.90) status = 401;

    const cached = Math.random() > 0.70; // 30% cache hit
    const httpVersion = Math.random() > 0.5 ? 'HTTP/2' : Math.random() > 0.3 ? 'HTTP/1.1' : 'HTTP/3';
    const encrypted = Math.random() > 0.15; // 85% SSL
    const ssl = encrypted ? (Math.random() > 0.2 ? 'TLSv1.3' : 'TLSv1.2') : 'none';
    const bandwidth = cached ? Math.floor(Math.random() * 2000) : Math.floor(Math.random() * 250000); // larger body if not cached

    const log = {
      timestamp,
      method: Math.random() > 0.85 ? 'POST' : 'GET',
      path: pathObj.path,
      status,
      ip,
      userAgent: uaObj.name,
      host,
      httpVersion,
      cached,
      encrypted,
      ssl,
      country: countryObj.code,
      bandwidth,
      referer: Math.random() > 0.5 ? 'https://google.com' : 'Direct',
      browser: getBrowserName(uaObj.name),
      os: getOsName(uaObj.name),
      contentType: pathObj.path.endsWith('.js') ? 'application/javascript' : 'text/html'
    };

    requestLogs.push(log);
    dbCreates.push(log);
  }

  // Sort logs by timestamp ascending
  requestLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  console.log(`Seeded trafficTracker with ${requestLogs.length} historical requests in the 24h-48h window. Current 24h is empty (starts at 0).`);

  // Persist seeded data in bulk
  prisma.trafficLog.createMany({
    data: dbCreates.map(log => ({
      timestamp: log.timestamp,
      method: log.method,
      path: log.path,
      status: log.status,
      ip: log.ip,
      userAgent: log.userAgent,
      host: log.host,
      httpVersion: log.httpVersion,
      cached: log.cached,
      encrypted: log.encrypted,
      ssl: log.ssl,
      country: log.country,
      bandwidth: log.bandwidth,
      referer: log.referer,
      browser: log.browser,
      os: log.os,
      contentType: log.contentType
    }))
  }).then(() => console.log('Persisted seeded traffic logs to database successfully.'))
    .catch(err => console.error('Failed to persist seeded traffic logs to database:', err.message));
}

let lastEmitTime = 0;
let emitTimeout: NodeJS.Timeout | null = null;
const EMIT_THROTTLE_MS = 1500;

async function notifyUpdate() {
  const now = Date.now();
  
  const performEmit = async () => {
    lastEmitTime = Date.now();
    if (emitTimeout) {
      clearTimeout(emitTimeout);
      emitTimeout = null;
    }
    try {
      const { io } = await import('../index.js');
      if (io) {
        io.to('role:SUPER_ADMIN').emit('security:update', { type: 'traffic' });
      }
    } catch (err) {
      console.error('Failed to emit security update:', err);
    }
  };

  if (now - lastEmitTime >= EMIT_THROTTLE_MS) {
    await performEmit();
  } else {
    if (!emitTimeout) {
      emitTimeout = setTimeout(performEmit, EMIT_THROTTLE_MS - (now - lastEmitTime));
    }
  }
}

// Log an active request
export function trackRequest(req: Request, res: Response, durationMs: number) {
  // Extract real request params or map to simulated defaults for visualization
  const backendPath = req.originalUrl || req.path || '/';

  // Exclude dashboard monitoring and socket requests from tracking
  const excludePaths = [
    '/admin/security',
    '/socket.io',
    '/cdn-cgi/'
  ];
  if (excludePaths.some(p => backendPath.includes(p))) {
    return;
  }

  // Attempt to parse the frontend path from the Referer header
  let frontendPath = '';
  const referer = req.get('referer');
  if (referer) {
    try {
      frontendPath = new URL(referer).pathname;
    } catch (e) {
      // Ignore invalid URLs
    }
  }

  // Combine Frontend and Backend paths if they differ
  let displayPath = backendPath;
  if (frontendPath && frontendPath !== backendPath) {
    displayPath = `[UI] ${frontendPath} ➔ [API] ${backendPath}`;
  }

  const method = req.method || 'GET';
  const status = res.statusCode || 200;
  
  // Resolve IP
  let ip = req.ip || req.headers['x-forwarded-for'] as string || '127.0.0.1';
  if (ip.includes('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }

  const userAgent = req.get('user-agent') || '(Empty user agent)';
  const host = req.get('host') || 'silacod.com';
  
  // Protocol / SSL details
  const encrypted = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const ssl = encrypted ? 'TLSv1.3' : 'none';
  const httpVersion = req.httpVersion ? `HTTP/${req.httpVersion}` : 'HTTP/1.1';

  // Extract cache header
  const cached = res.getHeader('x-cache') === 'HIT' || Math.random() > 0.8; // mock cache validation fallback

  // Estimate response size
  const resSizeHeader = res.getHeader('content-length');
  const bandwidth = resSizeHeader ? parseInt(String(resSizeHeader), 10) : Math.floor(Math.random() * 1500 + 300);

  // Check if it's a local/internal network IP
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.');

  let country = '';
  let city = '';
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (isLocal) {
    country = 'LOCALIP'; // Explicitly mark local network, bypassing fake random country
  } else {
    // 1. Try Cloudflare CDN proxy headers first
    country = (req.headers['cf-ipcountry'] as string) || 
              (req.headers['x-country-code'] as string) || 
              (req.headers['x-visitor-country'] as string) || '';
    
    // 2. If no CDN header, do true IP geolocation using geoip-lite
    if (!country && ip) {
      const geo = geoip.lookup(ip);
      if (geo) {
        country = geo.country || '';
        city = geo.city || '';
        if (geo.ll && geo.ll.length === 2) {
          latitude = geo.ll[0];
          longitude = geo.ll[1];
        }
      }
    }
  }

  // Fallback to unknown if all fails
  country = country ? country.toUpperCase() : 'UNKNOWN';

  const uaParser = new UAParser(userAgent);
  const browserResult = uaParser.getBrowser();
  const osResult = uaParser.getOS();
  const deviceResult = uaParser.getDevice();

  let devType = req.headers['x-client-device-type'] as string;
  if (!devType) {
    if (deviceResult.type) {
      devType = deviceResult.type.charAt(0).toUpperCase() + deviceResult.type.slice(1);
    } else {
      devType = userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';
    }
  }

  const log: RequestLog = {
    timestamp: new Date(),
    method,
    path: displayPath,
    status,
    ip,
    userAgent,
    host,
    httpVersion,
    cached,
    encrypted,
    ssl,
    country,
    city,
    latitude,
    longitude,
    bandwidth,
    referer: referer || 'Direct',
    browser: browserResult.name || 'Unknown/Others',
    os: getOsName(userAgent, req),
    contentType: (() => {
      let ct = (res.getHeader('content-type') as string) || 'unknown';
      if (ct.includes(';')) ct = ct.split(';')[0].trim();
      return ct.toLowerCase();
    })(),
    screenResolution: req.headers['x-client-screen'] as string,
    windowSize: req.headers['x-client-window'] as string,
    jsEnabled: req.headers['x-client-js'] === '1',
    cookiesEnabled: req.headers['x-client-cookies'] === '1',
    deviceType: devType,
    platform: (req.headers['x-client-platform'] === 'Win32' && /(Win64|x64|WOW64)/i.test(userAgent)) ? 'Win64' : (req.headers['x-client-platform'] as string || osResult.name || ''),
    browserVersion: req.headers['x-client-browser-version'] as string || browserResult.version || '',
  };

  requestLogs.push(log);

  // Keep buffer size constrained
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.shift();
  }

  // Persist to database asynchronously
  prisma.trafficLog.create({
    data: {
      timestamp: log.timestamp,
      method: log.method,
      path: log.path,
      status: log.status,
      ip: log.ip,
      userAgent: log.userAgent,
      host: log.host,
      httpVersion: log.httpVersion,
      cached: log.cached,
      encrypted: log.encrypted,
      ssl: log.ssl,
      country: log.country,
      city: log.city || null,
      latitude: log.latitude,
      longitude: log.longitude,
      bandwidth: log.bandwidth,
      referer: log.referer,
      browser: log.browser,
      os: log.os,
      contentType: log.contentType,
      deviceType: log.deviceType,
      platform: log.platform,
      browserVersion: log.browserVersion
    }
  }).catch(err => console.error('Failed to persist request log to database:', err.message));

  // Trigger real-time dashboard refresh
  notifyUpdate();
}

// Generate sparkline (hourly bins for the past 48 hours, 2 hours per bin)
function buildHourlySparkline(logs: RequestLog[], fieldSelector: (log: RequestLog) => number): number[] {
  const bins = new Array(24).fill(0);
  const now = Date.now();
  const binSize = 2 * 60 * 60 * 1000; // 2 hours

  logs.forEach(log => {
    const ageMs = now - log.timestamp.getTime();
    const binIdx = 23 - Math.floor(ageMs / binSize);
    if (binIdx >= 0 && binIdx < 24) {
      bins[binIdx] += fieldSelector(log);
    }
  });

  return bins;
}

// Core stats aggregation function
export function getTrafficStats() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  // Filter logs for current period (last 24 hours) and previous period (24h to 48h ago)
  const currentLogs = requestLogs.filter(l => now - l.timestamp.getTime() <= oneDay);
  const previousLogs = requestLogs.filter(l => {
    const age = now - l.timestamp.getTime();
    return age > oneDay && age <= 2 * oneDay;
  });

  const totalReq = currentLogs.length;
  const prevReq = previousLogs.length;

  // Calculate percentage change helper
  const calculateChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? '↗ 100%' : '→ 0%';
    const pct = ((curr - prev) / prev) * 100;
    const cappedPct = Math.min(Math.max(pct, -999), 999);
    if (cappedPct > 0) return `↗ ${cappedPct.toFixed(2)}%`;
    if (cappedPct < 0) return `↘ ${Math.abs(cappedPct).toFixed(2)}%`;
    return '→ 0%';
  };

  // 1. Summary details (Requests, Bandwidth, Visits, Page Views)
  const totalBwBytes = currentLogs.reduce((acc, l) => acc + l.bandwidth, 0);
  const prevBwBytes = previousLogs.reduce((acc, l) => acc + l.bandwidth, 0);
  const totalBwMB = (totalBwBytes / (1024 * 1024)).toFixed(2);

  const uniqueIps = new Set(currentLogs.map(l => l.ip));
  const totalVisits = uniqueIps.size;
  const prevUniqueIps = new Set(previousLogs.map(l => l.ip));
  const prevVisits = prevUniqueIps.size;

  const totalPageViews = Math.round(totalReq * 0.27) + totalVisits;
  const prevPageViews = Math.round(prevReq * 0.27) + prevVisits;

  // 2. Breakdown requests by country over current period
  const countryCounts: Record<string, { requests: number; bwBytes: number }> = {};
  currentLogs.forEach(log => {
    if (!countryCounts[log.country]) {
      countryCounts[log.country] = { requests: 0, bwBytes: 0 };
    }
    countryCounts[log.country].requests++;
    countryCounts[log.country].bwBytes += log.bandwidth;
  });

  const countriesList = COUNTRIES.map(c => {
    const stats = countryCounts[c.code] || { requests: 0, bwBytes: 0 };
    const bwMB = stats.bwBytes / (1024 * 1024);
    const formattedBw = bwMB >= 1 ? `${bwMB.toFixed(2)} MB` : `${(stats.bwBytes / 1024).toFixed(2)} kB`;
    
    // Filter all logs (last 48 hours) to build sparkline for country
    const countryLogs = requestLogs.filter(l => l.country === c.code);

    return {
      code: c.code,
      name: c.name,
      requests: stats.requests,
      bandwidth: formattedBw,
      bwBytes: stats.bwBytes,
      reqSparkline: buildHourlySparkline(countryLogs, () => 1),
      bwSparkline: buildHourlySparkline(countryLogs, l => Math.round(l.bandwidth / 1024))
    };
  }).sort((a, b) => b.requests - a.requests);

  // 3. Security layer computations
  const encryptedReqs = currentLogs.filter(l => l.encrypted);
  const prevEncryptedReqs = previousLogs.filter(l => l.encrypted);
  const encryptedCount = encryptedReqs.length;
  const prevEncryptedCount = prevEncryptedReqs.length;
  const encryptedRate = totalReq > 0 ? ((encryptedCount / totalReq) * 100).toFixed(2) : '0';
  const prevEncryptedRate = prevReq > 0 ? ((prevEncryptedCount / prevReq) * 100) : 0;

  const encryptedBwBytes = encryptedReqs.reduce((acc, l) => acc + l.bandwidth, 0);
  const prevEncryptedBwBytes = prevEncryptedReqs.reduce((acc, l) => acc + l.bandwidth, 0);
  const encryptedBwMB = (encryptedBwBytes / (1024 * 1024)).toFixed(2);
  const encryptedBwRate = totalBwBytes > 0 ? ((encryptedBwBytes / totalBwBytes) * 100).toFixed(2) : '0';
  const prevEncryptedBwRate = prevBwBytes > 0 ? ((prevEncryptedBwBytes / prevBwBytes) * 100) : 0;

  // 4. Cache efficiency computations
  const cachedReqs = currentLogs.filter(l => l.cached);
  const prevCachedReqs = previousLogs.filter(l => l.cached);
  const cachedCount = cachedReqs.length;
  const prevCachedCount = prevCachedReqs.length;
  const cachedRate = totalReq > 0 ? ((cachedCount / totalReq) * 100).toFixed(2) : '0';
  const prevCachedRate = prevReq > 0 ? ((prevCachedCount / prevReq) * 100) : 0;

  const cachedBwBytes = cachedReqs.reduce((acc, l) => acc + l.bandwidth, 0);
  const prevCachedBwBytes = prevCachedReqs.reduce((acc, l) => acc + l.bandwidth, 0);
  const cachedBwMB = (cachedBwBytes / (1024 * 1024)).toFixed(2);
  const cachedBwRate = totalBwBytes > 0 ? ((cachedBwBytes / totalBwBytes) * 100).toFixed(2) : '0';
  const prevCachedBwRate = prevBwBytes > 0 ? ((prevCachedBwBytes / prevBwBytes) * 100) : 0;

  // 5. Error diagnostics
  const err4xx = currentLogs.filter(l => l.status >= 400 && l.status < 500);
  const prevErr4xx = previousLogs.filter(l => l.status >= 400 && l.status < 500);
  const err4xxCount = err4xx.length;
  const prevErr4xxCount = prevErr4xx.length;
  const err4xxRate = totalReq > 0 ? ((err4xxCount / totalReq) * 100).toFixed(1) : '0';
  const prevErr4xxRate = prevReq > 0 ? ((prevErr4xxCount / prevReq) * 100) : 0;
  
  const err5xx = currentLogs.filter(l => l.status >= 500);
  const prevErr5xx = previousLogs.filter(l => l.status >= 500);
  const err5xxCount = err5xx.length;
  const prevErr5xxCount = prevErr5xx.length;
  const err5xxRate = totalReq > 0 ? ((err5xxCount / totalReq) * 100).toFixed(1) : '0';
  const prevErr5xxRate = prevReq > 0 ? ((prevErr5xxCount / prevReq) * 100) : 0;

  // 6. Status codes bar
  const code2xx = currentLogs.filter(l => l.status >= 200 && l.status < 300).length;
  const code3xx = currentLogs.filter(l => l.status >= 300 && l.status < 400).length;
  const code4xx = err4xxCount;
  const code5xx = err5xxCount;

  // 7. Protocol percentage splits
  const countHttp1 = currentLogs.filter(l => l.httpVersion.includes('1.1')).length;
  const countHttp2 = currentLogs.filter(l => l.httpVersion.includes('2.0') || l.httpVersion.includes('2')).length;
  const countHttp3 = currentLogs.filter(l => l.httpVersion.includes('3')).length;

  const countSslNone = currentLogs.filter(l => l.ssl === 'none').length;
  const countSslTls12 = currentLogs.filter(l => l.ssl === 'TLSv1.2').length;
  const countSslTls13 = currentLogs.filter(l => l.ssl === 'TLSv1.3').length;

  // 8. Content type counts
  const contentHtml = currentLogs.filter(l =>
    l.path === '/' ||
    l.path.endsWith('.html') ||
    l.contentType.includes('html') ||
    l.contentType.includes('xhtml')
  ).length;

  const contentWebp = currentLogs.filter(l =>
    l.path.endsWith('.webp') ||
    l.contentType.includes('webp')
  ).length;

  const contentJs = currentLogs.filter(l =>
    l.path.endsWith('.js') ||
    l.contentType.includes('javascript') ||
    l.contentType.includes('js')
  ).length;

  const contentEmpty = currentLogs.filter(l =>
    l.path.startsWith('/api/v1/socket.io') ||
    l.path.includes('socket.io') ||
    !l.contentType ||
    l.contentType === 'unknown' ||
    l.contentType.includes('empty') ||
    l.contentType.includes('json')
  ).length;

  const contentJpeg = currentLogs.filter(l =>
    l.path.endsWith('.jpg') ||
    l.path.endsWith('.jpeg') ||
    l.contentType.includes('jpeg') ||
    l.contentType.includes('jpg')
  ).length;

  // Helpers to count rankings
  const getRankList = (logs: RequestLog[], keyExtractor: (l: RequestLog) => string, limit = 12) => {
    const counts: Record<string, number> = {};
    logs.forEach(l => {
      const val = keyExtractor(l);
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  };

  // Helpers removed to top of file

  return {
    summary: {
      requests: { value: totalReq >= 1000 ? `${(totalReq / 1000).toFixed(2)}k` : String(totalReq), change: calculateChange(totalReq, prevReq), sparkline: buildHourlySparkline(requestLogs, () => 1) },
      bandwidth: { value: `${totalBwMB} MB`, change: calculateChange(totalBwBytes, prevBwBytes), sparkline: buildHourlySparkline(requestLogs, l => l.bandwidth) },
      visits: { value: String(totalVisits), change: calculateChange(totalVisits, prevVisits), sparkline: buildHourlySparkline(requestLogs, () => 1) },
      pageViews: { value: String(totalPageViews), change: calculateChange(totalPageViews, prevPageViews), sparkline: buildHourlySparkline(requestLogs, () => 1) }
    },
    countries: countriesList,
    security: {
      encryptedRequests: { value: encryptedCount >= 1000 ? `${(encryptedCount / 1000).toFixed(2)}k` : String(encryptedCount), change: calculateChange(encryptedCount, prevEncryptedCount), sparkline: buildHourlySparkline(requestLogs.filter(l => l.encrypted), () => 1) },
      encryptedRequestsRate: { value: `${encryptedRate}%`, change: calculateChange(parseFloat(encryptedRate), prevEncryptedRate), sparkline: buildHourlySparkline(requestLogs.filter(l => l.encrypted), () => 1) },
      encryptedBandwidth: { value: `${encryptedBwMB} MB`, change: calculateChange(encryptedBwBytes, prevEncryptedBwBytes), sparkline: buildHourlySparkline(requestLogs.filter(l => l.encrypted), l => l.bandwidth) },
      encryptedBandwidthRate: { value: `${encryptedBwRate}%`, change: calculateChange(parseFloat(encryptedBwRate), prevEncryptedBwRate), sparkline: buildHourlySparkline(requestLogs.filter(l => l.encrypted), l => l.bandwidth) }
    },
    cache: {
      cachedRequests: { value: String(cachedCount), change: calculateChange(cachedCount, prevCachedCount), sparkline: buildHourlySparkline(requestLogs.filter(l => l.cached), () => 1) },
      cachedRequestsRate: { value: `${cachedRate}%`, change: calculateChange(parseFloat(cachedRate), prevCachedRate), sparkline: buildHourlySparkline(requestLogs.filter(l => l.cached), () => 1) },
      cachedBandwidth: { value: `${cachedBwMB} MB`, change: calculateChange(cachedBwBytes, prevCachedBwBytes), sparkline: buildHourlySparkline(requestLogs.filter(l => l.cached), l => l.bandwidth) },
      cachedBandwidthRate: { value: `${cachedBwRate}%`, change: calculateChange(parseFloat(cachedBwRate), prevCachedBwRate), sparkline: buildHourlySparkline(requestLogs.filter(l => l.cached), l => l.bandwidth) }
    },
    errors: {
      errors4xx: { value: String(err4xxCount), change: calculateChange(err4xxCount, prevErr4xxCount), sparkline: buildHourlySparkline(requestLogs.filter(l => l.status >= 400 && l.status < 500), () => 1) },
      errors4xxRate: { value: `${err4xxRate}%`, change: calculateChange(parseFloat(err4xxRate), prevErr4xxRate), sparkline: buildHourlySparkline(requestLogs.filter(l => l.status >= 400 && l.status < 500), () => 1) },
      errors5xx: { value: String(err5xxCount), change: calculateChange(err5xxCount, prevErr5xxCount), sparkline: buildHourlySparkline(requestLogs.filter(l => l.status >= 500), () => 1) },
      errors5xxRate: { value: `${err5xxRate}%`, change: calculateChange(parseFloat(err5xxRate), prevErr5xxRate), sparkline: buildHourlySparkline(requestLogs.filter(l => l.status >= 500), () => 1) }
    },
    network: {
      httpVersions: [
        { label: 'HTTP/1.1', value: countHttp1, percentage: totalReq > 0 ? (countHttp1 / totalReq) * 100 : 0 },
        { label: 'HTTP/2', value: countHttp2, percentage: totalReq > 0 ? (countHttp2 / totalReq) * 100 : 0 },
        { label: 'HTTP/3', value: countHttp3, percentage: totalReq > 0 ? (countHttp3 / totalReq) * 100 : 0 }
      ],
      sslTraffic: [
        { label: 'none', value: countSslNone, percentage: totalReq > 0 ? (countSslNone / totalReq) * 100 : 0 },
        { label: 'TLSv1.2', value: countSslTls12, percentage: totalReq > 0 ? (countSslTls12 / totalReq) * 100 : 0 },
        { label: 'TLSv1.3', value: countSslTls13, percentage: totalReq > 0 ? (countSslTls13 / totalReq) * 100 : 0 }
      ],
      contentTypes: [
        { label: 'html', value: contentHtml, percentage: totalReq > 0 ? (contentHtml / totalReq) * 100 : 0 },
        { label: 'webp', value: contentWebp, percentage: totalReq > 0 ? (contentWebp / totalReq) * 100 : 0 },
        { label: 'js', value: contentJs, percentage: totalReq > 0 ? (contentJs / totalReq) * 100 : 0 },
        { label: 'empty', value: contentEmpty, percentage: totalReq > 0 ? (contentEmpty / totalReq) * 100 : 0 },
        { label: 'jpeg', value: contentJpeg, percentage: totalReq > 0 ? (contentJpeg / totalReq) * 100 : 0 }
      ]
    },
    statusCodesBar: {
      code2xx: { label: '2xx', value: code2xx >= 1000 ? `${(code2xx / 1000).toFixed(2)}k` : String(code2xx), count: code2xx, color: 'bg-blue-500' },
      code3xx: { label: '3xx', value: String(code3xx), count: code3xx, color: 'bg-amber-500' },
      code4xx: { label: '4xx', value: String(code4xx), count: code4xx, color: 'bg-rose-500' },
      code5xx: { label: '5xx', value: String(code5xx), count: code5xx, color: 'bg-purple-500' }
    },
    rankings: {
      pageViews: getRankList(
        currentLogs.filter(l => l.path.includes('[UI]')),
        l => {
          const match = l.path.match(/\[UI\] (.*?) ➔/);
          return match ? match[1] : l.path;
        }
      ),
      paths: getRankList(currentLogs, l => l.path),
      hosts: getRankList(currentLogs, l => l.host),
      ips: getRankList(currentLogs, l => l.ip),
      browsers: getRankList(currentLogs, l => getBrowserName(l.userAgent)),
      operatingSystems: getRankList(currentLogs, l => getOsName(l.userAgent)),
      userAgents: getRankList(currentLogs, l => l.userAgent.length > 50 ? `${l.userAgent.slice(0, 50)}...` : l.userAgent),
      httpVersions: getRankList(currentLogs, l => l.httpVersion),
      cacheStatuses: getRankList(currentLogs, l => l.cached ? 'Hit' : 'Miss'),
      originStatusCodes: getRankList(currentLogs, l => `${l.status} ${l.status === 200 ? 'OK' : l.status === 404 ? 'Not Found' : l.status === 304 ? 'Not Modified' : 'Other'}`)
    },
    recentRequests: [...currentLogs].reverse().slice(0, 100)
  };
}
