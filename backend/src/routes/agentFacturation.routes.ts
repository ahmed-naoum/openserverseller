import { prisma } from '../lib/prisma.js';
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { parseDateRange } from '../lib/dateRange.js';

/**
 * Facturation for a CALL_CENTER_AGENT.
 *
 * The agent is paid per parcel they saisi that actually reached the customer,
 * at their own `netProfitPerDeliveredParcelMad` — an admin-set rate, separate
 * from `saisieFeeMad`, which is what the *vendor* is billed per lead entered.
 * The two answer different questions and are deliberately allowed to differ:
 * the vendor pays for every lead saisi, the agent earns only on deliveries.
 *
 * The flow the screen drives, in order:
 *   1. delivered parcels not yet on an invoice are "à facturer"
 *   2. issuing an invoice freezes them and credits the agent's wallet
 *   3. the wallet balance is withdrawn through the ordinary /payouts route,
 *      where an admin approves and pays it out
 *
 * Step 2 is where the money actually moves, which is why an AgentInvoice is
 * born PAID. Nothing here is reversible from the agent's side.
 */
const router = Router();

// Mirrors the column default in the schema, for the case where a row predates
// the field. Not the saisie fee — that one bills the vendor, not this agent.
const DEFAULT_NET_PROFIT_PER_PARCEL = 10;

const agentOnly = [authenticate, authorize('CALL_CENTER_AGENT')] as const;

const deliveredCondition = {
  OR: [
    { status: 'DELIVERED' },
    { order: { is: { status: 'DELIVERED' } } },
  ],
};

/** Every delivered parcel of this agent with paymentSituation FACTURED that no agent invoice has claimed yet. */
const billableWhere = (agentId: number, range?: { gte?: Date; lte?: Date } | null) => ({
  assignedAgentId: agentId,
  agentInvoiceItem: { is: null },
  paymentSituation: 'FACTURED',
  ...(range ? { createdAt: range } : {}),
});

const feeOf = async (agentId: number) => {
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { netProfitPerDeliveredParcelMad: true },
  });
  return agent?.netProfitPerDeliveredParcelMad ?? DEFAULT_NET_PROFIT_PER_PARCEL;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// GET /agent-facturation/summary
// The six counters at the top of the page, in one round trip.
// ---------------------------------------------------------------------------
router.get(
  '/summary',
  ...agentOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const agentId = req.user!.id;
    const feePerParcelMad = await feeOf(agentId);

    const [deliveredTotal, billableCount, billableValue, invoiceAgg, wallet, pendingPayouts] =
      await Promise.all([
        prisma.lead.count({
          where: {
            assignedAgentId: agentId,
            OR: [
              { paymentSituation: { in: ['FACTURED', 'FACTURED-CC'] } },
              { status: 'DELIVERED' },
              { order: { is: { status: 'DELIVERED' } } },
            ],
          },
        }),
        prisma.lead.count({ where: billableWhere(agentId) }),
        prisma.order.aggregate({
          where: {
            lead: {
              is: {
                assignedAgentId: agentId,
                agentInvoiceItem: { is: null },
                paymentSituation: 'FACTURED',
              },
            },
          },
          _sum: { totalAmountMad: true },
        }),
        prisma.agentInvoice.aggregate({
          where: { agentId },
          _count: { _all: true },
          _sum: { totalAmountMad: true, parcelCount: true },
        }),
        prisma.wallet.findUnique({ where: { userId: agentId } }),
        prisma.payoutRequest.aggregate({
          where: { vendorId: agentId, status: 'PENDING' },
          _count: { _all: true },
          _sum: { amountMad: true },
        }),
      ]);

    res.json({
      status: 'success',
      data: {
        feePerParcelMad,
        // Colis livrés, all-time — the pool everything else is carved out of.
        deliveredTotal,
        billable: {
          count: billableCount,
          amountMad: round2(billableCount * feePerParcelMad),
          parcelValueMad: Math.round(billableValue._sum.totalAmountMad || 0),
        },
        invoiced: {
          count: invoiceAgg._count._all,
          parcelCount: invoiceAgg._sum.parcelCount || 0,
          // Sum of every invoice ever issued: the agent's total earned money.
          totalEarnedMad: round2(invoiceAgg._sum.totalAmountMad || 0),
        },
        wallet: {
          balanceMad: round2(wallet?.balanceMad || 0),
          totalEarnedMad: round2(wallet?.totalEarnedMad || 0),
          totalWithdrawnMad: round2(wallet?.totalWithdrawnMad || 0),
        },
        pendingWithdrawals: {
          count: pendingPayouts._count._all,
          amountMad: round2(pendingPayouts._sum.amountMad || 0),
        },
      },
    });
  })
);

