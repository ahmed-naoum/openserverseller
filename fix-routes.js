const fs = require('fs');

const path = 'backend/src/routes/dashboard.routes.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Authorize VENDOR
content = content.replace(
  "authorize('INFLUENCER'),",
  "authorize('INFLUENCER', 'VENDOR'),"
);

// 2. Read mode from query
content = content.replace(
  "const { start, end, days } = req.query;",
  "const { start, end, days, mode: queryMode } = req.query;\n    const mode = queryMode || (req.user!.role === 'VENDOR' ? req.user!.mode : 'AFFILIATE');"
);

// 3. whereBase
content = content.replace(
  /const whereBase: any = \{\s*influencerId: userId,\s*\};/,
  "const whereBase: any = mode === 'SELLER' ? { referralLink: { product: { ownerId: userId } } } : { influencerId: userId };"
);

// 4. referralLinks
content = content.replace(
  "prisma.referralLink.findMany({\n        where: { influencerId: userId },",
  "prisma.referralLink.findMany({\n        where: mode === 'SELLER' ? { product: { ownerId: userId } } : { influencerId: userId },"
);

// 5. leads (first query)
// Note: due to whitespace, we use regex
content = content.replace(
  /where: \{\s*referralLink: \{\s*influencerId: userId\s*\},\s*createdAt: dateLimitStart \|\| dateLimitEnd \? \{/g,
  "where: {\n          ...(mode === 'SELLER' ? { vendorId: userId } : { referralLink: { influencerId: userId } }),\n          createdAt: dateLimitStart || dateLimitEnd ? {"
);

// 6. leads groupBy
content = content.replace(
  /where: \{\s*referralLink: \{\s*influencerId: userId\s*\},\s*createdAt: \{ gte: dateLimitStart, lte: dateLimitEnd \}\s*\}/g,
  "where: {\n          ...(mode === 'SELLER' ? { vendorId: userId } : { referralLink: { influencerId: userId } }),\n          createdAt: { gte: dateLimitStart, lte: dateLimitEnd }\n        }"
);

// 7. clicks
content = content.replace(
  /where: \{\s*referralLink: \{\s*influencerId: userId\s*\},\s*createdAt: dateLimitStart \|\| dateLimitEnd \? \{/g,
  "where: {\n          ...(mode === 'SELLER' ? { referralLink: { product: { ownerId: userId } } } : { referralLink: { influencerId: userId } }),\n          createdAt: dateLimitStart || dateLimitEnd ? {"
);

// 8. totalEarnings aggregate
content = content.replace(
  "where: { influencerId: userId, status: 'APPROVED' },",
  "where: { ...(mode === 'SELLER' ? { referralLink: { product: { ownerId: userId } } } : { influencerId: userId }), status: 'APPROVED' },"
);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully replaced content!");
