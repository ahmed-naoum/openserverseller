/**
 * « Envoi des leads » — client API et types de la console admin.
 *
 * Module séparé de lib/api.ts pour la même raison que waAgentApi : la page
 * admin et les panneaux vendeur parlent du même pipeline, et les types de
 * SheetPushJob / SheetCreditTransaction n'ont qu'un seul endroit où vivre.
 *
 * TOUS LES MONTANTS SONT DES CENTS ENTIERS. Ils ne sont jamais divisés ici :
 * lib/sheetMoney possède cette conversion, au bord de l'affichage.
 */

import { api } from './api';

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

export type JobStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'BLOCKED_NO_CREDITS'
  | 'FAILED'
  | 'SKIPPED'
  | 'REMOVED';

export type TxType = 'GRANT' | 'CONSUME' | 'ADMIN_DEBIT' | 'REFUND';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SheetOverview {
  jobs: Record<JobStatus, number>;
  sent24h: number;
  sent30d: number;
  accounts: { entitled: number; connected: number; autoOn: number };
  credits: {
    /** Ce que les comptes détiennent encore, non consommé. */
    outstanding: number;
    totalGranted: number;
    totalConsumed: number;
    /** Ce que la plateforme a facturé sur 30 jours. */
    billed30d: number;
    granted30d: number;
  };
  /** Le plus vieux PENDING : si c'est ancien, le cron ne draine plus. */
  oldestPendingAt: string | null;
  priceCents: number;
}

export interface JobRow {
  id: number;
  status: JobStatus;
  origin: 'AUTO' | 'MANUAL';
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  rowRange: string | null;
  sheetId: string | null;
  createdAt: string;
  updatedAt: string;
  lead: { id: number; fullName: string | null; phone: string | null; source: string; createdAt: string } | null;
  vendor: { id: number; uuid: string; email: string; name: string };
  /**
   * Ce que la ligne a réellement coûté. `null` = aucun débit : le lead n'a
   * jamais atteint la feuille, ou il y était déjà payé (renvoi d'un REMOVED).
   */
  chargedCents: number | null;
  chargedAt: string | null;
}

export interface AccountRow {
  id: number;
  uuid: string;
  email: string;
  phone: string | null;
  name: string;
  role: string;
  createdAt: string;
  entitlement: { enabled: boolean; since: string | null };
  connection: {
    connected: boolean;
    active: boolean;
    auto: boolean;
    url: string | null;
    tab: string | null;
    connectedAt: string | null;
    lastError: string | null;
    lastErrorAt: string | null;
  };
  credits: { balance: number; affordable: number; totalGranted: number; totalConsumed: number };
  jobs: {
    sent: number;
    pending: number;
    blocked: number;
    failed: number;
    skipped: number;
    removed: number;
  };
  lastSentAt: string | null;
}

/** Les compteurs de la réservation — voir services/leadCredits. */
export interface GateStats {
  active: boolean;
  balance: number;
  affordable: number;
  unsent: number;
  capacity: number;
  /** Leads dont le vendeur ne voit pas le numéro faute de crédit. */
  locked: number;
  priceCents: number;
}

export interface LedgerRow {
  id: number;
  type: TxType;
  /** Signé : positif sur un crédit, négatif sur une consommation. Cents. */
  amount: number;
  balanceAfter: number;
  description: string | null;
  leadId: number | null;
  createdBy?: number | null;
  createdAt: string;
  user?: { id: number; uuid: string; email: string; name: string };
}

export interface AccountDetail {
  account: Omit<AccountRow, 'jobs' | 'lastSentAt'>;
  jobsByStatus: Record<JobStatus, number>;
  gate: GateStats;
  transactions: LedgerRow[];
  jobs: {
    id: number;
    status: JobStatus;
    origin: 'AUTO' | 'MANUAL';
    attempts: number;
    lastError: string | null;
    sentAt: string | null;
    createdAt: string;
    lead: { id: number; fullName: string | null; phone: string | null } | null;
  }[];
  priceCents: number;
}

/** Ce que renvoie un drain — les compteurs du service, tels quels. */
export interface DrainStats {
  sent?: number;
  charged?: number;
  blocked?: number;
  failed?: number;
  skipped?: number;
  alreadySent?: number;
  balance?: number;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* client                                                              */
/* ------------------------------------------------------------------ */

export const sheetAdminApi = {
  overview: () => api.get('/admin/sheets/overview'),

  jobs: (params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    userId?: number;
    from?: string;
    to?: string;
  }) => api.get('/admin/sheets/jobs', { params }),

  accounts: (params: { page?: number; limit?: number; search?: string; entitlement?: string }) =>
    api.get('/admin/sheets/accounts', { params }),

  account: (uuid: string) => api.get(`/admin/sheets/accounts/${uuid}`),

  transactions: (params: { page?: number; limit?: number; type?: string; userId?: number }) =>
    api.get('/admin/sheets/transactions', { params }),

  retryJob: (id: number) => api.post(`/admin/sheets/jobs/${id}/retry`),

  drain: (uuid: string, reconcile = false) =>
    api.post(`/admin/sheets/accounts/${uuid}/drain`, { reconcile }),

  setEntitlement: (uuid: string, enabled: boolean) =>
    api.patch(`/admin/sheets/accounts/${uuid}/entitlement`, { enabled }),

  /**
   * La vente de crédits reste sur la route finance existante : c'est elle qui
   * porte la transaction du grand livre, le déblocage de la file et la
   * notification au vendeur. `amount` est en DOLLARS ici — le serveur convertit.
   */
  adjustCredits: (data: { userId: number; amount: number; type: 'CREDIT' | 'DEBIT'; description?: string }) =>
    api.post('/admin/sheet-credits/adjust', data),
};
