import fs from 'fs';
let content = fs.readFileSync('components/link-swap-manager.tsx', 'utf8');

// Add import
if (!content.includes('import { toast } from "sonner";')) {
  content = content.replace(
    'import { cn } from "@autocashback/ui";',
    'import { cn } from "@autocashback/ui";\nimport { toast } from "sonner";'
  );
}

// Remove state definitions
content = content.replace(/type FeedbackState =[\s\S]*?null;\n\n/g, '');
content = content.replace(/const \[feedback, setFeedback\] = useState<FeedbackState>\(null\);\n/g, '');

// Replace setters
content = content.replace(/setFeedback\(\{ tone: "error", text: (.*) \}\);/g, 'toast.error($1);');
content = content.replace(/setFeedback\(\{ tone: "success", text: (.*) \}\);/g, 'toast.success($1);');
content = content.replace(/setFeedback\(null\);\n/g, '');

// Remove banner
const feedbackBlock = /\{feedback \? \([\s\S]*?\{feedback\.text\}[\s\S]*?<\/div>[\s\S]*?\) : null\}/;
content = content.replace(feedbackBlock, '');

fs.writeFileSync('components/link-swap-manager.tsx', content);
