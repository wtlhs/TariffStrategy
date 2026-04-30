# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (Manifest V3) for US import tariff calculation and origin comparison. Chinese-first product targeting Chinese export enterprises ("税率政策工具"). Product direction PRD: `docs/产品后续走向需求文档.md`. Competitive analysis: `docs/竞品分析报告.md`.

**Tech stack:** WXT + React 18 + TypeScript + TailwindCSS (dark/light dual-mode) + Zustand v5 + chrome.storage.local + i18next (zh/en) + SheetJS (xlsx) + Vitest

## Commands

```bash
pnpm dev              # Dev mode (Chrome), uses WXT with HMR
pnpm dev:firefox      # Dev mode (Firefox)
pnpm build            # Production build → .output/chrome-mv3/
pnpm compile          # TypeScript type-check (tsc --noEmit) — run after any .ts/.tsx change
pnpm test             # vitest run — 71 tests across 3 test files
pnpm test:watch       # vitest watch mode
```

Run a single test file: `npx vitest run src/lib/__tests__/strategy-engine.test.ts`

Dev server port: `npx wxt --port 3200`. Note: WXT dev build writes to `.output/chrome-mv3/` which can get locked on Windows — if `EBUSY` error, close Chrome and kill node processes before rebuilding.

Vite standalone preview (bypasses WXT): `npx vite --port 3200` then open `http://localhost:3200/src/entrypoints/options/index.html` (requires `vite.config.ts` with `@/` alias).

## Architecture

### No popup — options page only

Clicking the extension icon opens the full-screen options page (not a popup). `background.ts` calls `chrome.runtime.openOptionsPage()` via `chrome.action.onClicked`. There is no popup entrypoint.

### Entrypoints

- `src/entrypoints/background.ts` — Service Worker with 3 alarms: `tariff-check` (6h), `checkin-reminder` (hourly at 9:00), `trial-expiry-check` (daily). Uses `detectSimulatedChanges()` guarded by `import.meta.env.DEV`.
- `src/entrypoints/options/` — Full-screen SPA with sidebar navigation. 7 pages in `pages/`: StrategyPage (single + batch mode), ConfigPage, DataCenterPage (health dashboard + policy timeline), SubscriptionPage, PlanPage, AccountPage, WelcomePage.

### Data flow

```
StrategyPage → useStrategyStore (searchParams)
            → compareAllRoutes() in strategy-engine.ts
            → results with appliedMeasures[] stored in Zustand store
            → persisted to chrome.storage.local

Batch mode:
StrategyPage → XLSX.parse → mapColumns() → runBatchCalculation()
            → BatchResult (rows + summary + risk levels)
            → exportBatchReport() → 5-sheet Chinese Excel
```

### State persistence

All Zustand stores use `persist` middleware with a custom `chrome.storage.local` adapter (`src/store/persist-adapter.ts`). Falls back to `localStorage` when `chrome.storage` unavailable (dev preview).

**Exception:** `settings-store.ts` (theme + locale) uses raw `localStorage` directly.

Storage keys: `tariff-strategy`, `tariff-user`, `tariff-config`, `tariff-checkin`, `tariff-subscriptions`, `tariff-settings`.

### Strategy engine (V2 — policy-correct)

Landed Cost formula (6-layer tariff stacking + risk indicators):
```
totalCost = goodsValue + customsDuty(MFN/FTA) + section301 + section232 + section122 + ieepaHistorical + MPF + HMF + shippingCost + insurance
```

Each calculation returns `appliedMeasures[]` — an array of `AppliedMeasure` objects with per-layer source URL, effective/expiry date, confidence, legal basis, and missing field indicators.

Key tariff layers:
- **MFN/FTA**: Standard duty from USITC HTS; FTA reduces via KORUS / US-Singapore FTA / USMCA
- **Section 301**: China-only, by HS4 prefix (Lists 1-4A + EV/Solar/Semi)
- **Section 232**: Global, steel/aluminum/autos at 25%
- **Section 122**: Temporary 10% surcharge (2026-02-24 to 2026-07-24), USMCA exempt, date-sensitive via `isSection122Active()`
- **IEEPA Historical**: Invalidated by SCOTUS 2026-02-20, only active for `entryDate` in 2025-04-09 to 2026-02-20 range
- **AD/CVD**: Risk indicator only — never auto-included in total cost. Shows missing fields (producer, order, cash deposit rate)
- **De Minimis**: Globally suspended since 2025-08-29 (CN/HK since 2025-05-02). Default `enabled: false`

### Key modules

