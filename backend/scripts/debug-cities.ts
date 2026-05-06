import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const cities = await prisma.order.findMany({
    select: { customerCity: true }
  });
  
  const uniqueCities = [...new Set(cities.map(c => c.customerCity))];
  console.log('Unique Cities in Orders:');
  console.log(uniqueCities);
  
  const pushedCities = await prisma.order.findMany({
    where: {
      status: { in: ['PUSHED_TO_DELIVERY', 'SHIPPED', 'DELIVERED'] }
    },
    select: { customerCity: true }
  });
  
  const uniquePushedCities = [...new Set(pushedCities.map(c => c.customerCity))];
  console.log('\nUnique Cities for Pushed Leads:');
  console.log(uniquePushedCities);
  
  process.exit(0);
}

check();
