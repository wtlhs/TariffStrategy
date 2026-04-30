import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateLandedCost,
  compareAllRoutes,
  generateAiSuggestion,
} from '../strategy-engine'
import { setActiveDict } from '../strategy-engine'
import { MOCK_TARIFF_DICT_US } from '../mock-data'
import type { LandedCostInput } from '@/types'

beforeEach(() => {
  setActiveDict([...MOCK_TARIFF_DICT_US])
})

// ============================================================
// Section 122 测试
// ============================================================

describe('Section 122 临时进口附加税', () => {
  it('非 USMCA 国家在 Section 122 有效期内应计算 10% 附加税', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 2400,
      entryDate: '2026-04-15',
    })
    expect(result.section122Rate).toBe(0.10)
    expect(result.section122).toBe(1000)
  })

  it('USMCA 国家（墨西哥）应豁免 Section 122', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'MX',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 1600,
      entryDate: '2026-04-15',
    })
    expect(result.section122Rate).toBe(0)
    expect(result.section122).toBe(0)
  })

  it('USMCA 国家（加拿大）应豁免 Section 122', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CA',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 1400,
      entryDate: '2026-04-15',
    })
    expect(result.section122Rate).toBe(0)
  })

  it('Section 122 过期后（2026-08-01）不应计算', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 2400,
      entryDate: '2026-08-01',
    })
    expect(result.section122Rate).toBe(0)
    expect(result.section122).toBe(0)
  })

  it('Section 122 生效前（2026-02-20）不应计算', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 2400,
      entryDate: '2026-02-20',
    })
    expect(result.section122Rate).toBe(0)
  })
})

// ============================================================
// IEEPA 历史关税测试
// ============================================================

describe('IEEPA 历史关税', () => {
  it('当前日期（无 entryDate）不应计入 IEEPA', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 2400,
    })
    expect(result.reciprocalTariffRate).toBe(0)
    expect(result.reciprocalTariff).toBe(0)
  })

  it('IEEPA 生效期内（2025-05-01）应计入中国 34%', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 2400,
      entryDate: '2025-05-01',
    })
    expect(result.reciprocalTariffRate).toBe(0.34)
    expect(result.reciprocalTariff).toBeCloseTo(3400, 0)
  })

  it('SCOTUS 推翻后（2026-02-20）不应计入 IEEPA', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 2400,
      entryDate: '2026-02-20',
    })
    expect(result.reciprocalTariffRate).toBe(0)
  })
})

// ============================================================
// De Minimis 全球暂停测试
// ============================================================

describe('De Minimis 全球暂停', () => {
  it('中国原产应标记为 suspended_cn_hk', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 500,
      shippingMode: 'ocean',
      shippingCost: 2400,
    })
    expect(result.deMinimisStatus).toBe('suspended_cn_hk')
    expect(result.deMinimis).toBe(false)
  })

  it('非中国原产低值商品应标记为 globally_suspended', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'KR',
      destination: 'US',
      goodsValue: 500,
      shippingMode: 'ocean',
      shippingCost: 2500,
    })
    expect(result.deMinimisStatus).toBe('globally_suspended')
    expect(result.deMinimis).toBe(false)
  })
})

// ============================================================
// AD/CVD 风险提示测试
// ============================================================

describe('AD/CVD 风险提示', () => {
  it('AD/CVD 不应计入确定总成本', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 2400,
      entryDate: '2026-04-15',
    })
    expect(result.adCvd).toBe(0)
    expect(result.adCvdRate).toBe(0)
  })
})

// ============================================================
// 税种叠加综合测试
// ============================================================

