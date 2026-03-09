import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // Find or create CALL_CENTER_AGENT role
    let role = await prisma.role.findFirst({ where: { name: 'CALL_CENTER_AGENT' } });
    if (!role) {
        role = await prisma.role.create({ data: { name: 'CALL_CENTER_AGENT' } });
        console.log('Created CALL_CENTER_AGENT role:', role.id);
    } else {
        console.log('Found CALL_CENTER_AGENT role:', role.id);
    }

    const password = await bcrypt.hash('agent123', 10);

    // Agent 1
    const agent1 = await prisma.user.upsert({
        where: { email: 'agent1@test.com' },
        update: {},
        create: {
            email: 'agent1@test.com',
            password,
            roleId: role.id,
            isActive: true,
            kycStatus: 'APPROVED',
        }
    });
    // Ensure profile exists
    await prisma.userProfile.upsert({
        where: { userId: agent1.id },
        update: {},
        create: { userId: agent1.id, fullName: 'Agent Alpha' }
    });
    console.log('Agent 1 ready:', agent1.email, '(id:', agent1.id, ')');

    // Agent 2
    const agent2 = await prisma.user.upsert({
        where: { email: 'agent2@test.com' },
        update: {},
        create: {
            email: 'agent2@test.com',
            password,
            roleId: role.id,
            isActive: true,
            kycStatus: 'APPROVED',
        }
    });
    await prisma.userProfile.upsert({
        where: { userId: agent2.id },
        update: {},
        create: { userId: agent2.id, fullName: 'Agent Beta' }
    });
    console.log('Agent 2 ready:', agent2.email, '(id:', agent2.id, ')');

    console.log('\n--- Login credentials ---');
    console.log('Agent 1: agent1@test.com / agent123');
    console.log('Agent 2: agent2@test.com / agent123');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
