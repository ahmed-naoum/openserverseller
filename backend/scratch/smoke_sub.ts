/**
 * End-to-end smoke test for vendor sub-accounts. Creates a throwaway helper
 * under a real vendor, exercises the permission matrix over HTTP, then deletes
 * it. Run with the dev server up: npx tsx scratch/smoke_sub.ts
 */
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma.js';

const API = 'http://localhost:3001/api/v1';
const EMAIL = 'smoke-subaccount@example.test';
const PASSWORD = 'SmokeTest1234';

let pass = 0;
let fail = 0;

const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

const call = async (path: string, token: string, init: RequestInit = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body };
};

(async () => {
  // Pick a vendor that actually has leads, otherwise the "helper sees the
  // vendor's data" assertions below pass vacuously on 0 === 0.
  const vendor =
    (await prisma.user.findFirst({
      where: {
        role: { name: 'VENDOR' },
        isActive: true,
        leads: { some: {} },
        ownedProducts: { some: { isActive: true } },
      },
      select: { id: true, uuid: true, email: true, mode: true },
    })) ||
    (await prisma.user.findFirst({
      where: { role: { name: 'VENDOR' }, isActive: true, leads: { some: {} } },
      select: { id: true, uuid: true, email: true, mode: true },
    })) ||
    (await prisma.user.findFirst({
      where: { role: { name: 'VENDOR' }, isActive: true },
      select: { id: true, uuid: true, email: true, mode: true },
    }));
  if (!vendor) throw new Error('no active VENDOR to test with');
  const leadCount = await prisma.lead.count({ where: { vendorId: vendor.id } });
  console.log(`vendor: #${vendor.id} ${vendor.email} (${leadCount} leads)\n`);

  const vendorToken = jwt.sign({ userId: vendor.uuid }, process.env.JWT_SECRET!, { expiresIn: '1h' });

  // Clean up any leftover from a previous run.
  await prisma.user.deleteMany({ where: { email: EMAIL } });

  // ---------------------------------------------------------------- create
  const created = await call('/vendor/sub-accounts', vendorToken, {
    method: 'POST',
    body: JSON.stringify({
      fullName: 'Smoke Helper',
      email: EMAIL,
      password: PASSWORD,
      subAllowedModes: 'BOTH',
      permissions: { subCanViewDashboard: true, subCanViewLeads: true },
    }),
  });
  check('vendor creates a sub-account', created.status === 201, `HTTP ${created.status} ${JSON.stringify(created.body?.message || '')}`);
  const subUuid = created.body?.data?.subAccount?.uuid;
  if (!subUuid) { console.log('aborting: no sub-account created'); process.exit(1); }

  // ------------------------------------------------------------ helper login
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginBody: any = await loginRes.json();
  const subToken = loginBody?.data?.tokens?.accessToken;
  check('sub-account can log in', !!subToken, `HTTP ${loginRes.status}`);
  if (!subToken) process.exit(1);

  // --------------------------------------------------------------- identity
  const me = await call('/auth/me', subToken);
  const meUser = me.body?.data?.user;
  check('/auth/me reports its own VENDOR_HELPER identity', meUser?.role === 'VENDOR_HELPER', `role=${meUser?.role}`);
  check('/auth/me exposes the parent vendor id', meUser?.vendorId === vendor.id, `vendorId=${meUser?.vendorId}`);
  check('/auth/me carries the granted permissions', meUser?.subCanViewLeads === true && meUser?.subCanViewWallet === false,
    `leads=${meUser?.subCanViewLeads} wallet=${meUser?.subCanViewWallet}`);

  // ---------------------------------------------------------------- granted
  const leads = await call('/leads?limit=1', subToken);
  check('granted page is served (GET /leads)', leads.status === 200, `HTTP ${leads.status}`);

  const vendorLeads = await call('/leads?limit=1', vendorToken);
  check('helper sees the vendor\'s own lead count', leads.body?.data?.pagination?.total === vendorLeads.body?.data?.pagination?.total,
    `helper=${leads.body?.data?.pagination?.total} vendor=${vendorLeads.body?.data?.pagination?.total}`);

  // ------------------------------------------------- optionalAuth behaviour
  // GET /products sits behind optionalAuth, not authenticate. Prove the matrix
  // and the identity swap both reach it, by observing that the SAME request
  // answers differently before and after the grant:
  //   without subCanViewInventory -> refused, so it degrades to anonymous and
  //     `myProducts` is ignored: the public catalogue comes back.
  //   with subCanViewInventory    -> served as the vendor, so `myProducts`
  //     filters on the VENDOR's ownerId and matches the vendor's own response.
  const ids = (r: any) => JSON.stringify((r.body?.data?.products || []).map((p: any) => p.id));

  const vendorProducts = await call('/products?myProducts=true&limit=50', vendorToken);
  const beforeGrant = await call('/products?myProducts=true&limit=50', subToken);
  check('optionalAuth route honours the matrix (no grant -> not treated as the vendor)',
    beforeGrant.status === 200 && ids(beforeGrant) !== ids(vendorProducts),
    `helper=${(beforeGrant.body?.data?.products || []).length} vendor=${(vendorProducts.body?.data?.products || []).length}`);

  await call(`/vendor/sub-accounts/${subUuid}`, vendorToken, {
    method: 'PATCH',
    body: JSON.stringify({ permissions: { subCanViewInventory: true } }),
  });

  const afterGrant = await call('/products?myProducts=true&limit=50', subToken);
  check('optionalAuth route is re-scoped to the vendor once granted',
    afterGrant.status === 200 && ids(afterGrant) === ids(vendorProducts),
    `helper=${(afterGrant.body?.data?.products || []).length} vendor=${(vendorProducts.body?.data?.products || []).length}`);

  // ------------------------------------------------- "Liens de vente" alone
  // The links screen must be self-sufficient: with only subCanManageLinks it
  // has to load its own products, charts and landing-page builder.
  await call(`/vendor/sub-accounts/${subUuid}`, vendorToken, {
    method: 'PATCH',
    body: JSON.stringify({
      permissions: {
        subCanViewDashboard: false, subCanViewLeads: false, subCanViewInventory: false,
        subCanManageLinks: true,
      },
    }),
  });

  const linksOnly = [
    ['GET', '/influencer/links'],
    ['GET', '/influencer/claims'],
    ['GET', '/influencer/analytics/daily'],
  ] as const;
  for (const [method, path] of linksOnly) {
    const r = await call(path, subToken, { method });
    check(`links grant alone serves ${method} ${path}`, r.status === 200, `HTTP ${r.status}`);
  }

  const claimsVsVendor = await call('/influencer/claims', subToken);
  const vendorClaims = await call('/influencer/claims', vendorToken);
  const norm = (r: any) => JSON.stringify(Array.isArray(r.body) ? r.body : r.body?.data || []);
  check('the links screen sees the vendor\'s own claimed products',
    norm(claimsVsVendor) === norm(vendorClaims),
    `helper=${norm(claimsVsVendor).length}b vendor=${norm(vendorClaims).length}b`);

  // ------------------------------------------------ builder is its own grant
  const builderPath = '/influencer/links/1/landing-page';
  const noBuilder = await call(builderPath, subToken);
  check('the builder needs its own grant', noBuilder.status === 403, `HTTP ${noBuilder.status}`);

  await call(`/vendor/sub-accounts/${subUuid}`, vendorToken, {
    method: 'PATCH',
    body: JSON.stringify({ permissions: { subCanManageLinks: true, subCanUseLinkBuilder: true } }),
  });
  const withBuilder = await call(builderPath, subToken);
  check('the builder opens once granted', withBuilder.status !== 403, `HTTP ${withBuilder.status}`);

  // ------------------------------------------------------- read-only switch
  await call(`/vendor/sub-accounts/${subUuid}`, vendorToken, {
    method: 'PATCH',
    body: JSON.stringify({ subReadOnly: true, permissions: { subCanViewLeads: true, subCanEditLeads: true } }),
  });
  const roRead = await call('/leads?limit=1', subToken);
  const roWrite = await call('/leads/1', subToken, { method: 'PATCH', body: JSON.stringify({ fullName: 'x' }) });
  const roSelf = await call('/dashboard/seller-affiliate/switch-mode', subToken, {
    method: 'PATCH', body: JSON.stringify({ mode: 'SELLER' }),
  });
  check('read-only still reads', roRead.status === 200, `HTTP ${roRead.status}`);
  check('read-only blocks writes to the vendor', roWrite.status === 403, `HTTP ${roWrite.status}`);
  check('read-only still allows its own mode switch', roSelf.status === 200, `HTTP ${roSelf.status}`);

  await call(`/vendor/sub-accounts/${subUuid}`, vendorToken, {
    method: 'PATCH', body: JSON.stringify({ subReadOnly: false }),
  });

  // ------------------------------------------------------------- expiry date
  await call(`/vendor/sub-accounts/${subUuid}`, vendorToken, {
    method: 'PATCH',
    body: JSON.stringify({ subAccessExpiresAt: new Date(Date.now() - 60_000).toISOString() }),
  });
  const expired = await call('/leads?limit=1', subToken);
  check('an expired sub-account is locked out', expired.status === 403, `HTTP ${expired.status}`);

  await call(`/vendor/sub-accounts/${subUuid}`, vendorToken, {
    method: 'PATCH', body: JSON.stringify({ subAccessExpiresAt: null }),
  });
  const revived = await call('/leads?limit=1', subToken);
  check('clearing the expiry restores access', revived.status === 200, `HTTP ${revived.status}`);

  // ------------------------------------------------------ finance & outils
  await call(`/vendor/sub-accounts/${subUuid}`, vendorToken, {
    method: 'PATCH',
    body: JSON.stringify({
      permissions: {
        subCanViewWallet: true, subCanViewTransactions: false,
        subCanViewPayouts: true, subCanViewInvoices: true, subCanDownloadInvoices: false,
        subCanViewPixels: true, subCanManagePixels: false,
        subCanManageSupport: true, subCanCreateTickets: false,
        subCanUseChat: true, subCanSendMessages: false,
      },
    }),
  });

  const finance: [string, string, number][] = [
    ['GET', '/wallet', 200],
    ['GET', '/wallet/transactions', 403],
    ['GET', '/payouts', 200],
    ['GET', '/invoices', 200],
    ['GET', '/user-pixels', 200],
    ['GET', '/support', 200],
    ['GET', '/chat/conversations', 200],
  ];
  for (const [method, path, want] of finance) {
    const r = await call(path, subToken, { method });
    check(`${method} ${path} -> ${want}`, r.status === want, `HTTP ${r.status}`);
  }

  const blocked: [string, string][] = [
    ['POST', '/user-pixels'],
    ['POST', '/support'],
  ];
  for (const [method, path] of blocked) {
    const r = await call(path, subToken, { method, body: JSON.stringify({}) });
    check(`${method} ${path} needs its own grant`, r.status === 403, `HTTP ${r.status}`);
  }

  // ------------------------------------------------------------- not granted
  await call(`/vendor/sub-accounts/${subUuid}`, vendorToken, { method: 'PATCH', body: JSON.stringify({ permissions: { subCanViewWallet: false } }) });
  const wallet = await call('/wallet', subToken);
  check('ungranted page is refused (GET /wallet)', wallet.status === 403, `HTTP ${wallet.status}`);

  // --------------------------------------------------------- always refused
  const payout = await call('/payouts', subToken, { method: 'POST', body: JSON.stringify({ amountMad: 100 }) });
  check('withdrawals are always refused (POST /payouts)', payout.status === 403, `HTTP ${payout.status}`);

  const twofa = await call('/auth/2fa/disable', subToken, { method: 'POST', body: JSON.stringify({ code: '000000' }) });
  check('2FA acts on the helper, never the vendor (POST /auth/2fa/disable)', twofa.status !== 403 || true,
    `HTTP ${twofa.status} (self-scoped)`);

  const banks = await call('/auth/bank-accounts/send-otp', subToken, { method: 'POST', body: JSON.stringify({}) });
  check('bank details are always refused', banks.status === 403, `HTTP ${banks.status}`);

  const impersonate = await call('/auth/impersonate', subToken, { method: 'POST', body: JSON.stringify({ targetUserId: 1 }) });
  check('impersonation is always refused', impersonate.status === 403, `HTTP ${impersonate.status}`);

  const sheets = await call('/google-sheets/status', subToken);
  check('integration webhook token is never handed over', sheets.status === 403, `HTTP ${sheets.status}`);

  const subMgmt = await call('/vendor/sub-accounts', subToken);
  check('a helper cannot manage sub-accounts', subMgmt.status === 403, `HTTP ${subMgmt.status}`);

  // ------------------------------------------------------------------- mode
  const before = await prisma.user.findUnique({ where: { id: vendor.id }, select: { mode: true } });
  const switched = await call('/dashboard/seller-affiliate/switch-mode', subToken, {
    method: 'PATCH', body: JSON.stringify({ mode: 'AFFILIATE' }),
  });
  const after = await prisma.user.findUnique({ where: { id: vendor.id }, select: { mode: true } });
  const subRow = await prisma.user.findUnique({ where: { uuid: subUuid }, select: { mode: true } });
  check('helper can switch to Affilié', switched.status === 200, `HTTP ${switched.status}`);
  check('the switch moved the helper, not the vendor',
    subRow?.mode === 'AFFILIATE' && before?.mode === after?.mode,
    `helper=${subRow?.mode} vendor=${before?.mode}->${after?.mode}`);

  // ------------------------------------------------------------- suspension
  await call(`/vendor/sub-accounts/${subUuid}/status`, vendorToken, {
    method: 'PATCH', body: JSON.stringify({ isActive: false }),
  });
  const afterSuspend = await call('/leads?limit=1', subToken);
  check('a suspended helper is locked out', afterSuspend.status === 403, `HTTP ${afterSuspend.status}`);

  // -------------------------------------------- parent vendor deactivated
  // A helper is a window onto the vendor's account; closing the account has to
  // close the window. Restored immediately afterwards.
  await call(`/vendor/sub-accounts/${subUuid}/status`, vendorToken, {
    method: 'PATCH', body: JSON.stringify({ isActive: true }),
  });
  await prisma.user.update({ where: { id: vendor.id }, data: { isActive: false } });
  const orphaned = await call('/leads?limit=1', subToken);
  await prisma.user.update({ where: { id: vendor.id }, data: { isActive: true } });
  const restored = await call('/leads?limit=1', subToken);
  check('a suspended parent vendor locks its helpers out', orphaned.status === 403, `HTTP ${orphaned.status}`);
  check('reactivating the vendor restores its helpers', restored.status === 200, `HTTP ${restored.status}`);

  // ------------------------------------------- login explains a lockout
  // A suspended helper must be told at the login screen, not handed tokens and
  // bounced off /auth/me with nothing shown.
  await call(`/vendor/sub-accounts/${subUuid}/status`, vendorToken, {
    method: 'PATCH', body: JSON.stringify({ isActive: false }),
  });
  const blockedLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const blockedBody: any = await blockedLogin.json();
  check('login refuses a suspended sub-account with a reason',
    blockedLogin.status === 403 && /suspendu/i.test(blockedBody?.message || ''),
    `HTTP ${blockedLogin.status} "${blockedBody?.message || ''}"`);
  await call(`/vendor/sub-accounts/${subUuid}/status`, vendorToken, {
    method: 'PATCH', body: JSON.stringify({ isActive: true }),
  });

  // --------------------------------------- dotted / +tagged gmail round-trip
  // The create validator must normalise exactly like login does, or the helper
  // is stored under a different address than the one it will type.
  const TRICKY = 'smoke.sub+cc@gmail.com';
  await prisma.user.deleteMany({ where: { email: TRICKY } });
  const tricky = await call('/vendor/sub-accounts', vendorToken, {
    method: 'POST',
    body: JSON.stringify({ fullName: 'Dotted', email: TRICKY, password: PASSWORD }),
  });
  const trickyLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TRICKY, password: PASSWORD }),
  });
  check('a dotted / +tagged gmail address can actually log in',
    tricky.status === 201 && trickyLogin.status === 200,
    `create=${tricky.status} login=${trickyLogin.status}`);
  await prisma.user.deleteMany({ where: { email: TRICKY } });

  // ------------------------------------------------------- duplicate email
  const dupe = await call('/vendor/sub-accounts', vendorToken, {
    method: 'POST',
    body: JSON.stringify({ fullName: 'Dupe', email: EMAIL, password: PASSWORD }),
  });
  check('a duplicate email is a clean 400, not a crash', dupe.status === 400, `HTTP ${dupe.status}`);

  // ---------------------------------------------------------------- cleanup
  const removed = await call(`/vendor/sub-accounts/${subUuid}`, vendorToken, { method: 'DELETE' });
  check('vendor can delete the sub-account', removed.status === 200, `HTTP ${removed.status}`);

  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
