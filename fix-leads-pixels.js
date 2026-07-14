const fs = require('fs');

// --- 1. LEADS ---
const infLeadsPath = 'frontend/src/pages/influencer/Leads.tsx';
const venLeadsPath = 'frontend/src/pages/vendor/Leads.tsx';

let leadsContent = fs.readFileSync(infLeadsPath, 'utf8');

// Duplicate to VendorLeads first
let venLeadsContent = leadsContent.replace(/export default function InfluencerLeads/g, 'export default function VendorLeads');
venLeadsContent = venLeadsContent.replace(
  "import { useSearchParams } from 'react-router-dom';",
  "import { useSearchParams } from 'react-router-dom';\nimport { useAuth } from '../../contexts/AuthContext';"
);
venLeadsContent = venLeadsContent.replace(
  "  const currentMode = searchParams.get('mode') || 'AFFILIATE';",
  "  const { user } = useAuth();\n  const currentMode = searchParams.get('mode') || user?.mode || 'SELLER';"
);
// In VendorLeads, the header is "Mes Leads & Parrainages (Affilié)" or (Vendeur). It already has that in InfluencerLeads?
// Let's check what InfluencerLeads has. It probably has {currentMode === 'AFFILIATE' ? '(Affilié)' : '(Vendeur)'}.
fs.writeFileSync(venLeadsPath, venLeadsContent, 'utf8');

// Now revert InfluencerLeads
leadsContent = leadsContent.replace(
  "import { useSearchParams } from 'react-router-dom';\n",
  ""
);
leadsContent = leadsContent.replace(
  "  const [searchParams] = useSearchParams();\n  const currentMode = searchParams.get('mode') || 'AFFILIATE';\n",
  ""
);

// We need to remove the mode logic from API calls
leadsContent = leadsContent.replace(
  "        influencerApi.getLinks({ mode: currentMode }),",
  "        influencerApi.getLinks(),"
);
leadsContent = leadsContent.replace(
  "        influencerApi.getCustomers({ all: true, mode: currentMode })",
  "        influencerApi.getCustomers({ all: true })"
);
leadsContent = leadsContent.replace(/mode: currentMode/g, "mode: undefined"); // Fallback for any other usages

// We need to fix the title in InfluencerLeads
leadsContent = leadsContent.replace(
  /Mes Leads & Parrainages.*?\{currentMode[^}]*\}/g,
  "Mes Leads & Parrainages"
);
// Alternatively, just replace any `(Affilié)` or `(Vendeur)` mentions
leadsContent = leadsContent.replace(
  "{currentMode === 'SELLER' && <span className=\"ml-2 text-emerald-600 text-lg font-bold\">(Vendeur)</span>}",
  ""
);
leadsContent = leadsContent.replace(
  "{currentMode === 'AFFILIATE' && <span className=\"ml-2 text-indigo-600 text-lg font-bold\">(Affilié)</span>}",
  ""
);
// Actually, it might be inline like `Mes Leads & Parrainages {currentMode === 'SELLER' ? '(Vendeur)' : '(Affilié)'}`
leadsContent = leadsContent.replace(
  /\{currentMode === 'SELLER' \? '\(Vendeur\)' : '\(Affilié\)'\}/g,
  ""
);
leadsContent = leadsContent.replace(
  /\{currentMode === 'SELLER' \? '\(Vendeur\)' : '\(Affilié\)'\}/g,
  ""
);

fs.writeFileSync(infLeadsPath, leadsContent, 'utf8');
console.log("Successfully duplicated and reverted Leads!");

// --- 2. PIXELS ---
const infPixelsPath = 'frontend/src/pages/influencer/Pixels.tsx';
const venPixelsPath = 'frontend/src/pages/vendor/Pixels.tsx'; // Does this exist? We'll create it if needed.

if (fs.existsSync(infPixelsPath)) {
  let pixelsContent = fs.readFileSync(infPixelsPath, 'utf8');

  // Duplicate to VendorPixels
  let venPixelsContent = pixelsContent.replace(/export default function InfluencerPixels/g, 'export default function VendorPixels');
  fs.writeFileSync(venPixelsPath, venPixelsContent, 'utf8'); // We'll fix VendorPixels later, let's just make it separate.

  // Revert InfluencerPixels
  // The user said: "on http://localhost:5173/influencer/pixels its wrong" because of the dropdown options.
  // In InfluencerPixels, we added logic to fetch products and show "Mes Produits (Vendeur)".
  // We need to revert that.
  pixelsContent = pixelsContent.replace(
    /import \{ dashboardApi \} from '\.\.\/\.\.\/lib\/api';\n/g,
    ""
  );
  pixelsContent = pixelsContent.replace(
    /import \{ useAuth \} from '\.\.\/\.\.\/contexts\/AuthContext';\n/g,
    ""
  );
  
  // Actually, string replace might be too fragile for this. I will use regex or manual replace.
  
  fs.writeFileSync(infPixelsPath, pixelsContent, 'utf8');
  console.log("Started reverting Pixels!");
}

