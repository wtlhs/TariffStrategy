/**
 * DataCenterPage — 数据中心 v2
 *
 * 数据健康看板 + 政策时间线 + 采集数据展示 + Excel 操作
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Database, Download, Upload, Clock, CheckCircle, AlertTriangle,
  Activity, Shield, TrendingUp, ChevronRight,
} from 'lucide-react'
import { SAMPLE_SECTION301, SAMPLE_MFN_RATES, SAMPLE_AD_CVD } from '@/lib/mock-data'
import { TARIFF_CHANGE_LOG, MOCK_DATA_HEALTH } from '@/lib/tariff-change-log'
import { useTariffDictStore } from '@/store/tariff-dict-store'
import { exportTariffData, importTariffData } from '@/lib/excel-utils'
import type { DataFreshness, TariffChangeEntry } from '@/types'

const TABS = [
  { key: 'health', label: '数据健康', icon: Activity },
  { key: 'timeline', label: '政策时间线', icon: TrendingUp },
  { key: 'section301', label: 'Section 301' },
  { key: 'mfn', label: 'MFN 税率' },
  { key: 'adcvd', label: 'AD/CVD' },
] as const

type TabKey = (typeof TABS)[number]['key']

const FRESHNESS_CONFIG: Record<DataFreshness, { color: string; bg: string; label: string }> = {
  fresh: { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/15', label: '正常' },
  stale: { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-500/15', label: '过期风险' },
  expired: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-500/15', label: '已过期' },
  unknown: { color: 'text-slate-500', bg: 'bg-slate-500/15', label: '未知' },
}

const DIRECTION_CONFIG: Record<TariffChangeEntry['changeDirection'], { color: string; bg: string; label: string }> = {
  increase: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', label: '↑ 上调' },
  decrease: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', label: '↓ 下调' },
  new: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', label: '新增' },
  expired: { color: 'text-slate-500', bg: 'bg-slate-500/10', label: '失效' },
  suspended: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', label: '暂停' },
}

export function DataCenterPage() {
  const { t } = useTranslation()
  const dictStore = useTariffDictStore()
  const [activeTab, setActiveTab] = useState<TabKey>('health')
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    dictStore.refreshHealth()
  }, [])

  const healthSummary = dictStore.getDataHealthSummary()

  const handleExport = () => {
    exportTariffData()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await importTariffData(file)
    setImportResult(`${result.sheets.join(', ')} — 共 ${result.rowCount} 行`)
    e.target.value = ''
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
            <Database size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">数据中心</h2>
            <p className="text-xs text-slate-400">数据健康看板 · 政策时间线 · Excel 操作</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Download size={13} /> {t('data.excelExport')}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Upload size={13} /> {t('data.excelImport')}
          </button>
          {importResult && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={12} /> {importResult}
            </span>
          )}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 p-1 w-fit flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary/20 text-primary-light'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {'icon' in tab && tab.icon && <tab.icon size={12} />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== 数据健康看板 ===== */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          {/* 概览指标 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-4">
              <p className="text-xs text-slate-400">数据源总数</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{healthSummary.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">正常</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{healthSummary.fresh}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10 p-4">
              <p className="text-xs text-amber-600 dark:text-amber-400">过期风险</p>
              <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">{healthSummary.stale}</p>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-50/50 dark:bg-red-900/10 p-4">
              <p className="text-xs text-red-600 dark:text-red-400">已过期</p>
              <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-300">{healthSummary.expired}</p>
            </div>
          </div>

          {/* 数据源详情 */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-blue-400" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">数据源状态</span>
              </div>
              <button
                onClick={() => dictStore.refreshHealth()}
                className="text-xs text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
              >
                刷新
              </button>
            </div>
            <div className="space-y-2">
              {MOCK_DATA_HEALTH.map((src) => {
                const cfg = FRESHNESS_CONFIG[src.freshness]
                return (
                  <div
                    key={src.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${
                          src.freshness === 'fresh' ? 'bg-emerald-500'
                          : src.freshness === 'stale' ? 'bg-amber-500'
                          : 'bg-red-500'
                        }`} />
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{src.name}</span>
                        <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">
                        <span>版本: {src.version}</span>
                        <span>记录: {src.recordCount.toLocaleString()}</span>
                        <span>同步: {new Date(src.lastSyncAt).toLocaleDateString('zh-CN')}</span>
                        <span>方式: {src.method}</span>
                      </div>
                    </div>
                    <a
                      href={src.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-3 text-xs text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-0.5 shrink-0"
                    >
                      来源 <ChevronRight size={10} />
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== 政策时间线 ===== */}
      {activeTab === 'timeline' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-blue-400" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">2025-2026 美国关税政策变更时间线</span>
          </div>
          <div className="relative pl-6">
            {/* 时间线竖线 */}
            <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />

            {TARIFF_CHANGE_LOG.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry) => {
              const dir = DIRECTION_CONFIG[entry.changeDirection]
              return (
                <div key={entry.id} className="relative mb-6 last:mb-0">
                  {/* 时间线节点 */}
                  <div className={`absolute -left-4 top-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                    entry.changeDirection === 'expired' ? 'bg-slate-400'
                    : entry.changeDirection === 'suspended' ? 'bg-amber-500'
                    : entry.changeDirection === 'new' ? 'bg-blue-500'
                    : entry.changeDirection === 'increase' ? 'bg-red-500'
                    : 'bg-emerald-500'
                  }`} />

                  <div className="rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-slate-400">{entry.date}</span>
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ${dir.bg} ${dir.color}`}>
                        {dir.label}
                      </span>
                      {entry.confidence === 'medium' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle size={10} /> 需确认
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1.5 text-sm font-medium text-slate-900 dark:text-white">{entry.title}</h4>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{entry.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
                      <span>税种: {entry.tariffType}</span>
                      <span>影响: {entry.affectedOrigins.join(', ')}</span>
                      {entry.changeAmount && <span>幅度: {entry.changeAmount}</span>}
                      <span>生效: {entry.effectiveDate}</span>
                      <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
                        来源: {entry.sourceAuthority}
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== Section 301 数据表 ===== */}
      {activeTab === 'section301' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-5">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">法律依据</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">国家</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">税率</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">覆盖产品</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">生效日期</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {SAMPLE_SECTION301.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 text-sm text-slate-800 dark:text-slate-200">{row.legalBasis}</td>
                    <td className="py-3 px-3 text-sm text-slate-600 dark:text-slate-300">{row.country}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${row.min >= 50 ? 'bg-red-500/15 text-red-600 dark:text-red-300' : row.min >= 25 ? 'bg-orange-500/15 text-orange-600 dark:text-orange-300' : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'}`}>{row.rateRange}</span>
                    </td>
                    <td className="py-3 px-3 text-sm text-slate-400">{row.products}</td>
                    <td className="py-3 px-3 text-sm text-slate-500">{row.effectiveDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MFN 税率表 ===== */}
      {activeTab === 'mfn' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-5">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">HS章</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">HS编码</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">描述</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">MFN税率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {SAMPLE_MFN_RATES.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 text-sm text-slate-400">{row.hsChapter}</td>
                    <td className="py-3 px-3 text-sm font-mono text-slate-800 dark:text-slate-200">{row.hsCode}</td>
                    <td className="py-3 px-3 text-sm text-slate-600 dark:text-slate-300">{row.description}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-sm font-medium ${row.rateNum === 0 ? 'text-emerald-600 dark:text-emerald-300' : row.rateNum > 0.1 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>{row.rate}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== AD/CVD 数据表 ===== */}
      {activeTab === 'adcvd' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 p-5">
          <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            ⚠ AD/CVD 税率依赖产品、原产国、生产商/出口商和复审结果，以下仅为样本数据。实际适用请以 CBP/Federal Register 为准。
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">HS编码</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">描述</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">目标国</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">税率范围</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {SAMPLE_AD_CVD.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 text-sm font-mono text-slate-800 dark:text-slate-200">{row.hsCode}</td>
                    <td className="py-3 px-3 text-sm text-slate-600 dark:text-slate-300">{row.description}</td>
                    <td className="py-3 px-3 text-sm text-slate-400">{row.target}</td>
                    <td className="py-3 px-3 text-center text-sm text-red-600 dark:text-red-300">{row.rate}</td>
                    <td className="py-3 px-3 text-center">
                      {row.active
                        ? <span className="inline-flex rounded-lg bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-300">生效中</span>
                        : <span className="inline-flex rounded-lg bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-400">已撤销</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
