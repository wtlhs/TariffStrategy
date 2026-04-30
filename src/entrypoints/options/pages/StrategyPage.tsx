import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calculator, TrendingUp, Package, Sparkles, RefreshCw,
  Check, Lightbulb, Bell, X, Info, HelpCircle, ChevronDown,
  Search, ChevronRight, Mail, MessageSquare, Upload, Download, FileSpreadsheet, AlertTriangle,
} from 'lucide-react'
import { useStrategyStore } from '@/store/strategy-store'
import { useTariffDictStore } from '@/store/tariff-dict-store'
import { compareAllRoutes, generateAiSuggestion, setActiveDict } from '@/lib/strategy-engine'
import { searchDict } from '@/lib/hs-normalize'
import { DEMO_HS_CODES, DEMO_ORIGINS } from '@/lib/mock-data'
import { DESTINATION_COUNTRIES } from '@/constants/countries'
import { mapColumns, runBatchCalculation } from '@/lib/batch-engine'
import type { BatchImportRow, BatchResult } from '@/lib/batch-engine'
import { downloadBatchTemplate, exportBatchReport } from '@/lib/excel-utils'
import * as XLSX from 'xlsx'

export function StrategyPage() {
  const { t } = useTranslation()
  const { searchParams, setSearchParams, results, setResults, aiSuggestion, setAiSuggestion, setComparing } = useStrategyStore()
  const dictStore = useTariffDictStore()
  const [loading, setLoading] = useState(false)
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [hsSearch, setHsSearch] = useState('')
  const [selectedSubCode, setSelectedSubCode] = useState<string | undefined>(undefined)
  const [expandedHs6, setExpandedHs6] = useState<string | null>(null)
  const [showHSInfo, setShowHSInfo] = useState(false)
  const [showSourcePanel, setShowSourcePanel] = useState(false)
  const [showModelInfo, setShowModelInfo] = useState(false)
  const [showQuickSubscribe, setShowQuickSubscribe] = useState(false)
  const [subscribeChannels, setSubscribeChannels] = useState<string[]>(['email'])
  const [subscribeEmail, setSubscribeEmail] = useState('')
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [animatedStats, setAnimatedStats] = useState({ bestCost: 0, savings: 0, taxRate: 0 })
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const batchFileRef = useRef<HTMLInputElement>(null)

  // 加载字典
  useEffect(() => {
    dictStore.loadDict(searchParams.destination).then(() => {
      const dict = dictStore.getDict(searchParams.destination)
      setActiveDict(dict)
    })
  }, [searchParams.destination])

  const dict = dictStore.getDict(searchParams.destination)
  const searchResults = hsSearch ? searchDict(hsSearch, dict) : dict.slice(0, 10)

  const handleCompare = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))
    const routes = compareAllRoutes(searchParams.hsCode, searchParams.goodsValue, searchParams.destination, selectedSubCode)
    setResults(routes)
    setAiSuggestion(generateAiSuggestion(routes))
    setLoading(false)
  }

  // 数字动画
  useEffect(() => {
    if (results.length === 0) return
    const best = results[0]
    const second = results[1]
    const duration = 800
    const steps = 25
    let step = 0
    const timer = setInterval(() => {
      step++
      const p = step / steps
      setAnimatedStats({
        bestCost: Math.round(best.totalCost * p),
        savings: Math.round((second?.savingsVsBest ?? 0) * p),
        taxRate: Math.round(best.effectiveRate * 100 * p * 10) / 10,
      })
      if (step >= steps) {
        clearInterval(timer)
        setAnimatedStats({
          bestCost: best.totalCost,
          savings: second?.savingsVsBest ?? 0,
          taxRate: Math.round(best.effectiveRate * 1000) / 10,
        })
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [results])

  const handleCopy = () => {
    if (results.length === 0) return
    const text = results
      .map((r, i) => `${i + 1}. ${r.originName}→${r.destinationName}  $${r.totalCost.toLocaleString()}  ${(r.effectiveRate * 100).toFixed(1)}%${r.isBest ? ' ★最优' : ` +$${r.savingsVsBest?.toLocaleString()}`}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleQuickSubscribe = async () => {
    setSubscribeLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setSubscribeLoading(false)
    setShowQuickSubscribe(false)
  }

  const handleBatchFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBatchFile(file)
    setBatchError(null)
    setBatchResult(null)
    e.target.value = ''
  }

  const handleBatchRun = async () => {
    if (!batchFile) return
    setBatchLoading(true)
    setBatchError(null)
    try {
      const buffer = await batchFile.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) throw new Error('Excel 文件为空')

      const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      if (rawData.length === 0) throw new Error('没有数据行')
      if (rawData.length > 100) throw new Error('最多支持 100 行数据')

      // 字段映射
      const headers = Object.keys(rawData[0])
      const mapping = mapColumns(headers)

      const rows: BatchImportRow[] = rawData.map((row) => {
        const mapped: Record<string, unknown> = { hsCode: '', origin: '', goodsValue: 0 }
        for (const [header, field] of Object.entries(mapping)) {
          if (field && row[header] !== undefined && row[header] !== null) {
            const val = row[header]
            if (field === 'goodsValue' || field === 'shippingCost') {
              mapped[field] = Number(val) || 0
            } else {
              mapped[field] = String(val)
            }
          }
        }
        return mapped as unknown as BatchImportRow
      })

      const result = runBatchCalculation(rows)
      setBatchResult(result)
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : '文件解析失败')
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* 模式切换 */}
      <div className="flex gap-1 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 p-1 w-fit">
        <button
          onClick={() => setMode('single')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'single' ? 'bg-primary/20 text-primary-light' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Calculator size={12} /> 单次测算
        </button>
        <button
          onClick={() => setMode('batch')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'batch' ? 'bg-primary/20 text-primary-light' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet size={12} /> 批量测算
        </button>
      </div>

      {/* ===== 批量测算模式 ===== */}
      {mode === 'batch' && (
        <section className="rounded-2xl border border-blue-200 dark:border-blue-300/20 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15">
              <FileSpreadsheet size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">批量测算</h2>
              <p className="text-xs text-slate-400">上传 Excel，批量计算多 SKU 到岸总成本</p>
            </div>
          </div>

          {/* 操作区 */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => downloadBatchTemplate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Download size={13} /> 下载导入模板
            </button>
            <input ref={batchFileRef} type="file" accept=".xlsx,.xls" onChange={handleBatchFile} className="hidden" />
            <button
              onClick={() => batchFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Upload size={13} /> 选择文件
            </button>
            {batchFile && (
              <span className="text-xs text-slate-500">
                已选: {batchFile.name}
              </span>
            )}
            <button
              onClick={handleBatchRun}
              disabled={!batchFile || batchLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {batchLoading ? (
                <><RefreshCw size={14} className="animate-spin" /> 计算中...</>
              ) : (
                <><Sparkles size={14} /> 开始批量测算</>
              )}
            </button>
            {batchResult && (
              <button
                onClick={() => exportBatchReport(batchResult)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                <Download size={13} /> 导出中文报告
              </button>
            )}
          </div>

          {/* 错误提示 */}
          {batchError && (
            <div className="mt-3 rounded-lg border border-red-300 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-xs text-red-700 dark:text-red-400">
              {batchError}
            </div>
          )}

          {/* 批量结果 */}
          {batchResult && (
            <div className="mt-4 space-y-4">
              {/* 汇总指标 */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 p-3">
                  <p className="text-[10px] uppercase text-slate-400">测算行数</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{batchResult.summary.successRows}</p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 p-3">
                  <p className="text-[10px] uppercase text-slate-400">总货值</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">${batchResult.summary.totalGoodsValue.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 p-3">
                  <p className="text-[10px] uppercase text-slate-400">总到岸成本</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">${batchResult.summary.totalLandedCost.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30 p-3">
                  <p className="text-[10px] uppercase text-slate-400">平均税率</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{(batchResult.summary.avgEffectiveRate * 100).toFixed(1)}%</p>
                </div>
                <div className="rounded-lg border border-amber-300 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                  <p className="text-[10px] uppercase text-amber-600 dark:text-amber-400">高/中风险</p>
                  <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">{batchResult.summary.highRiskRows}/{batchResult.summary.mediumRiskRows}</p>
                </div>
              </div>

              {/* 结果表格 */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="py-2 px-2 text-left font-medium text-slate-500">行</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-500">SKU</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-500">HS</th>
                      <th className="py-2 px-2 text-left font-medium text-slate-500">原产地</th>
                      <th className="py-2 px-2 text-right font-medium text-slate-500">货值</th>
                      <th className="py-2 px-2 text-right font-medium text-slate-500">到岸成本</th>
                      <th className="py-2 px-2 text-right font-medium text-slate-500">税率</th>
                      <th className="py-2 px-2 text-center font-medium text-slate-500">风险</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {batchResult.rows.map((r) => (
                      <tr key={r.rowIndex} className="hover:bg-slate-50 dark:hover:bg-white/5">
                        <td className="py-2 px-2 text-slate-400">{r.rowIndex}</td>
                        <td className="py-2 px-2 text-slate-900 dark:text-white font-medium">{r.sku}</td>
                        <td className="py-2 px-2 font-mono text-slate-600 dark:text-slate-300">{r.hsCode}</td>
                        <td className="py-2 px-2 text-slate-600 dark:text-slate-300">{r.originName}</td>
                        <td className="py-2 px-2 text-right text-slate-900 dark:text-white">${r.goodsValue.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right font-semibold text-slate-900 dark:text-white">${r.totalCost.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right">
                          <span className={r.effectiveRate > 0.5 ? 'text-red-600 dark:text-red-400' : r.effectiveRate > 0.3 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}>
                            {(r.effectiveRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {r.riskLevel === 'high' && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400" title={r.riskReasons.join('\n')}>
                              <AlertTriangle size={10} /> 高
                            </span>
                          )}
                          {r.riskLevel === 'medium' && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400" title={r.riskReasons.join('\n')}>
                              中
                            </span>
                          )}
                          {r.riskLevel === 'low' && (
                            <span className="text-emerald-600 dark:text-emerald-400">低</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 失败行提示 */}
              {batchResult.errors.length > 0 && (
                <div className="rounded-lg border border-red-300 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-2">
                    {batchResult.errors.length} 行测算失败：
                  </p>
                  {batchResult.errors.map((err) => (
                    <p key={err.rowIndex} className="text-xs text-red-600 dark:text-red-400">
                      第 {err.rowIndex} 行: {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ===== 单次测算模式 ===== */}
      {mode === 'single' && (
      <>
      {/* ===== 头部：搜索表单 ===== */}
      <section className="rounded-2xl border border-blue-200 dark:border-blue-300/20 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl p-4 md:p-6 shadow-sm overflow-visible">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
              <Calculator size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">策略对比</h2>
              <p className="text-xs text-slate-400">输入参数对比所有可选路线总成本</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHSInfo(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <HelpCircle size={13} /> HS编码说明
            </button>
            <button
              onClick={() => setShowModelInfo(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Info size={13} /> 模型说明
            </button>
          </div>
        </div>

        {/* 检索条件 */}
        <div className="flex flex-wrap items-end gap-3 md:gap-3">
          {/* HS编码 */}
          <div className="flex-1 min-w-[180px] max-w-[260px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">HS编码</label>
            <div className="relative">
              <Package size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchParams.hsCode}
                onChange={(e) => setSearchParams({ hsCode: e.target.value })}
                onFocus={() => setShowProductPicker(true)}
                className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 pl-8 pr-14 text-sm text-slate-900 dark:text-white outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {searchParams.hsCode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSearchParams({ hsCode: '8482.10', goodsValue: 50000 }) }}
                    className="p-0.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    <X size={14} />
                  </button>
                )}
                <button onClick={() => setShowProductPicker(!showProductPicker)} className="p-0.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* HS 编码字典搜索下拉 */}
              {showProductPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setShowProductPicker(false); setExpandedHs6(null) }} />
                  <div className="fixed left-4 top-20 z-50 w-[320px] max-h-80 overflow-y-auto rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                    {/* 搜索框 */}
                    <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-2.5 py-2">
                      <div className="relative">
                        <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={hsSearch}
                          onChange={(e) => setHsSearch(e.target.value)}
                          placeholder={t('hs.search')}
                          className="h-8 w-full rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 pl-7 pr-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-400"
                          autoFocus
                        />
                      </div>
                    </div>

                    {searchResults.length === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-slate-400">{t('hs.noMatch')}</div>
                    )}

                    {searchResults.map((entry) => (
                      <div key={entry.hs6}>
                        {/* HS6 分组标题 */}
                        <button
                          onClick={() => setExpandedHs6(expandedHs6 === entry.hs6 ? null : entry.hs6)}
                          className="w-full px-2.5 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                          <ChevronRight size={12} className={`text-slate-400 transition-transform ${expandedHs6 === entry.hs6 ? 'rotate-90' : ''}`} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-slate-900 dark:text-white">{entry.hs6.slice(0, 4)}.{entry.hs6.slice(4)}</div>
                            <div className="text-xs text-slate-400 truncate">{entry.nameZh} · {entry.nameEn}</div>
                          </div>
                          <span className="text-xs text-slate-400">{entry.subCodes.length}项</span>
                        </button>

                        {/* 子分类列表 */}
                        {expandedHs6 === entry.hs6 && (
                          <div className="bg-slate-50 dark:bg-slate-700/30 border-t border-b border-slate-200 dark:border-slate-600">
                            <div className="px-3 py-1 text-xs text-slate-400">{t('hs.subCodeHint')}</div>
                            {entry.subCodes.map((sub) => (
                              <button
                                key={sub.code}
                                onClick={() => {
                                  setSearchParams({ hsCode: sub.code, goodsValue: searchParams.goodsValue })
                                  setSelectedSubCode(sub.code)
                                  setShowProductPicker(false)
                                  setExpandedHs6(null)
                                }}
                                className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-600/50 transition-colors border-t border-slate-200/50 dark:border-slate-600/50 ${
                                  selectedSubCode === sub.code ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium text-slate-900 dark:text-white">{sub.code}</span>
                                  <span className="text-slate-400">MFN {(sub.mfnRate * 100).toFixed(1)}%</span>
                                  {sub.section301 && <span className="text-red-500">S301 {(sub.section301.rate * 100).toFixed(0)}%</span>}
                                </div>
                                <div className="mt-0.5 text-slate-500 dark:text-slate-400">{sub.descriptionZh}</div>
                                <div className="text-slate-400 text-[10px]">{sub.descriptionEn}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* 预设产品快捷入口 */}
                    {hsSearch === '' && (
                      <div className="border-t border-slate-200 dark:border-slate-700">
                        <div className="px-2.5 py-1.5 text-xs text-slate-500">预设产品</div>
                        {DEMO_HS_CODES.map((h) => (
                          <button
                            key={h.hsCode}
                            onClick={() => { setSearchParams({ hsCode: h.hsCode, goodsValue: h.defaultValue }); setSelectedSubCode(undefined); setShowProductPicker(false) }}
                            className="w-full px-2.5 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                          >
                            <div className="font-medium text-slate-900 dark:text-white">{h.hsCode}</div>
                            <div className="text-xs text-slate-400">{h.name} · ${h.defaultValue.toLocaleString()}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 发出地 */}
          <div className="w-[150px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">发出地</label>
            <select
              value={searchParams.origin}
              onChange={(e) => setSearchParams({ origin: e.target.value })}
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
            >
              {DEMO_ORIGINS.map((o) => (
                <option key={o.code} value={o.code}>{o.code} {o.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end pb-2 text-slate-500">→</div>

          {/* 目的地 */}
          <div className="w-[150px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">目的地</label>
            <select
              value={searchParams.destination}
              onChange={(e) => setSearchParams({ destination: e.target.value })}
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
            >
              {DESTINATION_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>

          {/* 货值 */}
          <div className="w-[140px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">货值</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
              <input
                type="number"
                value={searchParams.goodsValue}
                onChange={(e) => setSearchParams({ goodsValue: Number(e.target.value) })}
                className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 pl-6 pr-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
              />
            </div>
          </div>

          {/* 对比按钮 */}
          <div className="flex items-end">
            <button
              onClick={handleCompare}
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <><RefreshCw size={14} className="animate-spin" /> 计算中...</>
              ) : (
                <><Sparkles size={14} /> 开始对比</>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ===== 结果区 ===== */}
      {results.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI 指标卡片 */}
          <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 shadow-sm dark:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">最优路线</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{results[0].originName}→{results[0].destinationName}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 shadow-sm dark:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">到岸总成本</p>
              <p className="mt-2 text-lg font-semibold text-emerald-700 dark:text-emerald-200">${animatedStats.bestCost.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 shadow-sm dark:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">相比次优节省</p>
              <p className="mt-2 text-lg font-semibold text-blue-700 dark:text-blue-300">${animatedStats.savings.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 shadow-sm dark:shadow-none">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">综合税率</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{animatedStats.taxRate}%</p>
            </div>
          </section>

          {/* 快速订阅横幅 */}
          <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                  <Bell size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">订阅税率变化</p>
                  <p className="text-xs text-slate-400">当 {searchParams.origin}→{searchParams.destination} 税率变化时通知您</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickSubscribe(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
              >
                <Bell size={14} /> 快速订阅
              </button>
            </div>
          </section>

          {/* 最优方案详情 + AI 建议 */}
          {results[0] && (
            <section className="rounded-2xl border border-blue-200 dark:border-blue-300/20 bg-gradient-to-br from-white/95 to-slate-50/80 dark:from-slate-900/95 dark:to-slate-800/80 backdrop-blur p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                <Check size={18} className="text-emerald-600 dark:text-emerald-300" />
                最优方案详情
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">路线</p>
                    <p className="mt-1 font-medium text-slate-900 dark:text-white">{results[0].originName}→{results[0].destinationName}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">关税</p>
                    <p className="mt-1 font-medium text-slate-900 dark:text-white">${results[0].customsDuty.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">运费</p>
                    <p className="mt-1 font-medium text-slate-900 dark:text-white">${results[0].shippingCost.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">到岸总成本</p>
                    <p className="mt-1 font-medium text-emerald-700 dark:text-emerald-200">${results[0].totalCost.toLocaleString()}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 p-4 border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={18} className="text-amber-400" />
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">AI 建议</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">{aiSuggestion}</p>
                </div>
              </div>

              {/* 数据来源与置信度面板 */}
              {results[0].appliedMeasures.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowSourcePanel(!showSourcePanel)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    <Info size={13} />
                    <span>{showSourcePanel ? '收起' : '展开'}数据来源与置信度</span>
                    <ChevronDown size={12} className={`transition-transform ${showSourcePanel ? 'rotate-180' : ''}`} />
                  </button>
                  {showSourcePanel && (
                    <div className="mt-3 space-y-2">
                      {results[0].appliedMeasures.map((m, i) => (
                        <div
                          key={`${m.type}-${i}`}
                          className="rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/30 px-3 py-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block h-2 w-2 rounded-full ${
                                m.applied ? 'bg-emerald-500' : m.confidence === 'low' ? 'bg-amber-500' : 'bg-slate-400'
                              }`} />
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{m.label}</span>
                              {m.applied && (
                                <span className="text-xs text-slate-500">
                                  {(m.rate * 100).toFixed(1)}% · ${m.amount.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${
                              m.confidence === 'high' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : m.confidence === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {m.confidence}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {m.reason}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-400">
                            <span>来源: {m.sourceUrl.replace('https://', '')}</span>
                            {m.effectiveDate && <span>生效: {m.effectiveDate}</span>}
                            {m.expiryDate && <span>到期: {m.expiryDate}</span>}
                            <span>采集: {m.dataFetchedAt}</span>
                          </div>
                          {m.missingFields && m.missingFields.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {m.missingFields.map((f) => (
                                <span key={f} className="inline-flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-900/20 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">
                                  ⚠ {f}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 全部路线对比表格 */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                <TrendingUp size={18} className="text-blue-400" />
                全部路线对比
              </h3>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                {copied ? '✓ 已复制' : '复制结果'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">路线</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">MFN</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">S301</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">S232</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">S122</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">FTA</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">运费</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">到岸总成本</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">税率</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">天数</th>
                    <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">对比</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {results.map((r) => (
                    <tr
                      key={r.routing}
                      className={`transition-colors ${r.isBest ? 'bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {r.isBest && <Check size={14} className="text-emerald-400" />}
                          <span className={`font-medium ${r.isBest ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                            {r.originName}→{r.destinationName}
                          </span>
                          {r.adCvdRisk && (
                            <span title={r.adCvdRisk} className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 cursor-help">
                              AD/CVD
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">{(r.mfnRate * 100).toFixed(1)}%</td>
                      <td className="py-3 px-3 text-right">
                        {r.section301Rate > 0
                          ? <span className="text-red-600 dark:text-red-400">{(r.section301Rate * 100).toFixed(0)}%</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.section232Rate > 0
                          ? <span className="text-orange-600 dark:text-orange-400">{(r.section232Rate * 100).toFixed(0)}%</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.section122Rate > 0
                          ? <span className="text-amber-600 dark:text-amber-400">{(r.section122Rate * 100).toFixed(0)}%</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.ftaApplied
                          ? <span className="text-blue-700 dark:text-blue-300">{r.ftaName}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">${r.shippingCost.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-white">${r.totalCost.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={r.effectiveRate === 0 ? 'text-emerald-700 dark:text-emerald-300' : r.effectiveRate > 0.2 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}>
                          {(r.effectiveRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">{r.shippingDays}天</td>
                      <td className="py-3 px-3 text-right">
                        {r.isBest
                          ? <span className="inline-flex rounded-lg border px-2.5 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30">最优</span>
                          : <span className="inline-flex rounded-lg border px-2.5 py-1 text-sm font-medium text-red-700 dark:text-red-200 bg-red-500/10 border-red-500/30">+${r.savingsVsBest?.toLocaleString()}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 免责声明 */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            <p>⚠ 以上结果基于当前数据和假设生成，不构成法律、税务或海关归类意见。AD/CVD 仅作风险提示，不计入确定总成本。Section 122 为临时附加税（有效期至 2026-07-24），实际税率请以海关核定为准。</p>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Calculator size={48} className="mb-4 opacity-30" />
          <p className="text-base mb-1">选择产品参数后点击「开始对比」</p>
          <p className="text-sm">对比所有可选发货路线的到岸总成本，展示税种拆解和风险提示</p>
        </div>
      )}

      {/* ===== 弹窗：HS编码说明 ===== */}
      {showHSInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">HS编码说明</h3>
              <button onClick={() => setShowHSInfo(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={20} /></button>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
{`HS编码（协调制度编码）是国际贸易商品的统一分类代码：

• 前2位：章号（如84=机械）
• 前4位：品目（如8412=其他发动机）
• 前6位：子目（国际统一）
• 后续位：各国细分

示例：
8482.10 = 滚珠轴承
8501.10 = 电动机
6110.20 = 棉制针织衫

输入建议：4-6位可查询到基础税率`}
            </div>
          </div>
        </div>
      )}

      {/* ===== 弹窗：比较模型说明 ===== */}
      {showModelInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">比较模型说明</h3>
              <button onClick={() => setShowModelInfo(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={20} /></button>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
{`## Landed Cost 到岸总成本公式

到岸总成本 = 货值 + MFN关税 + Section 301 + Section 232 + Section 122 + MPF + HMF + 运费 + 保险

### 税费构成
1. MFN/FTA 关税 — 基础进口关税，FTA 国家可减免
2. Section 301 — 对华惩罚性关税（仅中国原产）
3. Section 232 — 钢铝/汽车全球关税（25%）
4. Section 122 — 临时进口附加税（10%，USMCA 豁免，有效期至 2026-07-24）
5. IEEPA 历史关税 — 已于 2026-02-20 被 SCOTUS 推翻，不再生效
6. AD/CVD — 仅作风险提示，不自动计入确定总成本
7. MPF — 商品处理费 0.3464%（最低 $31.67，最高 $614.35）
8. HMF — 港口维护费 0.125%（仅海运）
9. 保险 — CIF 价值的 0.5%

### De Minimis 豁免
美国 de minimis 已于 2025-08-29 全球暂停，CN/HK 于 2025-05-02 先行暂停。
当前所有进口不再默认享受 $800 以下免税。

### 数据来源
• 美国 USITC HTS 税率表
• USTR Section 301 数据
• White House Section 122 Fact Sheet (2026-02-20)
• CBP de minimis 执行公告
• Drewry WCI 运费指数

### 免责声明
以上结果基于当前数据和假设生成，不构成法律、税务或海关归类意见。
实际税率请以海关核定为准。`}
            </div>
          </div>
        </div>
      )}

      {/* ===== 弹窗：快速订阅 ===== */}
      {showQuickSubscribe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">快速订阅</h3>
              <button onClick={() => setShowQuickSubscribe(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-100 dark:bg-slate-700 p-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">路线: <span className="font-medium text-slate-900 dark:text-white">{searchParams.origin} → {searchParams.destination}</span></p>
                <p className="text-sm text-slate-600 dark:text-slate-300">HS编码: <span className="font-medium text-slate-900 dark:text-white">{searchParams.hsCode}</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">通知渠道</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSubscribeChannels(subscribeChannels.includes('email') ? subscribeChannels.filter((c) => c !== 'email') : [...subscribeChannels, 'email'])}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
                      subscribeChannels.includes('email')
                        ? 'border-blue-400 bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Mail size={14} /> 邮件
                  </button>
                  <button
                    onClick={() => setSubscribeChannels(subscribeChannels.includes('dingtalk') ? subscribeChannels.filter((c) => c !== 'dingtalk') : [...subscribeChannels, 'dingtalk'])}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
                      subscribeChannels.includes('dingtalk')
                        ? 'border-blue-400 bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <MessageSquare size={14} /> 钉钉
                  </button>
                </div>
              </div>
              {subscribeChannels.includes('email') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={subscribeEmail}
                    onChange={(e) => setSubscribeEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-400"
                  />
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowQuickSubscribe(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600">
                取消
              </button>
              <button onClick={handleQuickSubscribe} disabled={subscribeLoading || subscribeChannels.length === 0} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                {subscribeLoading ? '创建中...' : '创建订阅'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
