/**
 * Yale Budget Lab Section 301 变化追踪
 *
 * 数据源: https://github.com/budgetlab
 * 方式: 下载 CSV/JSON 快照
 * 频率: 每日增量检测
 *
 * Yale Budget Lab 提供公开的关税变化追踪数据
 * 包含 Section 301 各清单的最新税率变化
 */
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { normalizeHS, normalizeRate, makeDedupeKey } from './normalizer.js'

// Yale Budget Lab 公开数据 URL（示例，实际 URL 需确认）
const YALE_DATA_URLS = [
  'https://raw.githubusercontent.com/budgetlab/taff/main/data/tariff_data.csv',
]

interface YaleRecord {
  hsCode: string
  listNumber: string
  currentRate: number
  previousRate: number
  effectiveDate: string
}

/**
 * 获取 Yale Budget Lab 数据
 */
async function fetchYaleData(): Promise<YaleRecord[]> {
  for (const url of YALE_DATA_URLS) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(60000),
      })

      if (!response.ok) continue

      const csv = await response.text()
      return parseYaleCSV(csv)
    } catch {
      continue
    }
  }

  logger.warn('Could not fetch Yale Budget Lab data from any source')
  return []
}

function parseYaleCSV(csv: string): YaleRecord[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  const hsIdx = header.findIndex(h => h.includes('hts') || h.includes('hs') || h.includes('code'))
  const rateIdx = header.findIndex(h => h.includes('current') || h.includes('rate'))
  const listIdx = header.findIndex(h => h.includes('list') || h.includes('action'))
  const dateIdx = header.findIndex(h => h.includes('date') || h.includes('effective'))

  if (hsIdx === -1) return []

  const records: YaleRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const hsCode = cols[hsIdx]?.trim().replace(/"/g, '')
    if (!hsCode || hsCode.length < 6) continue

    records.push({
      hsCode: normalizeHS(hsCode),
      listNumber: listIdx >= 0 ? cols[listIdx]?.trim() ?? '' : '',
      currentRate: rateIdx >= 0 ? normalizeRate(cols[rateIdx]) : 0,
      previousRate: 0,
      effectiveDate: dateIdx >= 0 ? cols[dateIdx]?.trim() ?? '' : new Date().toISOString().split('T')[0],
    })
  }

  return records
}

/**
 * 主入口：对比 Yale 数据与现有数据库，检测变化
 */
export async function collectYaleBudget(mode: 'full' | 'incremental'): Promise<number> {
  const yaleRecords = await fetchYaleData()

  if (yaleRecords.length === 0) return 0

  let totalChanges = 0

  for (const record of yaleRecords) {
    // 查询数据库中当前税率
    const { data: existing } = await supabase
      .from('section_301_rates')
      .select('rate')
      .eq('hs_code', record.hsCode)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentDbRate = existing?.rate ?? 0

    // 检测变化
    if (Math.abs(record.currentRate - currentDbRate) > 0.001) {
      const dedupeKey = makeDedupeKey('yale', record.hsCode, record.effectiveDate)

      const { data: alreadyLogged } = await supabase
        .from('tariff_change_log')
        .select('id')
        .contains('metadata', { dedupeKey })
        .maybeSingle()

      if (alreadyLogged) continue

      const { error } = await supabase.from('tariff_change_log').insert({
        hs_code: record.hsCode,
        origin_country: 'CN',
        destination_country: 'US',
        change_type: `s301_${record.listNumber.toLowerCase().replace(/\s+/g, '_')}`,
        old_rate: currentDbRate,
        new_rate: record.currentRate,
        change_percent: currentDbRate > 0
          ? Math.round(((record.currentRate - currentDbRate) / currentDbRate) * 10000) / 100
          : null,
        effective_date: record.effectiveDate,
        source: 'yale-budget-lab',
        metadata: { dedupeKey, listNumber: record.listNumber },
        pushed: false,
      })

      if (!error) totalChanges++

      // 同时更新 section_301_rates
      await supabase.from('section_301_rates').upsert({
        hs_code: record.hsCode,
        list_number: record.listNumber,
        rate: record.currentRate,
        origin_country: 'CN',
        effective_date: record.effectiveDate,
        source: 'yale-budget-lab',
      }, { onConflict: undefined, ignoreDuplicates: true })
    }
  }

  logger.info({ total: totalChanges }, 'Yale Budget Lab check completed')
  return totalChanges
}
