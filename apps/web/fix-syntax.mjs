import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./components');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // 1. Fix "use client" position
  if (content.startsWith('import { formatDateTime } from "@/lib/format";\n"use client";')) {
    content = content.replace('import { formatDateTime } from "@/lib/format";\n"use client";\n', '"use client";\n\nimport { formatDateTime } from "@/lib/format";\n');
  }

  // 2. Remove unused `const parsed = Date.parse(value);`
  content = content.replace(/const parsed = Date\.parse\(value\);\n\s*return formatDateTime\(value\);/g, 'return formatDateTime(value);');
  content = content.replace(/const parsed = Date\.parse\(value\);\n\s*return \? formatDateTime\(parsed\)/g, 'return formatDateTime(value)');
  // wait, earlier I replaced `? new Date(parsed).toLocaleString` with `? formatDateTime(parsed)`
  // let's just remove the `const parsed = Date.parse...` entirely from format functions.
  // Actually, the format function in those files looks like:
  /*
  function formatDateTime(value: string | null) {
    if (!value) {
      return "暂无记录";
    }

    const parsed = Date.parse(value);
    return formatDateTime(value);
  }
  */
  // Wait, I named the imported function `formatDateTime` and the local function is also `formatDateTime`! This is a naming collision!
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
