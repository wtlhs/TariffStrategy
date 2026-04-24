# 税率政策工具 — 完整复刻提示词

> 本文档包含从 `scm-bi-system` 项目中提取的税率政策模块完整功能规格。
> 可直接作为 Claude Code 的提示词使用，在新项目中快速复刻全部功能和样式。

---

## 一、产品定位

**税率政策工具**（Tariff Policy Tool）是一款面向国际贸易企业的发货策略对比工具，核心能力包括：

1. **智能发货策略对比** — 输入 HS 编码、发出地、目的地、货值，对比所有可选发货路线的总成本（含税费+运费），AI 推荐最优方案
2. **税率数据管理** — 展示爬虫采集的 Section 301、MFN 税率、反倾销税等真实数据；管理预设产品和发货国家
3. **税率变化订阅** — 订阅特定路线/产品/成本的税率变化通知，支持邮件和钉钉渠道

---

## 二、三页架构

```
/tariff-strategy      → 策略对比页（主入口）
/tariff-data          → 数据管理页（配置中心）
/tariff-subscription  → 订阅管理页（通知设置）
```

---

## 三、完整代码索引

### 前端（bi-dashboard）

| 文件路径 | 说明 |
|---------|------|
| `apps/bi-dashboard/src/app/tariff-strategy/page.tsx` | 策略对比主页面（~450行） |
| `apps/bi-dashboard/src/app/tariff-data/page.tsx` | 数据管理页面（~850行） |
| `apps/bi-dashboard/src/app/tariff-subscription/page.tsx` | 订阅管理页面（~597行） |
| `apps/bi-dashboard/src/services/tariff-config.ts` | 产品/发货国家 CRUD API + Excel 导入导出（229行） |
| `apps/bi-dashboard/src/services/tariff-strategy.ts` | 策略对比 API（53行） |
| `apps/bi-dashboard/src/services/tariff-subscription.ts` | 订阅规则/通知渠道 API（99行） |
| `apps/bi-dashboard/src/constants/tariff.ts` | 国家代码映射（53行） |
| `apps/bi-dashboard/src/i18n/messages/zh.ts` | 中文文案 `tariffStrategy` 命名空间（~70个key） |
| `apps/bi-dashboard/src/i18n/messages/en.ts` | 英文文案 `tariffStrategy` 命名空间（~70个key） |

### 后端（bi-backend）

| 文件路径 | 说明 |
|---------|------|
| `apps/bi-backend/src/modules/tariff/tariff.routes.ts` | 税率策略路由 |
| `apps/bi-backend/src/modules/tariff/tariff.service.ts` | 税率策略服务 |
| `apps/bi-backend/src/modules/tariff-config/tariff-config.routes.ts` | 产品/发货国家配置路由 |
| `apps/bi-backend/src/modules/tariff-config/tariff-config.service.ts` | 配置 CRUD + Excel 服务 |
| `apps/bi-backend/src/modules/tariff-subscription/tariff-subscription.routes.ts` | 订阅规则路由 |
| `apps/bi-backend/src/modules/tariff-subscription/tariff-subscription.service.ts` | 订阅服务 |

### AI 服务（scm-ai-service, Python FastAPI）

| 文件路径 | 说明 |
|---------|------|
| `scm-ai-service/app/main.py` | FastAPI 入口 |
| `scm-ai-service/app/routers/tariff.py` | 税率查询路由 |
| `scm-ai-service/app/routers/subscription.py` | 订阅路由 |
| `scm-ai-service/app/routers/user_config.py` | 用户配置路由 |
| `scm-ai-service/app/services/tariff_service.py` | 核心税率计算服务 |
| `scm-ai-service/app/services/subscription_service.py` | 订阅服务 |
| `scm-ai-service/app/services/notification_service.py` | 通知发送服务 |
| `scm-ai-service/app/services/user_config_service.py` | 用户配置服务 |
| `scm-ai-service/app/db/models.py` | SQLite 数据模型 |
| `scm-ai-service/app/db/tariff_repository.py` | 税率数据仓库 |
| `scm-ai-service/app/db/database.py` | 数据库连接 |
| `scm-ai-service/app/db/engine.py` | 引擎配置 |
| `scm-ai-service/app/models/dto.py` | Pydantic DTO |
| `scm-ai-service/app/crawlers/base_crawler.py` | 爬虫基类 |
| `scm-ai-service/app/crawlers/us_hts.py` | US HTS 爬虫 |
| `scm-ai-service/app/crawlers/eu_taric.py` | EU TARIC 爬虫 |
| `scm-ai-service/app/crawlers/wits_api.py` | WITS API 爬虫 |
| `scm-ai-service/app/crawlers/integrated_crawler.py` | 聚合爬虫 |
| `scm-ai-service/app/config.py` | 配置 |

