import fs from 'fs';

const replacements = [
  [/text-slate-[789]00/g, 'text-foreground'],
  [/text-slate-[56]00/g, 'text-muted-foreground'],
  [/text-slate-400/g, 'text-muted-foreground/80'],
  [/bg-stone-50/g, 'bg-muted/40'],
  [/bg-stone-100/g, 'bg-muted'],
  [/bg-white\/90/g, 'bg-background/90'],
  [/bg-white\/84/g, 'bg-background/80'],
  [/bg-white/g, 'bg-background'],
  [/bg-red-50/g, 'bg-destructive/10'],
  [/text-red-[67]00/g, 'text-destructive'],
  [/border-red-200/g, 'border-destructive/20'],
  [/bg-amber-50/g, 'bg-amber-500/10'],
  [/text-amber-700/g, 'text-amber-600'],
  [/p-6/g, 'p-5'],
  [/px-5 py-3/g, 'px-4 py-2'],
  [/px-4 py-4/g, 'p-4'],
  [/px-6 py-6/g, 'p-5'],
  [/px-6 py-5/g, 'p-5'],
  [/px-4 py-3/g, 'px-3 py-2'],
  [/focus:focus-visible:outline-none/g, 'focus-visible:outline-none'],
  [/focus:ring-2 focus:ring-primary focus:border-transparent/g, ''],
  [/focus-visible:ring-ring focus-visible:ring-offset-2/g, 'focus-visible:ring-primary focus-visible:ring-offset-1'],
  [/text-3xl font-semibold/g, 'text-2xl font-semibold tracking-tight'],
  [/text-2xl font-semibold/g, 'text-xl font-semibold tracking-tight'],
  [/border-t border-border\/60 align-top/g, 'border-b border-border hover:bg-muted/30 transition-colors'],
  [/<thead className="text-muted-foreground">/g, '<thead className="text-muted-foreground font-medium text-xs border-b border-border">'],
  [/shadow-lg/g, 'shadow-md'],
  [/保存中\.\.\./g, '保存中…'],
  [/刷新中\.\.\./g, '刷新中…'],
];

['components/settings-manager.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  // add sticky header
  content = content.replace(/<thead className="([^"]+)">/g, '<thead className="$1 sticky top-0 bg-background/95 backdrop-blur z-10">');
  // font-mono -> font-mono tabular-nums
  content = content.replace(/font-mono(?! tabular-nums)/g, 'font-mono tabular-nums');
  // fix catch
  content = content.replace(/catch \(loadError: unknown\) \{/g, 'catch {');
  
  // replace new Date().toLocaleString
  content = content.replace(/return Number\.isFinite\(parsed\) \? new Date\(parsed\)\.toLocaleString\("zh-CN"\) : value;/g, 'return formatDateTime(value);');
  content = content.replace(/return new Date\(timestamp\)\.toLocaleString\("zh-CN"\);/g, 'return formatDateTime(timestamp);');
  
  if (!content.includes('import { formatDateTime }')) {
    content = 'import { formatDateTime } from "@/lib/format";\n' + content;
  }
  if (content.startsWith('import { formatDateTime } from "@/lib/format";\n"use client";')) {
    content = content.replace('import { formatDateTime } from "@/lib/format";\n"use client";\n', '"use client";\n\nimport { formatDateTime } from "@/lib/format";\n');
  }

  fs.writeFileSync(file, content);
});
