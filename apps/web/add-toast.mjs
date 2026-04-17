import fs from 'fs';
const files = ['components/accounts-manager.tsx', 'components/offers-manager.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('import { toast } from "sonner";')) {
    // Add import
    content = content.replace(
      'import { cn } from "@autocashback/ui";',
      'import { cn } from "@autocashback/ui";\nimport { toast } from "sonner";'
    );

    // submitForm success
    content = content.replace(
      /setMessageTone\("success"\);\n    setMessage\(editingId \? "账号已更新。" : "账号已创建，可以继续去挂接 Offer。"\);/g,
      `toast.success(editingId ? "账号已更新" : "账号已创建");`
    );
    
    content = content.replace(
      /setMessageTone\("success"\);\n    setMessage\(editingId \? "Offer 已更新，列表已同步。" : "Offer 已创建，后续可直接补点击或配置换链。"\);/g,
      `toast.success(editingId ? "Offer 已更新" : "Offer 已创建");`
    );

    // delete success
    content = content.replace(
      /setMessageTone\("success"\);\n    setMessage\("账号已删除。"\);/g,
      `toast.success("账号已删除");`
    );
    content = content.replace(
      /setMessageTone\("success"\);\n    setMessage\("Offer 已删除。"\);/g,
      `toast.success("Offer 已删除");`
    );

    // submit error
    content = content.replace(
      /setError\(result.userMessage \|\| "保存失败"\);/g,
      `toast.error(result.userMessage || "保存失败");`
    );
    // delete error
    content = content.replace(
      /setError\(result.userMessage \|\| "删除失败"\);/g,
      `toast.error(result.userMessage || "删除失败");`
    );

    // click farm/link swap info message
    content = content.replace(
      /setMessageTone\("info"\);\n        setMessage\(infoMessage\);/g,
      `toast.info(infoMessage);`
    );
    
    // remove inline error/message blocks completely from the main layout header
    // The pattern is:
    // {error ? ( <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"> {error} </div> ) : null}
    // {message ? ( <div className={cn("mt-5 rounded-xl p-4 text-sm", messageTone === "success" ? "border border-emerald-200 bg-primary/10 text-primary" : "border border-slate-200 bg-muted/40 text-foreground")} > {message} </div> ) : null}
    const messageBlockRegex = /\{error \? \([\s\S]*?\{error\}[\s\S]*?<\/div>[\s\S]*?\) : null\}[\s\S]*?\{message \? \([\s\S]*?\{message\}[\s\S]*?<\/div>[\s\S]*?\) : null\}/;
    content = content.replace(messageBlockRegex, '');
    
    fs.writeFileSync(file, content);
    console.log('Added toast to ' + file);
  }
});
