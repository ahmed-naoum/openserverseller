import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function run() {
    // Find referral links with leads
    const links = await p.referralLink.findMany({
        select: { id: true, influencerId: true, code: true }
    });
    console.log('Referral links:', links.length);
    for (const l of links) console.log('  Link', l.id, '- influencer', l.influencerId, '- code', l.code);

    // Find all leads
    const leads = await p.lead.findMany({
        select: { id: true, fullName: true, status: true, referralLinkId: true, assignedAgentId: true },
        take: 10
    });
    console.log('\nLeads:', leads.length);
    for (const l of leads) console.log('  Lead', l.id, '-', l.fullName, '- status:', l.status, '- linkId:', l.referralLinkId, '- agentId:', l.assignedAgentId);

    // Create test leads with AVAILABLE status if none exist
    const availCount = leads.filter(l => l.status === 'AVAILABLE').length;
    if (availCount === 0 && links.length > 0) {
        console.log('\nCreating 3 test leads with AVAILABLE status...');
        for (let i = 1; i <= 3; i++) {
            const lead = await p.lead.create({
                data: {
                    fullName: `Client Test ${i}`,
                    phone: `06${String(i).padStart(8, '0')}`,
                    city: ['Casablanca', 'Rabat', 'Marrakech'][i - 1],
                    address: `${i * 10} Rue Test`,
                    referralLinkId: links[0].id,
                    status: 'AVAILABLE'
                }
            });
            console.log('  Created lead', lead.id, '-', lead.fullName, '- AVAILABLE');
        }
    }

    // Test claiming logic
    const available = await p.lead.findMany({ where: { status: 'AVAILABLE', assignedAgentId: null } });
    console.log('\n⚡ Available for claiming:', available.length);

    if (available.length > 0) {
        // Agent 1 claims first lead
        const a1 = await p.user.findFirst({ where: { email: 'agent1@test.com' } });
        if (a1) {
            // Clear any existing ASSIGNED leads for testing
            await p.lead.updateMany({ where: { assignedAgentId: a1.id, status: 'ASSIGNED' }, data: { status: 'CONTACTED' } });

            const claimed = await p.lead.update({
                where: { id: available[0].id },
                data: { assignedAgentId: a1.id, status: 'ASSIGNED' }
            });
            console.log('✅ Agent 1 claimed lead', claimed.id, ':', claimed.fullName);

            // Check lock
            const active = await p.lead.findFirst({ where: { assignedAgentId: a1.id, status: 'ASSIGNED' } });
            console.log('🔒 Agent 1 locked (has active):', !!active);
        }

        // Agent 2 claims second lead
        if (available.length > 1) {
            const a2 = await p.user.findFirst({ where: { email: 'agent2@test.com' } });
            if (a2) {
                await p.lead.updateMany({ where: { assignedAgentId: a2.id, status: 'ASSIGNED' }, data: { status: 'CONTACTED' } });

                const claimed2 = await p.lead.update({
                    where: { id: available[1].id },
                    data: { assignedAgentId: a2.id, status: 'ASSIGNED' }
                });
                console.log('✅ Agent 2 claimed lead', claimed2.id, ':', claimed2.fullName);
            }
        }

        // Final state
        const final = await p.lead.findMany({
            where: { status: { in: ['AVAILABLE', 'ASSIGNED'] } },
            select: { id: true, fullName: true, status: true, assignedAgentId: true }
        });
        console.log('\nFinal state:');
        for (const l of final) console.log('  Lead', l.id, '-', l.status, '- agent:', l.assignedAgentId);
    }

    console.log('\n=== TEST COMPLETE ===');
    await p.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
