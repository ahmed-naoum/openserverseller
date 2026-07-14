const fs = require('fs');

const path = 'frontend/src/pages/influencer/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Revert imports
content = content.replace(
  "import { Link, useSearchParams } from 'react-router-dom';",
  "import { Link } from 'react-router-dom';"
);

// 2. Revert currentMode declaration
content = content.replace(
  "  const [loading, setLoading] = useState(true);\n  const [searchParams] = useSearchParams();\n  const currentMode = searchParams.get('mode') || user?.mode || 'AFFILIATE';",
  "  const [loading, setLoading] = useState(true);"
);

// 3. Revert useEffect dependencies
content = content.replace(
  "  }, [dateRange, startDate, endDate, currentMode]);",
  "  }, [dateRange, startDate, endDate]);"
);

// 4. Revert params
content = content.replace(
  "      const params: any = { mode: currentMode };",
  "      const params: any = {};"
);

// 5. Revert linkParams
content = content.replace(
  "      // Filter links stats by the same date range\n      const linkParams: any = { mode: currentMode };",
  "      // Filter links stats by the same date range\n      const linkParams: any = {};"
);

// 6. Revert customers query
content = content.replace(
  "        influencerApi.getCustomers({ all: true, mode: currentMode })",
  "        influencerApi.getCustomers({ all: true })"
);

// 7. Revert header badge
content = content.replace(
  "      {/* Header with Mode Badge */}\n      <div className=\"flex items-center justify-between\">\n        <h1 className=\"text-2xl font-bold text-gray-900 flex items-center\">\n          Tableau de bord\n          {currentMode === 'SELLER' && <span className=\"ml-2 text-emerald-600 text-lg font-bold\">(Vendeur)</span>}\n          {currentMode === 'AFFILIATE' && <span className=\"ml-2 text-indigo-600 text-lg font-bold\">(Affilié)</span>}\n        </h1>\n      </div>\n\n      {/* Tier Progress Banner */}",
  "      {/* Tier Progress Banner */}"
);

fs.writeFileSync(path, content, 'utf8');
console.log("Successfully reverted InfluencerDashboard!");
