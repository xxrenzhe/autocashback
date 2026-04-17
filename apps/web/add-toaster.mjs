import fs from 'fs';
const file = 'components/app-shell.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { Toaster } from "sonner";')) {
  content = content.replace(
    'import { CommandPalette } from "./command-palette";',
    'import { CommandPalette } from "./command-palette";\nimport { Toaster } from "sonner";'
  );
  
  content = content.replace(
    '<CommandPalette />',
    '<CommandPalette />\n      <Toaster position="bottom-right" richColors />'
  );
  
  fs.writeFileSync(file, content);
  console.log('Added Toaster to AppShell');
}
