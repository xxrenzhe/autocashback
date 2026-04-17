import fs from 'fs';
const file = 'components/accounts-manager.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add SheetFrame import
content = content.replace(
  'import { fetchJson } from "@/lib/api-error-handler";',
  'import { fetchJson } from "@/lib/api-error-handler";\nimport { SheetFrame } from "./sheet-frame";'
);

// We need a state for the sheet visibility
// Actually `editingId !== null` could be used, but what if they are creating a new one? `editingId` is null.
// Let's add `const [editorOpen, setEditorOpen] = useState(false);`
content = content.replace(
  'const [editingId, setEditingId] = useState<number | null>(null);',
  'const [editingId, setEditingId] = useState<number | null>(null);\n  const [editorOpen, setEditorOpen] = useState(false);'
);

// Update `startCreateAccount` and `resetForm` and `handleEdit`
content = content.replace(
  /function resetForm\(\) \{[\s\S]*?setError\(""\);\n  \}/,
  `function resetForm() {\n    setForm(initialForm);\n    setEditingId(null);\n    setError("");\n    setEditorOpen(false);\n  }`
);

content = content.replace(
  /function startCreateAccount\(\) \{[\s\S]*?scrollEditorIntoView\(\);\n  \}/,
  `function startCreateAccount() {\n    setForm(initialForm);\n    setEditingId(null);\n    setError("");\n    setEditorOpen(true);\n  }`
);

content = content.replace(
  /function handleEdit[\s\S]*?scrollEditorIntoView\(\);\n  \}/,
  `function handleEdit(account: CashbackAccount) {\n    setEditingId(account.id);\n    setForm({\n      platformCode: account.platformCode,\n      accountName: account.accountName,\n      registerEmail: account.registerEmail,\n      payoutMethod: account.payoutMethod,\n      notes: account.notes || "",\n      status: account.status\n    });\n    setMessage("");\n    setError("");\n    setEditorOpen(true);\n  }`
);

// Now replace the <section id="account-editor"> with a SheetFrame
// It starts with <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" id="account-editor">
// and ends with </section> (the one just before <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5"> which has "重点提醒")

const regex = /<section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" id="account-editor">[\s\S]*?(?=          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">\n            <p className="text-xs font-semibold uppercase tracking-wider text-primary">重点提醒<\/p>)/;

const newSheet = `<SheetFrame
            open={editorOpen}
            onClose={resetForm}
            eyebrow={editingId ? "编辑账号" : "新建账号"}
            title={editingId ? "更新当前返利账号" : "补齐新的返利平台账号"}
            description="建议按运营人、平台角色或国家维度命名，后续在 Offer 和任务页更容易识别。"
          >
            <form className="space-y-4" onSubmit={submitForm}>
              <label className="block text-sm font-medium text-foreground">
                平台
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  onChange={(event) =>
                    setForm({
                      ...form,
                      platformCode: event.target.value as CashbackAccount["platformCode"]
                    })
                  }
                  value={form.platformCode}
                >
                  {PLATFORM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-foreground">
                账号名
                <input
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  onChange={(event) => setForm({ ...form, accountName: event.target.value })}
                  placeholder="例如：TopCashback-US-Main"
                  value={form.accountName}
                />
              </label>

              <label className="block text-sm font-medium text-foreground">
                注册邮箱
                <input
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  onChange={(event) => setForm({ ...form, registerEmail: event.target.value })}
                  placeholder="用于登录或收款确认的邮箱"
                  type="email"
                  value={form.registerEmail}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
                  提现方式
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                    onChange={(event) =>
                      setForm({
                        ...form,
                        payoutMethod: event.target.value as CashbackAccount["payoutMethod"]
                      })
                    }
                    value={form.payoutMethod}
                  >
                    {PAYOUT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-foreground">
                  状态
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as CashbackAccount["status"]
                      })
                    }
                    value={form.status}
                  >
                    <option value="active">启用中</option>
                    <option value="paused">已暂停</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-foreground">
                备注
                <textarea
                  className="mt-2 min-h-28 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="记录收款规则、登录注意事项、账号负责人等"
                  value={form.notes}
                />
              </label>

              <div className="flex flex-wrap gap-3 pt-6">
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 w-full"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? "保存中…" : editingId ? "更新账号" : "创建账号"}
                </button>
              </div>
            </form>
          </SheetFrame>\n`;

content = content.replace(regex, newSheet);

fs.writeFileSync(file, content);
console.log("Updated accounts manager to use SheetFrame");
