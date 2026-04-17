import fs from 'fs';
import path from 'path';

function replaceSaaS(content) {
  // Colors
  content = content.replace(/text-slate-900/g, 'text-foreground');
  content = content.replace(/text-slate-[78]00/g, 'text-foreground');
  content = content.replace(/text-slate-[56]00/g, 'text-muted-foreground');
  content = content.replace(/text-slate-400/g, 'text-muted-foreground/80');
  content = content.replace(/bg-stone-50/g, 'bg-muted/40');
  content = content.replace(/bg-stone-100/g, 'bg-muted');
  content = content.replace(/bg-white\/90/g, 'bg-background/90');
  content = content.replace(/bg-white\/84/g, 'bg-background/80');
  content = content.replace(/bg-white/g, 'bg-background');
  content = content.replace(/bg-red-50/g, 'bg-destructive/10');
  content = content.replace(/text-red-700/g, 'text-destructive');
  content = content.replace(/text-red-600/g, 'text-destructive');
  content = content.replace(/border-red-200/g, 'border-destructive/20');
  content = content.replace(/bg-amber-50/g, 'bg-amber-500/10');
  content = content.replace(/text-amber-700/g, 'text-amber-600');

  // Padding & Size Reduction (from consumer to SaaS)
  // Cards padding
  content = content.replace(/p-6/g, 'p-5');
  // Buttons large padding -> normal
  content = content.replace(/px-5 py-3/g, 'px-4 py-2');
  content = content.replace(/px-4 py-4/g, 'p-4');
  content = content.replace(/px-6 py-6/g, 'p-5');
  content = content.replace(/px-6 py-5/g, 'p-5');
  
  // Inputs large padding -> normal
  content = content.replace(/px-4 py-3/g, 'px-3 py-2');
  // Form elements focus rings
  content = content.replace(/focus:focus-visible:outline-none/g, 'focus-visible:outline-none');
  content = content.replace(/focus:ring-2 focus:ring-primary focus:border-transparent/g, '');
  content = content.replace(/focus-visible:ring-ring focus-visible:ring-offset-2/g, 'focus-visible:ring-primary focus-visible:ring-offset-1');

  // Headings
  content = content.replace(/text-3xl font-semibold/g, 'text-2xl font-semibold tracking-tight');
  content = content.replace(/text-2xl font-semibold/g, 'text-xl font-semibold tracking-tight');

  // Tables
  content = content.replace(/border-t border-border\/60 align-top/g, 'border-b border-border hover:bg-muted/30 transition-colors');
  content = content.replace(/<thead className="text-muted-foreground">/g, '<thead className="text-muted-foreground font-medium text-xs border-b border-border">');
  
  // Other cleanups
  content = content.replace(/shadow-lg/g, 'shadow-md');
  
  // Specific fix for loading texts
  content = content.replace(/保存中\.\.\./g, '保存中…');
  content = content.replace(/刷新中\.\.\./g, '刷新中…');

  return content;
}

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

const files = walk('./components').concat(walk('./app'));
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  let newContent = replaceSaaS(content);
  
  if (newContent !== original) {
    fs.writeFileSync(file, newContent);
    changedCount++;
  }
});

console.log(`Updated ${changedCount} files with deep SaaS structural changes.`);
