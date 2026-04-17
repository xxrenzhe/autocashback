import fs from 'fs';
const files = ['components/accounts-manager.tsx', 'components/offers-manager.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Remove state definitions
  content = content.replace(/const \[error, setError\] = useState\(""\);\n/g, '');
  content = content.replace(/const \[message, setMessage\] = useState\(""\);\n/g, '');
  content = content.replace(/const \[messageTone, setMessageTone\] = useState<MessageTone>\(".*"\);\n/g, '');

  // Remove specific setter calls
  content = content.replace(/setError\(""\);\n/g, '');
  content = content.replace(/setMessage\(""\);\n/g, '');
  content = content.replace(/setError\("请填写.*"\);\n/g, 'toast.error("请填写必填项");\n');
  content = content.replace(/setError\(.* \? .* : "加载.*失败"\);\n/g, 'toast.error("加载数据失败");\n');

  // Any remaining setError calls (like inline validation) -> toast.error
  content = content.replace(/setError\(/g, 'toast.error(');
  content = content.replace(/setMessage\(/g, 'toast.success(');
  content = content.replace(/setMessageTone\(/g, '// setMessageTone(');
  
  // Clean up unused MessageTone type
  content = content.replace(/type MessageTone = ".*" \| ".*";\n/g, '');

  fs.writeFileSync(file, content);
  console.log('Fixed vars in ' + file);
});
