/**
 * Confirms the admin-set "bénéfice net par colis livré" is what the agent's
 * facturation actually pays — not the saisie fee billed to the vendor.
 * Run with the dev server up: npx tsx scratch/check_net_profit_per_parcel.ts
 */
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma.js';

const API = 'http://localhost:3001/api/v1';

async function main() {
  const agent = await prisma.user.findFirst({
    where: { role: { name: 'CALL_CENTER_AGENT' } },
    select: { uuid: true, email: true, saisieFeeMad: true, netProfitPerDeliveredParcelMad: true },
  });
  if (!agent) throw new Error('no CALL_CENTER_AGENT to test with');

  console.log(
    `agent ${agent.email}\n` +
      `  saisieFeeMad                   = ${agent.saisieFeeMad} MAD / lead saisi (facturé au vendeur)\n` +
      `  netProfitPerDeliveredParcelMad = ${agent.netProfitPerDeliveredParcelMad} MAD / colis livré (gagné par l'agent)\n`
  );

  const token = jwt.sign({ userId: agent.uuid }, process.env.JWT_SECRET!, { expiresIn: '10m' });
  const res = await fetch(`${API}/agent-facturation/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body: any = await res.json().catch(() => null);

  const rate = body?.data?.feePerParcelMad;
  const ok = res.status === 200 && rate === agent.netProfitPerDeliveredParcelMad;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  /agent-facturation/summary feePerParcelMad = ${rate} ` +
      `(attendu ${agent.netProfitPerDeliveredParcelMad}, status ${res.status})`
  );
  if (body?.data) {
    console.log(
      `  ${body.data.deliveredTotal} colis livrés · ${body.data.billable.count} à facturer = ${body.data.billable.amountMad} MAD`
    );
  }

  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