---

## 四、数据模型

### 4.1 产品（TariffProduct）

```ts
interface TariffProduct {
  id: string
  tenantId: string
  userId: string
  hsCode: string        // HS编码，如 "8412"
  name: string          // 产品名称，如 "航空发动机"
  defaultValue: number  // 默认货值 USD
  remark?: string
  createdAt: string
  updatedAt: string
}
```

### 4.2 发货国家（TariffOrigin）

```ts
interface TariffOrigin {
  id: string
  tenantId: string
  userId: string
  code: string           // ISO 2位代码，如 "RO"
  name: string           // 国家名
  shippingDays: number   // 默认运输天数
  shippingCost: number   // 默认运费 USD
  createdAt: string
  updatedAt: string
}
```

### 4.3 策略对比结果

```ts
interface StrategyResult {
  routing: string         // "RO→US"
  total_cost: number      // 总成本
  tax_cost: number        // 税费
  shipping_cost: number   // 运费
  tax_rate: number        // 综合税率（小数，如 0.035）
  savings_vs_best: number // 较最优方案多花的钱
  is_best: boolean        // 是否为最优
}

interface StrategyResponse {
  success: boolean
  best_strategy: StrategyResult | null
  all_strategies: StrategyResult[]  // 按 total_cost 升序
  ai_suggestion: string
}
```

### 4.4 订阅规则（TariffSubscription）

```ts
type RuleType = 'product' | 'route' | 'cost' | 'policy'

interface TariffSubscription {
  rule_id: string
  tenant_id: string
  user_id: string
  rule_name: string
  rule_type: RuleType
  rule_config: Record<string, unknown>  // 根据 rule_type 不同
  channels: string[]                    // ['email', 'dingtalk']
  is_active: boolean
}
```

### 4.5 通知渠道配置

```ts
interface TariffUserConfig {
  notification_channels: {
    email: { enabled: boolean; address: string }
    dingtalk: { enabled: boolean; webhook: string; secret: string }
    wechat: { enabled: boolean; corp_id: string; agent_id: string; secret: string }
    webhook: { enabled: boolean; url: string }
  }
  preferences: {
    notify_on_rate_increase: boolean
    notify_on_rate_decrease: boolean
    min_change_threshold: number
  }
}
```

### 4.6 国家代码常量

```ts
const COUNTRIES = [
  { code: 'CN', name: '中国' },
  { code: 'DE', name: '德国' },
  { code: 'KR', name: '韩国' },
  { code: 'RO', name: '罗马尼亚' },
  { code: 'US', name: '美国(普通)' },
  { code: 'US-F', name: '美国(协定)' },
  { code: 'MA', name: '摩洛哥' },
  { code: 'MA-F', name: '摩洛哥(免税区)' },
  { code: 'MX', name: '墨西哥' },
  { code: 'JP', name: '日本' },
  { code: 'SG', name: '新加坡' },
  { code: 'VN', name: '越南' },
  { code: 'CL', name: '智利' },
  { code: 'HK', name: '中国香港' },
  { code: 'CA', name: '加拿大' },
  { code: 'FR', name: '法国' },
]
```

---

## 五、API 接口

### 5.1 税率配置 `/api/bi/tariff-config`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/products` | 获取产品列表 |
| POST | `/products` | 创建产品 |
| PUT | `/products/:id` | 更新产品 |
| DELETE | `/products/:id` | 删除产品 |
| GET | `/origins` | 获取发货国家列表 |
| POST | `/origins` | 创建发货国家 |
| PUT | `/origins/:id` | 更新发货国家 |
| DELETE | `/origins/:id` | 删除发货国家 |
| POST | `/import` | Excel 导入（FormData: file） |
| GET | `/export` | Excel 导出（返回 Blob） |
| GET | `/template` | 下载导入模板 |

