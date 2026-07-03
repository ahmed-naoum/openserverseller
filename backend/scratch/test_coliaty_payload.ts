import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function run() {
  const tracking = 'DHR07265871BW';
  
  // 1. Check if the order exists
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { coliatyPackageCode: tracking },
        { orderNumber: tracking }
      ]
    },
    include: { lead: true }
  });

  if (order) {
    console.log(`Found Order ID: ${order.id}, Status: ${order.status}, Lead ID: ${order.leadId}, Lead Status: ${order.lead?.status}`);
  } else {
    console.log(`No order found with tracking/number: ${tracking}. Webhook will log but not update order status.`);
    // Let's find any order with a coliatyPackageCode to see what they look like
    const anyColiatyOrder = await prisma.order.findFirst({
      where: { coliatyPackageCode: { not: null } }
    });
    if (anyColiatyOrder) {
      console.log(`Example order in database with coliaty package code: ID: ${anyColiatyOrder.id}, code: ${anyColiatyOrder.coliatyPackageCode}`);
    }
  }

  // 2. Trigger webhook locally
  const payload = {
    "DATE": "03-07-2026",
    "EVENT": "PARCEL_STATUS_CHANGED",
    "STATUS": "CLIENT_INTERESE",
    "COMMENT": "Test comment",
    "TRACKING": tracking
  };

  try {
    const res = await axios.post('http://localhost:3001/api/v1/webhooks/coliaty', payload);
    console.log('Webhook Response:', res.status, res.data);
  } catch (err: any) {
    console.error('Webhook Error:', err.response?.status, err.response?.data || err.message);
  }

  await prisma.$disconnect();
}

run();
