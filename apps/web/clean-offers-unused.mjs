import fs from 'fs';
let content = fs.readFileSync('components/offers-manager.tsx', 'utf8');

// remove startTransition import
content = content.replace('  startTransition,\n', '');

// remove scrollEditorIntoView function
content = content.replace(/function scrollEditorIntoView\(\) \{[\s\S]*?block: "start"\n    \}\);\n  \}/, '');

fs.writeFileSync('components/offers-manager.tsx', content);
