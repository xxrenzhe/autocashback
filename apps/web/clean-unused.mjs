import fs from 'fs';
let content = fs.readFileSync('components/accounts-manager.tsx', 'utf8');
content = content.replace(/function scrollEditorIntoView\(\) \{[\s\S]*?block: "start"\n    \}\);\n  \}/g, '');
fs.writeFileSync('components/accounts-manager.tsx', content);

let content2 = fs.readFileSync('components/command-palette.tsx', 'utf8');
content2 = content2.replace('import { cn } from "@autocashback/ui";\n', '');
fs.writeFileSync('components/command-palette.tsx', content2);
