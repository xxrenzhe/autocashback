import fs from 'fs';
const file = 'components/app-shell.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { Toaster } from "sonner";')) {
  content = content.replace(
    'import { cn } from "@autocashback/ui";',
    'import { cn } from "@autocashback/ui";\nimport { Toaster } from "sonner";'
  );

  content = content.replace(
    '<div className="min-h-screen bg-muted/30">',
    '<div className="min-h-screen bg-muted/30">\n      <Toaster position="bottom-right" richColors />'
  );

  fs.writeFileSync(file, content);
  console.log('Added Toaster to AppShell');
}
