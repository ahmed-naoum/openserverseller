/**
 * « Journal de l'agent » — client API et types.
 *
 * Module séparé de waAgentApi pour la même raison que sheetAdminApi : le
 * journal a ses propres formes (curseur au lieu de page, payloads JSON bruts)
 * et une seule page les consomme.
 *
 * LA PAGINATION EST PAR CURSEUR, pas par numéro de page — c'est une table qui
 * grossit pendant qu'on la lit. `before` remonte dans le passé, `after` ne
 * ramène que ce qui est arrivé depuis la dernière ligne connue, ce qui rend le
 * suivi en direct assez léger pour rester allumé.
 */

import { api } from './api';

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

export type WaLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type WaLogCategory =
  | 'SESSION'
  | 'INBOUND'
  | 'OUTBOUND'
  | 'BRAIN'
  | 'STT'
  | 'TTS'
  | 'CREDITS'
  | 'LEAD'
  | 'API'
  | 'WORKER';

/** Le compte auquel la ligne appartient, quand elle en a un. */
export interface WaLogAccount {
  id: number;
  uuid: string;
  email: string;
  name: string;
}

/**
 * Une ligne de la liste.
 *
 * `request` / `response` / `meta` sont ABSENTS ici : la liste ne les demande
 * pas au serveur. Ils n'arrivent qu'avec le détail d'une ligne ouverte.
 */
export interface WaLogRow {
  id: number;
  level: WaLogLevel;
  category: WaLogCategory;
  /** Slug machine : « brain.answer », « outbound.failed ». */
  event: string;
  message: string;
  userId: number | null;
  account: WaLogAccount | null;
  contactId: number | null;
  contactJid: string | null;
  contactName: string | null;
  turnId: number | null;
  messageWaId: string | null;
  errorText: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costCents: number | null;
  /** Quel process a écrit la ligne : le worker WhatsApp ou l'API. */
  source: 'worker' | 'api';
  createdAt: string;
}

/** La même ligne, payloads compris. */
export interface WaLogFull extends WaLogRow {
  request: unknown;
  response: unknown;
  meta: unknown;
}

export interface WaLogDetail {
  log: WaLogFull;
  contact: {
    id: number;
    jid: string;
    phone: string | null;
    pushName: string | null;
    status: string;
    source: string;
  } | null;
  /** Les lignes voisines de la même conversation : le contexte de l'échange. */
  context: {
    id: number;
    level: WaLogLevel;
    category: WaLogCategory;
    event: string;
    message: string;
    createdAt: string;
  }[];
}

export interface WaLogList {
  logs: WaLogRow[];
  /** À passer en `before` pour la page suivante. null = fin du journal. */
  nextCursor: number | null;
  /** L'id le plus récent de la page : le point de reprise du suivi live. */
  newestId: number | null;
  levels: WaLogLevel[];
  categories: WaLogCategory[];
}

export interface WaLogStats {
  hours: number;
  total: number;
  byLevel: Record<WaLogLevel, number>;
  byCategory: Record<WaLogCategory, number>;
  lastEventAt: string | null;
  topErrorAccounts: { userId: number; uuid: string | null; name: string; errors: number }[];
  storedRows: number;
  oldestStoredAt: string | null;
}

/* ------------------------------------------------------------------ */
/* fiabilité par modèle                                                */
/* ------------------------------------------------------------------ */

/**
 * TROIS ISSUES, PAS DEUX.
 *
 * `degraded` est la seule information que ce journal possède et qu'aucun autre
 * écran ne montre : le moteur a bien fini par répondre, mais après un réessai
 * ou un repli. Rien en aval ne s'en aperçoit — le client a eu sa réponse — et
 * ça reste invisible jusqu'au jour où le repli s'épuise à son tour. Le fondre
 * dans « réussi » reviendrait à effacer le seul avertissement précoce dont on
 * dispose.
 */