describe('多层关税叠加计算', () => {
  it('中国原产滚珠轴承应包含 MFN + Section 301 + Section 122', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 50000,
      shippingMode: 'ocean',
      shippingCost: 2400,
      entryDate: '2026-04-15',
    })

    // MFN 9% on $50,000
    expect(result.mfnRate).toBe(0.09)
    expect(result.customsDuty).toBe(4500)

    // Section 301 25% (List 3)
    expect(result.section301Rate).toBe(0.25)
    expect(result.section301).toBe(12500)

    // Section 232 25% (钢铁类)
    expect(result.section232Rate).toBe(0.25)
    expect(result.section232).toBe(12500)

    // Section 122 10%
    expect(result.section122Rate).toBe(0.10)
    expect(result.section122).toBe(5000)

    // IEEPA = 0 (current)
    expect(result.reciprocalTariff).toBe(0)

    // 总税额 = 4500 + 12500 + 12500 + 5000 = 34500
    expect(result.totalCost).toBeGreaterThan(50000 + 34500)

    // 有效税率 = 34500 / 50000 = 69%
    expect(result.effectiveRate).toBeCloseTo(0.69, 1)
  })

  it('韩国原产（KORUS FTA）应免 MFN、免 Section 122，无 Section 301', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'KR',
      destination: 'US',
      goodsValue: 50000,
      shippingMode: 'ocean',
      shippingCost: 2500,
      entryDate: '2026-04-15',
    })

    // KORUS FTA → Free
    expect(result.ftaApplied).toBe(true)
    expect(result.customsDuty).toBe(0)

    // 无 Section 301（非中国）
    expect(result.section301).toBe(0)

    // Section 122 10%（韩国非 USMCA）
    expect(result.section122Rate).toBe(0.10)
    expect(result.section122).toBe(5000)

    // Section 232 25%（钢铁类，全球）
    expect(result.section232Rate).toBe(0.25)
  })

  it('墨西哥原产（USMCA）应免 MFN、免 Section 122', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'MX',
      destination: 'US',
      goodsValue: 50000,
      shippingMode: 'ocean',
      shippingCost: 1600,
      entryDate: '2026-04-15',
    })

    // USMCA → Free
    expect(result.ftaApplied).toBe(true)
    expect(result.customsDuty).toBe(0)

    // 无 Section 301
    expect(result.section301).toBe(0)

    // 免 Section 122（USMCA 豁免）
    expect(result.section122Rate).toBe(0)
    expect(result.section122).toBe(0)

    // Section 232 仍适用（钢铁类）
    expect(result.section232Rate).toBe(0.25)
  })
})

// ============================================================
// 多路径排序测试
// ============================================================

describe('compareAllRoutes 多路径排序', () => {
  it('应返回所有路线并按成本排序', () => {
    const routes = compareAllRoutes('8482.10', 50000)

    expect(routes.length).toBe(9)

    // 最优路线应该是成本最低的
    expect(routes[0].isBest).toBe(true)
    expect(routes[0].rank).toBe(1)
    expect(routes[0].savingsVsBest).toBe(0)

    // 后续路线成本递增
    for (let i = 1; i < routes.length; i++) {
      expect(routes[i].totalCost).toBeGreaterThanOrEqual(routes[i - 1].totalCost)
      expect(routes[i].savingsVsBest).toBeGreaterThan(0)
    }
  })

  it('所有路线应包含 section122 和 deMinimisStatus 字段', () => {
    const routes = compareAllRoutes('8482.10', 50000)
    for (const route of routes) {
      expect(route).toHaveProperty('section122')
      expect(route).toHaveProperty('section122Rate')
      expect(route).toHaveProperty('deMinimisStatus')
      expect(route).toHaveProperty('adCvdRisk')
    }
  })
})

// ============================================================
// AI 建议测试
// ============================================================

describe('generateAiSuggestion', () => {
  it('应包含免责声明', () => {
    const routes = compareAllRoutes('8482.10', 50000)
    const suggestion = generateAiSuggestion(routes)
    expect(suggestion).toContain('实际成本请以海关核定为准')
  })

  it('应包含 Section 122 变动风险提示（非 USMCA 最优路线时）', () => {
    // 使用非 USMCA 最优的场景：移除 MX/CA，确保最优路线有 Section 122
    const allRoutes = compareAllRoutes('8482.10', 50000, 'US', undefined, '2026-04-15')
    const nonUsMcaRoutes = allRoutes.filter(r => r.section122Rate > 0)
    if (nonUsMcaRoutes.length > 0) {
      const suggestion = generateAiSuggestion(nonUsMcaRoutes)
      expect(suggestion).toContain('Section 122')
    }
  })

  it('空路线返回空字符串', () => {
    expect(generateAiSuggestion([])).toBe('')
  })
})

// ============================================================
// 历史日期切换测试（IEEPA → Section 122）
// ============================================================

describe('政策时间线切换', () => {
  it('2025-05-01：IEEPA 生效、无 Section 122', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 2400,
      entryDate: '2025-05-01',
    })
    expect(result.reciprocalTariffRate).toBe(0.34)
    expect(result.section122Rate).toBe(0)
  })

  it('2026-03-01：IEEPA 失效、Section 122 生效', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 2400,
      entryDate: '2026-03-01',
    })
    expect(result.reciprocalTariffRate).toBe(0)
    expect(result.section122Rate).toBe(0.10)
  })

  it('2026-08-01：IEEPA 失效、Section 122 过期', () => {
    const result = calculateLandedCost({
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      goodsValue: 10000,
      shippingMode: 'ocean',
      shippingCost: 2400,
      entryDate: '2026-08-01',
    })
    expect(result.reciprocalTariffRate).toBe(0)
    expect(result.section122Rate).toBe(0)
  })
})

