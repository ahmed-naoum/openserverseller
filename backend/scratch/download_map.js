import https from 'https';
import fs from 'fs';
import path from 'path';

const url = 'https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson';
const dest = path.resolve('c:/Users/Victus/Desktop/vegas/frontend/public/world-countries.json');

console.log('Fetching world map GeoJSON from:', url);
console.log('Saving to:', dest);

const file = fs.createWriteStream(dest);

https.get(url, (response) => {
  if (response.statusCode !== 200) {
    console.error('Failed to fetch. Status code:', response.statusCode);
    process.exit(1);
  }
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download complete!');
  });
}).on('error', (err) => {
  fs.unlink(dest, () => {});
  console.error('Error downloading:', err.message);
  process.exit(1);
});
