/**
 * US HTS (USITC) 税率批量导入
 *
 * 数据源: https://hts.usitc.gov
 * 格式: CSV / JSON 批量下载
 * 频率: 每月全量更新
 * 数据量: ~17,000 HTS10 记录
 *
 * HTS 文件结构:
 *   HTS Number | Description | Unit of Measure | General Rate | Special Rate | Column 2 Rate
 *   8482.10.10 | Combined radial... | % | 9% | Free (A,AU,BH,CA,CL...) | 40%
 */
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { normalizeHS, normalizeRate } from './normalizer.js'

// USITC 批量下载 URL（年度快照）
const HTS_DOWNLOAD_URL = 'https://hts.usitc.gov/api/release_data?format=csv&hts_from=&hts_to=&chapter_from=&chapter_to=&heading_from=&heading_to=&subheading_from=&subheading_to=&suffix_from=&suffix_to=&start_date=&end_date=&version='

// 备用：固定文件 URL
const HTS_ARCHIVE_URL = 'https://www.usitc.gov/harmonized_tariff_information/hts-complete-database'

interface HTSRecord {
  htsNumber: string        // "8482.10.10.00"
  description: string
  unit: string
  generalRate: number      // MFN
  specialRate: number      // FTA / Special
  column2Rate: number      // 非最惠国
  chapter: string
  heading: string
}

/**
 * 下载并解析 HTS CSV
 */
async function fetchHTSData(): Promise<HTSRecord[]> {
  logger.info('Fetching US HTS data...')

  const response = await fetch(HTS_ARCHIVE_URL, {
    signal: AbortSignal.timeout(300000), // 5 分钟超时（文件较大）
  })

  if (!response.ok) {
    // 尝试 API 端点
    return fetchHTSFromApi()
  }

  const text = await response.text()
  return parseHTSCsv(text)
}

async function fetchHTSFromApi(): Promise<HTSRecord[]> {
  const response = await fetch(HTS_DOWNLOAD_URL, {
    signal: AbortSignal.timeout(300000),
  })

  if (!response.ok) {
    throw new Error(`HTS API returned ${response.status}`)
  }

  const text = await response.text()
  return parseHTSCsv(text)
}

/**
 * 解析 HTS CSV 文件
 */
function parseHTSCsv(csv: string): HTSRecord[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const records: HTSRecord[] = []

  // 查找列索引（HTS CSV 格式可能有变化）
  const htsIdx = header.findIndex(h => h.includes('hts') || h.includes('number') || h.includes('code'))
  const descIdx = header.findIndex(h => h.includes('description') || h.includes('desc'))
  const unitIdx = header.findIndex(h => h.includes('unit') || h.includes('measure'))
  const generalIdx = header.findIndex(h => h.includes('general') || h.includes('rate') || h.includes('duty'))
  const specialIdx = header.findIndex(h => h.includes('special'))
  const col2Idx = header.findIndex(h => h.includes('column 2') || h.includes('col2') || h.includes('column2'))

  if (htsIdx === -1) {
    logger.warn({ header: header.slice(0, 10) }, 'Cannot find HTS number column')
    return []
  }

  for (let i = 1; i < lines.length; i++) {
    // 简单 CSV 解析（不处理引号内逗号的复杂情况）
    const cols = splitCSVLine(lines[i])

    const htsNumber = cols[htsIdx]?.trim().replace(/"/g, '').replace(/\./g, '')
    if (!htsNumber || htsNumber.length < 6) continue

    // 跳过章/标题级条目（只有 2-4 位数字）
    if (htsNumber.length < 8) continue

    const hs6 = normalizeHS(htsNumber)
    if (hs6.length < 6) continue

    records.push({
      htsNumber: cols[htsIdx]?.trim() ?? '',
      description: descIdx >= 0 ? cols[descIdx]?.trim() ?? '' : '',
      unit: unitIdx >= 0 ? cols[unitIdx]?.trim() ?? '' : '',
      generalRate: generalIdx >= 0 ? normalizeRate(cols[generalIdx]) : 0,
      specialRate: specialIdx >= 0 ? normalizeRate(cols[specialIdx]) : 0,
      column2Rate: col2Idx >= 0 ? normalizeRate(cols[col2Idx]) : 0,
      chapter: htsNumber.substring(0, 2),
      heading: htsNumber.substring(0, 4),
    })
  }

  return records
}

/** 处理 CSV 中引号内的逗号 */
function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

/**
 * 主入口：导入 US HTS 数据
 */
export async function collectUSHTS(mode: 'full' | 'incremental'): Promise<number> {
  const records = await fetchHTSData()

  if (records.length === 0) {
    logger.warn('No HTS records fetched, aborting')
    return 0
  }

  logger.info({ count: records.length }, 'HTS records parsed')

  // 按 HS6 分组，创建 dict 条目和 sub_codes
  const hs6Groups = new Map<string, HTSRecord[]>()

  for (const record of records) {
    const hs6 = normalizeHS(record.htsNumber)
    if (!hs6Groups.has(hs6)) {
      hs6Groups.set(hs6, [])
    }
    hs6Groups.get(hs6)!.push(record)
  }

  let totalUpserted = 0
  const dictBatchSize = 50

  // 批量创建 dict 条目
  const dictEntries = Array.from(hs6Groups.entries()).map(([hs6, recs]) => ({
    country_code: 'US',
    hs6,
    name_en: recs[0]?.description || `HS ${hs6}`,
    keywords: [hs6],
  }))

  // 分批 upsert dict
  for (let i = 0; i < dictEntries.length; i += dictBatchSize) {
    const batch = dictEntries.slice(i, i + dictBatchSize)

    await supabase
      .from('tariff_dict')
      .upsert(batch, { onConflict: 'country_code,hs6', ignoreDuplicates: true })
  }

  // 查询所有 US dict 条目 ID
  const { data: dictRows } = await supabase
    .from('tariff_dict')
    .select('id, hs6')
    .eq('country_code', 'US')

  const dictIdMap = new Map(dictRows?.map(r => [r.hs6, r.id]) ?? [])

  // 批量 upsert sub_codes
  const subCodeBatchSize = 200
  const allSubCodes: any[] = []

  for (const [hs6, recs] of hs6Groups) {
    const dictId = dictIdMap.get(hs6)
    if (!dictId) continue

    for (const rec of recs) {
      allSubCodes.push({
        dict_id: dictId,
        code: rec.htsNumber.replace(/\./g, ''),
        description_en: rec.description,
        mfn_rate: rec.generalRate,
        unit: rec.unit || '%',
        special_rate: rec.specialRate > 0 ? rec.specialRate : null,
        source: 'hts',
      })
    }
  }

  for (let i = 0; i < allSubCodes.length; i += subCodeBatchSize) {
    const batch = allSubCodes.slice(i, i + subCodeBatchSize)

    const { error } = await supabase
      .from('tariff_sub_codes')
      .upsert(batch, { onConflict: 'dict_id,code', ignoreDuplicates: true })

    if (error) {
      logger.error({ batch: i, error: error.message }, 'HTS sub_codes upsert failed')
    } else {
      totalUpserted += batch.length
    }
  }

  logger.info({ total: totalUpserted }, 'US HTS import completed')
  return totalUpserted
}
