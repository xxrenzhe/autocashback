# 后台 UI/UX 优化方案 — 对标 autobb

> 目的：基于 `autobb` 项目（`/Users/jason/Documents/Kiro/autobb/`）的后台工程实践，对 `autocashback` 登录后台做一次完整梳理；移除无关信息、统一组件、让交互更顺畅。
> 最后更新：2026-04-19
> 关联 Issue：`autocashback-8uj`、`autocashback-eb5`

> ⚠️ **文档命运提示**：`docs/` 目录已被 `.gitignore:154` 忽略，本文件**默认不入版本控制**，只保存在本地。落地时请将关键内容复制到 PR 描述，或 `git add -f` 强制纳入。过程追踪仍以 `bd` issue / status 为单一来源，不在本文打勾跟踪。

---

## 一、执行摘要（TL;DR）

autocashback 后台已具备"侧边栏 + 顶栏 + 主内容"的骨架，但存在 **3 类主要问题**：

1. **工程级隐形 bug**（P0）：非法 Tailwind amber class 实际不止两种文本，当前已确认包含 `bg-amber-500/100/10`、`bg-amber-500/100/100/10` 及其派生的 `/35`、`/60`、`/80` 变体，**5 个文件共 30 处**，导致所有 amber 徽章 / 风险高亮"其实从未显色"；`tracking-tight` 重复出现于 10 个头部；`apps/web` 下残留 5 个 " 2.tsx" 副本文件。
2. **共享层缺失**（P1）：`@autocashback/ui` 只导出 `cn()`；`OverviewCard` / `ShortcutCard` / `StatusBadge` 等 5–7 类组件在 7 个 manager 文件里各写一份。没有 `EmptyState` / `Skeleton` / `PageHeader` 基础组件。
3. **UI 冗余与细节**（P2）：仪表盘首屏 `coreEntryLinks` 与 `data.actions` **视觉同构**（虽数据源不同）导致同类 ActionCard 卡片堆两层；管理员导航与普通导航同色；顶栏"在线"徽章恒亮、无语义；Settings 934 行单文件、无分组。

本文给出 **Phase 0 → 4、约 8–12 人日** 的单一路线图；依赖策略是**仅新增两个小型运行时依赖** `@radix-ui/react-tabs` 与 `@radix-ui/react-dropdown-menu`，**不引入新的视觉组件库**（详见§七）。

**执行前提补充**：
- 仓库命令以 **npm workspaces** 为准，不使用 `pnpm --filter`。
- Settings 改 Tabs 时，**必须保留**现有 `/settings#proxy-settings`、`/settings#google-ads-settings` 等 hash 深链。
- `Tooltip` / `Stepper` / 前端交互测试都**不是现成能力**；若要落地，必须先写清楚是否新增依赖或改造测试基建。

---

## 二、两个项目的结构对比

| 维度 | autobb（参考） | autocashback（待优化） |
| --- | --- | --- |
| 路由分组 | `src/app/(app)/` 下 21 个业务域 | `apps/web/app/(app)/` 下 8 个业务域（精简合理） |
| 后台主布局 | `src/components/layout/AppLayout.tsx`（~700 行） | `apps/web/components/app-shell.tsx`（306 行） |
| 共享 UI 库 | `src/components/ui/` 含 37 个 shadcn-style 原子组件 | `packages/ui/src/index.ts` 仅 6 行、**只导出 `cn()`** |
| 业务组件总数 | ~110 | ~27（含 5 个 " 2.tsx" 副本） |
| 空状态组件 | `ui/empty-state.tsx`（6 variant） | ❌ |
| 骨架屏组件 | `ui/loading-skeleton.tsx`（4 variant） | 仅 dashboard 内嵌一份 `LoadingState` |
| 管理员导航配色 | 紫色差异化 | 与普通菜单同色 |
| 命令面板 | 无 | 有（`command-palette.tsx`，将移除） |

> 产品决策：autobb 无命令面板，当前项目也**不需要**；Phase 0 一并移除 `command-palette.tsx` 与顶栏 `⌘K` hint，减少维护面。

---

## 三、按严重度排列的发现

### 🔴 P0 — 必须在首个清理 PR 修掉

#### F1. Tailwind 非法 amber class：两种基础形态及其派生 `/35` / `/60` / `/80` 变体

Tailwind 的 opacity 修饰器只支持单个 `/<num>`；当前代码里实际出现的是一组非法串：`bg-amber-500/100/10`、`bg-amber-500/100/100/10`，以及继续拼出来的 `.../35`、`.../60`、`.../80`。这些 class 都会被**整段丢弃**，导致 amber 徽章、风险行、warning 图标**完全无色**。分布：

