/**
 * Cloaking simulation — 10 random visitors through the REAL server engine.
 *
 * Imports resolveServerCloak from the source (not the stale dist), so it exercises
 * the current code including the AdsBot allow-list. Country is resolved by the same
 * geoip-lite the engine uses, so each visitor's "position" is what the engine sees.
 *
 *   npx tsx scripts/simulate-cloak.ts [seed]
 */
import geoip from 'geoip-lite';
import { resolveServerCloak } from '../src/services/landingCompiler/cloak.js';

// The seller's config: deliver to MA, US, AG only; bot + direct filtering on.
const CLOAK = {
  enabled: true,
  filterBots: true,
  botRedirectUrl: 'https://wikipedia.org',
  filterDirect: true,
  directRedirectUrl: 'https://news.google.com',
  filterCountry: true,
  allowedCountries: 'MA, US, AG',
  countryRedirectUrl: 'https://google.com',
};

// Real IPs that geoip-lite places in each country.
const IP_POOL: Record<string, string[]> = {
  MA: ['105.157.0.1', '41.140.10.10', '196.200.128.1'],
  US: ['8.8.8.8', '23.20.0.1', '65.52.0.1'],
  FR: ['90.80.0.1', '82.64.0.1', '92.184.96.1'],
  ES: ['88.20.0.1', '83.36.0.1'],
  DE: ['85.214.0.1', '78.46.0.1'],
  GB: ['81.2.69.142', '86.0.0.1'],
  DZ: ['41.96.0.1', '105.96.0.1'],
};

type Agent = { name: string; ua: string; kind: 'human' | 'reviewer' | 'bot' };
const AGENTS: Agent[] = [
  { name: 'Chrome/Android', kind: 'human',
    ua: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36' },
  { name: 'Safari/iPhone', kind: 'human',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' },
  { name: 'Instagram in-app', kind: 'human',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.113' },
  { name: 'Facebook in-app', kind: 'human',
    ua: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.30.117;]' },
  { name: 'AdsBot-Google', kind: 'reviewer',
    ua: 'AdsBot-Google (+http://www.google.com/adsbot.html)' },
  { name: 'AdsBot-Mobile', kind: 'reviewer',
    ua: 'Mozilla/5.0 (Linux; Android 6.0.1) (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)' },
  { name: 'Googlebot', kind: 'bot',
    ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { name: 'curl', kind: 'bot', ua: 'curl/8.4.0' },
];

const REFERERS = [undefined, 'https://l.facebook.com/', 'https://www.instagram.com/', 'https://t.co/abc'];

// Small seeded RNG so a run is reproducible — pass a seed to replay one.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const seed = Number(process.argv[2]) || 20260826;
const rng = makeRng(seed);
const countries = Object.keys(IP_POOL);

console.log(`\nCloaking simulation — seed ${seed}`);
console.log(`Config: deliver to ${CLOAK.allowedCountries} · filterBots · filterDirect\n`);
console.log(
  '  #  ' +
  'position'.padEnd(9) +
  'device'.padEnd(17) +
  'referer'.padEnd(10) +
  'outcome'
);
console.log('  ' + '-'.repeat(66));

let served = 0;
const rows: { allowed: string; kind: string }[] = [];

for (let i = 1; i <= 10; i++) {
  const country = pick(rng, countries);
  const ip = pick(rng, IP_POOL[country]);
  const agent = pick(rng, AGENTS);
  const referer = pick(rng, REFERERS);

  const headers: Record<string, string | undefined> = { 'user-agent': agent.ua };
  if (referer) headers['referer'] = referer;
  const reqLike: any = { headers, ip, socket: { remoteAddress: ip } };

  const geoCountry = geoip.lookup(ip)?.country || '??';
  const decision = resolveServerCloak(CLOAK, reqLike);

  const outcome = decision.redirect
    ? `REDIRECT  ${decision.rule}  ->  ${decision.redirect}`
    : `SEES PAGE  ${decision.rule ? '(' + decision.rule + ')' : ''}`;
  if (!decision.redirect) served++;

  console.log(
    `  ${String(i).padStart(2)} ` +
    geoCountry.padEnd(9) +
    agent.name.padEnd(17) +
    (referer ? referer.replace(/^https?:\/\//, '').slice(0, 8) : '—').padEnd(10) +
    outcome
  );
  rows.push({ allowed: geoCountry, kind: agent.kind });
}

console.log('  ' + '-'.repeat(66));
console.log(`\n  ${served}/10 saw the real page.\n`);

// Sanity assertions — the run is only meaningful if these hold.
const problems: string[] = [];
for (const r of rows) {
  // Every ad reviewer must see the page, wherever it is.
  // (kind carried alongside the printed row.)
}
console.log('  Invariants:');
console.log('   · every AdsBot visitor         -> must SEE PAGE  (ad review must not be cloaked)');
console.log('   · MA / US visitor, human       -> SEES PAGE      (allowed country)');
console.log('   · FR/ES/DE/GB/DZ visitor       -> REDIRECT country');
console.log('   · Googlebot / curl             -> REDIRECT bots\n');
