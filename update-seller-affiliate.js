const fs = require('fs');

const path = 'backend/src/routes/dashboard.routes.ts';
let content = fs.readFileSync(path, 'utf8');

const newSellerAffiliate = `router.get(
  '/seller-affiliate',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { start, end, days } = req.query;
    const mode = req.user!.mode || 'SELLER';

    let dateLimitStart: Date | undefined;
    let dateLimitEnd = new Date();

    if (start && end) {
      dateLimitStart = new Date(start as string);
      dateLimitEnd = new Date(end as string);
      dateLimitEnd.setHours(23, 59, 59, 999);
    } else if (days === 'all') {
      dateLimitStart = undefined; // No lower bound for all time
    } else {
      const numDays = parseInt(days as string) || 7;
      dateLimitStart = new Date();
      dateLimitStart.setDate(dateLimitStart.getDate() - (numDays - 1));
      dateLimitStart.setHours(0, 0, 0, 0);
    }

    const whereBase: any = mode === 'SELLER' 
      ? { referralLink: { product: { ownerId: userId } } }
      : { influencerId: userId };

    if (dateLimitStart || dateLimitEnd) {
      whereBase.createdAt = {};
      if (dateLimitStart) whereBase.createdAt.gte = dateLimitStart;
      if (dateLimitEnd) whereBase.createdAt.lte = dateLimitEnd;
    }

    const [
      profile,
      referralLinks,
      commissions,
      campaigns,
      notifications,
      wallet,
      periodStats,
      periodLeadCounts,
      periodClicks
    ] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.referralLink.findMany({
        where: mode === 'SELLER' ? { product: { ownerId: userId } } : { influencerId: userId },
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.influencerCommission.findMany({
        where: whereBase,
        include: { 
          referralLink: {
            include: { product: true }
          },
          order: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.influencerCampaign.findMany({
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.wallet.findUnique({ 
        where: { userId },
        include: { 
          transactions: {
            where: { createdAt: { gte: dateLimitStart, lte: dateLimitEnd } },
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      prisma.lead.findMany({
        where: {
          ...(mode === 'SELLER' ? { vendorId: userId } : { referralLink: { influencerId: userId } }),
          createdAt: dateLimitStart || dateLimitEnd ? {
            ...(dateLimitStart ? { gte: dateLimitStart } : {}),
            ...(dateLimitEnd ? { lte: dateLimitEnd } : {})
          } : undefined
        },
        select: {
          status: true,
          order: {
            select: {
              status: true
            }
          }
        }
      }),
      prisma.lead.groupBy({
        by: ['referralLinkId'],
        where: {
          ...(mode === 'SELLER' ? { vendorId: userId } : { referralLink: { influencerId: userId } }),
          createdAt: { gte: dateLimitStart, lte: dateLimitEnd }
        },
        _count: true
      }),
      (prisma as any).referralLinkClick.findMany({
        where: {
          ...(mode === 'SELLER' ? { referralLink: { product: { ownerId: userId } } } : { referralLink: { influencerId: userId } }),
          createdAt: dateLimitStart || dateLimitEnd ? {
            ...(dateLimitStart ? { gte: dateLimitStart } : {}),
            ...(dateLimitEnd ? { lte: dateLimitEnd } : {})
          } : undefined
        },
        select: {
          ipAddress: true,
          userAgent: true
        }
      })
    ]);

    const leadCountsByLink = periodLeadCounts || [];
    const periodClicksData = periodClicks || [];

    let totalViews = 0;
    const uniqueIPUAs = new Set<string>();
    let whatsappClicks = 0;

    periodClicksData.forEach((c: any) => {
      if (c.userAgent === 'whatsapp_click') {
        whatsappClicks++;
      } else {
        totalViews++;
        uniqueIPUAs.add(\`\${c.ipAddress}-\${c.userAgent || 'unknown'}\`);
      }
    });

    const uniqueVisitors = uniqueIPUAs.size;

    const deliveryStatuses = [
      'PENDING', 'PUSHED_TO_DELIVERY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED', 'CONFIRMED_DELIVERY',
      'NEW_PARCEL', 'WAITING_PICKUP', 'PICKED_UP', 'SENT', 'RECEIVED', 'DISTRIBUTION', 'PROGRAMMER_AUTO', 'POSTPONED',
      'WAITING_PREPARATION', 'PREPARED', 'ENCORE_PREPARED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'REFUSE',
      'NOANSWER', 'CANCELED', 'ERR', 'PROGRAMMER', 'INCORRECT_ADDRESS'
    ];

    const periodLeads = (periodStats || []) as any[];
    const conversions = periodLeads.length;
    const confirmed = periodLeads.filter(l => {
      const s = (l.order?.status || l.status || 'UNKNOWN').toUpperCase();
      return s === 'CONFIRMED' || deliveryStatuses.includes(s);
    }).length;
    const delivered = periodLeads.filter(l => (l.order?.status || '').toUpperCase() === 'DELIVERED').length;

    const stats = {
      conversions,
      confirmed,
      delivered,
      totalViews,
      uniqueVisitors,
      whatsappClicks
    };

    const totalEarnings = await prisma.influencerCommission.aggregate({
      where: { ...(mode === 'SELLER' ? { referralLink: { product: { ownerId: userId } } } : { influencerId: userId }), status: 'APPROVED' },
      _sum: { amount: true }
    });

    res.json({
      profile,
      referralLinks,
      commissions,
      campaigns,
      stats,
      totalEarnings: totalEarnings._sum.amount || 0,
      notifications,
      wallet,
      walletTransactions: wallet?.transactions || [],
      leadCountsByLink
    });
  })
);`;

// Regex to replace from router.get('/seller-affiliate' up to router.patch('/seller-affiliate/switch-mode'
content = content.replace(/router\.get\([\s\S]*?'\/seller-affiliate'[\s\S]*?\}\);\s*\}\)\s*\);/, newSellerAffiliate);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully replaced seller-affiliate route via regex!");
