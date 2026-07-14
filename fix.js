const fs = require('fs');

let inv = fs.readFileSync('frontend/src/pages/vendor/Inventory.tsx', 'utf8');
inv = inv.replace("import React, { useRef, useState, useLayoutEffect } from 'react';", "import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';");
inv = inv.replace(/setClaims\(prev => prev\.map\(c => \{[\s\S]*?return c;\n\s*\}\)\);/g, '// setClaims update skipped');
fs.writeFileSync('frontend/src/pages/vendor/Inventory.tsx', inv);

let prod = fs.readFileSync('frontend/src/pages/vendor/Products.tsx', 'utf8');
prod = prod.replace("import { useState } from 'react';", "import { useState, useEffect } from 'react';");
fs.writeFileSync('frontend/src/pages/vendor/Products.tsx', prod);
