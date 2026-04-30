/**
 * 策略计算引擎 V2 — 政策正确性热修
 *
 * 税种叠加顺序：
 * 1. MFN/FTA 关税
 * 2. Section 301（中国原产）
 * 3. Section 232（全球，钢铝/汽车）
 * 4. Section 122（全球临时附加税，USMCA 豁免）
 * 5. IEEPA 历史（已失效，不计入当前成本）
 * 6. AD/CVD（仅风险提示，不自动计入总成本）
 * 7. MPF + HMF + 运费 + 保险
 *
 * De Minimis：2025-08-29 全球暂停
 */

import type { LandedCostInput, LandedCostResult, RouteData, Confidence, DeMinimisStatus, TariffDictEntry, TariffSubCode, AppliedMeasure } from '@/types'
import {
  DEMO_ORIGINS,
  US_IMPORT_FEES,
  RECIPROCAL_TARIFFS,
  DE_MINIMIS_BY_COUNTRY,
  SECTION_301_MAPPING,
  SECTION_232_MAPPING,
  SECTION_122_CONFIG,
  MEASURE_MFN,
  MEASURE_FTA,
  MEASURE_SECTION_301,
  MEASURE_SECTION_232,
  MEASURE_SECTION_122,
  MEASURE_IEEPA,
  MEASURE_MPF,
  MEASURE_HMF,
} from './mock-data'
import { rankRoutes } from './mock-data'
import { normalizeHS } from './hs-normalize'

let activeDict: TariffDictEntry[] = []

export function setActiveDict(dict: TariffDictEntry[]): void {
  activeDict = dict
}

function findSubCode(hsCode: string, selectedSubCode?: string): TariffSubCode | null {
  const hs6 = normalizeHS(hsCode)
  const entry = activeDict.find((e) => e.hs6 === hs6)
  if (!entry) return null

  if (selectedSubCode) {
    return entry.subCodes.find((s) => s.code === selectedSubCode) ?? entry.subCodes[0] ?? null
  }
  return entry.subCodes[0] ?? null
}

/** 判断入境日期是否在 Section 122 有效期内 */
function isSection122Active(entryDate?: string): boolean {
  if (!entryDate) return true
  const date = new Date(entryDate)
  const effective = new Date(SECTION_122_CONFIG.effectiveDate)
  const expiry = new Date(SECTION_122_CONFIG.estimatedExpiryDate)
  return date >= effective && date <= expiry
}

/** 判断入境日期是否在 IEEPA 有效期内（2025-04-09 至 2026-02-20） */
function isIeepaActive(entryDate?: string): boolean {
  if (!entryDate) return false
  const date = new Date(entryDate)
  return date >= new Date('2025-04-09') && date < new Date('2026-02-20')
}

/** 获取 De Minimis 状态 */
function getDeMinimisStatus(originCode: string): DeMinimisStatus {
  const config = DE_MINIMIS_BY_COUNTRY[originCode] ?? DE_MINIMIS_BY_COUNTRY.default
  if (config.enabled) return 'active'
  if (originCode === 'CN' || originCode === 'HK') return 'suspended_cn_hk'
  return 'globally_suspended'
}

/** 检查 AD/CVD 风险 */
function getAdCvdRisk(subCode: TariffSubCode | null, originCode: string): string | null {
  if (!subCode?.adCvd) return null
  return `该商品可能适用 AD/CVD（${subCode.adCvd}），需人工确认是否适用及具体税率`
}

/**
 * V2 Landed Cost 计算
 */
