const fs = require('fs');

const extract = JSON.parse(fs.readFileSync('frontend/scratch_modals.js', 'utf8'));
let target = fs.readFileSync('frontend/src/pages/vendor/Products.tsx', 'utf8');

// 1. Add missing imports
target = target.replace(
  "import { productsApi, publicApi } from '../../lib/api';",
  "import { productsApi, publicApi, influencerApi } from '../../lib/api';\nimport { Package, ExternalLink, RefreshCw, Power, AlertCircle, Copy, QrCode, Plus } from 'lucide-react';\nimport toast from 'react-hot-toast';\nimport { useLanguage } from '../../contexts/LanguageContext';\nimport { buildReferralUrl } from '../../utils/referral';\nimport { containsBlockedWord } from '../../utils/blockedWords';\nimport { useAuth } from '../../contexts/AuthContext';"
);

// 2. Add State inside VendorProducts component
const stateInsert = `  const { t } = useLanguage();\n  const { user } = useAuth();\n` + extract.stateCode;
target = target.replace(
  "const [search, setSearch] = useState('');",
  "const [search, setSearch] = useState('');\n" + stateInsert
);

// 3. Add Logic inside VendorProducts component
target = target.replace(
  "const products = data?.data?.data?.products || [];",
  "const products = data?.data?.data?.products || [];\n" + extract.logicCode.replace('setClaims(prev => prev.map(c => {', '// setClaims disabled for products view\n      /*')
  .replace('          return { ...c, referralLink: newLink };\n        }\n        return c;\n      }));', '*/')
  .replace('setClaims(prev => prev.map(c => {', '// setClaims disabled for products view\n          /*')
  .replace('              return { ...c, referralLink: { ...c.referralLink, isActive: res.data.isActive } };\n            }\n            return c;\n          }));', '*/')
);

// 4. Add Modals inside the return statement
target = target.replace(
  "    </div>\n  );\n}",
  "\n" + extract.modalsCode + "\n    </div>\n  );\n}"
);

// 5. Add Buttons to product card
const productCardButtons = `
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedProductId(product.id);
                      setSelectedProductName(product.nameFr);
                      setCustomName('');
                      setCustomNameError('');
                      setShowCreateModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs font-bold shadow-sm"
                  >
                    <Package className="w-3 h-3" />
                    Générer un lien
                  </button>
                  <button 
                    onClick={(e) => { e.preventDefault(); handleOpenLinksModal(product.id, product.nameFr); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-100 hover:bg-slate-100 rounded-lg transition-colors text-xs font-black uppercase tracking-wider shadow-sm"
                  >
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                    Gérer les liens
                  </button>
                </div>
`;

target = target.replace(
  "<button className=\"btn-primary btn-sm\">Personnaliser</button>\n                </div>\n              </div>",
  "<button className=\"btn-primary btn-sm\">Personnaliser</button>\n                </div>" + productCardButtons + "\n              </div>"
);

fs.writeFileSync('frontend/src/pages/vendor/Products.tsx', target);