### 5.2 税率策略 `/api/bi/tariff`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/strategy/compare` | 策略对比 |
| GET | `/crawled-data` | 获取爬虫采集数据 |

**compare 请求体：**
```json
{
  "hs_code": "8412",
  "origin": "RO",
  "destination": "US",
  "goods_value": 50000,
  "routes": [
    { "routing": "RO→US", "shipping_days": 18, "shipping_cost": 1800 }
  ]
}
```

### 5.3 订阅管理 `/api/bi/tariff-subscription`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/subscriptions` | 获取订阅列表 |
| POST | `/subscriptions` | 创建订阅规则 |
| DELETE | `/subscriptions/:id` | 删除订阅规则 |
| GET | `/user-config` | 获取用户通知配置 |
| PUT | `/user-config/channel` | 更新通知渠道 |
| POST | `/user-config/test-channel` | 测试通知渠道 |

---

## 六、策略对比核心算法

```
总成本 = 货值 × (1 + 综合税率) + 运费

综合税率 = 关税率 + 惩罚性关税率 + 消费税率 + 海关手续费率 + 港口附加税率
```

**当前模拟数据（7条路线，目的地统一为 US）：**

| 发出地 | 综合税率 | 运输天数 | 运费 USD |
|--------|---------|---------|---------|
| RO（罗马尼亚） | 3.5% | 18 | 1,800 |
| KR（韩国） | 5.0% | 20 | 2,200 |
| SG（新加坡） | 6.0% | 22 | 2,400 |
| JP（日本） | 7.0% | 15 | 2,600 |
| VN（越南） | 8.0% | 24 | 2,000 |
| DE（德国） | 9.0% | 28 | 3,200 |
| CN（中国） | 31.0% | 25 | 2,000 |

算法流程：
1. 对每条路线计算 `taxCost = goodsValue × taxRate`
2. 计算 `totalCost = goodsValue + taxCost + shippingCost`
3. 按 `totalCost` 升序排序
4. 第一条标记 `is_best = true`
5. 其余计算 `savings_vs_best = totalCost - bestTotal`
6. 生成 AI 建议文本

---

## 七、页面 UI 布局与样式规格

### 7.1 策略对比页（tariff-strategy）

**全局背景：** 深色模式用径向渐变 `radial-gradient(circle_at_top_right, rgba(59,130,246,0.15), transparent 40%), radial-gradient(circle_at_bottom_left, rgba(99,102,241,0.15), transparent 45%), linear-gradient(180deg, #020617, #0f172a)`

**区块 1 — 头部检索区**
- 圆角卡片 `rounded-2xl`，白色半透明背景 + 毛玻璃 `backdrop-blur-xl`
- 标题行：Calculator 图标 + 标题 + 副标题
- 右侧快捷按钮：配置管理链接、HS编码说明弹窗、模型说明弹窗
- 检索条件行：HS编码输入（带产品选择下拉）、发出地下拉、→符号、目的地下拉、货值输入、对比按钮
- HS编码输入框左侧 Package 图标，右侧清空+下拉按钮
- 产品选择器支持模糊匹配 HS编码和产品名

**区块 2 — 错误提示**
- 红色边框卡片，AlertTriangle 图标 + 错误信息

**区块 3 — KPI 卡片（4列网格）**
- 最优方案（路线名）、总成本（绿色，带数字滚动动画）、较次优节省（蓝色，带滚动）、综合税率
- 数字滚动效果：30步 1秒内从0递增到目标值

**区块 4 — 快速订阅**
- 橙色渐变背景 `from-amber-50 to-orange-50`
- Bell 图标 + 路线信息 + 快速订阅按钮
- 弹窗：显示路线和HS编码，可选邮件/钉钉渠道，输入邮箱后创建

**区块 5 — 最优方案详情**
- 绿色 Check 图标 + 标题
- 左列：路线、税费成本、运输成本、总成本
- 右列：AI 建议框（橙色渐变背景，Lightbulb 图标，`whitespace-pre-line` 展示多行文本）

