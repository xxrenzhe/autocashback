import fs from 'fs';
const file = 'components/accounts-manager.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/bg-amber-500\/100\/10/g, 'bg-amber-500/10');
// Add missing import for SheetFrame if I previously injected it, but since I reverted, I need to inject URL state and SheetFrame again properly.
