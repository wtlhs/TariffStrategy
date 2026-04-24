# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (Manifest V3) for international trade tariff strategy comparison. Users compare shipping route costs across origins to find the optimal landed cost. Chinese-first product ("税率政策工具").

**Tech stack:** WXT + React 18 + TypeScript + TailwindCSS (dark/light dual-mode) + Zustand v5 + chrome.storage.local + i18next (zh/en)

**Source of truth:** `主计划.md` is the authoritative development document. It supersedes all other docs (架构与研发计划.md, 商业化与付费策略.md, etc.). Note: the master plan describes aspirational architecture; actual codebase may differ.

## Commands

```bash
pnpm dev              # Dev mode (Chrome), uses WXT with HMR
pnpm dev:firefox      # Dev mode (Firefox)
pnpm build            # Production build → .output/chrome-mv3/
pnpm compile          # TypeScript type-check (tsc --noEmit) — run after any .ts/.tsx change
pnpm test             # vitest run (configured but no test files exist yet)
pnpm test:watch       # vitest watch mode
```

Dev server port: `npx wxt --port 3200`. Production preview: `pnpm build && cd .output/chrome-mv3 && python -m http.server 3210` (note: virtual modules 404 in direct browser, use production build for testing).

## Architecture

### No popup — options page only

Clicking the extension icon opens the full-screen options page (not a popup). `background.ts` calls `chrome.runtime.openOptionsPage()` via `chrome.action.onClicked`. There is no popup entrypoint.

### Entrypoints

- `src/entrypoints/background.ts` — Service Worker with 3 alarms: `tariff-check` (6h), `checkin-reminder` (hourly at 9:00), `trial-expiry-check` (daily). Uses `detectSimulatedChanges()` for V1 demo.
- `src/entrypoints/options/` — Full-screen SPA with sidebar navigation. 7 pages: StrategyPage, ConfigPage, DataCenterPage, SubscriptionPage, PlanPage, AccountPage, WelcomePage. Sidebar is inline in `App.tsx` (not a separate component).

### Data flow

```
StrategyPage → useStrategyStore (searchParams)
            → compareAllRoutes() in strategy-engine.ts
            → results stored in Zustand store → persisted to chrome.storage.local
```

### State persistence

All Zustand stores use `persist` middleware with a custom `chrome.storage.local` adapter (`src/store/persist-adapter.ts`). This adapter implements Zustand v5's `PersistStorage` interface, falls back to `localStorage` when `chrome.storage` unavailable (dev preview).

**Exception:** `settings-store.ts` (theme + locale) uses raw `localStorage` directly, not chrome.storage.

Storage keys: `tariff-strategy`, `tariff-user`, `tariff-config`, `tariff-checkin`, `tariff-subscriptions`, `tariff-settings`.

### Strategy engine (V1 — offline)

Landed Cost formula (5-layer tariff stacking):
```
totalCost = goodsValue + customsDuty(MFN-FTA) + section301 + section232 + adCvd + reciprocalTariff + MPF + HMF + shippingCost + insurance
```

Key tariff layers in `mock-data.ts`:
- **MFN + FTA**: Standard duty, reduced by KORUS / US-Singapore FTA / USMCA where applicable
- **Section 301**: China-only, by HS4 prefix (Lists 1-4A + EV/Solar/Semi special rates)
- **Section 232**: Global, by HS4 prefix (steel/aluminum/auto parts at 25%)
- **Reciprocal tariffs (IEEPA)**: Currently 0% after SCOTUS Feb 2026 repeal, data structure preserved for future rates
- **De Minimis**: Per-country ($800 threshold); CN/HK revoked

### Key modules

| Module | Purpose |
|--------|---------|
| `src/lib/strategy-engine.ts` | Landed Cost calculator V1, `compareAllRoutes()`, `generateAiSuggestion()` |
| `src/lib/credit-engine.ts` | Credit costs per action, check-in streak bonuses, plan tier multipliers, quota checks |
| `src/lib/mock-data.ts` | Real tariff data (5 HS codes, 9 origins, Section 301/232 mappings, reciprocal tariffs, de minimis config, sample data) |
| `src/services/auth.ts` | Email+API Key auth + phone+SMS login, offline fallback creates guest user |
| `src/services/api-client.ts` | HTTP client pointed at `localhost:8000`, offline detection, no backend exists yet |
| `src/services/credits.ts` | Check-in, credit consumption, makeup, weekly usage tracking |
| `src/services/plans.ts` | 4 plan tiers (free/starter/pro/enterprise), `PLAN_DEFINITIONS` array, quota logic |
| `src/services/notification-service.ts` | Chrome notifications + DingTalk/WeChat/webhook channels |
| `src/types/index.ts` | All interfaces (~350 lines, unified camelCase) |

### Style system

Dark/light dual-mode via Tailwind `darkMode: 'class'`. Default styles = light mode, `dark:` prefix = dark mode. Toggled by `ThemeToggle` component setting class on `<html>`.

Key patterns:
- Cards (light/dark): `border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 shadow-sm dark:shadow-none`
- Gradient sections (light/dark): `from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20`
- Form inputs: `border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white`
- Font: `Inter, Noto Sans SC, system-ui`

Custom Tailwind theme in `tailwind.config.ts`: colors (`primary`, `credit`, etc.), shadows (`glow`, `glow-lg`), animations (`fade-in`, `slide-up`). Custom CSS classes in `assets/tailwind.css`: `dashboard-card`, `dashboard-table`, `glow-effect`.

### i18n

`zh.ts` defines the canonical shape (`export type TranslationKeys = typeof zh`). `en.ts` is typed against it — adding keys to `zh.ts` first is mandatory, or `en.ts` will get compile errors. Language saved to `localStorage` key `'locale'`.

## Constraints

- **Manifest V3**: Service worker has 5-minute timeout. Use `chrome.alarms` (not `setTimeout`) for recurring tasks.
- **Strict CSP**: `script-src 'self'; object-src 'self'` — no CDN scripts, no inline scripts.
- **Path aliases**: `@/*` → `src/*` (configured in tsconfig via WXT)
- **WXT auto-imports**: `defineBackground`, `defineContentScript` are auto-imported (no need to import explicitly)
- **Package manager**: pnpm only. `postinstall` is a no-op (`echo skip`).
- **camelCase**: All TypeScript interface properties use camelCase (not snake_case).
- **No backend**: All services fall back to local/mock when offline. `apiClient` points at `localhost:8000` which doesn't exist. Auth creates local guest users.
- **UI component `Input`**: Hardcoded dark-mode colors — for forms needing light/dark support, use raw `<input>` with explicit `dark:` variants (same pattern as AccountPage).