// ============================================================
// 多品类回归测试（固定 HTS10 + 原产地 + 日期）
// ============================================================

describe('多品类回归测试', () => {
  it('8501.10 电动机 CN→US: MFN 2.8% + S301 25% + S232 0 + S122 10%', () => {
    const r = calculateLandedCost({
      hsCode: '8501.10', origin: 'CN', destination: 'US',
      goodsValue: 30000, shippingMode: 'ocean', shippingCost: 2400, entryDate: '2026-04-15',
    })
    expect(r.mfnRate).toBeCloseTo(0.028, 3)
    expect(r.section301Rate).toBe(0.25)
    expect(r.section232Rate).toBe(0)       // 电机不属于 Section 232
    expect(r.section122Rate).toBe(0.10)
    expect(r.reciprocalTariffRate).toBe(0)  // IEEPA 已失效
  })

  it('8501.10 电动机 KR→US: KORUS FTA 0% + 无 S301 + S122 10%', () => {
    const r = calculateLandedCost({
      hsCode: '8501.10', origin: 'KR', destination: 'US',
      goodsValue: 30000, shippingMode: 'ocean', shippingCost: 2500, entryDate: '2026-04-15',
    })
    expect(r.ftaApplied).toBe(true)
    expect(r.customsDuty).toBe(0)
    expect(r.section301).toBe(0)
    expect(r.section122Rate).toBe(0.10)
  })

  it('6110.20 棉制针织衫 CN→US: MFN 16.6% + S301 7.5% (List 4A) + S122 10%', () => {
    const r = calculateLandedCost({
      hsCode: '6110.20', origin: 'CN', destination: 'US',
      goodsValue: 20000, shippingMode: 'ocean', shippingCost: 2400, entryDate: '2026-04-15',
    })
    expect(r.mfnRate).toBeCloseTo(0.166, 3)
    expect(r.section301Rate).toBe(0.075)
    expect(r.section122Rate).toBe(0.10)
    // 无 Section 232
    expect(r.section232Rate).toBe(0)
  })

  it('6110.20 棉制针织衫 VN→US: MFN 16.6% + 无 S301 + S122 10%', () => {
    const r = calculateLandedCost({
      hsCode: '6110.20', origin: 'VN', destination: 'US',
      goodsValue: 20000, shippingMode: 'ocean', shippingCost: 2400, entryDate: '2026-04-15',
    })
    expect(r.mfnRate).toBeCloseTo(0.166, 3)
    expect(r.section301).toBe(0)
    expect(r.section122Rate).toBe(0.10)
  })

  it('9405.40 LED 灯具 CN→US: MFN 3.9% + S301 25% + S232 25% + S122 10%', () => {
    const r = calculateLandedCost({
      hsCode: '9405.40', origin: 'CN', destination: 'US',
      goodsValue: 40000, shippingMode: 'ocean', shippingCost: 2400, entryDate: '2026-04-15',
    })
    expect(r.mfnRate).toBeCloseTo(0.039, 3)
    expect(r.section301Rate).toBe(0.25)
    expect(r.section232Rate).toBe(0.25)
    expect(r.section122Rate).toBe(0.10)
    // 总税率 = 3.9% + 25% + 25% + 10% = 63.9%
    expect(r.effectiveRate).toBeCloseTo(0.639, 2)
  })

  it('9405.40 LED 灯具 MX→US: USMCA FTA 0% + 无 S301 + S232 25% + 免 S122', () => {
    const r = calculateLandedCost({
      hsCode: '9405.40', origin: 'MX', destination: 'US',
      goodsValue: 40000, shippingMode: 'ocean', shippingCost: 1600, entryDate: '2026-04-15',
    })
    expect(r.ftaApplied).toBe(true)
    expect(r.section301).toBe(0)
    expect(r.section232Rate).toBe(0.25)
    expect(r.section122Rate).toBe(0) // USMCA 豁免
  })

  it('8708.99 汽车零部件 CN→US: MFN 2.5% + S301 25% + S232 25% + S122 10%', () => {
    const r = calculateLandedCost({
      hsCode: '8708.99', origin: 'CN', destination: 'US',
      goodsValue: 80000, shippingMode: 'ocean', shippingCost: 2400, entryDate: '2026-04-15',
    })
    expect(r.mfnRate).toBeCloseTo(0.025, 3)
    expect(r.section301Rate).toBe(0.25)
    expect(r.section232Rate).toBe(0.25)
    expect(r.section122Rate).toBe(0.10)
  })

  it('8708.99 汽车零部件 CA→US: USMCA FTA 0% + 免 S122 + S232 25%', () => {
    const r = calculateLandedCost({
      hsCode: '8708.99', origin: 'CA', destination: 'US',
      goodsValue: 80000, shippingMode: 'ocean', shippingCost: 1400, entryDate: '2026-04-15',
    })
    expect(r.ftaApplied).toBe(true)
    expect(r.section301).toBe(0)
    expect(r.section122Rate).toBe(0)
    expect(r.section232Rate).toBe(0.25)
  })

  it('8482.10 滚珠轴承 SG→US: US-SG FTA 0% + S232 25% + S122 10%', () => {
    const r = calculateLandedCost({
      hsCode: '8482.10', origin: 'SG', destination: 'US',
      goodsValue: 50000, shippingMode: 'ocean', shippingCost: 2800, entryDate: '2026-04-15',
    })
    expect(r.ftaApplied).toBe(true)
    expect(r.section301).toBe(0)
    expect(r.section232Rate).toBe(0.25)
    expect(r.section122Rate).toBe(0.10)
  })

  it('8482.10 滚珠轴承 JP→US: 无 FTA + MFN 9% + S232 25% + S122 10%', () => {
    const r = calculateLandedCost({
      hsCode: '8482.10', origin: 'JP', destination: 'US',
      goodsValue: 50000, shippingMode: 'ocean', shippingCost: 2200, entryDate: '2026-04-15',
    })
    expect(r.ftaApplied).toBe(false)
    expect(r.mfnRate).toBeCloseTo(0.09, 2)
    expect(r.section301).toBe(0)
    expect(r.section232Rate).toBe(0.25)
    expect(r.section122Rate).toBe(0.10)
  })
})

