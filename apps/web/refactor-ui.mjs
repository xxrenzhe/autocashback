import fs from 'fs';
import path from 'path';

const replacements = {
  'surface-panel': 'bg-card text-card-foreground rounded-xl border shadow-sm',
  'surface-subtle': 'bg-background/80 backdrop-blur rounded-xl border',
  'eyebrow': 'text-xs font-semibold uppercase tracking-wider text-primary',
  'brand-bg': 'background',
  'brand-ink': 'foreground',
  'brand-emerald': 'primary',
  'brand-amber': 'amber-500',
  'brand-mist': 'primary/10',
  'brand-line': 'border',
  'shadow-editorial': 'shadow-lg',
  'rounded-\\[28px\\]': 'rounded-xl',
  'rounded-\\[24px\\]': 'rounded-xl',
  'rounded-\\[22px\\]': 'rounded-xl',
  'rounded-2xl': 'rounded-lg',
  'rounded-3xl': 'rounded-xl',
  'font-display': 'font-bold tracking-tight text-foreground',
  'bg-\\[linear-gradient\\(180deg,#fafaf9_0%,#f5f5f4_48%,#f0fdf4_100%\\)\\]': 'bg-background',
  'bg-\\[linear-gradient\\(180deg,rgba\\(236,253,245,0.95\\)_0%,rgba\\(255,255,255,0.98\\)_100%\\)\\]': 'bg-card',
  'bg-\\[radial-gradient\\(circle_at_top_left,rgba\\(16,185,129,0.14\\),transparent_48%\\),linear-gradient\\(180deg,rgba\\(236,253,245,0.9\\)_0%,rgba\\(255,255,255,0.98\\)_100%\\)\\]': 'bg-muted/50'
};

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

const files = walk('./app').concat(walk('./components'));
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key, 'g');
    content = content.replace(regex, value);
  }
  
  // A11y fixes:
  // "正在登录..." -> "正在登录…"
  content = content.replace(/正在登录\.\.\./g, '正在登录…');
  
  // Fix outline-none
  content = content.replace(/outline-none transition focus:border-primary focus:bg-white/g, 'transition focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent');
  content = content.replace(/outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white/g, 'transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent');
  content = content.replace(/outline-none/g, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring');

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedCount++;
  }
});

console.log(`Updated ${changedCount} files.`);