// ---------------------------------------------------------------------------
// GET /agent-facturation/billable
// The delivered parcels waiting to be invoiced, newest first.
// ---------------------------------------------------------------------------
router.get(
  '/billable',
  ...agentOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const agentId = req.user!.id;
    const { page = 1, limit = 50, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(500, Math.max(1, Number(limit) || 50));
    const range = parseDateRange(dateFrom, dateTo);
    const where = billableWhere(agentId, range);

    const feePerParcelMad = await feeOf(agentId);

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              coliatyPackageCode: true,
              customerName: true,
              customerCity: true,
              totalAmountMad: true,
              createdAt: true,
              updatedAt: true,
              items: {
                take: 1,
                select: { product: { select: { nameFr: true, nameAr: true } } },
              },
            },
          },
        },
        orderBy: { order: { updatedAt: 'desc' } },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({
      status: 'success',
      data: {
        feePerParcelMad,
        parcels: leads.map(l => ({
          leadId: l.id,
          orderNumber: l.order?.orderNumber || null,
          packageCode: l.order?.coliatyPackageCode || null,
          customerName: l.order?.customerName || l.fullName,
          customerCity: l.order?.customerCity || null,
          productName: l.order?.items?.[0]?.product?.nameFr || l.order?.items?.[0]?.product?.nameAr || null,
          parcelValueMad: Number(l.order?.totalAmountMad) || 0,
          earnedMad: feePerParcelMad,
          deliveredAt: l.order?.updatedAt || null,
          createdAt: l.order?.createdAt || null,
        })),
        // The whole billable set, not just this page — the "générer" button bills
        // everything that matches, so the confirmation has to quote the real total.
        totals: {
          count: total,
          amountMad: round2(total * feePerParcelMad),
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.max(1, Math.ceil(total / limitNum)),
        },
      },
    });
  })
);

// ---------------------------------------------------------------------------
// POST /agent-facturation/invoices
// Freeze the billable parcels into one invoice and credit the agent's wallet.
// ---------------------------------------------------------------------------
router.post(
  '/invoices',
  ...agentOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const agentId = req.user!.id;
    const { leadIds, dateFrom, dateTo } = req.body as {
      leadIds?: unknown;
      dateFrom?: string;
      dateTo?: string;
    };

    const range = parseDateRange(dateFrom, dateTo);
    const where: any = billableWhere(agentId, range);

    // A subset is allowed, but only ever as a narrowing of what the agent may
    // bill — the ids are intersected with the scope above, never trusted alone.
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      const ids = leadIds.map(Number).filter(n => Number.isInteger(n) && n > 0);
      if (ids.length === 0) throw new AppException(400, 'leadIds invalides');
      where.id = { in: ids };
    }

    const feePerParcelMad = await feeOf(agentId);

    // Amounts come from the database, never from the request body.
    const leads = await prisma.lead.findMany({
      where,
      select: {
        id: true,
        order: { select: { totalAmountMad: true, createdAt: true } },
      },
    });

    if (leads.length === 0) {
      throw new AppException(400, 'Aucun colis livré à facturer pour le moment.');
    }

    const totalAmountMad = round2(leads.length * feePerParcelMad);
    const dates = leads
      .map(l => l.order?.createdAt)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime());

    const invoiceNumber = `FAC-CC-${agentId}-${Date.now()}`;

    let invoice;
    try {
      invoice = await prisma.$transaction(async tx => {
        const created = await tx.agentInvoice.create({
          data: {
            invoiceNumber,
            agentId,
            feePerParcelMad,
            parcelCount: leads.length,
            totalAmountMad,
            status: 'PAID',
            paidAt: new Date(),
            periodFrom: dates[0] || null,
            periodTo: dates[dates.length - 1] || null,
          },
        });

        // The unique index on leadId turns a double submit into a failed
        // transaction rather than a parcel paid twice. See the migration.
        await tx.agentInvoiceItem.createMany({
          data: leads.map(l => ({
            invoiceId: created.id,
            leadId: l.id,
            amountMad: feePerParcelMad,
            parcelValueMad: Number(l.order?.totalAmountMad) || 0,
          })),
        });

        await tx.lead.updateMany({
          where: { id: { in: leads.map(l => l.id) } },
          data: { paymentSituation: 'FACTURED-CC' },
        });

        // An agent may never have had a wallet — nothing else credits one.
        const wallet =
          (await tx.wallet.findUnique({ where: { userId: agentId } })) ??
          (await tx.wallet.create({ data: { userId: agentId } }));

        const balanceAfterMad = round2(wallet.balanceMad + totalAmountMad);
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balanceMad: balanceAfterMad,
            totalEarnedMad: round2(wallet.totalEarnedMad + totalAmountMad),
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amountMad: totalAmountMad,
            balanceAfterMad,
            description: `Facturation ${created.invoiceNumber} — ${leads.length} colis livré(s) × ${feePerParcelMad} MAD`,
          },
        });

        return created;
      });
    } catch (err: any) {
      // P2002 here can only be the leadId index: another request billed the same
      // parcels a moment ago.
      if (err?.code === 'P2002') {
        throw new AppException(409, 'Ces colis viennent d\'être facturés. Rafraîchissez la page.');
      }
      throw err;
    }

    try {
      const { createNotification } = await import('../utils/notification.js');
      await createNotification(
        agentId,
        'PAYOUT_REQUEST_STATUS',
        '🧾 Facture générée',
        `Votre facture ${invoice.invoiceNumber} de ${totalAmountMad} MAD (${leads.length} colis livrés) a été créditée sur votre solde.`
      );
    } catch (err) {
      console.error('Failed to notify agent of new facturation invoice:', err);
    }

    res.status(201).json({
      status: 'success',
      message: `Facture ${invoice.invoiceNumber} générée — ${totalAmountMad} MAD crédités.`,
      data: { invoice },
    });
  })
);