- `admin-users-manager.tsx`：角色徽章、风险行底色、ActionQueueCard、ActionButton，且包含 `/35`、`/80`、`/60` 这类派生变体。
- `link-swap-manager.tsx`：`toneStyles.amber` 源被污染，**下游所有引用都失色**。
- `admin-operations-monitor.tsx`：MetricGroup、状态 badge、告警条均受影响。
- `settings-manager.tsx`：概览卡 warning badge、脚本状态提示失色。
- `accounts-manager.tsx`："已暂停"账号徽章和相关提示失色。

**用户可见后果**：管理员用户管理页的"角色 / 风险 / 异常"徽章几乎都没底色、换链页的 paused/warning 态失色、业务监控页 warning metric 无底色、用户列表风险行没有背景高亮。

**修复**：
```bash
# 先定位所有非法 amber 变体，再统一替换
rg -n "bg-amber-500/100(/100)?/10(/(35|60|80))?" apps/web/components

rg -l "bg-amber-500/100(/100)?/10(/(35|60|80))?" apps/web/components | xargs perl -0pi -e '
  s/bg-amber-500\/100\/100\/10\/35/bg-amber-500\/35/g;
  s/bg-amber-500\/100\/100\/10\/60/bg-amber-500\/60/g;
  s/bg-amber-500\/100\/100\/10\/80/bg-amber-500\/80/g;
  s/bg-amber-500\/100\/100\/10/bg-amber-500\/10/g;
  s/bg-amber-500\/100\/10/bg-amber-500\/10/g;
'
```
**产品决策已确认**：修复后 amber 高亮**全部保留并恢复显色**，包括风险行背景。这是预期效果，不需要截图评审，直接合入。

#### F2. `tracking-tight` 重复（10 个文件）

功能无影响，但脚本改写遗留的"死代码"，易误导阅读：

- `dashboard-client-page.tsx:283`（三重）
- `settings-manager.tsx:407`（三重）
- `google-ads-manager.tsx:315, 685`（三重 + 两重）
- `admin-users-manager.tsx:659, 1570`（三重 + 两重）
- `admin-operations-monitor.tsx:154, 279, 461`（两重 ×2 + 三重）
- `link-swap-manager.tsx:468`（三重）
- `offers-manager.tsx:502`、`click-farm-manager.tsx:311`、`accounts-manager.tsx:405`、`queue-monitor.tsx:459`（两重）

**修复**：
```bash
rg -l "tracking-tight tracking-tight" apps/web/components | xargs sed -i '' \
  -E 's|tracking-tight( tracking-tight)+|tracking-tight|g'
```

#### F3. 残留 5 个 " 2.tsx" 副本

```
apps/web/app/page 2.tsx
apps/web/components/accounts-manager 2.tsx
apps/web/components/link-swap-manager 2.tsx
apps/web/components/offers-manager 2.tsx
apps/web/components/settings-manager 2.tsx
```
**修复**：`git rm`（即使未入库也请 `rm`），防止 IDE 误跳转、构建索引膨胀。

#### F4. 移除命令面板（`command-palette.tsx`）

autobb 无命令面板，autocashback 也不需要；继续维护一套 Cmd+K 索引意味着每次新增路由都要同步更新，投入产出不划算。

**修复**：
1. 删除 `apps/web/components/command-palette.tsx`。
2. `app-shell.tsx` 移除 `import { CommandPalette }` 与 `<CommandPalette />` 渲染（约 line 24、160）。
3. 移除顶栏 `⌘K` hint 块（`app-shell.tsx:280-285`），右侧仅保留后续按需添加的状态指示。
4. 搜索其它引用：`rg "CommandPalette\|command-palette\|⌘K" apps/web`，确认清零。

#### F5. `offers-manager.tsx` 残留空代码块

已核验：
- 行 292-293：`if (!options?.preserveNotice) { }` 空块；
- 行 328、334：双重缩进的 `setEditorOpen(...)`（缩进错乱但不影响功能）。

**修复**：删除空 if、修正缩进。

---

### 🟠 P1 — 架构层面的简化

#### F6. `@autocashback/ui` 名不副实

`packages/ui/src/index.ts` 只 6 行 + `cn()`。以下模式在多文件里**各写一份**：

