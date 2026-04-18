import fs from 'fs';
let content = fs.readFileSync('components/accounts-manager.tsx', 'utf8');
content = content.replace(/function scrollEditorIntoView\(\) \{[\s\S]*?block: "start"\n    \}\);\n  \}/g, '');
fs.writeFileSync('components/accounts-manager.tsx', content);
