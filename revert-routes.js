const fs = require('fs');

const path = 'backend/src/routes/dashboard.routes.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Revert Authorize
content = content.replace(
  "authorize('INFLUENCER', 'VENDOR'),",
  "authorize('INFLUENCER'),"
);

// 2. Revert mode from query
content = content.replace(
  "const { start, end, days, mode: queryMode } = req.query;\n    const mode = queryMode || (req.user!.role === 'VENDOR' ? req.user!.mode : 'AFFILIATE');",
  "const { start, end, days } = req.query;"
);

// 3. Revert whereBase
content = content.replace(
  "const whereBase: any = mode === 'SELLER' ? { referralLink: { product: { ownerId: userId } } } : { influencerId: userId };",
  "const whereBase: any = { \n      influencerId: userId,\n    };"
);

// 4. Revert referralLinks
content = content.replace(
  "prisma.referralLink.findMany({\n        where: mode === 'SELLER' ? { product: { ownerId: userId } } : { influencerId: userId },",
  "prisma.referralLink.findMany({\n        where: { influencerId: userId },"
);

// 5. Revert leads (first query)
content = content.replace(
  "where: {\n          ...(mode === 'SELLER' ? { vendorId: userId } : { referralLink: { influencerId: userId } }),\n          createdAt: dateLimitStart || dateLimitEnd ? {",
  "where: {\n          referralLink: {\n            influencerId: userId\n          },\n          createdAt: dateLimitStart || dateLimitEnd ? {"
);

// 6. Revert leads groupBy
content = content.replace(
  "where: {\n          ...(mode === 'SELLER' ? { vendorId: userId } : { referralLink: { influencerId: userId } }),\n          createdAt: { gte: dateLimitStart, lte: dateLimitEnd }\n        }",
  "where: {\n          referralLink: {\n            influencerId: userId\n          },\n          createdAt: { gte: dateLimitStart, lte: dateLimitEnd }\n        }"
);

// 7. Revert clicks
content = content.replace(
  "where: {\n          ...(mode === 'SELLER' ? { referralLink: { product: { ownerId: userId } } } : { referralLink: { influencerId: userId } }),\n          createdAt: dateLimitStart || dateLimitEnd ? {",
  "where: {\n          referralLink: {\n            influencerId: userId\n          },\n          createdAt: dateLimitStart || dateLimitEnd ? {"
);

// 8. Revert totalEarnings aggregate
content = content.replace(
  "where: { ...(mode === 'SELLER' ? { referralLink: { product: { ownerId: userId } } } : { influencerId: userId }), status: 'APPROVED' },",
  "where: { influencerId: userId, status: 'APPROVED' },"
);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully reverted content!");
