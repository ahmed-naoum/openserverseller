/**
 * « Quel moteur marche vraiment ? » — réussites et échecs par MODÈLE, rôle par rôle.
 *
 * POURQUOI CET ÉCRAN NE PEUT PAS ÊTRE UN FILTRE DE PLUS SUR LE JOURNAL. Le
 * journal compte des lignes d'erreur, et une ligne d'erreur dit qu'un tour a
 * cassé, pas QUEL moteur l'a cassé. Avec cinq moteurs de transcription derrière
 * une seule chaîne de repli, « 12 erreurs STT » est compatible avec un moteur
 * mort et quatre en bonne santé, ou avec les cinq qui se dégradent ensemble :
 * deux problèmes opposés, deux réparations opposées. L'identité du modèle vit
 * dans `meta`, et c'est le serveur qui la regroupe.
 *
 * TROIS ISSUES, PAS DEUX, et c'est la raison d'être de la barre orange :
 *
 *   Réussi     le moteur a répondu du premier coup
 *   Rattrapé   il a répondu, mais après un réessai ou un repli
 *   Échoué     il n'a pas répondu du tout
 *
 * « Rattrapé » est la seule alerte précoce que ce produit possède. Rien en aval
 * ne s'en aperçoit — le client a eu sa réponse — et ça reste invisible jusqu'au
 * jour où le repli s'épuise à son tour. Le fondre dans « réussi » rendrait
 * l'écran plus vert et strictement moins utile.
 *
 * LE SENS DE `meta` CHANGE SELON LE RÔLE, et les libellés en tiennent compte :
 * en STT la ligne nomme le moteur INTERROGÉ (donc un rattrapage est un échec de
 * CE moteur), en TTS elle nomme le moteur qui a effectivement parlé.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Gauge,
  Loader2,
  Mic,
  ShieldAlert,
  Volume2,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { waLogsApi } from '../../lib/waLogsApi';
import type { WaModelRoleStats, WaModelRow, WaModelStats } from '../../lib/waLogsApi';
import { formatWaMoney } from '../../lib/waAgentApi';

/* ------------------------------------------------------------------ */
/* constantes                                                          */
/* ------------------------------------------------------------------ */

type Role = 'BRAIN' | 'STT' | 'TTS';

const ROLE_META: Record<Role, { label: string; icon: LucideIcon; tone: string; help: string }> = {
  BRAIN: {
    label: 'Cerveau',
    icon: Brain,
    tone: 'bg-violet-50 text-violet-600',
    help: 'Le modèle qui rédige les réponses. Un échec ici, c’est une conversation qui reste sans réponse.',
  },
  STT: {
    label: 'Transcription',
    icon: Mic,
    tone: 'bg-sky-50 text-sky-600',
    help:
      'Les moteurs qui écoutent les notes vocales. La ligne nomme le moteur INTERROGÉ : un rattrapage compte comme un échec de ce moteur-là, même si le client a bien eu sa réponse. Le maillon de repli qui l’a sauvée n’est PAS crédité ici — le journal écrit une ligne par note, pas une par tentative ; ouvrez la ligne pour voir qui a répondu.',
  },
  TTS: {
    label: 'Voix',
    icon: Volume2,
    tone: 'bg-amber-50 text-amber-600',
    help:
      'Les moteurs qui parlent. La ligne nomme le moteur qui a effectivement produit l’audio, pas celui qui était demandé.',
  },
};

const OUTCOMES = [
  { key: 'ok', label: 'Réussi', color: '#10b981' },
  { key: 'degraded', label: 'Rattrapé', color: '#f59e0b' },
  { key: 'failed', label: 'Échoué', color: '#f43f5e' },
] as const;

const SOURCES = [
  { key: 'worker', label: 'Production', help: 'Le trafic réel des comptes, produit par le worker WhatsApp.' },
  { key: 'api', label: 'Tests', help: 'Les appels lancés à la main depuis le tableau de bord (bouton « Tester », aperçus vocaux).' },
  { key: 'all', label: 'Les deux', help: 'Tout ce que le journal contient sur la période.' },
];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const formatCount = (n: number): string => new Intl.NumberFormat('fr-FR').format(n || 0);

