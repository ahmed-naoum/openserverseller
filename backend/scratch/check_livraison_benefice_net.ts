/**
 * Checks the agent Livraison "Bénéfice net (livré)" card: it must show what the
 * agent earns (rate × colis livrés), not the business P&L on those parcels, and
 * it must agree with /agent-facturation. Run with the dev server up.
 */
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma.js';

const API = 'http://localhost:3001/api/v1';
let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

async function main() {
  const agents = await prisma.user.findMany({
    where: { role: { name: 'CALL_CENTER_AGENT' } },
    select: { uuid: true, email: true, saisieFeeMad: true, netProfitPerDeliveredParcelMad: true },
  });

  for (const agent of agents) {
    const token = jwt.sign({ userId: agent.uuid }, process.env.JWT_SECRET!, { expiresIn: '10m' });
    const auth = { Authorization: `Bearer ${token}` };

    const res = await fetch(`${API}/leads/livraison?limit=1`, { headers: auth });
    const body: any = await res.json().catch(() => null);
    const s = body?.data?.stats;
    if (!s) {
      console.log(`${agent.email}: no stats (status ${res.status})`);
      fail++;
      continue;
    }

    const expected = Math.round(agent.netProfitPerDeliveredParcelMad * s.delivered);
    console.log(
      `\n${agent.email} — ${s.delivered} colis livrés, rate ${agent.netProfitPerDeliveredParcelMad} MAD`
    );
    check('rate exposed to the card', s.agentRatePerParcel === agent.netProfitPerDeliveredParcelMad, String(s.agentRatePerParcel));
    check(
      `card = ${agent.netProfitPerDeliveredParcelMad} × ${s.delivered} = ${expected} MAD`,
      s.agentEarningsDelivered === expected,
      `got ${s.agentEarningsDelivered}`
    );
    check('card is never negative', s.agentEarningsDelivered >= 0, String(s.agentEarningsDelivered));

    // The same parcels, priced by the facturation route — the two screens the
    // agent reads their pay off must never disagree.
    const fRes = await fetch(`${API}/agent-facturation/summary`, { headers: auth });
    const fBody: any = await fRes.json().catch(() => null);
    const f = fBody?.data;
    check(
      'facturation quotes the same rate',
      f?.feePerParcelMad === agent.netProfitPerDeliveredParcelMad,
      `facturation ${f?.feePerParcelMad} vs livraison ${s.agentRatePerParcel}`
    );
    check(
      'same delivered count on both screens',
      f?.deliveredTotal === s.delivered,
      `facturation ${f?.deliveredTotal} vs livraison ${s.delivered}`
    );

    console.log(
      `  card would read: ${s.agentEarningsDelivered} MAD · ` +
        `${s.delivered} colis livrés × ${s.agentRatePerParcel} MAD ` +
        `(ancien affichage: ${s.profitDelivered} MAD)`
    );
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