// ============================================================
// appliedMeasures 测试
// ============================================================

describe('appliedMeasures 数据来源面板', () => {
  it('应返回所有税种的 appliedMeasures', () => {
    const r = calculateLandedCost({
      hsCode: '8482.10', origin: 'CN', destination: 'US',
      goodsValue: 50000, shippingMode: 'ocean', shippingCost: 2400, entryDate: '2026-04-15',
    })
    // 至少包含 MFN、S301、S232、S122
    expect(r.appliedMeasures.length).toBeGreaterThanOrEqual(4)
    const types = r.appliedMeasures.map(m => m.type)
    expect(types).toContain('mfn')
    expect(types).toContain('section301')
    expect(types).toContain('section232')
    expect(types).toContain('section122')
  })

  it('每层 appliedMeasure 应包含来源和置信度', () => {
    const r = calculateLandedCost({
      hsCode: '8482.10', origin: 'CN', destination: 'US',
      goodsValue: 50000, shippingMode: 'ocean', shippingCost: 2400, entryDate: '2026-04-15',
    })
    for (const m of r.appliedMeasures) {
      expect(m.legalBasis).toBeTruthy()
      expect(m.sourceUrl).toBeTruthy()
      expect(m.dataFetchedAt).toBeTruthy()
      expect(['high', 'medium', 'low']).toContain(m.confidence)
    }
  })

  it('非中国路线不应包含 S301 appliedMeasures', () => {
    const r = calculateLandedCost({
      hsCode: '8482.10', origin: 'KR', destination: 'US',
      goodsValue: 50000, shippingMode: 'ocean', shippingCost: 2500, entryDate: '2026-04-15',
    })
    const s301 = r.appliedMeasures.find(m => m.type === 'section301')
    expect(s301).toBeDefined()
    expect(s301?.applied).toBe(false)
    expect(s301?.reason).toContain('仅适用于中国原产')
  })

  it('compareAllRoutes 应在 RouteData 中包含 appliedMeasures', () => {
    const routes = compareAllRoutes('8482.10', 50000, 'US', undefined, '2026-04-15')
    for (const route of routes) {
      expect(route.appliedMeasures).toBeDefined()
      expect(route.appliedMeasures.length).toBeGreaterThan(0)
    }
  })
})
