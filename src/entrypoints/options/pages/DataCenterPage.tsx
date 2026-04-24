/**
 * DataCenterPage — 数据中心（采集数据展示 + Excel 操作）
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, Download, Upload, Clock } from 'lucide-react'
import { SAMPLE_SECTION301, SAMPLE_MFN_RATES, SAMPLE_AD_CVD, DATA_SOURCES } from '@/lib/mock-data'

export function DataCenterPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'section301' | 'mfn' | 'adcvd'>('section301')

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header — 同策略分析页 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
            <Database size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">数据中心</h2>
            <p className="text-xs text-slate-400">采集的税率数据 + Excel 操作</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <Download size={13} /> {t('data.excelExport')}
          </button>
          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <Upload size={13} /> {t('data.excelImport')}
          </button>
        </div>
      </div>

      {/* Data source info */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">数据来源</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(DATA_SOURCES).map(([key, src]) => (
            <div key={key} className="rounded-lg bg-slate-100/50 dark:bg-slate-800/50 p-3">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{src.name}</p>
              <p className="text-[11px] text-slate-500 mt-1">更新: {src.lastUpdated}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab switch */}
      <div className="flex gap-1 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 p-1 w-fit">
        {([['section301', t('data.sampleSection301')], ['mfn', t('data.sampleMfn')], ['adcvd', t('data.sampleAdcvd')]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === key ? 'bg-primary/20 text-primary-light' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Data tables — overflow-x-auto for responsive */}
      {activeTab === 'section301' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5">
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

      {activeTab === 'mfn' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5">
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

      {activeTab === 'adcvd' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur shadow-sm dark:shadow-none p-5">
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