export function calculateLandedCost(input: LandedCostInput): LandedCostResult {
  const origin = DEMO_ORIGINS.find((o) => o.code === input.origin)
  const subCode = findSubCode(input.hsCode, input.selectedSubCode)
  const hs4 = normalizeHS(input.hsCode, 6).substring(0, 4)

  // --- 1. MFN/FTA ---
  const mfnRate = subCode?.mfnRate ?? 0
  const ftaRate = subCode?.ftaRates?.[origin?.ftaName ?? ''] ?? null
  const effectiveMfn = ftaRate !== null && ftaRate < mfnRate ? ftaRate : mfnRate
  const ftaApplied = effectiveMfn < mfnRate
  const ftaName = ftaApplied ? origin?.ftaName ?? null : null

  // --- 2. Section 301（仅中国原产）---
  const section301Rate = origin?.code === 'CN'
    ? (subCode?.section301?.rate ?? SECTION_301_MAPPING[hs4]?.rate ?? 0)
    : 0

  // --- 3. Section 232（全球适用）---
  const section232Rate = subCode?.section232?.rate ?? (SECTION_232_MAPPING[hs4]?.rate ?? 0)

  // --- 4. Section 122（全球临时附加税，USMCA 豁免，日期敏感）---
  const section122Active = isSection122Active(input.entryDate)
  const isUsMca = SECTION_122_CONFIG.exemptedOrigins.includes(input.origin as 'MX' | 'CA')
  const section122Rate = section122Active && !isUsMca
    ? SECTION_122_CONFIG.defaultRate
    : 0

  // --- 5. IEEPA 历史关税（已失效，仅历史查询时计入）---
  const ieepaActive = isIeepaActive(input.entryDate)
  const ieepaRate = ieepaActive
    ? (RECIPROCAL_TARIFFS[input.origin]?.april2025Rate ?? 0)
    : 0

  // --- 6. AD/CVD（仅风险提示，不自动计入总成本）---
  const adCvdRisk = getAdCvdRisk(subCode, input.origin)
  const adCvdRate = 0

  // --- De Minimis（全球暂停）---
  const deMinimisStatus = getDeMinimisStatus(input.origin)
  const deMinimis = deMinimisStatus === 'active'
    && input.goodsValue <= (DE_MINIMIS_BY_COUNTRY[input.origin]?.threshold ?? DE_MINIMIS_BY_COUNTRY.default.threshold)
    && section301Rate === 0
    && section232Rate === 0
    && section122Rate === 0

  // --- 费用计算 ---
  const customsDuty = deMinimis ? 0 : input.goodsValue * effectiveMfn
  const section301 = deMinimis ? 0 : input.goodsValue * section301Rate
  const section232 = deMinimis ? 0 : input.goodsValue * section232Rate
  const section122 = deMinimis ? 0 : input.goodsValue * section122Rate
  const reciprocalTariff = deMinimis ? 0 : input.goodsValue * ieepaRate
  const adCvd = 0

  const mpf = deMinimis ? 0 : Math.max(
    US_IMPORT_FEES.mpfMin,
    Math.min(input.goodsValue * US_IMPORT_FEES.mpfRate, US_IMPORT_FEES.mpfMax),
  )
  const hmf = input.shippingMode === 'ocean' ? input.goodsValue * US_IMPORT_FEES.hmfRate : 0
  const insurance = (input.goodsValue + input.shippingCost) * US_IMPORT_FEES.insuranceRate

  const totalTax = customsDuty + section301 + section232 + section122 + reciprocalTariff
  const totalCost = input.goodsValue + totalTax + mpf + hmf + input.shippingCost + insurance

  const hasEntry = subCode !== null
  const missingData: string[] = []
  if (!hasEntry) missingData.push('HS编码未找到对应税率，使用回退数据')
  if (!origin) missingData.push('发出地未找到对应数据')
  if (adCvdRisk) missingData.push('AD/CVD 可能适用，需人工确认')

  // --- 构建 appliedMeasures ---
  const appliedMeasures: AppliedMeasure[] = []

  // MFN/FTA
  appliedMeasures.push({
    type: 'mfn',
    label: ftaApplied ? `FTA (${ftaName})` : 'MFN 关税',
    rate: effectiveMfn,
    amount: customsDuty,
    applied: customsDuty > 0 || deMinimis,
    reason: deMinimis ? 'De Minimis 豁免' : ftaApplied ? `适用 FTA 优惠 (${ftaName})` : `标准 MFN 税率 ${(mfnRate * 100).toFixed(1)}%`,
    legalBasis: ftaApplied ? MEASURE_FTA.legalBasis : MEASURE_MFN.legalBasis,
    sourceUrl: MEASURE_MFN.sourceUrl,
    dataFetchedAt: MEASURE_MFN.dataFetchedAt,
    effectiveDate: MEASURE_MFN.effectiveDate,
    confidence: MEASURE_MFN.confidence,
    missingFields: !hasEntry ? ['HTS10 子分类'] : undefined,
  })

  // Section 301
  appliedMeasures.push({
    type: 'section301',
    label: 'Section 301',
    rate: section301Rate,
    amount: section301,
    applied: section301 > 0,
    reason: origin?.code !== 'CN' ? '仅适用于中国原产商品' : deMinimis ? 'De Minimis 豁免' : `List ${subCode?.section301?.list ?? '3'} ${(section301Rate * 100).toFixed(1)}%`,
    legalBasis: MEASURE_SECTION_301.legalBasis,
    sourceUrl: MEASURE_SECTION_301.sourceUrl,
    dataFetchedAt: MEASURE_SECTION_301.dataFetchedAt,
    effectiveDate: MEASURE_SECTION_301.effectiveDate,
    confidence: MEASURE_SECTION_301.confidence,
  })

  // Section 232
  appliedMeasures.push({
    type: 'section232',
    label: 'Section 232',
    rate: section232Rate,
    amount: section232,
    applied: section232 > 0,
    reason: section232Rate === 0 ? '该商品不属于 Section 232 覆盖范围' : deMinimis ? 'De Minimis 豁免' : `${subCode?.section232?.category ?? '钢铁/铝/汽车'} ${(section232Rate * 100).toFixed(0)}%`,
    legalBasis: MEASURE_SECTION_232.legalBasis,
    sourceUrl: MEASURE_SECTION_232.sourceUrl,
    dataFetchedAt: MEASURE_SECTION_232.dataFetchedAt,
    effectiveDate: MEASURE_SECTION_232.effectiveDate,
    confidence: MEASURE_SECTION_232.confidence,
    missingFields: section232Rate > 0 && !subCode?.section232 ? ['材料含量', 'Chapter 99 分类'] : undefined,
  })

  // Section 122
  appliedMeasures.push({
    type: 'section122',
    label: 'Section 122 临时附加税',
    rate: section122Rate,
    amount: section122,
    applied: section122 > 0,
    reason: isUsMca ? 'USMCA 国家豁免' : !section122Active ? '不在 Section 122 有效期内' : deMinimis ? 'De Minimis 豁免' : `临时附加税 ${(section122Rate * 100).toFixed(0)}%`,
    legalBasis: MEASURE_SECTION_122.legalBasis,
    sourceUrl: MEASURE_SECTION_122.sourceUrl,
    dataFetchedAt: MEASURE_SECTION_122.dataFetchedAt,
    effectiveDate: MEASURE_SECTION_122.effectiveDate,
    expiryDate: MEASURE_SECTION_122.expiryDate,
    confidence: MEASURE_SECTION_122.confidence,
  })

  // IEEPA 历史
  if (ieepaRate > 0 || ieepaActive) {
    appliedMeasures.push({
      type: 'ieepa_historical',
      label: 'IEEPA 历史关税',
      rate: ieepaRate,
      amount: reciprocalTariff,
      applied: reciprocalTariff > 0,
      reason: !ieepaActive ? 'IEEPA 已于 2026-02-20 被 SCOTUS 推翻' : `${(ieepaRate * 100).toFixed(0)}%（历史税率）`,
      legalBasis: MEASURE_IEEPA.legalBasis,
      sourceUrl: MEASURE_IEEPA.sourceUrl,
      dataFetchedAt: MEASURE_IEEPA.dataFetchedAt,
      effectiveDate: MEASURE_IEEPA.effectiveDate,
      expiryDate: MEASURE_IEEPA.expiryDate,
      confidence: MEASURE_IEEPA.confidence,
    })
  }

  // AD/CVD 风险
  if (adCvdRisk) {
    appliedMeasures.push({
      type: 'ad_cvd',
      label: 'AD/CVD 风险提示',
      rate: 0,
      amount: 0,
      applied: false,
      reason: adCvdRisk,
      legalBasis: 'Anti-Dumping / Countervailing Duty Orders',
      sourceUrl: 'https://www.usitc.gov/investigations_adcvd',
      dataFetchedAt: '2026-04-10',
      effectiveDate: '',
      confidence: 'low',
      missingFields: ['生产商/出口商', '订单编号', '现金保证金率', 'AD/CVD scope 确认'],
    })
  }

  return {
    goodsValue: input.goodsValue,
    customsDuty,
    section301,
    section232,
    section122,
    adCvd,
    section201: 0,
    reciprocalTariff,
    mpf,
    hmf,
    insurance,
    shippingCost: input.shippingCost,
    totalCost,
    effectiveRate: input.goodsValue > 0 ? totalTax / input.goodsValue : 0,
    mfnRate,
    section301Rate,
    section232Rate,
    section122Rate,
    adCvdRate,
    reciprocalTariffRate: ieepaRate,
    ftaApplied,
    ftaName: ftaName ?? undefined,
    deMinimis,
    deMinimisStatus,
    adCvdRisk,
    confidence: determineConfidence(hasEntry, origin != null),
    missingData,
    appliedMeasures,
  }
}

