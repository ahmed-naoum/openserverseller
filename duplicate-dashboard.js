const fs = require('fs');

const sourcePath = 'frontend/src/pages/influencer/Dashboard.tsx';
const targetPath = 'frontend/src/pages/vendor/Dashboard.tsx';

let content = fs.readFileSync(sourcePath, 'utf8');

// 1. Rename Component
content = content.replace(
  "export default function InfluencerDashboard() {",
  "export default function VendorDashboard() {"
);

// 2. Import useSearchParams and use it
content = content.replace(
  "import { Link } from 'react-router-dom';",
  "import { Link, useSearchParams } from 'react-router-dom';"
);

content = content.replace(
  "  const [loading, setLoading] = useState(true);",
  "  const [loading, setLoading] = useState(true);\n  const [searchParams] = useSearchParams();\n  const currentMode = searchParams.get('mode') || user?.mode || 'SELLER';"
);

// 3. Add to dependencies
content = content.replace(
  "  }, [dateRange, startDate, endDate]);",
  "  }, [dateRange, startDate, endDate, currentMode]);"
);

// 4. Update API call to use sellerAffiliate
content = content.replace(
  "        dashboardApi.influencer(params),",
  "        dashboardApi.sellerAffiliate({ ...params, mode: currentMode }),"
);

// 5. Update other API calls to pass mode
content = content.replace(
  "        influencerApi.getLinks(linkParams),",
  "        influencerApi.getLinks({ ...linkParams, mode: currentMode }),"
);

content = content.replace(
  "        influencerApi.getCustomers({ all: true })",
  "        influencerApi.getCustomers({ all: true, mode: currentMode })"
);

// 6. Add Header with Mode Badge
content = content.replace(
  "      {/* Tier Progress Banner */}",
  "      {/* Header with Mode Badge */}\n      <div className=\"flex items-center justify-between\">\n        <h1 className=\"text-2xl font-bold text-gray-900 flex items-center\">\n          Tableau de bord\n          {currentMode === 'SELLER' && <span className=\"ml-2 text-emerald-600 text-lg font-bold\">(Vendeur)</span>}\n          {currentMode === 'AFFILIATE' && <span className=\"ml-2 text-indigo-600 text-lg font-bold\">(Affilié)</span>}\n        </h1>\n      </div>\n\n      {/* Tier Progress Banner */}"
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Successfully created VendorDashboard!");