| Module | Purpose |
|--------|---------|
| `src/lib/strategy-engine.ts` | V2 landed cost calculator with `appliedMeasures[]`, `compareAllRoutes()`, `generateAiSuggestion()` (includes disclaimer) |
| `src/lib/batch-engine.ts` | Batch calculation: `runBatchCalculation()` with auto field mapping (`mapColumns()`), risk classification (high/medium/low), origin ranking |
| `src/lib/mock-data.ts` | Real tariff data: 5 HS codes, 9 origins, Section 301/232/122 configs, IEEPA historical, De Minimis (globally suspended), `TariffMeasure` definitions |
| `src/lib/tariff-change-log.ts` | Policy change timeline (7 events 2024-2026), `DataSourceHealth[]` for 7 data sources |
| `src/lib/excel-utils.ts` | SheetJS: `downloadBatchTemplate()`, `exportBatchReport()` (5-sheet Chinese report), `exportTariffData()`, `importTariffData()` |
| `src/lib/hs-normalize.ts` | HS code normalization and dictionary search |
| `src/lib/credit-engine.ts` | Credit costs, check-in streak bonuses, plan tier multipliers, weekly quota checks |
| `src/types/index.ts` | All interfaces (~530 lines, unified camelCase). Key types: `TariffMeasure`, `AppliedMeasure`, `BatchResultRow`, `DataSourceHealth`, `TariffChangeEntry` |
| `src/store/tariff-dict-store.ts` | HS dictionary + data health status |
| `src/services/tariff-dict.ts` | API → chrome.storage cache → mock fallback for HS dictionary |
| `src/services/notification-service.ts` | Chrome notifications + DingTalk (HMAC-SHA256) / WeChat / webhook |
| `src/services/auth.ts` | Phone+SMS login, Supabase Auth priority, offline guest fallback |

### Style system

Dark/light dual-mode via Tailwind `darkMode: 'class'`. Default = light mode, `dark:` prefix = dark mode.

Key patterns:
- Cards: `border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 shadow-sm dark:shadow-none`
- Gradient sections: `from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20`
- Form inputs: `border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white`
- Font: `Inter, Noto Sans SC, system-ui`

### i18n

`zh.ts` defines the canonical shape (`export type TranslationKeys = typeof zh`). `en.ts` is typed against it — adding keys to `zh.ts` first is mandatory, or `en.ts` will get compile errors. Language saved to `localStorage` key `'locale'`.

## Constraints

- **Manifest V3**: Service worker has 5-minute timeout. Use `chrome.alarms` (not `setTimeout`) for recurring tasks.
- **Strict CSP**: `script-src 'self'; object-src 'self'` — no CDN scripts, no inline scripts.
- **Path aliases**: `@/*` → `src/*` (configured in tsconfig via WXT)
- **WXT auto-imports**: `defineBackground`, `defineContentScript` are auto-imported (no need to import explicitly)
- **Package manager**: pnpm only. `postinstall` is a no-op (`echo skip`).
- **camelCase**: All TypeScript interface properties use camelCase (not snake_case).
- **Offline-first**: All services fall back to local/mock when Supabase is unavailable. Priority: Supabase → API → chrome.storage cache → mock data.
- **Immutable data**: Use spread operator for state updates, never mutate existing objects.
- **UI component `Input`**: Hardcoded dark-mode colors — for forms needing light/dark support, use raw `<input>` with explicit `dark:` variants.

## Policy Data Accuracy

All tariff rates in `mock-data.ts` are based on real policy sources documented in `docs/竞品分析报告.md`. Key references:
- IEEPA invalidated: Learning Resources, Inc. v. Trump (SCOTUS 2026-02-20)
- Section 122: White House fact sheet 2026-02-20, effective 2026-02-24, 150 days
- De Minimis: CBP globally suspended 2025-08-29, CN/HK 2025-05-02
- Section 301/232: USTR/CBP official rates

Disclaimer required on all UI results: "不构成法律、税务或海关归类意见，实际成本请以海关核定为准"

## Tests

```bash
pnpm test                           # Run all 71 tests
npx vitest run src/lib/__tests__/strategy-engine.test.ts  # Strategy engine only (36 tests)
npx vitest run src/lib/hs-normalize.test.ts               # HS normalize (16 tests)
npx vitest run src/lib/credit-engine.test.ts              # Credit engine (19 tests)
```

Test files:
- `src/lib/__tests__/strategy-engine.test.ts` — Section 122, IEEPA historical, De Minimis, AD/CVD, multi-origin stacking, appliedMeasures, policy timeline switching (10+ HTS × origin × date combos)
- `src/lib/hs-normalize.test.ts` — HS code normalization and dictionary search
- `src/lib/credit-engine.test.ts` — Credit costs, check-in, weekly limits

## Backend Architecture

`backend/` contains a complete backend: Supabase self-hosted + Hono Worker + static payment page.

```
backend/
├── docker-compose.yml          # Supabase stack + worker + Redis + Nginx
├── supabase/migrations/        # 16 tables + RLS + RPC functions + seed data
├── worker/                     # Hono Worker (Node.js)
│   ├── src/routes/             # payment, collect, notify, admin
│   ├── src/services/
│   │   ├── payment/            # wechat.pay.ts, alipay.ts, fulfill.ts
│   │   ├── collect/            # wits, ushts, ustr, federal-register, yale-budget
│   │   └── notify/             # email, dingtalk, wechat, webhook (fan-out)
│   └── src/jobs/               # BullMQ queue + 7 cron jobs
└── pay-static/                 # Static payment pages (WeChat/Alipay QR)
```

Worker commands: `cd backend/worker && pnpm install && npx tsc --noEmit && pnpm build && node dist/app.js` (requires Supabase + Redis running).

Phase 0-6 done. Phase 7 (integration testing) pending deployment.

## Known Issues

- `.output/chrome-mv3/` directory gets locked on Windows by Chrome/node processes. Kill all chrome.exe and node.exe before `pnpm build`.
- WXT production build's `options.html` may contain `localhost:3000` dev server references if build runs while dev server is active. Always do a clean build.
