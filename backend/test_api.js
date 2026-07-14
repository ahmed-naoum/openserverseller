const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();
const http = require('http');

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'naoum00007@gmail.com' } });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'super-secret-jwt-key');
  
  const options = {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/dashboard/influencer?days=7',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      const parsed = JSON.parse(data);
      console.log('Stats:', parsed.stats);
    });
  });

  req.on('error', error => {
    console.error(error);
  });

  req.end();
}

main().finally(() => prisma.$disconnect());