| 模式 | 当前出现位置 | 次数 |
| --- | --- | --- |
| `OverviewCard` / `SummaryCard` / `AdminOverviewCard` | dashboard / accounts / offers / settings / click-farm / queue / link-swap / google-ads / admin-ops | 7+ |
| `ShortcutCard` / `QuickActionCard` | offers / queue / click-farm / admin-ops / admin-users | 6 |
| `statusMeta` / `statusPill` / `taskStatusMeta` / `getStatusBadgeClass` | offers / link-swap / queue / click-farm / admin-ops | 5 |
| 手写 `animate-pulse` 骨架 | dashboard / offers / click-farm / queue / link-swap | 5+ |
| `toneStyles()` 映射 | admin-ops / link-swap / queue / 等 | 4+ |
| `MetricGroup` 抽象 | admin-ops（单处，但模式好） | 1 |
| `ActionButton` 多 tone | admin-users | 1 |

**建议**：在 `packages/ui/src/` 沉淀以下组件，index.ts 补齐 re-export：
- `stat-card.tsx` — `<StatCard tone label value note icon? delta? onClick? />`
- `shortcut-card.tsx` — `<ShortcutCard icon title description href tone? />`
- `status-badge.tsx` — `<StatusBadge variant="running|paused|error|success" />` + `getStatusMeta(variant)`
- `empty-state.tsx` — `<EmptyState variant="no-data|no-results|error" icon title description action />`
- `skeletons.tsx` — `<CardSkeleton />` / `<TableSkeleton rows />` / `<StatSkeleton count />`
- `page-header.tsx` — `<PageHeader title description? actions? />`（可从 context 读取默认描述，见 §七）
- `tone.ts` — `getToneStyles(tone)` 返回 `{ badge, icon, value, border }`
- `metric-group.tsx` — 推广 admin-ops 的好抽象

#### F7. Settings 单文件 934 行、无分组

`settings-manager.tsx` 把代理、平台备注、Google Ads、脚本模板、账号安全 5 类配置全塞进单组件，进去就滚 3 屏。

**建议**：外层加 **`@radix-ui/react-tabs`**（已决定引入，见 §七），Tab 顺序：代理 / Google Ads / 脚本模板 / 账号安全 / 平台备注；每个 tab 拆独立文件，单文件 ≤ 250 行。保留 `buildSettingsOverview` 概览卡作为 Tabs 上方的入口一览。

**URL 兼容要求（必须）**：
- 进入 `/settings#proxy-settings` 时，默认选中代理 Tab。
- 进入 `/settings#google-ads-settings`、`#platform-settings`、`#script-settings` 时，默认选中对应 Tab。
- 账号安全拆 Tab 后，新增并统一使用 `#account-security-settings`。
- 点击 Tab 时，同步更新 hash；旧入口无需改写，继续兼容来自 `admin-operations-monitor.tsx`、`google-ads-manager.tsx`、`link-swap-manager.tsx` 等现有链接。
- 若后续想改用 query string，必须先做旧 hash 到新 URL 状态的兼容层；本方案默认**继续保留 hash 方案**。

#### F8. 仪表盘首屏视觉重复

`dashboard-client-page.tsx` 首屏：

```
hero（xl:grid-cols-[1.2fr,0.9fr]）
├── 左：欢迎语 + 4 个静态 coreEntryLinks (ActionCard)        ┐ 视觉同构
└── 右：刷新按钮 + 3 张运行脉搏卡                            │
                                                            │
接下来                                                       │
├── 4 个 OverviewCard（启用 Offer / 任务 / 成功率 / 告警）   │
├── "当前优先处理项"（data.actions 动态渲染为 ActionCard） ┘ 同视觉不同数据
├── "需要留意的问题"（RiskCard）    ← 与右侧"当前风险焦点"数据重复
└── "最近 5 条换链结果"（RunCard）
```

需要澄清：`coreEntryLinks` 是**静态 4 入口**，`data.actions` 是 **API 动态动作项**（语义不同，但用同一个 `<ActionCard>` 视觉）。问题是用户扫视时"上面是绿卡，下面又是一样的绿卡"，分不清两者层级。

**建议**：
- 删除 hero 左侧的 `coreEntryLinks` 4-卡网格（侧边栏已有这些入口；如需保留，改成单行 Tab 样式，避免和下方 ActionCard 视觉撞车）。
- 合并右侧"当前风险焦点"和下方"需要留意的问题"为单一来源。
- 4 个 `StatCard` 增加 `delta`（环比）字段；成功率 < 80% 自动切 `warning` tone。
- Hero 改为轻 banner：问候 + 3 个 inline 小指标（上次运行 / 成功率 / 告警数）。
> 注：删 hero 4 卡后首屏会明显"瘦下来"，属于产品取舍；若产品希望保留"欢迎 + 快捷入口"氛围，可改成紧凑行，不要并列 4 张大卡。

#### F9. 顶栏信息权重失衡

`app-shell.tsx:258-291`：
- 右侧"在线"徽章恒为 primary 色，**不承载状态**，属语义噪音。
- 页面描述塞在 `main` 第一行（`app-shell.tsx:295-299`），与标题被 `<header>` 分隔开，视觉断层。
- `⌘K` hint 将随 F4 一并移除。

