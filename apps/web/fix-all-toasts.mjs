import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    if (file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./components');
const targetFiles = [
  'link-swap-manager.tsx',
  'click-farm-manager.tsx',
  'settings-manager.tsx',
  'admin-users-manager.tsx',
  'account-security-panel.tsx',
  'dashboard-client-page.tsx',
  'queue-monitor.tsx',
  'click-farm-task-dialog.tsx',
  'link-swap-task-dialog.tsx'
];

files.forEach(file => {
  const filename = path.basename(file);
  if (!targetFiles.includes(filename)) return;

  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Add import if needed
  if (
    (content.includes('setMessage(') || content.includes('setError(')) &&
    !content.includes('import { toast } from "sonner";')
  ) {
    content = content.replace(
      'import { cn } from "@autocashback/ui";',
      'import { cn } from "@autocashback/ui";\nimport { toast } from "sonner";'
    );
  }

  // Remove states
  content = content.replace(/const \[error, setError\] = useState\(""\);\n/g, '');
  content = content.replace(/const \[message, setMessage\] = useState\(""\);\n/g, '');
  content = content.replace(/const \[messageTone, setMessageTone\] = useState<MessageTone>\(".*"\);\n/g, '');
  content = content.replace(/type MessageTone = ".*" \| ".*";\n/g, '');

  // Setters -> Toast
  content = content.replace(/setMessageTone\(".*"\);\n/g, '');
  content = content.replace(/setError\(""\);\n/g, '');
  content = content.replace(/setMessage\(""\);\n/g, '');
  
  // Specific messages
  content = content.replace(/setError\(result.userMessage \|\| ".*"\);/g, 'toast.error(result.userMessage || "操作失败");');
  content = content.replace(/setError\(result.userMessage\);/g, 'toast.error(result.userMessage || "操作失败");');
  content = content.replace(/setError\("请填写.*"\);/g, match => `toast.error(${match.match(/\(".*"\)/)[0]});`);
  content = content.replace(/setError\(.* \? .* : ".*"\);/g, 'toast.error("加载数据失败");');
  
  content = content.replace(/setMessage\(".*"\);/g, match => `toast.success(${match.match(/\(".*"\)/)[0]});`);
  content = content.replace(/setMessage\(infoMessage\);/g, 'toast.info(infoMessage);');
  content = content.replace(/setMessage\(editingId \? ".*" : ".*"\);/g, 'toast.success("操作成功");');

  // Remove inline banner render blocks
  const errorBlock = /\{error \? \([\s\S]*?\{error\}[\s\S]*?<\/div>[\s\S]*?\) : null\}/g;
  const messageBlock = /\{message \? \([\s\S]*?\{message\}[\s\S]*?<\/div>[\s\S]*?\) : null\}/g;
  content = content.replace(errorBlock, '');
  content = content.replace(messageBlock, '');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Fixed toasts in ' + file);
  }
});
