/**
 * 策略计算引擎 V1 — 简化模型，纯前端离线
 *
 * 总成本 = 货值 + 关税 + Section301 + Section232 + AD/CVD + 对等关税 + MPF + HMF + 运费 + 保险
 * 支持完整 Landed Cost 计算，基于 mock-data 中的真实税率
 */

import type { LandedCostInput, LandedCostResult, RouteData, Confidence } from '@/types'
import {
  DEMO_HS_CODES,
  DEMO_ORIGINS,
  US_IMPORT_FEES,
  SECTION_301_MAPPING,
  SECTION_232_MAPPING,
  RECIPROCAL_TARIFFS,
  DE_MINIMIS_BY_COUNTRY,
} from './mock-data'
import { rankRoutes } from './mock-data'

/**
 * V1 简化 Landed Cost 计算
 */
export function calculateLandedCost(input: LandedCostInput): LandedCostResult {
  const hsProduct = DEMO_HS_CODES.find((h) => h.hsCode === input.hsCode)
  const origin = DEMO_ORIGINS.find((o) => o.code === input.origin)
  const hs4 = input.hsCode.substring(0, 4)

  // --- 税率查表 ---
  const s301 = SECTION_301_MAPPING[hs4]
  const s232 = SECTION_232_MAPPING[hs4]
  const reciprocal = RECIPROCAL_TARIFFS[input.origin]

  // --- MFN + FTA ---
  const mfnRate = hsProduct?.mfnRate ?? 0
  const effectiveMfn = applyFta(mfnRate, origin)
  const ftaApplied = effectiveMfn < mfnRate
  const ftaName = ftaApplied ? origin?.ftaName ?? null : null

  // --- Section 301（仅中国） ---
  const section301Rate = (origin?.code === 'CN' && s301) ? s301.rate : 0

  // --- Section 232（全球适用，按 HS 编码） ---
  const section232Rate = s232 ? s232.rate : 0

  // --- AD/CVD ---
  const adCvdRate = 0

  // --- 对等关税（当前 IEEPA 已推翻，currentRate = 0） ---
  const reciprocalTariffRate = reciprocal?.currentRate ?? 0

  // --- De Minimis 判断（按发货国） ---
  const dmConfig = DE_MINIMIS_BY_COUNTRY[input.origin] ?? DE_MINIMIS_BY_COUNTRY.default
  const deMinimisRevoked = !dmConfig.enabled
  const deMinimis = dmConfig.enabled
    && input.goodsValue <= dmConfig.threshold
    && adCvdRate === 0
    && section301Rate === 0
    && section232Rate === 0
    && reciprocalTariffRate === 0

  // --- 费用计算 ---
  const customsDuty = deMinimis ? 0 : input.goodsValue * effectiveMfn
  const section301 = deMinimis ? 0 : input.goodsValue * section301Rate
  const section232 = deMinimis ? 0 : input.goodsValue * section232Rate
  const adCvd = input.goodsValue * adCvdRate
  const reciprocalTariff = deMinimis ? 0 : input.goodsValue * reciprocalTariffRate

  const mpf = deMinimis ? 0 : Math.max(
    US_IMPORT_FEES.mpfMin,
    Math.min(input.goodsValue * US_IMPORT_FEES.mpfRate, US_IMPORT_FEES.mpfMax),
  )
  const hmf = input.shippingMode === 'ocean' ? input.goodsValue * US_IMPORT_FEES.hmfRate : 0
  const insurance = (input.goodsValue + input.shippingCost) * US_IMPORT_FEES.insuranceRate

  const totalTax = customsDuty + section301 + section232 + adCvd + reciprocalTariff
  const totalCost = input.goodsValue + totalTax + mpf + hmf + input.shippingCost + insurance

  const missingData: string[] = []
  if (!hsProduct) missingData.push('HS编码未找到对应税率')
  if (!origin) missingData.push('发出地未找到对应数据')

  return {
    goodsValue: input.goodsValue,
    customsDuty,
    section301,
    section232,
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
    adCvdRate,
    reciprocalTariffRate,
    ftaApplied,
    ftaName: ftaName ?? undefined,
    deMinimis,
    deMinimisRevoked,
    confidence: determineConfidence(hsProduct != null, origin != null),
    missingData,
  }
}

/**
 * 批量对比所有路线
 */
export function compareAllRoutes(
  hsCode: string,
  goodsValue: number,
  destination: string = 'US',
): RouteData[] {
  const routes = DEMO_ORIGINS.map((origin) => {
    const landed = calculateLandedCost({
      hsCode,
      origin: origin.code,
      destination,
      goodsValue,
      shippingMode: 'ocean',
      shippingCost: origin.shippingCostPer40ft,
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
      adCvdRate: landed.adCvdRate,
      reciprocalTariffRate: landed.reciprocalTariffRate,
      totalTaxRate: landed.effectiveRate,
      goodsValue,
      customsDuty: landed.customsDuty,
      section301: landed.section301,
      section232: landed.section232,
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
      deMinimisRevoked: landed.deMinimisRevoked,
    }
  })

  return rankRoutes(routes)
}

/**
 * 生成 AI 建议文本（V1 模板）
 */
export function generateAiSuggestion(routes: RouteData[]): string {
  if (routes.length === 0) return ''
  const best = routes[0]
  const second = routes.length > 1 ? routes[1] : null
  const originName = best.originName

  if (!second) {
    return `建议从${originName}发货，预估到岸总成本 $${best.totalCost.toLocaleString()}。`
  }

  const savings = second.totalCost - best.totalCost
  const percent = ((savings / second.totalCost) * 100).toFixed(1)

  if (best.ftaApplied && best.ftaName) {
    return `建议从${originName}发货（适用 ${best.ftaName} 优惠），到岸总成本 $${best.totalCost.toLocaleString()}，相比次优路线可节省 $${savings.toLocaleString()}（${percent}%）。`
  }

  return `建议从${originName}发货，到岸总成本 $${best.totalCost.toLocaleString()}，相比次优路线 ${second.originName} 可节省 $${savings.toLocaleString()}（${percent}%）。`
}

// ============================================================
// 内部辅助
// ============================================================

function applyFta(mfnRate: number, origin: (typeof DEMO_ORIGINS)[number] | undefined): number {
  if (!origin || origin.ftaRate === null) return mfnRate
  return Math.min(mfnRate, origin.ftaRate)
}

function determineConfidence(hasHs: boolean, hasOrigin: boolean): Confidence {
  if (hasHs && hasOrigin) return 'high'
  if (hasHs || hasOrigin) return 'medium'
  return 'low'
}
