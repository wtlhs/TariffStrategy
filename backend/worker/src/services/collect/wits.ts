/**
 * WITS (World Bank) MFN 税率采集器
 *
 * 数据源: https://wits.worldbank.org
 * API: REST / SDMX V21 格式
 * 频率: 每周全量同步
 * 覆盖: 200+ 国家 MFN 税率 (HS6)
 */
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { normalizeHS, normalizeRate, toCountryCode } from './normalizer.js'

// 目标采集国（主要贸易伙伴的 MFN 税率）
const REPORTER_COUNTRIES = [
  'USA', 'CHN', 'DEU', 'KOR', 'JPN', 'GBR',
  'FRA', 'ITA', 'ESP', 'NLD', 'BEL', 'VNM',
  'THA', 'MYS', 'IND', 'SGP', 'AUS', 'BRA',
  'CAN', 'MEX', 'IND', 'PHL', 'IDN',
]

interface WITSRecord {
  reporterCode: string
  reporterName: string
  partnerCode: string
  productCode: string
  productName: string
  mfnRate: number
  year: number
}

/**
 * 获取某国某年 MFN 税率
 * WITS API 返回 SDMX JSON 格式
 */
async function fetchWITSData(
  reporterISO: string,
  year: number,
): Promise<WITSRecord[]> {
  // WITS REST API — 简化的 JSON 端点
  const url = `https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_MFN_TARIFF/${reporterISO}..${year}?format=json`

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(120000), // 2 分钟超时
  })

  if (!response.ok) {
    logger.warn({ reporter: reporterISO, status: response.status }, 'WITS fetch failed')
    return []
  }

  const text = await response.text()

  // WITS 可能返回空或非 JSON
  if (!text || text.trim().startsWith('<')) {
    logger.warn({ reporter: reporterISO }, 'WITS returned non-JSON, trying CSV endpoint')

    // 回退到 CSV 端点
    return fetchWITSCsv(reporterISO, year)
  }

  try {
    return parseSDMXJson(text, reporterISO, year)
  } catch {
    return fetchWITSCsv(reporterISO, year)
  }
}

/**
 * 回退：CSV 格式获取
 */
async function fetchWITSCsv(reporterISO: string, year: number): Promise<WITSRecord[]> {
  const url = `https://wits.worldbank.org/API/V1/SDMX/V21/rest/data/DF_WITS_MFN_TARIFF/${reporterISO}..${year}?format=csv`

  const response = await fetch(url, {
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) return []

  const csv = await response.text()
  return parseCSV(csv, reporterISO, year)
}

function parseCSV(csv: string, reporterISO: string, year: number): WITSRecord[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(',')
  const productIdx = header.findIndex(h => h.includes('ProductCode') || h.includes('productcode'))
  const rateIdx = header.findIndex(h => h.includes('MFN') || h.includes('rate') || h.includes('Rate'))

  if (productIdx === -1 || rateIdx === -1) return []

  const records: WITSRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const productCode = cols[productIdx]?.trim().replace(/"/g, '')
    const rate = cols[rateIdx]?.trim().replace(/"/g, '')

    if (!productCode || productCode.length < 4) continue

    const hs6 = normalizeHS(productCode)
    if (hs6.length < 6) continue

    records.push({
      reporterCode: reporterISO,
      reporterName: reporterISO,
      partnerCode: 'WLD',
      productCode: hs6,
      productName: '',
      mfnRate: normalizeRate(rate),
      year,
    })
  }

  return records
}

function parseSDMXJson(json: string, reporterISO: string, year: number): WITSRecord[] {
  const data = JSON.parse(json)
  const records: WITSRecord[] = []

  // SDMX 结构因版本而异，处理常见格式
  const series = data?.data?.dataSets?.[0]?.series ?? data?.structures?.[0]?.series ?? []

  for (const key of Object.keys(series)) {
    const obs = series[key]?.observations
    if (!obs) continue

    const parts = key.split(':')
    const productCode = parts.find(p => /^[0-9]{4,6}$/.test(p)) ?? ''

    if (!productCode) continue

    const hs6 = normalizeHS(productCode)
    if (hs6.length < 6) continue

    // 取第一个观测值作为当前税率
    const firstObs = Object.values(obs as Record<string, number[]>)[0]
    const rate = Array.isArray(firstObs) ? firstObs[0] : (typeof firstObs === 'number' ? firstObs : 0)

    records.push({
      reporterCode: reporterISO,
      reporterName: reporterISO,
      partnerCode: 'WLD',
      productCode: hs6,
      productName: '',
      mfnRate: normalizeRate(rate),
      year,
    })
  }

  return records
}

/**
 * 确保 tariff_dict 中存在该 HS6 条目
 */
async function ensureDictEntry(hs6: string, countryCode: string): Promise<string | null> {
  const { data } = await supabase
    .from('tariff_dict')
    .select('id')
    .eq('country_code', countryCode)
    .eq('hs6', hs6)
    .maybeSingle()

  if (data) return data.id

  const { data: created, error } = await supabase
    .from('tariff_dict')
    .insert({
      country_code: countryCode,
      hs6,
      name_en: `HS ${hs6}`,
      keywords: [hs6],
    })
    .select('id')
    .single()

  if (error) {
    logger.warn({ hs6, countryCode, error: error.message }, 'Failed to create dict entry')
    return null
  }

  return created.id
}

/**
 * 主入口：同步 WITS MFN 税率
 * 返回处理的记录数
 */
export async function collectWITS(mode: 'full' | 'incremental'): Promise<number> {
  const year = new Date().getFullYear()
  let totalUpserted = 0

  for (const reporterISO of REPORTER_COUNTRIES) {
    logger.info({ reporter: reporterISO, year, mode }, 'WITS sync starting')

    const records = await fetchWITSData(reporterISO, year)
    if (records.length === 0) {
      logger.warn({ reporter: reporterISO }, 'WITS: no records fetched')
      continue
    }

    // 批量 upsert
    const batchSize = 200
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)

      const upsertRows = []
      for (const record of batch) {
        const hs6 = normalizeHS(record.productCode)
        const countryCode = toCountryCode(record.reporterCode)

        const dictId = await ensureDictEntry(hs6, countryCode)
        if (!dictId) continue

        upsertRows.push({
          dict_id: dictId,
          code: hs6,
          description_en: record.productName || `HS ${hs6}`,
          mfn_rate: record.mfnRate,
          effective_date: `${year}-01-01`,
          source: 'wits',
        })
      }

      if (upsertRows.length === 0) continue

      const { error } = await supabase
        .from('tariff_sub_codes')
        .upsert(upsertRows, { onConflict: 'dict_id,code', ignoreDuplicates: true })

      if (error) {
        logger.error({ reporter: reporterISO, batch: i, error: error.message }, 'WITS upsert failed')
      } else {
        totalUpserted += upsertRows.length
      }
    }

    logger.info({ reporter: reporterISO, records: records.length }, 'WITS sync done')

    // 限速：每个国家间隔 2 秒
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  logger.info({ total: totalUpserted }, 'WITS full sync completed')
  return totalUpserted
}
