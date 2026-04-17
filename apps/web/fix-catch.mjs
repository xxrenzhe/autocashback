import fs from 'fs';
['components/accounts-manager.tsx', 'components/offers-manager.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/catch \(loadError: unknown\) \{/g, 'catch {');
  fs.writeFileSync(file, content);
});