**建议**：
- 删除恒亮"在线"徽章；如确有服务心跳需求，**直接复用现有 `/api/health`** 做右上角小圆点，不再额外设计新的状态接口。
- 页面描述合并到 header 标题下方（见下文 F17 对 `pageDescriptions` 的处理）。
- F4 完成后顶栏右侧预期**接近空**：仅保留未来可能的通知/健康小圆点；不要为填空而加新元素。

#### F10. 管理员菜单缺少视觉区隔

`app-shell.tsx:211-218`：admin 区与普通菜单同色同权重，看不出"我正在操作管理员权限"。对照 autobb `AppLayout.tsx:621-622` 的紫色方案。

**建议**：给 `adminLinks` 的 active/hover 态换为中性紫（不改品牌主色 emerald）；section 标题前加 `<Shield className="h-3 w-3" />`。

#### F11. 侧边栏用户区信息单薄

`app-shell.tsx:222-239` 当前只有首字母 + 用户名 + 角色。

**建议**：
- 头像区改为 `<Link href="/settings">`，至少提供进入设置页的快捷入口。
- 若要展示"最后登录：相对时间"或订阅到期提示，需先扩展 `CurrentUser` 与 `requireUser() -> AppShell` 的数据面；这不是纯前端样式修改。
- 若本轮不扩展后端数据，Phase 2 仅做"可点击用户区 + 视觉优化"，不强行补 last login/subscription。
- 折叠态默认用 `title` / `aria-label` 解决提示需求，本轮**不单独为 Tooltip 增依赖**。

---

### 🟡 P2 — UX 体验层

#### F12. 缺乏统一 EmptyState

各列表自己手写 `rounded-xl border border-dashed ...`（如 `dashboard-client-page.tsx:413-419`），文案/间距/CTA 不一致。

**建议**：统一用 §F6 的 `<EmptyState>`。

#### F13. 列表页骨架屏缺失

`accounts-manager.tsx` / `offers-manager.tsx` / `link-swap-manager.tsx` / `queue-monitor.tsx` / `admin-users-manager.tsx` 多数 loading 只有静态"加载中…"。

**建议**：把 `dashboard-client-page.tsx:202-220` 的 `LoadingState` 外提成 `<TableSkeleton rows={8} />` / `<CardGridSkeleton count={4} />` 复用。

#### F14. Toast / 内联红字混用

`toast.error(...)`（dashboard-client-page.tsx:243）与 `setMessage(...)` + 内联红字（settings-manager.tsx:163）并存。**建议**：通用错误走 toast（`sonner`），内联红字仅用于字段级表单校验。

#### F15. 管理员 / Offers 行内操作按钮过多

- `admin-users-manager.tsx:963-1016` — 单行 **8 个按钮**（编辑 / 重置密码 / 登录记录 / 安全告警 / 解除锁定 / 清空失败 / 停用 / 删除），移动端必然换行，危险操作（删除 / 停用）与高频操作（解除锁定）长得一样。
- `offers-manager.tsx:860-891` — 单行最多 5 个按钮（编辑 / 补点击 / 换链 / 删除等）。
- `link-swap-manager.tsx:795-844` — 单行最多 5 个按钮，其中"暂停"用了 `bg-slate-700`，与主色系冲突。

**建议**：保留 2 个高频（如"编辑"+"历史/登录记录"），其余折叠进 **`@radix-ui/react-dropdown-menu`**（已决定引入，见 §七）；危险操作单独一级菜单 + 红色 hover。

#### F16. 页面描述文案双重维护风险

`app-shell.tsx:54-64` 集中定义 `pageDescriptions`，**这是优势设计**。但当前 offers-manager.tsx:507-509 等页面自己又重复写了一遍，形成双份维护。

**建议**：保留 `pageDescriptions` 作为**唯一来源**；页面不要自写描述；如单页需要覆盖，`<PageHeader description={...} />` 接受 override prop，默认从 app-shell context 读取。
> 这是对初版方案的修正：**不要把 pageDescriptions 下发到各 page**，那是把集中变量散化，属于设计降级。

#### F17. 页面描述的位置

与初版方案的**关键修正**：`app-shell.tsx:54-64` 的 `pageDescriptions` 集中映射是**优势设计**，不要打散到各 page。

**建议**：
- 保留 `pageDescriptions` 作为**唯一来源**。
- 让 `<PageHeader>` 从 app-shell 的 React context 读取当前路由的默认描述。
- 单页如需覆盖，通过 `<PageHeader description={...} />` prop override；默认不传就用集中映射。
- 页面内**不再**手写描述文字（如 offers-manager.tsx:507-509 的描述需删除，交给 PageHeader）。

