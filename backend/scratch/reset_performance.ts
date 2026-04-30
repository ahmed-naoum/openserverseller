import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetPerformance() {
  try {
    console.log('Starting reset of performance data...');

    // 1. Delete all clicks
    const deletedClicks = await (prisma as any).referralLinkClick.deleteMany({});
    console.log(`Deleted ${deletedClicks.count} clicks.`);

    // 2. Delete all commissions
    const deletedCommissions = await prisma.influencerCommission.deleteMany({});
    console.log(`Deleted ${deletedCommissions.count} commissions.`);

    // 3. Reset ReferralLink counters
    const updatedLinks = await (prisma as any).referralLink.updateMany({
      data: {
        clicks: 0,
        conversions: 0,
        earnings: 0
      }
    });
    console.log(`Reset counters for ${updatedLinks.count} referral links.`);

    // Handle foreign key constraints for Leads
    const leadsToReset = await prisma.lead.findMany({
        where: { referralLinkId: { not: null } },
        select: { id: true }
    });
    const leadIds = leadsToReset.map(l => l.id);

    if (leadIds.length > 0) {
        // 1. Delete Lead Status History
        await (prisma as any).leadStatusHistory.deleteMany({
            where: { leadId: { in: leadIds } }
        });

        // 2. Delete Lead Assignments
        await (prisma as any).leadAssignment.deleteMany({
            where: { leadId: { in: leadIds } }
        });

        // 3. Delete Lead Notes (if separate model, checking)
        // await (prisma as any).leadNote.deleteMany({ where: { leadId: { in: leadIds } } });

        // 4. Delete Orders associated with these leads
        await (prisma as any).order.deleteMany({
            where: { leadId: { in: leadIds } }
        });

        // 5. Delete the Leads themselves
        const deletedLeads = await prisma.lead.deleteMany({
            where: { id: { in: leadIds } }
        });
        console.log(`Deleted ${deletedLeads.count} leads and their associated history.`);
    }

    console.log('Reset complete!');
  } catch (error) {
    console.error('Error resetting performance data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPerformance();
