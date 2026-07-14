const fs = require('fs');

const extract = JSON.parse(fs.readFileSync('frontend/scratch_modals.js', 'utf8'));
let target = fs.readFileSync('frontend/src/pages/vendor/Inventory.tsx', 'utf8');

// 1. Add missing imports
target = target.replace(
  "import { Package, Clock, ExternalLink } from 'lucide-react';",
  "import { Package, Clock, ExternalLink, RefreshCw, Power, AlertCircle, Copy, QrCode, Plus } from 'lucide-react';\nimport toast from 'react-hot-toast';\nimport { useLanguage } from '../../contexts/LanguageContext';\nimport { buildReferralUrl } from '../../utils/referral';\nimport { containsBlockedWord } from '../../utils/blockedWords';"
);

// 2. Add State inside VendorInventory component
const stateInsert = `  const { t } = useLanguage();\n` + extract.stateCode;
target = target.replace(
  "const { user } = useAuth();",
  "const { user } = useAuth();\n" + stateInsert
);

// 3. Add Logic inside VendorInventory component
target = target.replace(
  "const isLoading = isLoadingInventory || isLoadingClaims;",
  "const isLoading = isLoadingInventory || isLoadingClaims;\n" + extract.logicCode
);

// 4. Add Modals inside the return statement
target = target.replace(
  "    </div>\n  );\n}",
  "\n" + extract.modalsCode + "\n    </div>\n  );\n}"
);

// 5. Add Buttons to claims card
const claimCardButtons = `
                {claim.status === 'APPROVED' && (
                  claim.referralLink ? (
                    claim.referralLink.status === 'BUILDING' ? (
                      <div className="mt-3 w-full flex flex-col items-center gap-1 bg-amber-50 rounded-lg p-2">
                        <span className="text-amber-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          En construction
                        </span>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => { e.preventDefault(); handleOpenLinksModal(claim.productId, claim.product.nameFr); }}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-100 hover:bg-slate-100 rounded-lg transition-colors text-xs font-black uppercase tracking-wider shadow-sm"
                      >
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                        Gérer les liens
                      </button>
                    )
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedProductId(claim.productId);
                        setSelectedProductName(claim.product.nameFr);
                        setCustomName('');
                        setCustomNameError('');
                        setShowCreateModal(true);
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs font-bold shadow-sm"
                    >
                      <Package className="w-3 h-3" />
                      Générer un lien
                    </button>
                  )
                )}
`;

target = target.replace(
  "Détails Produit\n                  <ExternalLink className=\"w-3 h-3\" />\n                </Link>",
  "Détails Produit\n                  <ExternalLink className=\"w-3 h-3\" />\n                </Link>\n" + claimCardButtons
);

// 6. Add Buttons to inventory card
const invCardButtons = `
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedProductId(item.productId);
                    setSelectedProductName(item.product.nameFr);
                    setCustomName('');
                    setCustomNameError('');
                    setShowCreateModal(true);
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs font-bold shadow-sm"
                >
                  <Package className="w-3 h-3" />
                  Générer un lien
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); handleOpenLinksModal(item.productId, item.product.nameFr); }}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-100 hover:bg-slate-100 rounded-lg transition-colors text-xs font-black uppercase tracking-wider shadow-sm"
                >
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                  Gérer les liens
                </button>
`;

target = target.replace(
  "Détails\n                  <ExternalLink className=\"w-3 h-3\" />\n                </Link>",
  "Détails\n                  <ExternalLink className=\"w-3 h-3\" />\n                </Link>\n" + invCardButtons
);

fs.writeFileSync('frontend/src/pages/vendor/Inventory.tsx', target);
