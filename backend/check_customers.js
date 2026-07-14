const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();
const http = require('http');

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'naoum00007@gmail.com' } });
  
  // mock request
  const userId = user.id;
  
  let leadWhereClause = {};
  const influencerLinks = await prisma.referralLink.findMany({
    where: { influencerId: userId },
    select: { id: true }
  });
  const linkIds = influencerLinks.map(l => l.id);
  leadWhereClause.referralLinkId = { in: linkIds };
  
  const leads = await prisma.lead.findMany({
    where: leadWhereClause,
  });
  
  console.log('GET /customers leads count:', leads.length);
}

main().finally(() => prisma.$disconnect());
