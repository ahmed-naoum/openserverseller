import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Creating confirmation agent...');
    const hashedPassword = await bcrypt.hash('agent123', 10);

    const role = await prisma.role.findUnique({
        where: { name: 'CONFIRMATION_AGENT' }
    });

    if (!role) {
        console.error('CONFIRMATION_AGENT role not found!');
        process.exit(1);
    }

    const agent = await prisma.user.upsert({
        where: { email: 'confirmation@openseller.ma' },
        update: {},
        create: {
            email: 'confirmation@openseller.ma',
            phone: '+212699999999',
            password: hashedPassword,
            roleId: role.id,
            isActive: true,
            kycStatus: 'APPROVED',
            emailVerifiedAt: new Date(),
            profile: {
                create: {
                    fullName: 'Confirmation Agent',
                    city: 'Casablanca',
                    language: 'fr',
                },
            },
        },
        include: { profile: true },
    });

    console.log(`✅ Created Confirmation Agent: ${agent.email}`);
    console.log(`Password: agent123`);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
