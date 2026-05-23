const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model.bin'
];

// CDN url from jsdelivr serving the vladmandic github repo, fallback to raw github url
const baseUrl = 'https://cdn.jsdelivr.net/gh/vladmandic/face-api@master/model/';
const fallbackUrl = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';

function downloadFile(fileName, attempt = 1) {
  return new Promise((resolve, reject) => {
    const dest = path.join(targetDir, fileName);
    const url = (attempt === 1 ? baseUrl : fallbackUrl) + fileName;
    
    console.log(`Downloading ${fileName} from ${attempt === 1 ? 'JsDelivr CDN' : 'GitHub Raw'}...`);
    
    const file = fs.createWriteStream(dest);
    
    const request = https.get(url, (response) => {
      // Handle HTTP redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        const redirectReq = https.get(redirectUrl, (redirectRes) => {
          if (redirectRes.statusCode !== 200) {
            file.close();
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            if (attempt === 1) {
              console.log(`JsDelivr redirect failed for ${fileName}, trying GitHub Raw fallback...`);
              resolve(downloadFile(fileName, 2));
            } else {
              reject(new Error(`Failed download redirect: Status ${redirectRes.statusCode}`));
            }
            return;
          }
          redirectRes.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`Successfully downloaded ${fileName} (redirected)`);
            resolve();
          });
        });
        redirectReq.on('error', (err) => {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          if (attempt === 1) {
            resolve(downloadFile(fileName, 2));
          } else {
            reject(err);
          }
        });
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        if (attempt === 1) {
          console.log(`JsDelivr failed for ${fileName} (Status ${response.statusCode}), trying GitHub Raw fallback...`);
          resolve(downloadFile(fileName, 2));
        } else {
          reject(new Error(`Failed to download ${fileName}: Status ${response.statusCode}`));
        }
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Successfully downloaded ${fileName}`);
        resolve();
      });
    });
    
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      if (attempt === 1) {
        console.log(`JsDelivr request error for ${fileName}, trying GitHub Raw fallback...`);
        resolve(downloadFile(fileName, 2));
      } else {
        reject(err);
      }
    });
  });
}

async function main() {
  console.log(`Target directory: ${targetDir}`);
  for (const file of files) {
    try {
      await downloadFile(file);
    } catch (err) {
      console.error(`Error downloading ${file}:`, err.message);
      process.exit(1);
    }
  }
  console.log('All face models downloaded successfully!');
}

main();
