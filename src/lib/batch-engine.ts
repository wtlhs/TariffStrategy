/**
 * 批量测算引擎 — 多 SKU × 多原产地 × 多入境日期
 *
 * 输入：Excel 行数据（SKU、HS 编码、货值、原产地、运费等）
 * 输出：逐行测算结果 + 风险分层 + 缺失项 + 报告数据
 */

import { calculateLandedCost, compareAllRoutes, generateAiSuggestion } from './strategy-engine'
import type { LandedCostInput, LandedCostResult, RouteData, Confidence } from '@/types'

// ============================================================
// 类型定义
// ============================================================

/** 批量导入行（原始数据，字段可能不标准） */
export interface BatchImportRow {
  /** SKU 编号 */
  sku?: string
  /** 产品名称 */
  productName?: string
  /** HS 编码 */
  hsCode: string
  /** 原产地（ISO 2 字母） */
  origin: string
  /** 货值 (USD) */
  goodsValue: number
  /** 运费 (USD) */
  shippingCost?: number
  /** 运输方式 */
  shippingMode?: 'ocean' | 'air' | 'rail' | 'land'
  /** 入境日期 */
  entryDate?: string
  /** 备注 */
  remark?: string
}

/** 风险等级 */
export type RiskLevel = 'high' | 'medium' | 'low'

/** 批量测算结果行 */
export interface BatchResultRow {
  /** 行号（从 1 开始） */
  rowIndex: number
  /** SKU */
  sku: string
  /** 产品名称 */
  productName: string
  /** HS 编码 */
  hsCode: string
  /** 原产地 */
  origin: string
  /** 原产地名称 */
  originName: string
  /** 货值 */
  goodsValue: number
  /** 到岸总成本 */
  totalCost: number
  /** 总税费 */
  totalTax: number
  /** 有效税率 */
  effectiveRate: number
  /** MFN 关税 */
  customsDuty: number
  /** Section 301 */
  section301: number
  /** Section 232 */
  section232: number
  /** Section 122 */
  section122: number
  /** MPF */
  mpf: number
  /** HMF */
  hmf: number
  /** 运费 */
  shippingCost: number
  /** 保险 */
  insurance: number
  /** FTA 是否适用 */
  ftaApplied: boolean
  /** FTA 名称 */
  ftaName?: string
  /** De Minimis 状态 */
  deMinimisStatus: string
  /** AD/CVD 风险 */
  adCvdRisk: string | null
  /** 置信度 */
  confidence: Confidence
  /** 缺失数据 */
  missingData: string[]
  /** 风险等级 */
  riskLevel: RiskLevel
  /** 风险原因 */
  riskReasons: string[]
  /** 入境日期 */
  entryDate: string
  /** 备注 */
  remark: string
}

/** 批量测算汇总 */
export interface BatchSummary {
  /** 总行数 */
  totalRows: number
  /** 成功行数 */
  successRows: number
  /** 失败行数 */
  errorRows: number
  /** 高风险行数 */
  highRiskRows: number
  /** 中风险行数 */
  mediumRiskRows: number
  /** 总货值 */
  totalGoodsValue: number
  /** 总到岸成本 */
  totalLandedCost: number
  /** 总税费 */
  totalTax: number
  /** 平均有效税率 */
  avgEffectiveRate: number
  /** 最高税率行 */
  highestRateRow: BatchResultRow | null
  /** 最低成本原产地排名 */
  originRanking: { origin: string; originName: string; avgRate: number; count: number }[]
}

/** 批量测算完整结果 */
export interface BatchResult {
  summary: BatchSummary
  rows: BatchResultRow[]
  errors: { rowIndex: number; error: string }[]
}

// ============================================================
// 标准字段映射
// ============================================================

/** 标准列名 → 内部字段 */
const STANDARD_COLUMNS: Record<string, keyof BatchImportRow> = {
  'SKU': 'sku',
  'sku': 'sku',
  'SKU编号': 'sku',
  '产品名称': 'productName',
  '品名': 'productName',
  '产品': 'productName',
  'HS编码': 'hsCode',
  'HS': 'hsCode',
  'HS Code': 'hsCode',
  'HTS': 'hsCode',
  'HTS编码': 'hsCode',
  '海关编码': 'hsCode',
  '原产地': 'origin',
  '产地': 'origin',
  '原产国': 'origin',
  'Origin': 'origin',
  'Country': 'origin',
  '货值': 'goodsValue',
  '货值(USD)': 'goodsValue',
  '金额': 'goodsValue',
  'Value': 'goodsValue',
  'Value(USD)': 'goodsValue',
  '运费': 'shippingCost',
  '运费(USD)': 'shippingCost',
  'Shipping': 'shippingCost',
  '运输方式': 'shippingMode',
  '运输': 'shippingMode',
  'Mode': 'shippingMode',
  '入境日期': 'entryDate',
  '日期': 'entryDate',
  '到港日期': 'entryDate',
  'Date': 'entryDate',
  'Entry Date': 'entryDate',
  '备注': 'remark',
  '说明': 'remark',
  'Remark': 'remark',
}

/**
 * 自动映射用户列名到标准字段
 */
export function mapColumns(headers: string[]): Record<string, keyof BatchImportRow | null> {
  const mapping: Record<string, keyof BatchImportRow | null> = {}
  for (const header of headers) {
    const trimmed = header.trim()
    mapping[header] = STANDARD_COLUMNS[trimmed] ?? null
  }
  return mapping
}

// ============================================================
// 批量计算
// ============================================================

/**
 * 批量测算
 * @param rows 导入行数据
 * @param defaultShippingCost 默认运费（未填写时使用）
 * @param defaultEntryDate 默认入境日期（未填写时使用）
 */