// ---------------------------------------------------------------------------
// GET /agent-facturation/invoices
// ---------------------------------------------------------------------------
router.get(
  '/invoices',
  ...agentOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const agentId = req.user!.id;
    const { page = 1, limit = 20 } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const [invoices, total] = await Promise.all([
      prisma.agentInvoice.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.agentInvoice.count({ where: { agentId } }),
    ]);

    res.json({
      status: 'success',
      data: {
        invoices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.max(1, Math.ceil(total / limitNum)),
        },
      },
    });
  })
);

// ---------------------------------------------------------------------------
// GET /agent-facturation/invoices/:id
// ---------------------------------------------------------------------------
router.get(
  '/invoices/:id',
  ...agentOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = Number(req.params.id);
    if (!Number.isInteger(invoiceId)) throw new AppException(400, 'Identifiant de facture invalide');

    const invoice = await prisma.agentInvoice.findFirst({
      // Scoped by agentId, so one agent can never open another's facture.
      where: { id: invoiceId, agentId: req.user!.id },
      include: {
        agent: { select: { email: true, profile: { select: { fullName: true } } } },
        items: {
          orderBy: { id: 'asc' },
          include: {
            lead: {
              select: {
                id: true,
                fullName: true,
                order: {
                  select: {
                    orderNumber: true,
                    coliatyPackageCode: true,
                    customerName: true,
                    customerCity: true,
                    createdAt: true,
                    updatedAt: true,
                    items: {
                      take: 1,
                      select: { product: { select: { nameFr: true, nameAr: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) throw new AppException(404, 'Facture introuvable');

    res.json({
      status: 'success',
      data: {
        ...invoice,
        items: invoice.items.map(it => ({
          id: it.id,
          leadId: it.leadId,
          amountMad: it.amountMad,
          parcelValueMad: it.parcelValueMad,
          orderNumber: it.lead?.order?.orderNumber || null,
          packageCode: it.lead?.order?.coliatyPackageCode || null,
          customerName: it.lead?.order?.customerName || it.lead?.fullName || null,
          customerCity: it.lead?.order?.customerCity || null,
          productName:
            it.lead?.order?.items?.[0]?.product?.nameFr ||
            it.lead?.order?.items?.[0]?.product?.nameAr ||
            null,
          deliveredAt: it.lead?.order?.updatedAt || null,
        })),
      },
    });
  })
);

export default router;