export interface WaModelRow {
  provider: string;
  /** « ? » quand la ligne n'a pas nommé de modèle (Edge en repli, par exemple). */
  modelId: string;
  /** « provider:modelId », l'identité affichée. */
  key: string;
  attempts: number;
  ok: number;
  degraded: number;
  failed: number;
  /** Passages propres uniquement : un moteur toujours rattrapé n'est pas un moteur qui marche. */
  successRate: number;
  /** Réussites + rattrapages : ce que le client a fini par obtenir. */
  answeredRate: number;
  avgMs: number | null;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  /** La dernière chose qui a mal tourné, pour dire POURQUOI et pas seulement combien. */
  lastFailure: { message: string; at: string } | null;
}

export interface WaModelRoleStats {
  role: 'BRAIN' | 'STT' | 'TTS';
  models: WaModelRow[];
  totals: {
    attempts: number;
    ok: number;
    degraded: number;
    failed: number;
    costCents: number;
    successRate: number;
  };
}

/** Un point de la courbe. Les seaux vides valent zéro, ils ne sont pas absents. */
export interface WaModelTimelinePoint {
  at: string;
  BRAIN_ok: number;
  BRAIN_degraded: number;
  BRAIN_failed: number;
  STT_ok: number;
  STT_degraded: number;
  STT_failed: number;
  TTS_ok: number;
  TTS_degraded: number;
  TTS_failed: number;
}

export interface WaModelStats {
  hours: number;
  since: string;
  source: string;
  bucketSeconds: number;
  roles: WaModelRoleStats[];
  timeline: WaModelTimelinePoint[];
}

/** Ce que la page envoie comme filtres. Tout est optionnel et s'intersecte. */
export interface WaLogFilters {
  /** uuid du compte, ou 'all'. */
  account?: string;
  /** Un niveau, 'all', ou 'problems' (avertissements + erreurs). */
  level?: string;
  category?: string;
  event?: string;
  source?: string;
  q?: string;
  contactId?: number;
  turnId?: number;
  from?: string;
  to?: string;
}

/* ------------------------------------------------------------------ */
/* client                                                              */
/* ------------------------------------------------------------------ */

export const waLogsApi = {
  list: (params: WaLogFilters & { limit?: number; before?: number; after?: number }) =>
    api.get('/admin/wa-logs', { params }),

  detail: (id: number) => api.get(`/admin/wa-logs/${id}`),

  stats: (params: { hours?: number; account?: string }) =>
    api.get('/admin/wa-logs/stats/overview', { params }),

  /**
   * Réussites et échecs PAR MODÈLE, séparés par rôle.
   *
   * `source` n'est pas cosmétique : le trafic de production tourne dans le
   * worker, alors que le bouton « Tester » de la page Modèles tourne dans
   * l'API. Les mélanger laisserait une poignée de sondes volontaires déplacer
   * un taux de réussite de production.
   */
  modelStats: (params: { hours?: number; account?: string; source?: string }) =>
    api.get('/admin/wa-logs/stats/models', { params }),

  /** Applique la fenêtre de rétention tout de suite au lieu d'attendre le worker. */
  prune: () => api.post('/admin/wa-logs/prune'),

  /**
   * Supprime ce que les filtres sélectionnent. Le serveur refuse un filtre
   * vide : purger tout se fait en baissant WA_LOG_RETENTION_DAYS.
   */
  purge: (params: WaLogFilters) =>
    api.delete('/admin/wa-logs', { params, data: { confirm: true } }),
};

/* ------------------------------------------------------------------ */
/* présentation                                                        */
/* ------------------------------------------------------------------ */

/** Durée lisible. Les millisecondes comptent : un tour d'agent se joue là. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
}

/** Numéro lisible à partir du jid WhatsApp, sans inventer de chiffres. */
export function jidToLabel(jid: string | null | undefined): string {
  if (!jid) return '—';
  const [id, domain] = String(jid).split('@');
  // Un @lid masque le numéro : les chiffres devant sont un identifiant interne
  // et les afficher comme un téléphone produit un numéro que personne ne peut
  // appeler. On le dit plutôt que de le maquiller.
  if (/^lid$/i.test(domain || '')) return 'numéro masqué';
  return `+${id}`;
}
