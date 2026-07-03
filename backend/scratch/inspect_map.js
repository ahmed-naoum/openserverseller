import fs from 'fs';
import path from 'path';

const file = path.resolve('c:/Users/Victus/Desktop/vegas/frontend/public/world-countries.json');
const geo = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log('Total features:', geo.features.length);
console.log('Sample properties:', geo.features[0].properties);
console.log('Available keys in properties:', Object.keys(geo.features[0].properties));
