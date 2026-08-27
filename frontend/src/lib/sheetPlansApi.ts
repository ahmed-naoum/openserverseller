/**
 * Google Sheets monthly packs — client API and types, both sides.
 *
 * Separate module from sheetAdminApi for the same reason that one is separate
 * from lib/api: the seller's picker and the admin's approval queue talk about
 * the same two tables, and `SheetPlan` / `SheetSubscription` have one place to live.
 *
 * ALL MONEY IS INTEGER CENTS and is never divided here — lib/sheetMoney owns that
 * conversion, at the edge of display. The one exception is `effectivePricePerLead`,
 * which the SERVER computes and sends as a fractional number of cents (1.5 for a
 * $30 / 2 000 pack): a pack can undercut the tariff far enough that an integer
 * cent would print it as free.
 */

import { api } from './api';

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface SheetPlan {
  id: number;
  code: string;
  name: string;
  /** Per period, in CENTS. 3000 is $30. */
  priceCents: number;
  /** Leads the pack covers per period. */
  leadQuota: number;
  periodDays: number;
  description: string | null;
  /**
   * Card accent as `#rrggbb`, or null for the default. A hex and not a class name
   * because Tailwind cannot emit a class it only sees at runtime — see lib/planAccent.
   */
  accentColor: string | null;
  /** Cents per lead on this pack, fractional. Server-computed. */
  effectivePricePerLead: number;
}

export interface AdminSheetPlan extends SheetPlan {
  active: boolean;
  sortOrder: number;
  /** Accounts currently running on this plan — what makes it safe to retire. */
  activeSubscribers: number;
  createdAt: string;
  updatedAt: string;
}

/** The pack covering the caller's leads right now, from GET /sheet-plans. */
export interface ActiveSubscription {
  id: number;
  status: SubscriptionStatus;
  planId: number;
  planCode: string;
  planName: string;
  priceCents: number;
  leadQuota: number;
  leadsUsed: number;
  /** leadQuota − leadsUsed. */
  remaining: number;
  startedAt: string | null;
  endsAt: string | null;
  daysLeft: number;
}

export interface PendingRequest {
  id: number;
  planId: number;
  planCode: string;
  planName: string;
  priceCents: number;
  leadQuota: number;
  requestedAt: string;
}

export interface PlanState {
  subscription: ActiveSubscription | null;
  remaining: number;
  pending: PendingRequest | null;
}

export interface PlansPayload {
  /** False for an account without the Google Sheets entitlement — render nothing. */
  enabled: boolean;
  plans: SheetPlan[];
  state: PlanState;
  /** The per-lead tariff that applies whenever no pack covers a lead. */
  priceCents: number;
}

/** A subscription row as the admin queue lists it. */
export interface AdminSubscription {
  id: number;
  status: SubscriptionStatus;
  leadQuota: number;
  leadsUsed: number;
  remaining: number;
  priceCents: number;
  requestedAt: string;
  startedAt: string | null;
  endsAt: string | null;
  reviewedAt: string | null;
  reviewedBy: number | null;
  cancelledAt: string | null;
  adminNote: string | null;
  requestNote: string | null;
  plan: { id: number; code: string; name: string; periodDays: number };
  user: { id: number; name: string; email: string; googleSheetsOutboundEnabled: boolean };
}

/* ------------------------------------------------------------------ */
/* seller                                                              */
/* ------------------------------------------------------------------ */

export const sheetPlansApi = {
  /** Catalogue, current pack and pending request in one call. */
  get: () => api.get('/sheet-plans'),
  /** Asks an admin to put this account on a pack. Never activates anything. */
  subscribe: (planId: number, note?: string) => api.post('/sheet-plans/subscribe', { planId, note }),
  /** Withdraws the caller's own pending request. */
  cancelRequest: () => api.post('/sheet-plans/cancel-request'),
};

/* ------------------------------------------------------------------ */
/* admin                                                               */
/* ------------------------------------------------------------------ */

export interface PlanDraft {
  code?: string;
  name?: string;
  priceCents?: number;
  leadQuota?: number;
  periodDays?: number;
  sortOrder?: number;
  description?: string | null;
  /** `#rrggbb`, or '' / null to fall back to the default accent. */
  accentColor?: string | null;
  active?: boolean;
}

export const sheetPlansAdminApi = {
  listPlans: () => api.get('/admin/sheet-plans/plans'),
  createPlan: (draft: PlanDraft) => api.post('/admin/sheet-plans/plans', draft),
  updatePlan: (id: number, draft: PlanDraft) => api.patch(`/admin/sheet-plans/plans/${id}`, draft),

  listSubscriptions: (params?: {
    page?: number;
    limit?: number;
    status?: SubscriptionStatus | '';
    userId?: number;
    search?: string;
  }) => api.get('/admin/sheet-plans/subscriptions', { params }),

  approve: (id: number, note?: string) => api.post(`/admin/sheet-plans/subscriptions/${id}/approve`, { note }),
  reject: (id: number, note?: string) => api.post(`/admin/sheet-plans/subscriptions/${id}/reject`, { note }),
  cancel: (id: number, note?: string) => api.post(`/admin/sheet-plans/subscriptions/${id}/cancel`, { note }),
};
