#!/usr/bin/env npx tsx
/**
 * Script to update all window.api calls to use the new API layer
 */

import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'src');

function getAllFiles(dir: string, extension: string[]): string[] {
  const results: string[] = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results.push(...getAllFiles(filePath, extension));
    } else if (extension.some(ext => file.endsWith(ext))) {
      results.push(filePath);
    }
  }
  
  return results;
}

async function updateFiles() {
  // Find all .tsx and .ts files that use window.api
  const files = getAllFiles(srcDir, ['.ts', '.tsx'])
    .filter(f => !f.includes('api\\apiLayer.ts') && !f.includes('api/apiLayer.ts'));
  
  let updatedCount = 0;
  
  for (const filePath of files) {
    const file = path.relative(srcDir, filePath);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if file contains window.api
    if (!content.includes('window.api')) {
      continue;
    }
    
    // Add import statement if not already present
    if (!content.includes("import { api }") && !content.includes("import api")) {
      // Find the first import statement or the beginning of the file
      const importMatch = content.match(/^import\s+/m);
      if (importMatch) {
        const insertPos = content.indexOf(importMatch[0]);
        content = content.slice(0, insertPos) + 
          "import { api } from './api/apiLayer';\n" + 
          content.slice(insertPos);
      } else {
        content = "import { api } from './api/apiLayer';\n\n" + content;
      }
      
      // Adjust import path based on file depth
      const normalizedFile = file.replace(/\\/g, '/');
      const depth = normalizedFile.split('/').length - 1;
      if (depth > 0) {
        const relativePath = '../'.repeat(depth) + 'api/apiLayer';
        content = content.replace("'./api/apiLayer'", `'${relativePath}'`);
      }
    }
    
    // Replace all window.api with api
    content = content.replace(/window\.api\./g, 'api.');
    
    // Write the updated content back
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Updated: ${file}`);
    updatedCount++;
  }
  
  console.log(`\n✨ Successfully updated ${updatedCount} files`);
  console.log('\nThe API layer has been created with:');
  console.log('  - Full Electron API support when running in Electron');
  console.log('  - Web-compatible fallbacks using localStorage when running in browser');
  console.log('  - Automatic environment detection');
  console.log('\nAll components now use the unified API layer instead of window.api directly.');
}

updateFiles().catch(console.error);