const formatMs = (ms: number | null): string => {
  if (ms === null || ms === undefined) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
};

/** Un modèle sans identifiant : Edge en repli n'en nomme aucun. */
const modelLabel = (m: WaModelRow): string => (m.modelId === '?' ? 'modèle non nommé' : m.modelId);

/**
 * Le taux décide de la couleur, mais le VOLUME décide si le taux veut dire
 * quelque chose : trois appels à 0 % ne sont pas une panne, c'est un
 * échantillon. En dessous de cinq essais la pastille reste neutre.
 */
function rateTone(rate: number, attempts: number): string {
  if (attempts < 5) return 'bg-gray-100 text-gray-500';
  if (rate >= 95) return 'bg-emerald-50 text-emerald-700';
  if (rate >= 75) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
}

/** L'axe des x : l'heure suffit sur une journée, la date devient nécessaire au-delà. */
function bucketLabel(iso: string, bucketSeconds: number): string {
  const d = new Date(iso);
  return bucketSeconds >= 86_400 ? format(d, 'd MMM', { locale: fr }) : format(d, 'd MMM HH:mm', { locale: fr });
}

/* ------------------------------------------------------------------ */
/* infobulles                                                          */
/* ------------------------------------------------------------------ */

function BarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row: WaModelRow & { name: string } = payload[0].payload;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg max-w-xs">
      <p className="text-xs font-black text-gray-900">{row.key}</p>
      <div className="mt-2 space-y-0.5 text-[11px]">
        <p className="text-emerald-700">Réussi : <span className="font-bold tabular-nums">{formatCount(row.ok)}</span></p>
        <p className="text-amber-700">Rattrapé : <span className="font-bold tabular-nums">{formatCount(row.degraded)}</span></p>
        <p className="text-rose-700">Échoué : <span className="font-bold tabular-nums">{formatCount(row.failed)}</span></p>
        <p className="pt-1 text-gray-500">
          {formatCount(row.attempts)} appel(s) · {formatMs(row.avgMs)} en moyenne
        </p>
      </div>
      {row.lastFailure && (
        <p className="mt-2 border-t border-gray-100 pt-2 text-[10px] italic text-gray-500">
          Dernier incident : {row.lastFailure.message.slice(0, 140)}
        </p>
      )}
    </div>
  );
}

function TimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
      <p className="text-xs font-black text-gray-900">{label}</p>
      <div className="mt-1.5 space-y-0.5 text-[11px]">
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name} : <span className="font-bold tabular-nums">{formatCount(p.value)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* le composant                                                        */
/* ------------------------------------------------------------------ */

export default function WaModelHealth({
  hours,
  account,
  periodLabel,
  reloadToken,
}: {
  hours: number;
  account: string;
  periodLabel: string;
  /** Incrémenté par le bouton « Actualiser » de la page : un bouton, deux vues. */
  reloadToken: number;
}) {
  const [role, setRole] = useState<Role>('STT');
  // La production par défaut : c'est la question qu'on vient poser ici. Les
  // tests manuels sont réels mais volontaires, et une poignée de sondes peut
  // déplacer un taux qu'on lit comme une mesure du trafic.
  const [source, setSource] = useState('worker');

  const [stats, setStats] = useState<WaModelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await waLogsApi.modelStats({ hours, account, source });
      setStats(res.data.data as WaModelStats);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Les statistiques par modèle n’ont pas pu être chargées.');
    } finally {
      setLoading(false);
    }
  }, [hours, account, source, reloadToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const byRole = useMemo(() => {
    const map = new Map<Role, WaModelRoleStats>();
    (stats?.roles || []).forEach((r) => map.set(r.role, r));
    return map;
  }, [stats]);

  const current = byRole.get(role);
  const meta = ROLE_META[role];
  const RoleIcon = meta.icon;

  /** Les barres, du plus sollicité au moins sollicité — le serveur trie déjà. */
  const bars = useMemo(
    () => (current?.models || []).map((m) => ({ ...m, name: modelLabel(m) })),
    [current]
  );

  const timeline = useMemo(
    () =>
      (stats?.timeline || []).map((p) => ({
        label: bucketLabel(p.at, stats?.bucketSeconds || 3600),
        ok: p[`${role}_ok` as keyof typeof p] as number,
        degraded: p[`${role}_degraded` as keyof typeof p] as number,
        failed: p[`${role}_failed` as keyof typeof p] as number,
      })),
    [stats, role]
  );

  const hasTimeline = timeline.some((p) => p.ok + p.degraded + p.failed > 0);

  /**
   * Le modèle à réparer en premier.
   *
   * Le pire taux ne suffit pas : un moteur essayé deux fois et raté deux fois
   * afficherait 0 % et passerait devant celui qui casse trois cents appels par
   * jour. On classe donc sur le NOMBRE d'échecs, qui est ce que les clients ont
   * réellement subi.
   */
  const worst = useMemo(() => {
    const failing = (current?.models || []).filter((m) => m.failed > 0);
    return failing.sort((a, b) => b.failed - a.failed)[0] || null;
  }, [current]);

  return (
    <div className="space-y-5">
      {/* Rôle + source */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(ROLE_META) as Role[]).map((key) => {
            const info = ROLE_META[key];
            const Icon = info.icon;
            const totals = byRole.get(key)?.totals;
            const active = role === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setRole(key)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {info.label}
                {!!totals?.attempts && (
                  <span
                    className={`rounded-lg px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                      active ? 'bg-white/15 text-white' : rateTone(totals.successRate, totals.attempts)
                    }`}
                  >
                    {totals.successRate}%
                  </span>
                )}
              </button>
            );
          })}

          <span className="mx-1 h-5 w-px bg-gray-200" />

          {SOURCES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSource(option.key)}
              title={option.help}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                source === option.key
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}

          {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
        </div>

        <p className="text-xs leading-relaxed text-gray-500">{meta.help}</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      )}

      {/* Totaux du rôle */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Tile
          icon={RoleIcon}
          label="Appels"
          value={formatCount(current?.totals.attempts ?? 0)}
          hint={`${meta.label} · ${periodLabel}`}
          tone={meta.tone}
        />
        <Tile
          icon={CheckCircle2}
          label="Réussis du premier coup"
          value={formatCount(current?.totals.ok ?? 0)}
          hint={`${current?.totals.successRate ?? 0} % des appels`}
          tone="bg-emerald-50 text-emerald-600"
        />
        <Tile
          icon={AlertTriangle}
          label="Rattrapés"
          value={formatCount(current?.totals.degraded ?? 0)}
          hint="Répondus, mais après un repli ou un réessai"
          tone="bg-amber-50 text-amber-600"
          alert={(current?.totals.degraded ?? 0) > 0}
        />
        <Tile
          icon={XCircle}
          label="Échoués"
          value={formatCount(current?.totals.failed ?? 0)}
          hint={current?.totals.failed ? 'Aucune réponse produite' : 'Rien à signaler'}
          tone={current?.totals.failed ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}
          alert={(current?.totals.failed ?? 0) > 0}
        />
      </div>

      {/* Le moteur à regarder en premier */}
      {worst && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          <div className="min-w-0 text-sm">
            <p className="font-bold text-rose-900">
              À regarder en premier : <code className="font-mono text-xs">{worst.key}</code> —{' '}
              {formatCount(worst.failed)} échec(s) sur {formatCount(worst.attempts)} appel(s).
            </p>
            {worst.lastFailure && (
              <p className="mt-1 text-xs italic text-rose-800/80">
                Dernier incident : {worst.lastFailure.message.slice(0, 220)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Barres empilées par modèle */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black text-gray-900">
              <Gauge size={16} className="text-gray-400" />
              Chaque modèle {meta.label.toLowerCase()}, du plus sollicité au moins sollicité
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Une barre par modèle, découpée en réussites, rattrapages et échecs.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {OUTCOMES.map((o) => (
              <span key={o.key} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: o.color }} />
                {o.label}
              </span>
            ))}
          </div>
        </header>

        {bars.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            {loading ? 'Chargement…' : `Aucun appel ${meta.label.toLowerCase()} sur la période.`}
          </p>
        ) : (
          <div style={{ height: Math.max(160, bars.length * 42 + 30) }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={190}
                  tick={{ fontSize: 10, fill: '#475569' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => (v.length > 30 ? `${v.slice(0, 29)}…` : v)}
                />
                <RechartsTooltip content={<BarTooltip />} cursor={{ fill: '#f8fafc' }} />
                {OUTCOMES.map((o) => (
                  <Bar
                    key={o.key}
                    dataKey={o.key}
                    name={o.label}
                    stackId="outcome"
                    fill={o.color}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Le détail chiffré */}
      {bars.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="px-5 py-3">Modèle</th>
                  <th className="px-3 py-3 text-right">Appels</th>
                  <th className="px-3 py-3 text-right">Réussi</th>
                  <th className="px-3 py-3 text-right">Rattrapé</th>
                  <th className="px-3 py-3 text-right">Échoué</th>
                  <th className="px-3 py-3 text-right">Taux</th>
                  <th className="px-3 py-3 text-right">Latence moy.</th>
                  <th className="px-5 py-3">Dernier incident</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(current?.models || []).map((m) => (
                  <tr key={m.key} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900">{modelLabel(m)}</p>
                      <p className="text-[11px] font-mono text-gray-400">{m.provider}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-600">{formatCount(m.attempts)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-700">
                      {formatCount(m.ok)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-amber-700">
                      {m.degraded ? formatCount(m.degraded) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-rose-700">
                      {m.failed ? formatCount(m.failed) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`inline-block rounded-lg px-2 py-1 text-xs font-black tabular-nums ${rateTone(
                          m.successRate,
                          m.attempts
                        )}`}
                        title={
                          m.attempts < 5
                            ? 'Trop peu d’appels pour que ce taux veuille dire quelque chose.'
                            : `${m.answeredRate} % ont fini par obtenir une réponse, repli compris.`
                        }
                      >
                        {m.successRate}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-600">{formatMs(m.avgMs)}</td>
                    <td className="px-5 py-3 max-w-xs">
                      {m.lastFailure ? (
                        <p className="truncate text-xs text-gray-500" title={m.lastFailure.message}>
                          {m.lastFailure.message}
                        </p>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {!!current?.totals.costCents && (
                <tfoot>
                  <tr className="border-t border-gray-100 bg-gray-50/60 text-xs">
                    <td className="px-5 py-2.5 font-bold text-gray-600" colSpan={7}>
                      Coût annoncé par les fournisseurs sur la période
                    </td>
                    <td className="px-5 py-2.5 text-right font-black tabular-nums text-gray-900">
                      {formatWaMoney(current.totals.costCents)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {/* La courbe */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <header className="mb-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-gray-900">
            <RoleIcon size={16} className="text-gray-400" />
            {meta.label} — au fil du temps
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Tous les modèles du rôle confondus. C’est la courbe qui répond à « depuis quand ? ».
          </p>
        </header>

        {!hasTimeline ? (
          <p className="py-10 text-center text-sm text-gray-400">
            {loading ? 'Chargement…' : 'Aucun appel sur la période.'}
          </p>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip content={<TimelineTooltip />} />
                {OUTCOMES.map((o) => (
                  <Area
                    key={o.key}
                    type="monotone"
                    dataKey={o.key}
                    name={o.label}
                    stackId="outcome"
                    stroke={o.color}
                    fill={o.color}
                    fillOpacity={0.22}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  alert,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-4 ${
        alert ? 'border-rose-100' : 'border-gray-100'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`rounded-xl p-2 ${tone}`}>
          <Icon size={15} />
        </span>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      </div>
      <p className="mt-2.5 text-2xl font-black tabular-nums text-gray-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>
    </div>
  );
}