export function runBatchCalculation(
  rows: BatchImportRow[],
  defaultShippingCost: number = 2400,
  defaultEntryDate: string = new Date().toISOString().split('T')[0],
): BatchResult {
  const results: BatchResultRow[] = []
  const errors: { rowIndex: number; error: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 1

    try {
      // 验证必填字段
      if (!row.hsCode || !row.origin || !row.goodsValue || row.goodsValue <= 0) {
        errors.push({ rowIndex, error: '缺少必填字段（HS编码、原产地、货值）' })
        continue
      }

      const input: LandedCostInput = {
        hsCode: row.hsCode,
        origin: row.origin.toUpperCase(),
        destination: 'US',
        goodsValue: row.goodsValue,
        shippingMode: row.shippingMode ?? 'ocean',
        shippingCost: row.shippingCost ?? defaultShippingCost,
        entryDate: row.entryDate ?? defaultEntryDate,
      }

      const landed = calculateLandedCost(input)

      const totalTax = landed.customsDuty + landed.section301 + landed.section232
        + landed.section122 + landed.reciprocalTariff

      // 风险分层
      const riskReasons: string[] = []
      if (landed.effectiveRate > 0.5) riskReasons.push('有效税率超过 50%')
      if (landed.section301Rate >= 0.25) riskReasons.push('Section 301 高税率')
      if (landed.section232Rate > 0) riskReasons.push('适用 Section 232')
      if (landed.adCvdRisk) riskReasons.push('AD/CVD 风险')
      if (landed.confidence === 'low') riskReasons.push('数据置信度低')
      if (landed.missingData.length > 0) riskReasons.push(`缺失数据: ${landed.missingData.join('; ')}`)
      if (landed.section122Rate > 0) riskReasons.push('Section 122 为临时附加税，可能变动')

      const riskLevel: RiskLevel =
        riskReasons.length >= 3 || landed.effectiveRate > 0.5 ? 'high'
        : riskReasons.length >= 1 || landed.effectiveRate > 0.3 ? 'medium'
        : 'low'

      const origin = rows[i].origin.toUpperCase()

      results.push({
        rowIndex,
        sku: row.sku ?? `SKU-${rowIndex}`,
        productName: row.productName ?? '',
        hsCode: row.hsCode,
        origin,
        originName: getOriginName(origin),
        goodsValue: row.goodsValue,
        totalCost: landed.totalCost,
        totalTax,
        effectiveRate: landed.effectiveRate,
        customsDuty: landed.customsDuty,
        section301: landed.section301,
        section232: landed.section232,
        section122: landed.section122,
        mpf: landed.mpf,
        hmf: landed.hmf,
        shippingCost: landed.shippingCost,
        insurance: landed.insurance,
        ftaApplied: landed.ftaApplied,
        ftaName: landed.ftaName,
        deMinimisStatus: landed.deMinimisStatus,
        adCvdRisk: landed.adCvdRisk,
        confidence: landed.confidence,
        missingData: landed.missingData,
        riskLevel,
        riskReasons,
        entryDate: row.entryDate ?? defaultEntryDate,
        remark: row.remark ?? '',
      })
    } catch (err) {
      errors.push({
        rowIndex,
        error: err instanceof Error ? err.message : '计算异常',
      })
    }
  }

  // 汇总
  const successRows = results.length
  const totalGoodsValue = results.reduce((s, r) => s + r.goodsValue, 0)
  const totalLandedCost = results.reduce((s, r) => s + r.totalCost, 0)
  const totalTax = results.reduce((s, r) => s + r.totalTax, 0)
  const avgEffectiveRate = totalGoodsValue > 0 ? totalTax / totalGoodsValue : 0

  // 按原产地分组统计
  const originMap = new Map<string, { totalRate: number; count: number; name: string }>()
  for (const r of results) {
    const existing = originMap.get(r.origin) ?? { totalRate: 0, count: 0, name: r.originName }
    existing.totalRate += r.effectiveRate
    existing.count++
    existing.name = r.originName
    originMap.set(r.origin, existing)
  }
  const originRanking = [...originMap.entries()]
    .map(([origin, v]) => ({ origin, originName: v.name, avgRate: v.totalRate / v.count, count: v.count }))
    .sort((a, b) => a.avgRate - b.avgRate)

  return {
    summary: {
      totalRows: rows.length,
      successRows,
      errorRows: errors.length,
      highRiskRows: results.filter(r => r.riskLevel === 'high').length,
      mediumRiskRows: results.filter(r => r.riskLevel === 'medium').length,
      totalGoodsValue,
      totalLandedCost,
      totalTax,
      avgEffectiveRate,
      highestRateRow: results.length > 0
        ? results.reduce((max, r) => r.effectiveRate > max.effectiveRate ? r : max, results[0])
        : null,
      originRanking,
    },
    rows: results,
    errors,
  }
}

// ============================================================
// 辅助
// ============================================================

const ORIGIN_NAMES: Record<string, string> = {
  CN: '中国', HK: '香港', TW: '台湾', KR: '韩国', JP: '日本',
  VN: '越南', TH: '泰国', MY: '马来西亚', SG: '新加坡', ID: '印尼',
  IN: '印度', DE: '德国', FR: '法国', IT: '意大利', RO: '罗马尼亚',
  PL: '波兰', MX: '墨西哥', CA: '加拿大', BR: '巴西', TR: '土耳其',
  GB: '英国', AU: '澳大利亚',
}

function getOriginName(code: string): string {
  return ORIGIN_NAMES[code] ?? code
}
