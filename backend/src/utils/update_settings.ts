import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching platform settings...');
  const settings = await prisma.platformSettings.findMany();
  console.log('Current Platform Settings:', JSON.stringify(settings, null, 2));

  const maintenanceSetting = await prisma.platformSettings.findUnique({
    where: { key: 'maintenance_mode' }
  });

  if (maintenanceSetting) {
    console.log('Found maintenance_mode settings:', maintenanceSetting.value);
    const value = maintenanceSetting.value as any;
    
    // Update the values to be false (unblocked)
    const updatedValue = {
      ...value,
      registrationBlocked: false,
      influencerRegistrationBlocked: false
    };

    await prisma.platformSettings.update({
      where: { key: 'maintenance_mode' },
      data: { value: updatedValue }
    });
    console.log('Successfully updated maintenance_mode settings in the database to enable registration!');
  } else {
    // If it does not exist, create it with registration allowed
    await prisma.platformSettings.create({
      data: {
        key: 'maintenance_mode',
        value: {
          enabled: false,
          secret: process.env.JWT_SECRET || 'fallback-secret',
          registrationBlocked: false,
          influencerRegistrationBlocked: false
        }
      }
    });
    console.log('Created default maintenance_mode settings with registration enabled!');
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