#### F18. 其它零星 UX 问题（按文件列）

- `link-swap-manager.tsx:549-582`：脚本对接面板一行三件（Token / rotate / copy），太密；拆两行。
- `link-swap-manager.tsx:995-1042`：执行历史弹窗的 loading/list/empty 三态齐全，**是项目内弹窗模板**，其它弹窗对齐此实现。
- `queue-monitor.tsx:739-771`：**手动保存模式已确认**（不是即时保存）。当前视觉问题：8 个数字输入变动后看不出"未保存"状态，用户不确定是否要点击保存。建议：
  1. 包裹 section 并加标题"队列配置"；
  2. 任一字段被修改时，右上角显示"· 未保存" 橙色提示 + 高亮保存按钮（primary 填充色）；
  3. "保存 / 还原" 按钮对齐到 section 右上，保存成功后 toast 并清 dirty 状态；
  4. 页面离开时若仍 dirty，用 `beforeunload` 提示。
- `queue-monitor.tsx:651-700`：任务卡片流无分页；加 LoadMore 或 virtual scroll。
- `click-farm-manager.tsx:580-603`：质量指标列信息过满；简化为"92%（820/890）"，hover 再出明细。
- `click-farm-manager.tsx:754-807`：pausedRows / weakRows 并排但无差异化标题，加"暂停 3"/"弱账号 2"徽章。
- `google-ads-manager.tsx:331-395`：4 步 OAuth 流程缺 step indicator；加 **CSS-only Stepper**（`<ol>` + 状态图标 + 文案即可），本轮不为此引入新依赖。
- `google-ads-manager.tsx:143, 146, 543`：模板字符串拼 Tailwind class；改 `cn()`。
- `admin-users-manager.tsx:1220-1278`：登录记录弹窗无按 IP 过滤，50 条滚起来累；加搜索框。
- `admin-users-manager.tsx:1281-1343`：安全告警 evidenceGrid 密度高；按"最近 7 天 / 更早"分段。

#### F19. 登录页小瑕疵（`login-form.tsx`）

已核验：
- ✅ 已有 `role="alert"` + `aria-live="polite"`（行 106）和正确的 `autoComplete`。
- ❌ 提交中只改按钮文字，无 spinner icon（行 116-117）；建议加 `<Loader2 className="animate-spin" />`。
- ❌ 错误时无焦点回到首个字段（行 30-33）；建议在 setError 后 `inputRef.current?.focus()`。
- ℹ️ 无"记住登录 / 找回密码"链接 —— 产品已在 hero 区说明"账号权限由管理员从后台统一分配"，视为设计决策，非缺陷。

---

## 四、优化路线图（单一时序表）

> 所有阶段可分多个 PR 推进；**Phase 0 必须最先**，其它可部分并行。

| Day | Phase | 内容 | 验收 |
| --- | --- | --- | --- |
| D1 | **Phase 0 · 清理** (0.5d) | F1 清理所有非法 amber 变体（含 `/35` `/60` `/80`）；F2 去重 tracking-tight；F3 删 5 个 " 2.tsx"；**F4 移除命令面板**（删 `command-palette.tsx`、`app-shell.tsx` 相关 import 与渲染、`⌘K` hint）；F5 删空 if block。 | §五"基础质量门禁"全绿；`rg "CommandPalette|command-palette" apps/web` 无输出 |
| D2–D4 | **Phase 1 · 共享 UI 包** (2d) | F6：新增 8 个文件到 `packages/ui/src/`（stat-card / shortcut-card / status-badge / empty-state / skeletons / page-header / tone / metric-group）；index.ts re-export。**用 npm workspaces 安装** `@radix-ui/react-tabs` + `@radix-ui/react-dropdown-menu`（Phase 3 / Phase 4 将用到，此处先装）。逐文件接入 dashboard / accounts / offers / link-swap / settings / admin-users，删除本地重复定义。 | 本地定义的 OverviewCard/ShortcutCard/toneStyles 从业务文件归零；7 个业务 manager 单文件行数**至少下降 10%**（Phase 4 后累计 ≥ 20%） |
| D5 | **Phase 2 · 布局精修** (1d) | F9 顶栏：删"在线"恒亮；描述合并进 header，并约定健康状态复用 `/api/health`。<br/>F10 管理员菜单换紫色 + Shield icon。<br/>F11 用户区改为可点击；是否显示最近登录取决于 `CurrentUser` 数据扩展。<br/>F17 `<PageHeader>` 接入；**保留 pageDescriptions 集中映射**，PageHeader 从 context 读默认值 + 支持 prop override。 | 所有 `(app)/*/page.tsx` 头部统一结构；admin 菜单颜色可辨；顶栏右侧留空（不再有 Cmd+K / 在线徽章） |
| D6–D8 | **Phase 3 · Dashboard + Settings** (3d) | F8 Dashboard hero 瘦身 + StatCard delta + 合并风险块 + 接入骨架屏。<br/>F7 Settings 接入 **Radix Tabs**，5 个 tab 各自拆文件，并完成旧 hash 深链兼容。 | Dashboard 首屏无视觉同构重复；Settings 每 tab ≤ 250 行；`/settings#proxy-settings` 等旧入口仍可直达对应 Tab |
| D9–D11 | **Phase 4 · 业务列表统一** (2–3d) | 按 bug 密度顺序：**admin-users → link-swap → offers → click-farm → accounts → google-ads → queue**。<br/>每文件：接 `<PageHeader>` + `<EmptyState>` + `<TableSkeleton>`；F15 行内按钮折叠 **Radix DropdownMenu**；F14 toast 统一；F18 零星问题（含 queue 配置的手动保存视觉增强）。 | 无本地 manager 自写 OverviewCard；行内按钮 ≤ 3；主要操作有 toast 反馈；queue 配置未保存时有明显 dirty 提示 |
| D12 (可选) | **收尾** (1d) | F19 登录 spinner + focus；一次视觉回归 + `npm --workspace @autocashback/web run build -- --profile` bundle 检查 | bundle 比 Phase 0 前增加 ≤ 8%（见 §六） |

