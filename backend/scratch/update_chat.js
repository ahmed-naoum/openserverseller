const fs = require('fs');
let content = fs.readFileSync('backend/src/routes/chat.routes.ts', 'utf8');

content = content.replace(
  /body\('brandingLabelPrintUrl'\)\.optional\(\)\.isString\(\),\s*\]/,
  "body('brandingLabelPrintUrl').optional().isString(),\n        body('requestedLandingPageUrl').optional().isString(),\n    ]"
);

content = content.replace(
  /brandingLabelPrintUrl,\s*subject,/,
  "brandingLabelPrintUrl,\n            requestedLandingPageUrl,\n            subject,"
);

content = content.replace(
  /brandingLabelPrintUrl,\s*orderNumber:/,
  "brandingLabelPrintUrl,\n                    requestedLandingPageUrl,\n                    orderNumber:"
);

content = content.replace(
  /Quantité souhaitée : \$\{requestedQty \|\| 0\} unités\\n\\nL'utilisateur attend votre approbation avant de procéder au paiement\./,
  "Quantité souhaitée : ${requestedQty || 0} unités${requestedLandingPageUrl ? `\\nPage de vente : ${requestedLandingPageUrl}` : ''}\\n\\nL'utilisateur attend votre approbation avant de procéder au paiement."
);

fs.writeFileSync('backend/src/routes/chat.routes.ts', content);
console.log('Update successful');