/**
 * 批量对比所有路线
 */
export function compareAllRoutes(
  hsCode: string,
  goodsValue: number,
  destination: string = 'US',
  selectedSubCode?: string,
  entryDate?: string,
): RouteData[] {
  const routes = DEMO_ORIGINS.map((origin) => {
    const landed = calculateLandedCost({
      hsCode,
      origin: origin.code,
      destination,
      goodsValue,
      shippingMode: 'ocean',
      shippingCost: origin.shippingCostPer40ft,
      selectedSubCode,
      entryDate,
    })

    return {
      routing: `${origin.code}→${destination}`,
      originCode: origin.code,
      originName: origin.name,
      destinationCode: destination,
      destinationName: destination === 'US' ? '美国' : destination,
      mfnRate: landed.mfnRate,
      effectiveRate: landed.effectiveRate,
      ftaApplied: landed.ftaApplied,
      ftaName: origin.ftaName,
      section301Rate: landed.section301Rate,
      section232Rate: landed.section232Rate,
      section122Rate: landed.section122Rate,
      adCvdRate: landed.adCvdRate,
      reciprocalTariffRate: landed.reciprocalTariffRate,
      totalTaxRate: landed.effectiveRate,
      goodsValue,
      customsDuty: landed.customsDuty,
      section301: landed.section301,
      section232: landed.section232,
      section122: landed.section122,
      adCvd: landed.adCvd,
      reciprocalTariff: landed.reciprocalTariff,
      mpf: landed.mpf,
      hmf: landed.hmf,
      shippingCost: origin.shippingCostPer40ft,
      insurance: landed.insurance,
      totalCost: landed.totalCost,
      shippingDays: origin.shippingDays,
      shippingMode: 'ocean' as const,
      geopoliticalRisk: origin.geopoliticalRisk,
      deMinimisStatus: landed.deMinimisStatus,
      adCvdRisk: landed.adCvdRisk,
      appliedMeasures: landed.appliedMeasures,
    }
  })

  return rankRoutes(routes)
}