合计 **~10 人日**，可 1–2 人推进。

---

## 五、验收标准

### 基础质量门禁（仓库当前可直接执行）

```bash
npm run lint
npm run type-check
npm run test
npm --workspace @autocashback/web run build
```

### 静态质量（CI 可自动校验，见 §七）

```bash
# 非法 amber class 全部归零（含派生 /35 /60 /80）
rg "bg-amber-500/100(/100)?/10(/(35|60|80))?" apps/web   # 应无输出

# tracking-tight 重复归零
rg "tracking-tight tracking-tight" apps/web    # 应无输出

# " 2.tsx" 副本清零
find apps/web -name '* 2.tsx'                  # 应无输出

# 命令面板已完全移除
rg "CommandPalette|command-palette" apps/web   # 应无输出

# @autocashback/ui 至少导出 8 个组件（不含 cn）
rg "^export " packages/ui/src/index.ts | wc -l # >= 9
```

### 视觉一致性

- 所有后台页首屏用统一 `<PageHeader>`；页面组件**不自写描述**（描述来自 `app-shell.pageDescriptions` 集中映射，或页面通过 prop 覆盖）。
- 管理员菜单 vs 普通菜单颜色明显可辨。
- 无重复信息块（核心入口 / 风险焦点均只出现一次）。

### 交互顺畅度

- 所有列表 loading 均有骨架屏，空态均有 `<EmptyState>`。
- 通用错误走 toast，内联红字仅字段级。
- 管理员行内按钮 ≤ 3，其余折入 Radix DropdownMenu；危险操作有红色 hover。
- queue 配置改动后明显提示 "未保存"，保存按钮高亮；离开前 `beforeunload` 拦截。

---

## 六、横向补充（容易漏但需要看）

### 可访问性（a11y）

- Phase 2 `<PageHeader>` 必须带 `<h1>`，避免页面双标题；tab 序需验证（Shift+Tab 回溯到侧栏，不被 Toast 拦截）。
- F15 改 DropdownMenu 后，需确保键盘 `Enter/Space` 可展开、`Esc` 可关闭。
- 颜色对比：emerald / amber 在 `text-amber-600` on `bg-amber-500/10` 的组合应通过 WCAG AA（≥ 4.5:1），Phase 0 修 amber 后需复核。

### i18n

- 当前文案全中文硬编码。若存在出海计划，Phase 1 新增 `<StatCard label={...}>` 时 prop 应为 `ReactNode` 而非固定字符串；Phase 4 业务页面文案不要在 JSX 内拼接，便于后续接 i18n。
- 若无出海计划，此条忽略。

### 暗色模式

- 当前用 `bg-card / text-foreground / text-muted-foreground` 语义 token，理论可用。但 Phase 0 修完 amber 后，需在暗色主题下检查 `bg-amber-500/10` 是否过淡（必要时 `dark:bg-amber-500/20`）。

### 测试

