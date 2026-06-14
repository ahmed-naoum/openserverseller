import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('src');
const targetPrismaFile = path.resolve('src/lib/prisma.ts');

function getAllFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else if (file.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

function processFiles() {
  const files = getAllFiles(srcDir);
  console.log(`Scanning ${files.length} TypeScript files...`);

  files.forEach(file => {
    // Skip the singleton file itself
    if (file === targetPrismaFile) return;

    let content = fs.readFileSync(file, 'utf8');

    // Check if the file instantiates PrismaClient
    const hasImport = content.includes("import { PrismaClient } from '@prisma/client'");
    const hasInst = content.includes("new PrismaClient(");

    if (hasImport && hasInst) {
      console.log(`Processing file: ${path.relative(process.cwd(), file)}`);

      // Calculate relative import path
      const fileDir = path.dirname(file);
      let relativePath = path.relative(fileDir, targetPrismaFile);
      
      // Convert to posix style
      relativePath = relativePath.replace(/\\/g, '/');
      // Replace .ts with .js
      relativePath = relativePath.replace(/\.ts$/, '.js');
      // Prepend ./ if it doesn't start with . or ..
      if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
      }

      // 1. Remove import statement
      content = content.replace(/import\s+\{\s*PrismaClient\s*\}\s+from\s+['"]@prisma\/client['"];?\r?\n?/g, '');
      
      // 2. Remove instantiation
      content = content.replace(/const\s+prisma\s*=\s*new\s+PrismaClient\([^)]*\);?\r?\n?/g, '');

      // 3. Prepend our import
      const newImport = `import { prisma } from '${relativePath}';\n`;
      content = newImport + content;

      fs.writeFileSync(file, content, 'utf8');
    }
  });

  console.log('Finished refactoring database connection instantiations!');
}

processFiles();