/**
 * 生成 AI 建议文本（V2 模板）
 * 展示缺失数据和风险，不做过度承诺
 */
export function generateAiSuggestion(routes: RouteData[]): string {
  if (routes.length === 0) return ''
  const best = routes[0]
  const second = routes.length > 1 ? routes[1] : null
  const originName = best.originName

  const warnings: string[] = []
  if (best.adCvdRisk) warnings.push('目标路线可能存在 AD/CVD 风险，需人工确认')
  if (best.section122Rate > 0) warnings.push('Section 122 为临时附加税，有效期至 2026-07-24，后续可能变动')

  let suggestion = ''

  if (!second) {
    suggestion = `建议从${originName}发货，预估到岸总成本 $${best.totalCost.toLocaleString()}。`
  } else {
    const savings = second.totalCost - best.totalCost
    const percent = ((savings / second.totalCost) * 100).toFixed(1)

    if (best.ftaApplied && best.ftaName) {
      suggestion = `建议从${originName}发货（适用 ${best.ftaName} 优惠），到岸总成本 $${best.totalCost.toLocaleString()}，相比次优路线可节省 $${savings.toLocaleString()}（${percent}%）。`
    } else {
      suggestion = `建议从${originName}发货，到岸总成本 $${best.totalCost.toLocaleString()}，相比次优路线 ${second.originName} 可节省 $${savings.toLocaleString()}（${percent}%）。`
    }
  }

  if (warnings.length > 0) {
    suggestion += ` 注意：${warnings.join('；')}。`
  }

  suggestion += '以上基于当前数据和假设生成，实际成本请以海关核定为准。'

  return suggestion
}

// ============================================================
// 内部辅助
// ============================================================

function determineConfidence(hasHs: boolean, hasOrigin: boolean): Confidence {
  if (hasHs && hasOrigin) return 'high'
  if (hasHs || hasOrigin) return 'medium'
  return 'low'
}
