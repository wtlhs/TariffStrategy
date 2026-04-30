/**
 * Federal Register AD/CVD 裁决采集器
 *
 * 数据源: https://www.federalregister.gov
 * API: https://www.federalregister.gov/api/v1/documents.json
 * 频率: 每日增量检测
 * 覆盖: 反倾销/反补贴新裁决和复审
 */
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { normalizeHS, makeDedupeKey } from './normalizer.js'

const FR_API_BASE = 'https://www.federalregister.gov/api/v1/documents.json'

interface FRDocument {
  document_number: string
  title: string
  publication_date: string
  abstract: string
  html_url: string
  type: string
  agencies: Array<{ name: string }>
}

/**
 * 查询 Federal Register 中的 AD/CVD 相关文档
 */
async function fetchADCVDDocuments(daysBack: number = 3): Promise<FRDocument[]> {
  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - daysBack)
  const fromDate = dateFrom.toISOString().split('T')[0]

  const url = new URL(FR_API_BASE)
  url.searchParams.set('conditions[term]', 'antidumping OR countervailing duty')
  url.searchParams.set('conditions[agencies][]', 'international-trade-commission')
  url.searchParams.set('conditions[publication_date][gte]', fromDate)
  url.searchParams.set('order', 'newest')
  url.searchParams.set('per_page', '20')

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'TariffPolicyTool/1.0' },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`Federal Register API returned ${response.status}`)
  }

  const data = await response.json() as { results: FRDocument[] }
  return data.results ?? []
}

/**
 * 从文档摘要中提取 HS 编码
 */
function extractHSCodes(text: string): string[] {
  const matches = text.matchAll(/(\d{4}\.\d{2}\.\d{2}[\.\d]*)/g)
  return Array.from(matches, m => m[1].replace(/\./g, '')).filter(code => code.length >= 8)
}

/**
 * 主入口：检测新增 AD/CVD 裁决
 */
export async function collectFederalRegister(mode: 'full' | 'incremental'): Promise<number> {
  const documents = await fetchADCVDDocuments()

  let totalChanges = 0

  for (const doc of documents) {
    // 去重检查
    const dedupeKey = makeDedupeKey('fedreg', doc.document_number)

    const { data: exists } = await supabase
      .from('tariff_change_log')
      .select('id')
      .contains('metadata', { dedupeKey })
      .maybeSingle()

    if (exists) continue

    // 提取 HS 编码
    const hsCodes = extractHSCodes(doc.abstract + ' ' + doc.title)

    if (hsCodes.length === 0) continue

    for (const hsCode of hsCodes) {
      const { error } = await supabase.from('tariff_change_log').insert({
        hs_code: hsCode,
        origin_country: null, // 从摘要中无法确定，需人工确认
        destination_country: 'US',
        change_type: 'adcvd_new',
        old_rate: null,
        new_rate: null,
        effective_date: doc.publication_date,
        source: 'federal-register',
        metadata: {
          dedupeKey: `${dedupeKey}:${hsCode}`,
          documentNumber: doc.document_number,
          title: doc.title,
          url: doc.html_url,
          abstract: doc.abstract.substring(0, 500),
        },
        pushed: false,
      })

      if (!error) totalChanges++
    }

    logger.info({ docNumber: doc.document_number, title: doc.title, hsCodes: hsCodes.length }, 'FR document processed')
  }

  logger.info({ total: totalChanges }, 'Federal Register check completed')
  return totalChanges
}
