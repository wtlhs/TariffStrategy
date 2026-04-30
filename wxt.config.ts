import { defineConfig } from 'wxt'
import react from '@vitejs/plugin-react'

const apiBaseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:8000'

export default defineConfig({
  vite: () => ({
    plugins: [react({ jsxRuntime: 'automatic' })],
  }),
  manifest: {
    name: '税率政策工具 — Tariff Policy Tool',
    version: '1.0.0',
    description: '国际贸易发货策略对比 — 对比关税运费，AI推荐最优发货路线',
    permissions: ['storage', 'alarms', 'notifications'],
    host_permissions: [`${apiBaseUrl}/*`],
    content_security_policy: {
      extension_pages: 'script-src \'self\'; object-src \'self\'',
    },
  },
  srcDir: 'src',
  outDir: '.output',
  // 不使用 popup，点击图标直接打开 options 全屏页
  entrypointsDir: 'entrypoints',
})
