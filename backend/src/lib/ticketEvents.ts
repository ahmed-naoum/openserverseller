import { prisma } from './prisma.js';
import { getIO } from './realtime.js';

/**
 * Live "new packaging ticket" alerts.
 *
 * A parcel lands on the packaging desk (helper → Tickets → "En attente") the
 * moment an agent pushes a lead to delivery and Coliaty hands back a package
 * code. The desk works a queue all day, so it needs to hear about that
 * immediately rather than noticing it on the next manual refresh.
 *
 * Delivery is scoped: a helper only sees parcels from the vendors they are
 * assigned to, so only those helpers are notified. Super admins see everything.
 */

export interface NewTicketPayload {
  orderNumber: string;
  packageCode: string;
  customerName: string;
  customerCity: string;
  vendorId: number;
  productName?: string | null;
  amountMad?: number | null;
}

export interface TicketActor {
  id: number;
  /** Display name. Resolved from the profile when the caller doesn't have it. */
  name?: string | null;
  role?: string | null;
}

/** "Youssef B." reads better on the desk's screen than "agent42@…". */
const resolveActorName = async (actor: TicketActor): Promise<string> => {
  if (actor.name && !actor.name.includes('@')) return actor.name;
  try {
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { email: true, profile: { select: { fullName: true } } },
    });
    return user?.profile?.fullName || actor.name || user?.email || 'Un agent';
  } catch {
    return actor.name || 'Un agent';
  }
};

export const TICKETS_NEW_EVENT = 'tickets:new';

/**
 * Broadcasts newly dispatched parcels to the packaging desk.
 *
 * Never throws: a failed notification must not roll back or fail a dispatch that
 * already succeeded at Coliaty.
 */
export const emitNewTickets = async (tickets: NewTicketPayload[], actor: TicketActor): Promise<void> => {
  try {
    const io = getIO();
    if (!io || tickets.length === 0) return;

    const vendorIds = [...new Set(tickets.map((t) => t.vendorId).filter((id) => Number.isFinite(id)))];
    if (vendorIds.length === 0) return;

    // Only helpers who are (a) assigned to one of these vendors and (b) allowed to
    // manage tickets would actually see these rows on their page.
    const assignments = await prisma.helperUserAssignment.findMany({
      where: {
        targetUserId: { in: vendorIds },
        helper: {
          isActive: true,
          canManageTickets: true,
          role: { name: 'HELPER' },
        },
      },
      select: {
        targetUserId: true,
        helper: { select: { uuid: true } },
      },
    });

    const payload = {
      count: tickets.length,
      tickets: tickets.slice(0, 25), // enough for a preview; the page refetches anyway
      actor: {
        name: await resolveActorName(actor),
        role: actor.role || null,
      },
      at: new Date().toISOString(),
    };

    // A helper assigned to several affected vendors must still get one event.
    const helperUuids = new Set(assignments.map((a) => a.helper.uuid).filter(Boolean));

    for (const uuid of helperUuids) {
      const scoped = tickets.filter((t) =>
        assignments.some((a) => a.helper.uuid === uuid && a.targetUserId === t.vendorId)
      );
      if (scoped.length === 0) continue;

      io.to(`user:${uuid}`).emit(TICKETS_NEW_EVENT, {
        ...payload,
        count: scoped.length,
        tickets: scoped.slice(0, 25),
      });
    }

    io.to('role:SUPER_ADMIN').emit(TICKETS_NEW_EVENT, payload);
  } catch (error) {
    console.error('[Tickets] Failed to emit new-ticket notification:', error);
  }
};
