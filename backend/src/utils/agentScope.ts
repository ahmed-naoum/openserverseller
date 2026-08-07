import { prisma } from '../lib/prisma.js';

/**
 * A call-center agent's lead portfolio.
 *
 * Two levels, both set from /admin/users:
 *   - AgentInfluencerAssignment  → which influencers/vendors the agent works.
 *   - AgentProductAssignment     → optionally narrows one of those accounts to a
 *                                  subset of its products.
 *
 * No product rows for an assigned account means the agent works ALL of that
 * account's leads — the behaviour that existed before product assignment, so
 * every already-configured agent keeps exactly the scope they had.
 */

export interface AgentScopeAccount {
  id: number;
  fullName: string;
  email: string | null;
  /** Empty = the whole account. Non-empty = only these products. */
  productIds: number[];
}

export interface AgentScope {
  /** Assigned accounts, newest assignment first — drives the agent's dropdown. */
  accounts: AgentScopeAccount[];
  /** false when nothing is assigned: the agent sees no leads at all. */
  hasScope: boolean;
  /** Prisma `OR` branches matching every lead in scope. Empty when !hasScope. */
  or: any[];
  /** Referral-link ids in scope, for callers that match on links or codes. */
  linkIds: number[];
}

/** productId sets an agent is restricted to, keyed by influencer/vendor id. */
export const getAgentProductRestrictions = async (agentId: number) => {
  const rows = await (prisma as any).agentProductAssignment.findMany({
    where: { agentId },
    select: { influencerId: true, productId: true },
  });

  const map = new Map<number, number[]>();
  for (const row of rows as { influencerId: number; productId: number }[]) {
    const list = map.get(row.influencerId);
    if (list) list.push(row.productId);
    else map.set(row.influencerId, [row.productId]);
  }
  return map;
};

/**
 * Resolve what an agent is allowed to see.
 *
 * @param onlyInfluencerId narrow to a single assigned account (the dropdown
 *   filter). Ignored when that account is not assigned to the agent.
 */
export const getAgentLeadScope = async (
  agentId: number,
  onlyInfluencerId?: number | null,
): Promise<AgentScope> => {
  const [assignments, restrictions] = await Promise.all([
    prisma.agentInfluencerAssignment.findMany({
      where: { agentId },
      include: { influencer: { include: { profile: true } } },
      orderBy: { assignedAt: 'desc' },
    }),
    getAgentProductRestrictions(agentId),
  ]);

  const accounts: AgentScopeAccount[] = assignments.map((a) => ({
    id: a.influencer.id,
    fullName: a.influencer.profile?.fullName || a.influencer.email || `User #${a.influencer.id}`,
    email: a.influencer.email,
    productIds: restrictions.get(a.influencerId) || [],
  }));

  if (accounts.length === 0) {
    return { accounts, hasScope: false, or: [], linkIds: [] };
  }

  // The dropdown filter may only narrow the portfolio, never widen it.
  const selected = onlyInfluencerId
    ? accounts.filter((a) => a.id === Number(onlyInfluencerId))
    : accounts;

  if (selected.length === 0) {
    return { accounts, hasScope: true, or: [], linkIds: [] };
  }

  const links = await prisma.referralLink.findMany({
    where: { influencerId: { in: selected.map((a) => a.id) } },
    select: { id: true, influencerId: true, productId: true },
  });

  const allowedProducts = new Map(
    selected.filter((a) => a.productIds.length > 0).map((a) => [a.id, new Set(a.productIds)]),
  );

  const linkIds = links
    .filter((l) => {
      const allowed = allowedProducts.get(l.influencerId);
      return !allowed || allowed.has(l.productId);
    })
    .map((l) => l.id);

  const or: any[] = [];
  if (linkIds.length > 0) or.push({ referralLinkId: { in: linkIds } });

  // Leads owned by the account directly (vendor imports, integrations) whose
  // referral link may belong to somebody else — or to nobody.
  const unrestricted = selected.filter((a) => a.productIds.length === 0).map((a) => a.id);
  if (unrestricted.length > 0) or.push({ vendorId: { in: unrestricted } });

  // One branch per restricted account: a shared `productId IN (...)` list would
  // leak account A's leads for a product that was only granted on account B.
  for (const account of selected) {
    if (account.productIds.length === 0) continue;
    or.push({
      vendorId: account.id,
      referralLink: { productId: { in: account.productIds } },
    });
  }

  return { accounts, hasScope: true, or, linkIds };
};

/**
 * Agents to push a `new-available-lead` socket event to, for a lead belonging to
 * `influencerId` and (optionally) `productId`. Agents narrowed to other products
 * of that account are left out, so the toast matches what their list will show.
 */
export const getNotifiableAgentIds = async (
  influencerId: number,
  productId?: number | null,
): Promise<number[]> => {
  const assignments = await prisma.agentInfluencerAssignment.findMany({
    where: { influencerId },
    select: { agentId: true },
  });
  if (assignments.length === 0) return [];

  const restrictions: { agentId: number; productId: number }[] =
    await (prisma as any).agentProductAssignment.findMany({
      where: { agentId: { in: assignments.map((a) => a.agentId) }, influencerId },
      select: { agentId: true, productId: true },
    });
  if (restrictions.length === 0) return assignments.map((a) => a.agentId);

  const allowed = new Map<number, Set<number>>();
  for (const r of restrictions) {
    const set = allowed.get(r.agentId);
    if (set) set.add(r.productId);
    else allowed.set(r.agentId, new Set([r.productId]));
  }

  return assignments
    .filter((a) => {
      const set = allowed.get(a.agentId);
      if (!set) return true; // no restriction → whole account
      return productId != null && set.has(productId);
    })
    .map((a) => a.agentId);
};

/** Does this one lead fall inside the agent's portfolio? */
export const isLeadInAgentScope = async (agentId: number, leadId: number) => {
  const scope = await getAgentLeadScope(agentId);
  if (!scope.hasScope || scope.or.length === 0) return false;
  const count = await prisma.lead.count({ where: { id: leadId, OR: scope.or } });
  return count > 0;
};