**区块 6 — 全部方案对比表**
- 表格列：路线、总成本、税费、运费、税率、较最优
- 最优方案行背景 `bg-emerald-500/10` + 绿色 Check
- 较最优显示：最优行绿色标签 "最优"，其余红色标签 `+$xxx`

**弹窗 x3 — HS编码说明、模型说明、快速订阅**
- 固定定位，黑色半透明遮罩，白色圆角卡片
- 模型说明弹窗可滚动 `max-h-[80vh] overflow-y-auto`

**状态持久化：** 使用 `sessionStorage` key `tariff-strategy-state` 保存查询条件和结果

### 7.2 数据管理页（tariff-data）

**头部：** 返回按钮 + Database 图标 + 标题 + 导入/导出/模板下载按钮

**三标签切换：** 采集数据 / 产品信息 / 发货国家
- 标签样式：活跃 `bg-blue-500 text-white`，非活跃 `bg-white text-slate-600`

**采集数据标签：**
- 4个概览卡片：Section 301（红色）、MFN税率（蓝色）、反倾销税（橙色）、实时查询（绿色）
- 子标签切换：Section 301 / MFN税率表 / 反倾销税 / 实时查询结果
- Section 301 表格：国家、法律依据、税率区间标签、最低、最高
- MFN 税率：双列网格，左列 HS 4位码详细税率，右列章节平均税率
- 反倾销税表格：HS编码、描述、目标、税率
- 实时查询表格：路线、关税、惩罚性、消费税、海关费、港口费、综合税率、来源链接

**税率颜色规则：**
- 0% → emerald（绿）
- ≤3% → slate（灰）
- ≤10% → amber（橙）
- >10% → red（红）

**产品管理标签：**
- 添加表单：HS编码、产品名称、默认货值、添加按钮
- 产品列表：每行显示 HS编码（蓝色等宽）、名称、货值、编辑/删除按钮
- 内联编辑模式

**发货国家标签：**
- 蓝色提示条说明自动路线生成逻辑
- 添加表单：国家代码下拉（排除已添加）、名称、运输天数、运费
- 国家列表：内联编辑
- 路线预览卡片（绿色背景）

**Excel 操作：**
- 导入：隐藏 file input，点击触发，接受 `.xlsx,.xls`
- 导出：直接下载 Blob
- 模板下载：下载空模板

### 7.3 订阅管理页（tariff-subscription）

**双标签：** 订阅规则 / 通知渠道配置

**订阅规则标签：**
- 创建表单（类型选择 + 类型特定字段）：
  - product：HS编码输入
  - route：发出地+目的地选择
  - cost：阈值输入
  - policy：政策名称
- 规则名称、通知渠道多选（邮件/钉钉）
- 订阅规则列表：每行显示名称、类型标签、渠道、创建日期、删除按钮

**通知渠道配置标签：**
- 4个渠道卡片：邮件、钉钉、企业微信、自定义Webhook
- 每个卡片：开关切换 + 字段编辑 + 测试连接按钮
- 邮件：地址字段
- 钉钉：Webhook URL + 签名密钥
- 企业微信：Corp ID + Agent ID + Secret
- Webhook：URL 字段

---

## 八、i18n 文案规格

所有文案统一在 `tariffStrategy` 命名空间下（~70个key），结构如下：

```
tariffStrategy.title / subtitle
tariffStrategy.configManage / hsCodeLabel / originLabel / destinationLabel / goodsValueLabel
tariffStrategy.compareBtn / calculating / compareFailed
tariffStrategy.kpi.bestPlan / totalCost / savingsVsSecond / blendedRate
tariffStrategy.subscribe.title / desc / btn
tariffStrategy.detail.title / route / taxCost / shippingCost / totalCost / aiSuggestion
tariffStrategy.comparison.title / route / totalCost / tax / shipping / taxRate / vsBest / best
tariffStrategy.hsInfo.title / content
tariffStrategy.modelInfo.title / content
tariffStrategy.quickSubscribe.title / routeLabel / hsLabel / channelLabel / email / dingtalk / ...
tariffStrategy.aiSuggestionTemplate  // 支持参数插值 {bestRoute} {bestCost} {secondRoute} {savings} {percent} {bestRate}
```