- 当前测试基线是 **Vitest + node environment**；仓库还没有 `jsdom` / `@testing-library/react` / `@testing-library/user-event`，不要把 UI 交互测试写成默认已具备的验收项。
- Phase 1 默认要求：补纯函数与数据构建测试即可；例如 `buildSettingsOverview`、`tone`、`status meta` 这类逻辑层可直接纳入现有 Vitest 体系。
- 若要给 `Tabs` / `DropdownMenu` / `EmptyState` 补交互测试，先单独创建子任务补测试基建：`jsdom`、`@testing-library/react`、必要的 test setup。
- Phase 4 对 admin-users 的危险操作二次确认，至少需要一层行为测试；若测试基建未补齐，则要在 PR 风险说明里明确改为人工回归。

### Bundle 大小

- Phase 1 引入新组件后跑：`npm --workspace @autocashback/web run build -- --profile`。
- 目标：后台首屏 JS chunk 增幅 ≤ 8%。
- 新增 `@radix-ui/react-tabs` + `@radix-ui/react-dropdown-menu`（+ 它们隐式依赖的 `react-slot` / `react-primitive` / `react-portal` 等小包），合计 gzip ~12KB，已核实可接受。
- **抵消项**：F4 移除 `command-palette.tsx` 会省掉 Cmd+K 相关代码（估算 ~2–4KB）。净增约 8–10KB。

### CI 防回归（必做）

在 `.github/workflows/*.yml` 或 `package.json` 的 pre-commit 添加：

```bash
# 禁止再次出现的模式
rg -q "bg-amber-500/100(/100)?/10(/(35|60|80))?" apps/web && exit 1
rg -q "tracking-tight tracking-tight" apps/web && exit 1
rg -q "CommandPalette|command-palette" apps/web && exit 1
find apps/web -name '* 2.tsx' | grep -q . && exit 1
```

或 ESLint 自定义 rule：禁止 `className` 字符串中出现上述子串。

---

## 七、依赖决策：引入 `@radix-ui/react-tabs` + `@radix-ui/react-dropdown-menu`

**核验**：`apps/web/package.json` 和 `packages/*/package.json` 均未依赖 `@radix-ui`。

**决策已确定**：引入上述两个 headless primitive，在 Phase 1 末尾一并通过 npm workspaces 安装，Phase 3 接入 Tabs（F7 Settings）、Phase 4 接入 DropdownMenu（F15 行内按钮折叠）。

```bash
npm install --workspace @autocashback/web @radix-ui/react-tabs @radix-ui/react-dropdown-menu
```

**边界**：
- **只引入这两个**；`page-header` / `stat-card` / `empty-state` / `skeleton` 等自定义组件保持 CSS-only，不要一口气把整套 Radix 装上。
- 不引入视觉组件库（MUI / antd / Chakra）。
- 本轮**不为 `Tooltip` / `Stepper` 新增依赖**：Tooltip 优先用 `title` / `aria-label` / 已有文案解决，Stepper 用 CSS-only + 语义化 `<ol>` 自绘。
- 若后续需要 `Dialog` / `Popover` / Tooltip primitive，单独发起依赖评审，不默认扩展。
- bundle 估算：两个包 + 其隐式小依赖合计 gzip ~12KB；F4 移除命令面板抵消 ~2–4KB，净增约 8–10KB，满足 §六"首屏 JS 增幅 ≤ 8%"。

---

## 八、关键文件索引

| 路径 | 说明 | 涉及阶段 |
| --- | --- | --- |
| `apps/web/components/app-shell.tsx` | 后台布局入口 | Phase 2 |
| `apps/web/components/dashboard-client-page.tsx` | 仪表盘 | Phase 1, 3 |
| `apps/web/components/settings-manager.tsx` | 设置页 | Phase 1, 3 |
| `apps/web/components/admin-users-manager.tsx` | 管理员 - 用户（bug 密度最高） | Phase 0, 1, 4 |
| `apps/web/components/link-swap-manager.tsx` | 换链管理 | Phase 0, 1, 4 |
| `apps/web/components/offers-manager.tsx` | Offer 管理 | Phase 0, 1, 4 |
| `apps/web/components/click-farm-manager.tsx` | 补点击 | Phase 1, 4 |
| `apps/web/components/accounts-manager.tsx` | 账号管理 | Phase 0, 1, 4 |
| `apps/web/components/queue-monitor.tsx` | 任务队列 | Phase 1, 4 |
| `apps/web/components/google-ads-manager.tsx` | Google Ads | Phase 1, 4 |
| `apps/web/components/admin-operations-monitor.tsx` | 运营监控 | Phase 0, 1, 4 |
| `apps/web/components/command-palette.tsx` | 命令面板 | **Phase 0 删除** |
| `apps/web/components/login-form.tsx` | 登录页 | Phase 4 (收尾) |
| `packages/ui/src/index.ts` | 共享 UI 包入口（当前仅 `cn`） | Phase 1（大幅扩容） |

