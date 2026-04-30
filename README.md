# 税率政策工具 — Tariff Policy Tool

给中国出海企业用的美国进口关税测算、原产地对比和政策变动监控工具。

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

## 功能

- **多层关税拆解**：MFN/FTA、Section 301、Section 232、Section 122、MPF/HMF，每层附带来源、有效期、置信度
- **多原产地对比**：9 个原产地（中国、韩国、越南、墨西哥、加拿大等）并排测算到岸总成本
- **批量测算**：上传 Excel，批量计算多 SKU 到岸成本，自动风险分层，导出 5 Sheet 中文报告
- **政策时间线**：追踪 IEEPA、Section 122、De Minimis 等政策变化，展示影响范围
- **数据健康看板**：7 个数据源同步状态、新鲜度、记录数一目了然

## 技术栈

- **前端**：WXT (Chrome Extension MV3) + React 18 + TypeScript + TailwindCSS + Zustand v5 + i18next
- **后端**：Supabase (self-hosted) + Hono Worker + BullMQ + Redis
- **测试**：Vitest（71 测试覆盖策略引擎、HS 规范化、积分系统）

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式（Chrome 扩展 HMR）
pnpm dev

# TypeScript 类型检查
pnpm compile

# 运行测试
pnpm test

# 生产构建
pnpm build
```

## 项目结构

```
src/
├── entrypoints/
│   ├── background.ts              # Service Worker（定时任务）
│   └── options/                   # 全屏选项页 SPA
│       ├── App.tsx                # 侧边栏导航 + 路由
│       └── pages/
│           ├── StrategyPage.tsx   # 策略对比（单次 + 批量模式）
│           ├── DataCenterPage.tsx # 数据中心（健康看板 + 时间线）
│           ├── SubscriptionPage.tsx
│           ├── PlanPage.tsx
│           └── AccountPage.tsx
├── lib/
│   ├── strategy-engine.ts        # V2 到岸成本计算引擎
│   ├── batch-engine.ts           # 批量测算引擎
│   ├── mock-data.ts              # 真实税率数据（5 品类 × 9 原产地）
│   ├── tariff-change-log.ts      # 政策变更时间线
│   ├── excel-utils.ts            # Excel 模板下载 + 报告导出
│   └── hs-normalize.ts           # HS 编码规范化
├── types/index.ts                # 全局类型定义
├── store/                        # Zustand 状态管理
└── services/                     # API 客户端、认证、通知
backend/
├── docker-compose.yml            # Supabase + Worker + Redis + Nginx
├── supabase/migrations/          # 数据库 schema + 种子数据
└── worker/                       # Hono Worker（采集、通知、支付）
```

## 关税计算公式

```
到岸总成本 = 货值 + MFN/FTA关税 + Section 301 + Section 232
           + Section 122 + MPF + HMF + 运费 + 保险
```

| 税种 | 适用范围 | 当前税率 |
|------|----------|----------|
| MFN/FTA | 全球，FTA 国家可减免 | 按 HS 编码查询 |
| Section 301 | 仅中国原产 | 7.5%-100%（按清单） |
| Section 232 | 全球，钢铝/汽车 | 25% |
| Section 122 | 全球临时附加税（USMCA 豁免） | 10%（至 2026-07-24） |
| IEEPA | 历史税种，已失效 | 0%（SCOTUS 2026-02-20 推翻） |
| AD/CVD | 仅风险提示，不计入确定成本 | 需人工确认 |
| De Minimis | 全球暂停 | $800 以下不再免税 |

## 产品定位

- **中文原生**，服务采购、外贸、供应链和财务人员
- **Chrome 扩展 + Excel 批量工作流**，贴近日常选品、询价、采购场景
- **可信优先**：每层税种展示来源、有效期、置信度，AD/CVD 不自动计入确定成本
- **不替代**报关行、律师、税务顾问，不承诺 DDP 税费保证

## 文档

- [产品后续走向需求文档](docs/产品后续走向需求文档.md) — P0-P4 功能优先级、商业化方向、12 周交付计划
- [竞品分析报告](docs/竞品分析报告.md) — DutyDesk、TariffsAPI、Flexport 等竞品对比

## 免责声明

本产品用于贸易成本测算、政策监控和内部决策辅助，不构成法律、税务、报关或海关归类意见。实际税率请以 CBP、USITC、HTSUS、Federal Register 官方公告为准。

## 开源许可

本项目基于 [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) 开源。

这意味着：
- 你可以自由使用、修改和分发本软件
- 如果你修改了代码并通过网络提供服务，**必须公开修改后的完整源代码**
- 衍生作品必须同样使用 AGPL-3.0 许可
- 不允许将本代码用于闭源商业软件
