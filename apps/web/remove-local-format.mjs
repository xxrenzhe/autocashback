import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./components');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Remove local formatDateTime
  const localFormatRegex = /function formatDateTime\([^)]*\) \{[\s\S]*?return formatDateTime\([^)]*\);\n\}/g;
  content = content.replace(localFormatRegex, '');
  
  // also handle the one in link-swap-manager that might be different
  const localFormatRegex2 = /function formatDateTime\([^)]*\) \{[\s\S]*?return formatDateTime\(value\);\n\s*\}/g;
  content = content.replace(localFormatRegex2, '');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Removed local format in ${file}`);
  }
});
