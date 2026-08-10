/**
 * Smoke test for the call-center saisie fee in the /leads/livraison stats.
 * Mints an agent token and checks the business-P&L counters against the agent's
 * own saisieFeeMad. These no longer drive the "Bénéfice net (livré)" card — that
 * shows the agent's own earnings now, covered by check_livraison_benefice_net.ts
 * — but they still price the vendor's side. Run with the dev server up.
 */
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma.js';

const API = 'http://localhost:3001/api/v1';
let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

(async () => {
  // Prefer an agent that actually has delivered parcels — a zero scope would
  // make every assertion below pass on empty sums.
  const agents = await prisma.user.findMany({
    where: { role: { name: 'CALL_CENTER_AGENT' } },
    select: { id: true, uuid: true, email: true, saisieFeeMad: true },
  });
  if (!agents.length) throw new Error('no CALL_CENTER_AGENT to test with');

  const delivered = await prisma.lead.groupBy({
    by: ['assignedAgentId'],
    where: { assignedAgentId: { in: agents.map(a => a.id) }, order: { is: { status: 'DELIVERED' } } },
    _count: { _all: true },
  });
  const byAgent = new Map(delivered.map(d => [d.assignedAgentId, d._count._all]));
  const agent =
    agents.find(a => (byAgent.get(a.id) || 0) > 0) || agents[0];
  const deliveredCount = byAgent.get(agent.id) || 0;

  console.log(`agent ${agent.email}  saisieFeeMad=${agent.saisieFeeMad}  delivered=${deliveredCount}\n`);

  const token = jwt.sign({ userId: agent.uuid }, process.env.JWT_SECRET!, { expiresIn: '10m' });

  const res = await fetch(`${API}/leads/livraison?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body: any = await res.json().catch(() => null);
  check('GET /leads/livraison 200', res.status === 200, `got ${res.status}`);
  const s = body?.data?.stats;
  if (!s) {
    console.log(JSON.stringify(body, null, 1));
    throw new Error('no stats in response');
  }

  check('agentCommissionDelivered present', typeof s.agentCommissionDelivered === 'number', String(s.agentCommissionDelivered));

  const expectedCommission = Math.round(agent.saisieFeeMad * s.delivered);
  check(
    `commission = ${agent.saisieFeeMad} × ${s.delivered} = ${expectedCommission}`,
    s.agentCommissionDelivered === expectedCommission,
    `got ${s.agentCommissionDelivered}`
  );

  // The four numbers still have to close against each other.
  const recomputed =
    s.revenueDelivered - s.shippingCostDelivered - s.platformFeeDelivered - s.agentCommissionDelivered;
  check(
    'profitDelivered = encaissé − livraison − commission − saisie',
    Math.abs(recomputed - s.profitDelivered) <= 1,
    `card says ${s.profitDelivered}, sum says ${recomputed}`
  );

  console.log(
    `\ncard: ${s.profitDelivered} MAD` +
      `\n  ${s.revenueDelivered} MAD encaissé · -${s.shippingCostDelivered} MAD livraison` +
      ` · -${s.platformFeeDelivered} MAD commission · -${s.agentCommissionDelivered} MAD saisie agent`
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