**AI 建议模板（中文）：**
```
最优路线为 {bestRoute}，预估总成本 ${bestCost}。
相比次优路线 {secondRoute}，可节省 ${savings}（{percent}%）。

建议优先从罗马尼亚发货，综合税率仅 {bestRate}%，远低于中国发货的 31%。
```

**AI 建议模板（英文）：**
```
The optimal route is {bestRoute}, with an estimated total cost of ${bestCost}.
Compared to the second-best route {secondRoute}, you can save ${savings} ({percent}%).

We recommend shipping from Romania with a blended rate of only {bestRate}%, far lower than the 31% from China.
```

---

## 九、API 服务层封装模式

每个 service 文件遵循统一模式：

```ts
const API_BASE = '/api/bi/tariff-xxx'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // 1. 获取 token → Bearer header
  // 2. 获取 locale → Accept-Language header
  // 3. 统一错误处理：!response.ok || !data.success → throw
  // 4. 返回 data.data（解包 ApiResponse 壳层）
}

// CRUD 函数
export async function getItems(): Promise<Item[]> { ... }
export async function createItem(input: CreateInput): Promise<Item> { ... }
export async function updateItem(id: string, input: UpdateInput): Promise<Item> { ... }
export async function deleteItem(id: string): Promise<void> { ... }
```

---

## 十、Chrome 插件适配建议

如果独立为 Chrome 插件，建议的架构调整：

1. **去掉 Next.js App Router** → 改用纯 React SPA + Chrome Extension API
2. **API 层改为直接调用 AI 服务** → 去掉 bi-backend 代理层
3. **sessionStorage 持久化 → chrome.storage.local**
4. **认证 → chrome.identity API 或自定义 token**
5. **popup.html → 策略对比页（主功能）**
6. **options.html → 数据管理+订阅管理**
7. **background script → 定时检查税率变化、推送通知**

推荐技术栈：
- React 18 + TypeScript + TailwindCSS
- Vite 构建（支持 Chrome Extension HMR）
- `@crxjs/vite-plugin` 或 `chrome-extension-boilerplate`
- 保持 lucide-react 图标库
- 保持相同的 TailwindCSS 类名和配色方案

---

## 十一、如何使用此提示词

在新项目的 Claude Code 会话中，粘贴以下提示：

```
请基于以下规格实现一款税率政策工具（Chrome 插件/Web 应用），包含 3 个页面：
1. 策略对比页 — 输入 HS编码/发出地/目的地/货值，对比多条路线总成本
2. 数据管理页 — 展示采集关税数据、CRUD 产品和发货国家、Excel导入导出
3. 订阅管理页 — 管理税率变化订阅规则和通知渠道

参考源码路径（只读参考，不要直接复制）：
- 源项目根目录：D:/悦信/项目资料/项目代码/scm-bi-system
- 前端页面：apps/bi-dashboard/src/app/tariff-strategy/page.tsx
- 前端页面：apps/bi-dashboard/src/app/tariff-data/page.tsx
- 前端页面：apps/bi-dashboard/src/app/tariff-subscription/page.tsx
- 服务层：apps/bi-dashboard/src/services/tariff-*.ts
- 常量：apps/bi-dashboard/src/constants/tariff.ts
- i18n：apps/bi-dashboard/src/i18n/messages/zh.ts (tariffStrategy 命名空间)
- 后端路由：apps/bi-backend/src/modules/tariff*/tariff*.routes.ts
- AI 服务：scm-ai-service/app/services/tariff_service.py
- AI 爬虫：scm-ai-service/app/crawlers/*.py

关键要求：
- 完整复刻 UI 布局和样式（深色径向渐变背景、圆角2xl卡片、毛玻璃效果）
- 保留全部 i18n 双语支持（zh/en）
- 策略对比使用相同的模拟数据（7条路线）
- 保留数字滚动动画效果
- 保留 sessionStorage 状态持久化
- 保留快速订阅弹窗流程
- 保留 Excel 导入导出功能
```

然后根据实际技术栈补充具体指令（如 "使用 React + Vite 构建 Chrome 插件"）。