**autobb 参考（仅学习，不直接复制代码）**：

- 布局：`/Users/jason/Documents/Kiro/autobb/src/components/layout/AppLayout.tsx`
- 空状态：`/Users/jason/Documents/Kiro/autobb/src/components/ui/empty-state.tsx`
- 骨架屏：`/Users/jason/Documents/Kiro/autobb/src/components/ui/loading-skeleton.tsx`
- 基础原子集合：`/Users/jason/Documents/Kiro/autobb/src/components/ui/`

---

## 九、不建议做的事

- **不要整体搬运 autobb 的侧边栏层级**：autobb 业务域是 autocashback 的 2.5 倍，折叠"数据与扩展"section 为那种规模设计；autocashback 9 个菜单保持**一层分组（运营中心 / 系统管理）**即可。
- **不要把 pageDescriptions 从 app-shell 打散到各 page**：集中映射本身是优势（见 F17），Phase 2 方案选**保留集中 + PageHeader 接受 override**，不做反向。
- **不要引入视觉组件库（MUI / antd）**：现有 Tailwind + lucide-react + sonner + 本方案引入的 Radix Tabs / DropdownMenu 够用（见 §七）。
- **不要保留命令面板**：虽然 Cmd+K 酷，但 autobb 没有、运营规模不需要、且每次加路由都要同步索引表；Phase 0 一并移除。
- **不要把 autobb 的蓝紫主题直接搬过来**：autocashback 品牌色是 emerald，仅"管理员"用中性紫做区隔。

---

## 十、决策记录

所有待核实事项已于 2026-04-19 确认：

| 事项 | 决策 | 落地位置 |
| --- | --- | --- |
| 风险行 amber 是否显色 | ✅ **全部保留并恢复显色** | F1 / Phase 0 |
| Tabs / DropdownMenu 路线 | ✅ **引入 Radix headless primitives** | §七 / Phase 1 末尾安装、Phase 3 / Phase 4 接入 |
| autobb 有无命令面板 & 是否保留 | ✅ autobb 无；autocashback **也不需要，Phase 0 移除** | F4 |
| queue 配置是即时还是手动保存 | ✅ **手动保存**，需强化 dirty 指示与保存按钮 | F18 |
| Settings 改 Tabs 后 URL 方案 | ✅ **继续保留 hash 深链并兼容旧入口** | F7 / Phase 3 |
| 顶栏健康状态来源 | ✅ **复用现有 `/api/health`** | F9 / Phase 2 |
| 侧边栏用户区增强 | ✅ 若展示最后登录等数据，**先扩展 `CurrentUser` / auth layout 数据面** | F11 / Phase 2 |
| Tooltip / Stepper 依赖策略 | ✅ **本轮不新增依赖**，Tooltip 用原生提示，Stepper 用 CSS-only | F11 / F18 / §七 |
| UI 交互测试基线 | ✅ **当前未具备**；若需要 testing-library，先建测试基建子任务 | §六 |

---

## 十一、下一步

确认方案后，建议在 `autocashback-8uj` 下创建 6 个子 issue：

```bash
bd create --title="[前置] 对齐 UI 优化方案的依赖/深链/测试前提" --priority=1 --type=task --json \
  --description="统一 npm workspaces 命令、Settings hash 深链兼容策略、CurrentUser 数据扩展范围、UI 交互测试是否补基建"
bd create --title="[Phase 0] 清理 UI 工程瑕疵 + 移除命令面板" --priority=1 --type=task --json \
  --description="修所有非法 amber class 变体、tracking-tight 重复、删副本文件、空 if block、移除 command-palette"
bd create --title="[Phase 1] 沉淀 @autocashback/ui 基础组件 + 安装 Radix Tabs/DropdownMenu" --priority=2 --type=task --json
bd create --title="[Phase 2] 后台布局与导航精修" --priority=2 --type=task --json
bd create --title="[Phase 3] Dashboard + Settings(Radix Tabs) 重构" --priority=2 --type=task --json
bd create --title="[Phase 4] 业务列表页统一(Radix DropdownMenu)" --priority=2 --type=task --json

bd dep add <phase-1-id> <preflight-id>
bd dep add <phase-2-id> <preflight-id>
bd dep add <phase-3-id> <preflight-id>
bd dep add <phase-4-id> <preflight-id>
bd dep add <phase-1-id> <phase-0-id>
bd dep add <phase-2-id> <phase-1-id>
bd dep add <phase-3-id> <phase-1-id>
bd dep add <phase-4-id> <phase-1-id>
```

_文档到此。实施进度请更新到 beads issue 的 status / notes / close reason，不在本文打勾追踪。_
