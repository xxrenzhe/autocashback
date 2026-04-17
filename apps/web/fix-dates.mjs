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
  
  // Quick and dirty replacement for known patterns
  const importStatement = `import { formatDateTime } from "@/lib/format";\n`;
  let needsImport = false;
  
  if (content.includes('toLocaleString("zh-CN"')) {
    // pattern 1: return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("zh-CN") : value;
    content = content.replace(/return Number\.isFinite\(parsed\) \? new Date\(parsed\)\.toLocaleString\("zh-CN"\) : value;/g, 'return formatDateTime(value);');
    
    // pattern 2: return new Date(timestamp).toLocaleString("zh-CN");
    content = content.replace(/return new Date\(timestamp\)\.toLocaleString\("zh-CN"\);/g, 'return formatDateTime(timestamp);');
    
    // pattern 3: return new Date(value).toLocaleString("zh-CN", {...});
    content = content.replace(/return new Date\(value\)\.toLocaleString\("zh-CN",[\s\S]*?\}\);/g, 'return formatDateTime(value);');
    
    // pattern 4: ? new Date(parsed).toLocaleString("zh-CN", {...})
    content = content.replace(/\? new Date\(parsed\)\.toLocaleString\("zh-CN",[\s\S]*?\}\)/g, '? formatDateTime(parsed)');
    
    // Add import if not present
    if (!content.includes('import { formatDateTime }')) {
      content = importStatement + content;
    }
  }

  // Also fix tabular-nums and sticky headers
  // Find <thead ...> and add sticky top-0 bg-background/95 backdrop-blur z-10
  content = content.replace(/<thead className="([^"]+)">/g, '<thead className="$1 sticky top-0 bg-background/95 backdrop-blur z-10">');
  
  // Find font-mono and replace with font-mono tabular-nums
  content = content.replace(/font-mono(?! tabular-nums)/g, 'font-mono tabular-nums');
  // Find text-slate-700 in tables and replace with tabular-nums if it might be a number (we just add it to table cells generally)
  // Let's add tabular-nums to specific table cells manually later if needed.

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
