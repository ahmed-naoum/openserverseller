const fs = require('fs');
const path = require('path');
const sharp = require('./backend/node_modules/sharp');

const frontendPublicDir = path.join(__dirname, 'frontend', 'public');
const frontendSrcDir = path.join(__dirname, 'frontend', 'src');
const indexHtmlPath = path.join(__dirname, 'frontend', 'index.html');
const backendUploadsDir = path.join(__dirname, 'backend', 'uploads');

const replacementMappings = [];

// Helper to recursively get files matching extensions
function getFilesRecursively(dir, extensions) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, extensions));
    } else {
      const ext = path.extname(file).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

// Helper to recursively get all text files in frontend/src
function getTextFiles(dir) {
  return getFilesRecursively(dir, ['.tsx', '.ts', '.html', '.css', '.json']);
}

async function optimizeFrontendImages() {
  console.log('--- Optimizing & Converting Frontend Public Static Images ---');
  const imageExtensions = ['.png', '.jpg', '.jpeg'];
  const imageFiles = getFilesRecursively(frontendPublicDir, imageExtensions);

  console.log(`Found ${imageFiles.length} static images in frontend/public.`);

  for (const imgPath of imageFiles) {
    const ext = path.extname(imgPath);
    const basename = path.basename(imgPath);
    const dir = path.dirname(imgPath);
    const webpName = basename.substring(0, basename.length - ext.length) + '.webp';
    const webpPath = path.join(dir, webpName);

    try {
      console.log(`Processing: ${basename}...`);
      const image = sharp(imgPath);
      const metadata = await image.metadata();

      let pipeline = image;
      if (metadata.width && metadata.width > 1920) {
        pipeline = pipeline.resize(1920, null, { withoutEnlargement: true });
      }

      await pipeline.webp({ quality: 80 }).toFile(webpPath);
      
      // Remove original file
      fs.unlinkSync(imgPath);

      // Record for code replacement
      replacementMappings.push({
        oldName: basename,
        newName: webpName
      });

      console.log(`  Converted to WebP: ${webpName}`);
    } catch (err) {
      console.error(`  Error processing ${basename}:`, err.message);
    }
  }
}

function updateCodeReferences() {
  console.log('\n--- Updating Code References to WebP ---');
  const codeFiles = getTextFiles(frontendSrcDir);
  codeFiles.push(indexHtmlPath);

  console.log(`Found ${codeFiles.length} files to scan for references.`);

  let updatedCount = 0;
  for (const file of codeFiles) {
    if (!fs.existsSync(file)) continue;

    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    for (const mapping of replacementMappings) {
      // Avoid replacing if it's already replaced or doesn't match
      if (content.includes(mapping.oldName)) {
        // Use global regex to replace all occurrences
        const regex = new RegExp(escapeRegExp(mapping.oldName), 'g');
        content = content.replace(regex, mapping.newName);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`  Updated references in: ${path.basename(file)}`);
      updatedCount++;
    }
  }
  console.log(`Finished updating references. ${updatedCount} files modified.`);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function optimizeBackendUploads() {
  console.log('\n--- Optimizing Backend Uploads in-place (PNG/JPEG) ---');
  const imageExtensions = ['.png', '.jpg', '.jpeg'];
  const uploadFiles = getFilesRecursively(backendUploadsDir, imageExtensions);

  console.log(`Found ${uploadFiles.length} images in backend/uploads.`);

  for (const imgPath of uploadFiles) {
    const basename = path.basename(imgPath);
    const ext = path.extname(imgPath).toLowerCase();
    const tempPath = imgPath + '.tmp';

    try {
      console.log(`Optimizing upload: ${basename}...`);
      const image = sharp(imgPath);
      const metadata = await image.metadata();

      let pipeline = image;
      if (metadata.width && metadata.width > 1200) {
        pipeline = pipeline.resize(1200, null, { withoutEnlargement: true });
      }

      if (ext === '.png') {
        await pipeline.png({ quality: 80, compressionLevel: 9 }).toFile(tempPath);
      } else {
        await pipeline.jpeg({ quality: 80, progressive: true }).toFile(tempPath);
      }

      // Swap temp and original
      fs.unlinkSync(imgPath);
      fs.renameSync(tempPath, imgPath);

      console.log(`  Optimized successfully.`);
    } catch (err) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      console.error(`  Error processing upload ${basename}:`, err.message);
    }
  }
}

async function main() {
  const start = Date.now();
  await optimizeFrontendImages();
  if (replacementMappings.length > 0) {
    updateCodeReferences();
  }
  await optimizeBackendUploads();
  const end = Date.now();
  console.log(`\n🎉 Success! All images optimized in ${((end - start) / 1000).toFixed(2)}s.`);
}

main();
