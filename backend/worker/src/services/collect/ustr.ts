/**
 * USTR Section 301 变化检测
 *
 * 数据源: https://ustr.gov/issue-areas/enforcement/section-301-investigations
 * 频率: 每日增量检测
 * 方式: 网页爬取 + 对比已知变更
 *
 * Section 301 清单结构:
 * - List 1 (34B): ~818 HTS codes, 25%
 * - List 2 (16B): ~284 HTS codes, 25%
 * - List 3 (200B): ~5,745 HTS codes, 25% (2024.09 → 部分上调至 100%)
 * - List 4A (300B): 2025.02 新增，部分提至 20%
 * - EV专项: 电动汽车 100%, 太阳能电池 50%, 半导体 50%
 */
import * as cheerio from 'cheerio'
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { normalizeHS, normalizeRate, makeDedupeKey } from './normalizer.js'

const USTR_BASE_URL = 'https://ustr.gov'

interface USTRAnnouncement {
  title: string
  url: string
  date: string
}

interface TariffChange {
  hsCode: string
  changeType: string
  oldRate: number
  newRate: number
  effectiveDate: string
  listNumber: string
}

/**
 * 爬取 USTR Section 301 公告页面
 */
async function fetchUSTRAnnouncements(): Promise<USTRAnnouncement[]> {
  const url = `${USTR_BASE_URL}/issue-areas/enforcement/section-301-investigations`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TariffPolicyTool/1.0 (data collection; contact@example.com)',
    },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`USTR returned ${response.status}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const announcements: USTRAnnouncement[] = []

  // USTR 网站结构可能有变化，尝试多种选择器
  const selectors = [
    '.view-content .views-row',
    '.views-row',
    '.announcement-list .item',
    '.content-list li',
    'article.node',
  ]

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const link = $(el).find('a').first()
      const title = link.text().trim()
      const href = link.attr('href')
      const dateEl = $(el).find('.date-display-single, .date, time, .field-name-field-date').first()
      const date = dateEl.text().trim() || $(el).find('[datetime]').attr('datetime') || ''

      if (title && href && (title.toLowerCase().includes('301') || title.toLowerCase().includes('tariff'))) {
        announcements.push({
          title,
          url: href.startsWith('http') ? href : `${USTR_BASE_URL}${href}`,
          date,
        })
      }
    })

    if (announcements.length > 0) break
  }

  return announcements
}

/**
 * 检查公告是否已在 tariff_change_log 中
 */
async function isAnnouncementProcessed(url: string): Promise<boolean> {
  const { data } = await supabase
    .from('tariff_change_log')
    .select('id')
    .eq('source', 'ustr')
    .contains('metadata', { url })
    .maybeSingle()

  return !!data
}

/**
 * 解析公告详情页，提取税率变更信息
 * 实际公告格式多样，这里处理常见的表格和文本格式
 */
async function parseAnnouncementDetail(url: string): Promise<TariffChange[]> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TariffPolicyTool/1.0' },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) return []

  const html = await response.text()
  const $ = cheerio.load(html)
  const changes: TariffChange[] = []

  // 查找包含 HTS 编码的表格
  $('table').each((_, table) => {
    const rows = $(table).find('tr')
    const headerText = $(table).find('th, thead td').text().toLowerCase()

    // 确认是 HTS 相关表格
    if (!headerText.includes('hts') && !headerText.includes('tariff') && !headerText.includes('rate')) return

    let listNumber = ''
    // 从上下文推断 List 编号
    const contextText = $(table).prev('h2,h3,h4,p').text()
    if (contextText.includes('List 1') || contextText.includes('List 4A')) listNumber = 'List 1'
    else if (contextText.includes('List 2')) listNumber = 'List 2'
    else if (contextText.includes('List 3')) listNumber = 'List 3'
    else if (contextText.includes('List 4A')) listNumber = 'List 4A'

    rows.each((rowIdx, row) => {
      if (rowIdx === 0) return // 跳过表头
      const cols = $(row).find('td')
      if (cols.length < 2) return

      const firstCol = $(cols[0]).text().trim()
      const rateCol = cols.length >= 3 ? $(cols[cols.length - 1]).text().trim() : $(cols[1]).text().trim()

      // 检查是否包含 HTS 编码
      const hsMatch = firstCol.match(/(\d{4}[\.\s]?\d{2}[\.\s]?\d{2}[\.\s]?\d{0,2})/)
      if (!hsMatch) return

      const hsCode = hsMatch[1].replace(/[\.\s]/g, '')
      const newRate = normalizeRate(rateCol)

      if (hsCode.length >= 6) {
        changes.push({
          hsCode: hsCode.substring(0, 10),
          changeType: listNumber ? `s301_${listNumber.toLowerCase().replace(' ', '')}` : 's301_update',
          oldRate: 0, // 增量检测时无法知道旧税率
          newRate,
          effectiveDate: new Date().toISOString().split('T')[0],
          listNumber,
        })
      }
    })
  })

  // 如果没有找到表格，检查文本中的 HTS 编码
  if (changes.length === 0) {
    const bodyText = $('.field-item, .content, article').text()
    const hsMatches = bodyText.matchAll(/(\d{4}\.\d{2}\.\d{2}[\.\d]*)/g)

    for (const match of hsMatches) {
      const hsCode = match[1].replace(/\./g, '')
      if (hsCode.length >= 8) {
        changes.push({
          hsCode,
          changeType: 's301_update',
          oldRate: 0,
          newRate: 0,
          effectiveDate: new Date().toISOString().split('T')[0],
          listNumber: '',
        })
      }
    }
  }

  return changes
}

/**
 * 主入口：检测 Section 301 变化
 */
export async function collectUSTR(mode: 'incremental' | 'full'): Promise<number> {
  if (mode === 'full') {
    // 全量模式：重新导入所有已知 Section 301 税率
    return importKnownSection301Rates()
  }

  // 增量模式：检测新公告
  const announcements = await fetchUSTRAnnouncements()

  let totalChanges = 0

  for (const item of announcements) {
    // 去重
    const processed = await isAnnouncementProcessed(item.url)
    if (processed) continue

    logger.info({ title: item.title, url: item.url }, 'New USTR announcement found')

    // 解析详情
    const changes = await parseAnnouncementDetail(item.url)

    for (const change of changes) {
      const dedupeKey = makeDedupeKey('ustr', item.url, change.hsCode)

      const { error } = await supabase.from('tariff_change_log').insert({
        hs_code: change.hsCode,
        origin_country: 'CN',
        destination_country: 'US',
        change_type: change.changeType,
        old_rate: change.oldRate,
        new_rate: change.newRate,
        change_percent: change.oldRate > 0
          ? Math.round(((change.newRate - change.oldRate) / change.oldRate) * 10000) / 100
          : null,
        effective_date: change.effectiveDate,
        source: 'ustr',
        metadata: {
          url: item.url,
          title: item.title,
          publishedAt: item.date,
          listNumber: change.listNumber,
          dedupeKey,
        },
        pushed: false,
      })

      if (!error) totalChanges++
    }
  }

  logger.info({ total: totalChanges }, 'USTR check completed')
  return totalChanges
}

/**
 * 导入已知 Section 301 税率（基于 2024-2026 年公开数据）
 * 全量同步时使用
 */
async function importKnownSection301Rates(): Promise<number> {
  // 已知 Section 301 税率数据（基于 USTR 公开清单）
  const knownRates = [
    // List 3 — 主要工业品 (25%)
    ...['8482', '8483', '8708', '8481', '8479', '7318', '8707', '3926', '4016', '7326', '7610'].map(hs4 => ({
      hs_code: hs4,
      list_number: 'List 3',
      rate: 0.25,
      effective_date: '2018-09-24',
    })),
    // List 4A — 消费品 (7.5%, 原 10% 降至 7.5%)
    ...['6110', '6203', '6204', '6212', '4202', '9403', '9405', '6403', '6404', '3924'].map(hs4 => ({
      hs_code: hs4,
      list_number: 'List 4A',
      rate: 0.075,
      effective_date: '2019-09-01',
    })),
    // EV 专项 (100%)
    { hs_code: '8703', list_number: 'EV专项', rate: 1.0, effective_date: '2024-09-27' },
    // 太阳能电池 (50%)
    { hs_code: '8541', list_number: 'Solar专项', rate: 0.5, effective_date: '2024-09-27' },
    // 半导体 (50%)
    { hs_code: '8542', list_number: 'Semi专项', rate: 0.5, effective_date: '2024-09-27' },
    { hs_code: '8543', list_number: 'Semi专项', rate: 0.5, effective_date: '2024-09-27' },
  ]

  const rows = knownRates.map(r => ({
    hs_code: r.hs_code,
    list_number: r.list_number,
    rate: r.rate,
    origin_country: 'CN',
    effective_date: r.effective_date,
    source: 'ustr',
  }))

  const { error } = await supabase
    .from('section_301_rates')
    .upsert(rows, { onConflict: undefined, ignoreDuplicates: true })

  if (error) {
    logger.error({ error: error.message }, 'Section 301 import failed')
    return 0
  }

  logger.info({ count: rows.length }, 'Known Section 301 rates imported')
  return rows.length
}
