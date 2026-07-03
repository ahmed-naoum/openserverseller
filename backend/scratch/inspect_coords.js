import fs from 'fs';
import path from 'path';

const MAP_WIDTH = 900;
const MAP_HEIGHT = 450;

function project(lon, lat) {
  const x = ((lon + 180) * MAP_WIDTH) / 360;
  const y = ((90 - lat) * MAP_HEIGHT) / 180;
  return { x, y };
}

function getPolygonCentroid(polygon) {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  polygon.forEach(ring => {
    ring.forEach(pt => {
      const { x, y } = project(pt[0], pt[1]);
      sumX += x;
      sumY += y;
      count++;
    });
  });
  return count > 0 ? { x: sumX / count, y: sumY / count } : null;
}

function getCountryCentroid(geometry) {
  if (!geometry) return null;

  if (geometry.type === 'Polygon') {
    return getPolygonCentroid(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    // Find the polygon with the maximum number of points (representing main landmass)
    let maxPoints = 0;
    let mainPolygon = null;
    
    geometry.coordinates.forEach(polygon => {
      let pointsCount = 0;
      polygon.forEach(ring => { pointsCount += ring.length; });
      if (pointsCount > maxPoints) {
        maxPoints = pointsCount;
        mainPolygon = polygon;
      }
    });

    return mainPolygon ? getPolygonCentroid(mainPolygon) : null;
  }
  return null;
}

const file = path.resolve('c:/Users/Victus/Desktop/vegas/frontend/public/world-countries.json');
const geo = JSON.parse(fs.readFileSync(file, 'utf8'));

const testCodes = ['MA', 'US', 'BR', 'FR', 'CN', 'CA'];
geo.features.forEach(f => {
  const code = f.properties.iso_a2;
  if (testCodes.includes(code)) {
    const centroid = getCountryCentroid(f.geometry);
    console.log(`Country: ${f.properties.name} (${code})`);
    console.log(`Centroid calculated (largest poly):`, centroid);
  }
});
