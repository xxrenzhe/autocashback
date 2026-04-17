import fs from 'fs';
const file = 'components/app-shell.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
  'import { cn } from "@autocashback/ui";',
  'import { cn } from "@autocashback/ui";\nimport { CommandPalette } from "./command-palette";'
);

// Inject component
content = content.replace(
  '<div className="min-h-screen bg-muted/30">',
  '<div className="min-h-screen bg-muted/30">\n      <CommandPalette />'
);

// Add visual hint in the header right side
content = content.replace(
  /<div className="hidden items-center gap-2 sm:flex">/g,
  `<div className="hidden items-center gap-4 sm:flex">
            <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground shadow-sm">
              <span>搜索</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>`
);

fs.writeFileSync(file, content);
console.log("Updated AppShell to include CommandPalette");
