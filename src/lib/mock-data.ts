/**
 * 真实模拟数据集 — 基于实际税率 + 运费采集
 *
 * 数据采集时间：2026年4月
 * 数据来源：
 *   - MFN税率：USITC HTS (hts.usitc.gov)
 *   - Section 301：USTR.gov / Yale Budget Lab Tariff Tracker
 *   - FTA优惠：KORUS / US-Singapore FTA / USMCA / EU 伙伴协议
 *   - 运费：Drewry WCI / Freightos Baltic Index / Xeneta
 *   - 航程：船公司公开船期表
 *
 * 免责声明：仅供产品演示参考，不构成贸易合规建议。
 * 实际税率请以各国海关官方公告为准。
 */

// ============================================================
// 1. 演示用 HS 编码（选择有代表性税率差异的品类）
// ============================================================

export const DEMO_HS_CODES = [
  {
    hsCode: '8482.10',
    name: '滚珠轴承',
    nameEn: 'Ball Bearings',
    mfnRate: 0.09,           // 9% ad valorem (USITC HTS Chapter 84)
    category: '工业零部件',
    defaultValue: 50000,     // $50,000
    section301China: 0.25,   // List 3, 25% additional
    adCvd: null,             // 暂无有效 AD/CVD 令
    unit: 'kg',
    typicalWeight: 2000,     // 2吨
  },
  {
    hsCode: '8501.10',
    name: '电动机（小型）',
    nameEn: 'Electric Motors (Small)',
    mfnRate: 0.028,          // 2.8% ad valorem
    category: '电气设备',
    defaultValue: 30000,
    section301China: 0.25,   // List 3
    adCvd: null,
    unit: 'kg',
    typicalWeight: 500,
  },
  {
    hsCode: '6110.20',
    name: '棉制针织衫',
    nameEn: 'Cotton Knit Garments',
    mfnRate: 0.166,          // 16.6% ad valorem (USITC HTS Chapter 61)
    category: '纺织品服装',
    defaultValue: 20000,
    section301China: 0.075,  // List 4A, 7.5%
    adCvd: null,
    unit: 'doz',
    typicalWeight: 300,
  },
  {
    hsCode: '9405.40',
    name: 'LED 灯具',
    nameEn: 'LED Lighting Fixtures',
    mfnRate: 0.039,          // 3.9% ad valorem
    category: '电子照明',
    defaultValue: 40000,
    section301China: 0.25,   // List 3
    adCvd: null,
    unit: 'kg',
    typicalWeight: 800,
  },
  {
    hsCode: '8708.99',
    name: '汽车零部件（通用）',
    nameEn: 'Auto Parts (General)',
    mfnRate: 0.025,          // 2.5% ad valorem
    category: '汽车配件',
    defaultValue: 80000,
    section301China: 0.25,   // List 3
    adCvd: null,             // 部分品类有 AD/CVD，通用件暂无
    unit: 'kg',
    typicalWeight: 3000,
  },
] as const

// ============================================================
// 2. 发货国家与 FTA 优惠税率
// ============================================================

export const DEMO_ORIGINS = [
  {
    code: 'RO',
    name: '罗马尼亚',
    nameEn: 'Romania',
    ftaName: null,            // EU 成员，无美 FTA
    ftaRate: null,            // 不适用 FTA 优惠
    // 注：2026年对 EU 有 15% 对等关税，此处用基础 MFN 率做演示
    shippingDays: 14,         // Constanta → NYC 海运
    shippingCostPer40ft: 2200,// 2026 Q1 均价
    shippingCostPerKg: 0.12,
    geopoliticalRisk: 10,     // 低风险（NATO 成员）
  },
  {
    code: 'KR',
    name: '韩国',
    nameEn: 'South Korea',
    ftaName: 'KORUS',
    ftaRate: 0,               // KORUS FTA → 多数工业品 Free
    shippingDays: 16,         // Busan → LA 海运
    shippingCostPer40ft: 2500,
    shippingCostPerKg: 0.13,
    geopoliticalRisk: 25,     // 中等（朝鲜半岛局势）
  },
  {
    code: 'SG',
    name: '新加坡',
    nameEn: 'Singapore',
    ftaName: 'US-Singapore FTA',
    ftaRate: 0,               // US-Singapore FTA → 多数商品 Free
    shippingDays: 18,         // Singapore → LA 海运
    shippingCostPer40ft: 2800,
    shippingCostPerKg: 0.15,
    geopoliticalRisk: 5,      // 极低
  },
  {
    code: 'JP',
    name: '日本',
    nameEn: 'Japan',
    ftaName: 'US-Japan Trade Agreement',
    ftaRate: null,            // 仅覆盖有限品类（农产品为主），工业品仍用 MFN
    shippingDays: 12,         // Tokyo/Yokohama → LA 海运（较快）
    shippingCostPer40ft: 2200,
    shippingCostPerKg: 0.12,
    geopoliticalRisk: 10,
  },
  {
    code: 'VN',
    name: '越南',
    nameEn: 'Vietnam',
    ftaName: null,            // 无美 FTA（曾讨论但未签署）
    ftaRate: null,
    shippingDays: 18,         // Cai Mep → LA 海运
    shippingCostPer40ft: 2400,
    shippingCostPerKg: 0.13,
    geopoliticalRisk: 20,
  },
  {
    code: 'DE',
    name: '德国',
    nameEn: 'Germany',
    ftaName: null,            // EU 成员，无独立美 FTA
    ftaRate: null,
    shippingDays: 12,         // Hamburg → NYC 海运
    shippingCostPer40ft: 1900,
    shippingCostPerKg: 0.10,
    geopoliticalRisk: 10,
  },
  {
    code: 'CN',
    name: '中国',
    nameEn: 'China',
    ftaName: null,            // 无美 FTA
    ftaRate: null,
    shippingDays: 16,         // Shanghai/Shenzhen → LA 海运
    shippingCostPer40ft: 2400,
    shippingCostPerKg: 0.13,
    geopoliticalRisk: 40,     // 高（贸易战持续）
  },
  {
    code: 'MX',
    name: '墨西哥',
    nameEn: 'Mexico',
    ftaName: 'USMCA',
    ftaRate: 0,               // USMCA → 多数商品 Free（需满足原产地规则）
    shippingDays: 4,          // 陆运 Laredo/Calexico
    shippingCostPer40ft: 1600,
    shippingCostPerKg: 0.08,
    geopoliticalRisk: 15,
  },
  {
    code: 'CA',
    name: '加拿大',
    nameEn: 'Canada',
    ftaName: 'USMCA',
    ftaRate: 0,               // USMCA → 多数商品 Free
    shippingDays: 3,          // 陆运
    shippingCostPer40ft: 1400,
    shippingCostPerKg: 0.07,
    geopoliticalRisk: 5,
  },
] as const

// ============================================================
// 3. 税率计算常量（2026年美国进口）
// ============================================================

export const US_IMPORT_FEES = {
  /** 商品处理费 MPF：0.3464%, 最低 $31.67, 最高 $614.35 */
  mpfRate: 0.003464,
  mpfMin: 31.67,
  mpfMax: 614.35,

  /** 港口维护费 HMF：0.125%（仅海运） */
  hmfRate: 0.00125,

  /** 保险费率：CIF 价值的 0.5%（行业标准） */
  insuranceRate: 0.005,

  /** De Minimis 阈值：$800 */
  deMinimis: 800,

  /** 正式进口门槛：$2,500（超过需正式报关） */
  formalEntryThreshold: 2500,

  /** 报关行费用估算 */
  brokerFeeEstimate: 150,
} as const

// ============================================================
// 4. Section 301 分清单税率（中国原产）
// ============================================================

export const SECTION_301_RATES = {
  /** List 1 ($34B, 2018.7): 25% */
  list1: 0.25,
  /** List 2 ($16B, 2018.8): 25% */
  list2: 0.25,
  /** List 3 ($200B, 2018.9 → 后降至7.5%, 2024又上调至25%) */
  list3: 0.25,
  /** List 4A ($112B, 原定15% → 后降至7.5%) */
  list4a: 0.075,
  /** 2024-2025 新增：电动汽车 100%, 半导体 50%, 太阳能电池 50%, etc. */
  evRate: 1.0,
  semiconductorRate: 0.50,
  solarRate: 0.50,
} as const

// HS 编码 → Section 301 清单映射（简化版）
export const SECTION_301_MAPPING: Record<string, { list: string; rate: number }> = {
  '8482': { list: 'List 3', rate: 0.25 },    // 轴承 → List 3
  '8501': { list: 'List 3', rate: 0.25 },    // 电机 → List 3
  '6110': { list: 'List 4A', rate: 0.075 },  // 针织服装 → List 4A
  '9405': { list: 'List 3', rate: 0.25 },    // LED灯具 → List 3
  '8708': { list: 'List 3', rate: 0.25 },    // 汽车零件 → List 3
}

// ============================================================
// 4b. Section 232 关税（2025 年扩展版）
// 钢铁制品 25%、铝制品 25%、汽车及零部件 25%
// 对所有国家适用（不仅是中 国）
// ============================================================

export const SECTION_232_MAPPING: Record<string, { category: string; rate: number }> = {
  '7326': { category: '钢铁制品', rate: 0.25 },
  '7606': { category: '铝制品', rate: 0.25 },
  '7607': { category: '铝箔', rate: 0.25 },
  '8708': { category: '汽车零部件', rate: 0.25 },
  '8703': { category: '整车', rate: 0.25 },
  '8482': { category: '轴承(钢铁类)', rate: 0.25 },
  '9405': { category: '灯具(含铝/钢)', rate: 0.25 },
}

// ============================================================
// 4c. IEEPA 对等关税（历史税种）
// 2025.4 宣布 → 2026.2 被 SCOTUS 推翻 (Learning Resources v. Trump)
// 当前不再生效，仅保留历史查询用途
// ============================================================

export const IEEPA_HISTORICAL: Record<string, {
  /** 2025.4 对等关税率 */
  april2025Rate: number
  /** SCOTUS 推翻后清零 */
  currentRate: 0
  /** 法律依据 */
  legalBasis: string
  /** 失效日期 */
  invalidatedDate: string
}> = {
  CN: { april2025Rate: 0.34, currentRate: 0, legalBasis: 'IEEPA → SCOTUS invalidated', invalidatedDate: '2026-02-20' },
  EU: { april2025Rate: 0.20, currentRate: 0, legalBasis: 'IEEPA → SCOTUS invalidated', invalidatedDate: '2026-02-20' },
  JP: { april2025Rate: 0.24, currentRate: 0, legalBasis: 'IEEPA → SCOTUS invalidated', invalidatedDate: '2026-02-20' },
  VN: { april2025Rate: 0.46, currentRate: 0, legalBasis: 'IEEPA → SCOTUS invalidated', invalidatedDate: '2026-02-20' },
  KR: { april2025Rate: 0.25, currentRate: 0, legalBasis: 'IEEPA → SCOTUS invalidated', invalidatedDate: '2026-02-20' },
  SG: { april2025Rate: 0.10, currentRate: 0, legalBasis: 'IEEPA → SCOTUS invalidated', invalidatedDate: '2026-02-20' },
  MX: { april2025Rate: 0.25, currentRate: 0, legalBasis: 'IEEPA → SCOTUS invalidated', invalidatedDate: '2026-02-20' },
  CA: { april2025Rate: 0.25, currentRate: 0, legalBasis: 'IEEPA → SCOTUS invalidated', invalidatedDate: '2026-02-20' },
  RO: { april2025Rate: 0.15, currentRate: 0, legalBasis: 'IEEPA → SCOTUS invalidated', invalidatedDate: '2026-02-20' },
  DE: { april2025Rate: 0.20, currentRate: 0, legalBasis: 'IEEPA → SCOTUS invalidated', invalidatedDate: '2026-02-20' },
}

/** @deprecated 使用 IEEPA_HISTORICAL，此名称仅为向后兼容保留 */
export const RECIPROCAL_TARIFFS = IEEPA_HISTORICAL

// ============================================================
// 4d. Section 122 临时进口附加税
// Trade Act of 1974 Section 122
// 2026-02-20 白宫公告，2026-02-24 生效
// 150 天临时期限，通常 10%，有豁免清单
// 与 Section 232、Chapter 99 有叠加/排除规则
// 实际终止日以官方后续公告为准
// ============================================================

export const SECTION_122_CONFIG = {
  /** 生效日期 */
  effectiveDate: '2026-02-24',
  /** 预计到期日（150天后） */
  estimatedExpiryDate: '2026-07-24',
  /** 默认税率 10% */
  defaultRate: 0.10,
  /** 法律依据 */
  legalBasis: 'Trade Act of 1974, Section 122',
  /** 豁免国家/地区（USMCA 满足原产地规则的商品） */
  exemptedOrigins: ['MX', 'CA'],
  /** 是否已被 Section 232 覆盖的商品可豁免（避免双重叠加） */
  section232OverlapExempt: true,
  /** 数据来源 */
  sourceUrl: 'https://www.whitehouse.gov/fact-sheets/2026/02/',
  /** 数据采集时间 */
  dataFetchedAt: '2026-04-15',
} as const

// ============================================================
// 4e. De Minimis 按国别
// 2025-08-29：美国 de minimis 全球暂停 (CBP)
// 2025-05-02：CN/HK 先行暂停
// 当前默认：全球暂停
// ============================================================

export const DE_MINIMIS_BY_COUNTRY: Record<string, {
  threshold: number
  enabled: boolean
  /** 暂停日期 */
  suspendedDate?: string
  /** 暂停原因 */
  reason?: string
}> = {
  CN: { threshold: 0, enabled: false, suspendedDate: '2025-05-02', reason: 'CBP 先行暂停 CN/HK de minimis' },
  HK: { threshold: 0, enabled: false, suspendedDate: '2025-05-02', reason: 'CBP 先行暂停 CN/HK de minimis' },
  default: { threshold: 0, enabled: false, suspendedDate: '2025-08-29', reason: 'CBP de minimis 全球暂停' },
}

// ============================================================
// 5. 默认演示场景：滚珠轴承 (HS 8482.10) → 美国
// ============================================================

export const DEFAULT_DEMO = {
  hsCode: '8482.10',
  hsName: '滚珠轴承',
  origin: 'RO',
  destination: 'US',
  goodsValue: 50000,
}

/**
 * 生成 7 条路线的真实税率对比数据
 * 基于实际 MFN + FTA + Section 301 + Section 232 + 运费
 */
export function generateDemoRoutes(hsCode: string, goodsValue: number) {
  const hsProduct = DEMO_HS_CODES.find(h => h.hsCode === hsCode) ?? DEMO_HS_CODES[0]
  const hs4 = hsCode.substring(0, 4)
  const s301 = SECTION_301_MAPPING[hs4]
  const s232 = SECTION_232_MAPPING[hs4]

  return DEMO_ORIGINS.slice(0, 7).map(origin => {
    const isOcean = true
    const shippingCost = origin.shippingCostPer40ft

    // MFN + FTA
    let effectiveRate: number = hsProduct.mfnRate
    if (origin.ftaRate !== null && origin.ftaRate < effectiveRate) {
      effectiveRate = origin.ftaRate
    }

    // Section 301（仅中国）
    const section301Rate = (origin.code === 'CN' && s301) ? s301.rate : 0

    // Section 232（全球适用）
    const section232Rate = s232 ? s232.rate : 0

    // Section 122 临时进口附加税（全球适用，USMCA 国家豁免）
    const section122Rate = (!SECTION_122_CONFIG.exemptedOrigins.includes(origin.code as 'MX' | 'CA'))
      ? SECTION_122_CONFIG.defaultRate
      : 0

    // AD/CVD（仅风险提示，不自动计入总成本）
    const adCvdRate = 0

    // IEEPA 历史关税（SCOTUS 2026-02-20 推翻，不再生效）
    const reciprocalTariffRate = RECIPROCAL_TARIFFS[origin.code]?.currentRate ?? 0

    // De Minimis（全球暂停）
    const dmConfig = DE_MINIMIS_BY_COUNTRY[origin.code] ?? DE_MINIMIS_BY_COUNTRY.default
    const deMinimisSuspended = !dmConfig.enabled

    // 总税率（AD/CVD 不计入确定总成本）
    const totalTaxRate = effectiveRate + section301Rate + section232Rate + section122Rate + reciprocalTariffRate

    // 费用计算
    const customsDuty = goodsValue * effectiveRate
    const section301 = goodsValue * section301Rate
    const section232 = goodsValue * section232Rate
    const section122 = goodsValue * section122Rate
    const reciprocalTariff = goodsValue * reciprocalTariffRate
    const mpf = Math.max(
      US_IMPORT_FEES.mpfMin,
      Math.min(goodsValue * US_IMPORT_FEES.mpfRate, US_IMPORT_FEES.mpfMax)
    )
    const hmf = isOcean ? goodsValue * US_IMPORT_FEES.hmfRate : 0
    const insurance = (goodsValue + shippingCost) * US_IMPORT_FEES.insuranceRate

    const totalCost =
      goodsValue +
      customsDuty +
      section301 +
      section232 +
      section122 +
      reciprocalTariff +
      mpf +
      hmf +
      shippingCost +
      insurance

    return {
      routing: `${origin.code}→US`,
      originCode: origin.code,
      originName: origin.name,
      destinationCode: 'US',
      destinationName: '美国',
      mfnRate: hsProduct.mfnRate,
      effectiveRate,
      ftaApplied: origin.ftaRate !== null && origin.ftaRate < hsProduct.mfnRate,
      ftaName: origin.ftaName,
      section301Rate,
      section232Rate,
      section122Rate,
      adCvdRate,
      reciprocalTariffRate,
      totalTaxRate,
      goodsValue,
      customsDuty,
      section301,
      section232,
      section122,
      adCvd: 0,
      reciprocalTariff,
      adCvdRisk: null,
      mpf,
      hmf,
      shippingCost,
      insurance,
      totalCost,
      shippingDays: origin.shippingDays,
      shippingMode: 'ocean' as const,
      geopoliticalRisk: origin.geopoliticalRisk,
      deMinimisStatus: deMinimisSuspended ? 'globally_suspended' as const : 'active' as const,
    }
  })
}

interface RankableRoute {
  totalCost: number
  [key: string]: unknown
}

/**
 * 对路线排序并标记最优
 */
export function rankRoutes<T extends RankableRoute>(routes: T[]): (T & { isBest: boolean; savingsVsBest: number; rank: number })[] {
  const sorted = [...routes].sort((a, b) => a.totalCost - b.totalCost)
  const bestCost = sorted[0].totalCost

  return sorted.map((route, index) => ({
    ...route,
    isBest: index === 0,
    savingsVsBest: index === 0 ? 0 : route.totalCost - bestCost,
    rank: index + 1,
  }))
}

// ============================================================
// 6. 采集数据样本（用于"数据管理"页展示）
// ============================================================

/** Section 301 令样本 */
export const SAMPLE_SECTION301 = [
  { country: '中国', legalBasis: 'Section 301 - List 1', rateRange: '25%', min: 25, max: 25, products: '工业机械、半导体设备等', effectiveDate: '2018-07-06' },
  { country: '中国', legalBasis: 'Section 301 - List 2', rateRange: '25%', min: 25, max: 25, products: '化工品、塑料、钢铁制品等', effectiveDate: '2018-08-23' },
  { country: '中国', legalBasis: 'Section 301 - List 3', rateRange: '25%', min: 25, max: 25, products: '农产品、日用品、电子元器件等', effectiveDate: '2018-09-24' },
  { country: '中国', legalBasis: 'Section 301 - List 4A', rateRange: '7.5%', min: 7.5, max: 7.5, products: '手机、笔记本电脑、服装鞋帽等', effectiveDate: '2019-09-01' },
  { country: '中国', legalBasis: 'Section 301 - EV', rateRange: '100%', min: 100, max: 100, products: '电动汽车', effectiveDate: '2024-09-27' },
  { country: '中国', legalBasis: 'Section 301 - Solar', rateRange: '50%', min: 50, max: 50, products: '太阳能电池、光伏组件', effectiveDate: '2024-09-27' },
  { country: '中国', legalBasis: 'Section 301 - Semi', rateRange: '50%', min: 50, max: 50, products: '半导体芯片、制造设备', effectiveDate: '2025-01-01' },
]

/** Section 232 关税样本 */
export const SAMPLE_SECTION232 = [
  { country: '全球', legalBasis: 'Section 232 - Steel', rateRange: '25%', min: 25, max: 25, products: '钢铁及钢铁制品 (HTS 72-73章)', effectiveDate: '2018-03-23 (2025扩展)' },
  { country: '全球', legalBasis: 'Section 232 - Aluminum', rateRange: '25%', min: 25, max: 25, products: '铝及铝制品 (HTS 76章)', effectiveDate: '2018-03-23 (2025扩展)' },
  { country: '全球', legalBasis: 'Section 232 - Autos', rateRange: '25%', min: 25, max: 25, products: '整车及零部件 (HTS 87章)', effectiveDate: '2025-05-01' },
]

/** 对等关税（IEEPA）历史样本 */
export const SAMPLE_RECIPROCAL = [
  { country: '中国', legalBasis: 'IEEPA 对等关税', rateRange: '34%→125%→30%', min: 34, max: 125, products: '几乎所有商品', effectiveDate: '2025-04-09 (2026-02推翻)' },
  { country: '欧盟', legalBasis: 'IEEPA 对等关税', rateRange: '20%', min: 20, max: 20, products: '几乎所有商品', effectiveDate: '2025-04-09 (2026-02推翻)' },
  { country: '越南', legalBasis: 'IEEPA 对等关税', rateRange: '46%', min: 46, max: 46, products: '几乎所有商品', effectiveDate: '2025-04-09 (2026-02推翻)' },
  { country: '日本', legalBasis: 'IEEPA 对等关税', rateRange: '24%', min: 24, max: 24, products: '几乎所有商品', effectiveDate: '2025-04-09 (2026-02推翻)' },
]

/** MFN 税率样本（HS 4位） */
export const SAMPLE_MFN_RATES = [
  { hsChapter: '84', hsCode: '8482', description: '滚珠/滚子轴承', rate: '9.0%', rateNum: 0.09 },
  { hsChapter: '84', hsCode: '8481', description: '阀门/龙头/旋塞', rate: '3.0%', rateNum: 0.03 },
  { hsChapter: '84', hsCode: '8479', description: '通用工业机械零件', rate: '3.4%', rateNum: 0.034 },
  { hsChapter: '85', hsCode: '8501', description: '电动机/发电机', rate: '2.8%', rateNum: 0.028 },
  { hsChapter: '85', hsCode: '8504', description: '电源/变压器', rate: '1.5%', rateNum: 0.015 },
  { hsChapter: '85', hsCode: '8541', description: '二极管/晶体管', rate: 'Free', rateNum: 0 },
  { hsChapter: '85', hsCode: '8544', description: '绝缘电线/电缆', rate: '3.5%', rateNum: 0.035 },
  { hsChapter: '87', hsCode: '8708', description: '汽车零部件', rate: '2.5%', rateNum: 0.025 },
  { hsChapter: '94', hsCode: '9405', description: '灯具/照明装置', rate: '3.9%', rateNum: 0.039 },
  { hsChapter: '61', hsCode: '6110', description: '针织衫/套头衫', rate: '16.6%', rateNum: 0.166 },
  { hsChapter: '62', hsCode: '6203', description: '男式梭织服装', rate: '12.6%', rateNum: 0.126 },
  { hsChapter: '64', hsCode: '6403', description: '皮革鞋类', rate: '8.5%', rateNum: 0.085 },
]

/** 反倾销/反补贴税样本 */
export const SAMPLE_AD_CVD = [
  { hsCode: '7318.15', description: '螺钉/螺栓', target: '中国', rate: '58.4%-206%', rateNum: 0.584, active: true },
  { hsCode: '7308.90', description: '钢结构部件', target: '中国', rate: '32.0%-133%', rateNum: 0.32, active: true },
  { hsCode: '8479.89', description: '光伏组件支架', target: '中国', rate: '18.3%-35.6%', rateNum: 0.183, active: true },
  { hsCode: '3920.10', description: 'PET薄膜', target: '中国', rate: '23.1%-76.7%', rateNum: 0.231, active: true },
  { hsCode: '7606.11', description: '铝合金薄板', target: '中国', rate: '49.3%-352%', rateNum: 0.493, active: true },
  { hsCode: '2849.90', description: '碳化钨粉', target: '中国', rate: '66.4%-140%', rateNum: 0.664, active: false },
]

/** 实时查询结果样本（基于 2026年4月采集） */
export const SAMPLE_REALTIME_QUERY = [
  { route: 'CN→US', duty: '9.0%', penalty: '25% (S301) + 25% (S232)', excise: '0%', customs: '0.35%', port: '0.125%', total: '59.5%', source: 'hts.usitc.gov' },
  { route: 'RO→US', duty: '9.0%', penalty: '0%', excise: '0%', customs: '0.35%', port: '0.125%', total: '9.5%', source: 'hts.usitc.gov' },
  { route: 'KR→US', duty: '0% (KORUS)', penalty: '0%', excise: '0%', customs: '0.35%', port: '0.125%', total: '0.5%', source: 'hts.usitc.gov + KORUS' },
  { route: 'SG→US', duty: '0% (US-SG FTA)', penalty: '0%', excise: '0%', customs: '0.35%', port: '0.125%', total: '0.5%', source: 'hts.usitc.gov + US-SG FTA' },
  { route: 'JP→US', duty: '9.0%', penalty: '0%', excise: '0%', customs: '0.35%', port: '0.125%', total: '9.5%', source: 'hts.usitc.gov' },
  { route: 'VN→US', duty: '9.0%', penalty: '0%', excise: '0%', customs: '0.35%', port: '0.125%', total: '9.5%', source: 'hts.usitc.gov' },
  { route: 'DE→US', duty: '9.0%', penalty: '0%', excise: '0%', customs: '0.35%', port: '0.125%', total: '9.5%', source: 'hts.usitc.gov' },
]

// ============================================================
// 7. 数据来源标注
// ============================================================

export const DATA_SOURCES = {
  mfnRates: {
    name: 'USITC HTS',
    url: 'https://hts.usitc.gov',
    lastUpdated: '2026-01-01',   // HTS 年度更新
    method: '批量下载 JSON/CSV',
  },
  section301: {
    name: 'USTR + Yale Budget Lab',
    url: 'https://ustr.gov/issue-areas/enforcement/section-301-investigations/tariff-actions',
    lastUpdated: '2026-04-15',
    method: '网页爬取 + GitHub 数据文件',
  },
  ftaRates: {
    name: 'USITC FTA Schedule',
    url: 'https://hts.usitc.gov',
    lastUpdated: '2026-01-01',
    method: 'HTS Column 1 Special',
  },
  shippingRates: {
    name: 'Drewry WCI + Freightos Baltic Index',
    url: 'https://www.freightos.com/freight-resources/container-shipping-cost-calculator-free-tool/',
    lastUpdated: '2026-04-16',
    method: 'API + 爬取',
  },
  adCvd: {
    name: 'Federal Register + CBP',
    url: 'https://www.federalregister.gov',
    lastUpdated: '2026-04-10',
    method: 'API 查询',
  },
  transitTimes: {
    name: '船公司船期表',
    url: 'N/A（多来源汇总）',
    lastUpdated: '2026-04-01',
    method: '手动维护',
  },
} as const

// ============================================================
// 8. TariffMeasure 税种定义（P0-B 可信计算模型）
// ============================================================

import type { TariffDictEntry, TariffMeasure } from '@/types'

/** 基础 MFN 关税 — 来自 USITC HTS 年度版 */
export const MEASURE_MFN: TariffMeasure = {
  type: 'mfn',
  legalBasis: 'Harmonized Tariff Schedule of the United States (HTSUS), Column 1, General',
  rate: 0, // 由具体 HS 编码决定
  rateUnit: 'ad_valorem',
  effectiveDate: '2026-01-01',
  stackingRule: 'additive',
  sourceUrl: 'https://hts.usitc.gov',
  dataFetchedAt: '2026-01-01',
  confidence: 'high',
  notes: 'MFN 税率按 HS6/HTS10 查询，年度更新',
}

/** FTA 优惠税率 — 取代 MFN */
export const MEASURE_FTA: TariffMeasure = {
  type: 'preferential',
  legalBasis: 'Bilateral/Regional Free Trade Agreements',
  rate: 0,
  rateUnit: 'ad_valorem',
  effectiveDate: '2026-01-01',
  stackingRule: 'max_of', // 与 MFN 取较低值
  sourceUrl: 'https://hts.usitc.gov',
  dataFetchedAt: '2026-01-01',
  confidence: 'high',
  notes: 'FTA 税率需满足原产地规则，与 MFN 取较低值',
}

/** Section 301 — 对华惩罚性关税 */
export const MEASURE_SECTION_301: TariffMeasure = {
  type: 'section301',
  legalBasis: 'Trade Act of 1974, Section 301; USTR Lists 1-4A + EV/Solar/Semi',
  rate: 0,
  rateUnit: 'ad_valorem',
  effectiveDate: '2018-07-06',
  stackingRule: 'additive',
  exemptions: ['List-specific exclusions (expired)'],
  sourceUrl: 'https://ustr.gov/issue-areas/enforcement/section-301-investigations/tariff-actions',
  dataFetchedAt: '2026-04-15',
  confidence: 'high',
  notes: '仅适用于中国原产商品，按清单分批生效',
}

/** Section 232 — 钢铝/汽车全球关税 */
export const MEASURE_SECTION_232: TariffMeasure = {
  type: 'section232',
  legalBasis: 'Trade Expansion Act of 1962, Section 232',
  rate: 0.25,
  rateUnit: 'ad_valorem',
  effectiveDate: '2018-03-23',
  stackingRule: 'additive',
  exemptions: ['USMCA steel/aluminum (quota-based)', 'Certain bilateral agreements'],
  sourceUrl: 'https://www.cbp.gov/trade/programs-administration/entry-summary/232-702-tariffs-steel-aluminum',
  dataFetchedAt: '2026-04-15',
  confidence: 'high',
  notes: '覆盖 HTS 72-73 章（钢铁）、76 章（铝）、87 章（汽车）及衍生品',
}

/** Section 122 — 临时进口附加税 */
export const MEASURE_SECTION_122: TariffMeasure = {
  type: 'section122',
  legalBasis: 'Trade Act of 1974, Section 122',
  rate: 0.10,
  rateUnit: 'ad_valorem',
  effectiveDate: '2026-02-24',
  expiryDate: '2026-07-24',
  stackingRule: 'additive',
  exemptions: ['USMCA (MX/CA) 满足原产地规则', 'Section 232 覆盖商品可豁免重叠'],
  sourceUrl: 'https://www.whitehouse.gov/fact-sheets/2026/02/',
  dataFetchedAt: '2026-04-15',
  confidence: 'medium',
  notes: '150 天临时期限，实际终止日以官方后续公告为准',
}

/** IEEPA 对等关税 — 历史税种 */
export const MEASURE_IEEPA: TariffMeasure = {
  type: 'ieepa_historical',
  legalBasis: 'International Emergency Economic Powers Act (IEEPA) → SCOTUS invalidated 2026-02-20',
  rate: 0,
  rateUnit: 'ad_valorem',
  effectiveDate: '2025-04-09',
  expiryDate: '2026-02-20',
  stackingRule: 'additive',
  sourceUrl: 'https://supreme.justia.com/cases/federal/us/607/24-1287/',
  dataFetchedAt: '2026-04-15',
  confidence: 'high',
  notes: 'Learning Resources, Inc. v. Trump 案推翻，当前不再生效',
}

/** MPF — 商品处理费 */
export const MEASURE_MPF: TariffMeasure = {
  type: 'mfn',
  legalBasis: '19 USC § 58c; CBP Merchandise Processing Fee',
  rate: 0.003464,
  rateUnit: 'ad_valorem',
  effectiveDate: '2024-10-01',
  stackingRule: 'additive',
  sourceUrl: 'https://www.cbp.gov/trade/basic-import-export/importing-goods-overview',
  dataFetchedAt: '2026-04-01',
  confidence: 'high',
  notes: '最低 $31.67，最高 $614.35；正式进口 $2,500 以上',
}

/** HMF — 港口维护费 */
export const MEASURE_HMF: TariffMeasure = {
  type: 'mfn',
  legalBasis: 'Harbor Maintenance Revenue Act of 1986',
  rate: 0.00125,
  rateUnit: 'ad_valorem',
  effectiveDate: '2024-10-01',
  stackingRule: 'additive',
  sourceUrl: 'https://www.cbp.gov/trade/basic-import-export/importing-goods-overview',
  dataFetchedAt: '2026-04-01',
  confidence: 'high',
  notes: '仅海运适用',
}

// ============================================================
// 9. HS 编码字典种子数据（美国 HTS，P0 阶段 5 个品类展开）
// ============================================================

export const MOCK_TARIFF_DICT_US: TariffDictEntry[] = [
  {
    hs6: '848210',
    nameZh: '滚珠轴承',
    nameEn: 'Ball bearings',
    keywords: ['轴承', 'bearing', 'ball bearing', '滚珠', 'bearing unit'],
    subCodes: [
      {
        code: '8482.10.10.00',
        descriptionZh: '组合式径向推力滚珠轴承',
        descriptionEn: 'Combined radial and thrust ball bearings',
        mfnRate: 0.09,
        section301: { list: 'List 3', rate: 0.25 },
        section232: { category: '钢铁类', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
      {
        code: '8482.10.50.00',
        descriptionZh: '其他滚珠轴承（非组合式）',
        descriptionEn: 'Other ball bearings, not combined types',
        mfnRate: 0.09,
        section301: { list: 'List 3', rate: 0.25 },
        section232: { category: '钢铁类', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
    ],
  },
  {
    hs6: '850110',
    nameZh: '电动机（小型）',
    nameEn: 'Electric motors (small)',
    keywords: ['电机', '电动机', 'motor', 'electric motor', '马达'],
    subCodes: [
      {
        code: '8501.10.10.00',
        descriptionZh: '输出功率不超过 18.65W 的电动机',
        descriptionEn: 'Motors with output not exceeding 18.65W',
        mfnRate: 0.028,
        section301: { list: 'List 3', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
      {
        code: '8501.10.40.00',
        descriptionZh: '输出功率 18.65W~746W 的电动机',
        descriptionEn: 'Motors with output exceeding 18.65W but not exceeding 746W',
        mfnRate: 0.028,
        section301: { list: 'List 3', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
      {
        code: '8501.10.60.00',
        descriptionZh: '输出功率 746W~7.5kW 的电动机',
        descriptionEn: 'Motors with output exceeding 746W but not exceeding 7.5kW',
        mfnRate: 0.028,
        section301: { list: 'List 3', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
    ],
  },
  {
    hs6: '611020',
    nameZh: '棉制针织衫',
    nameEn: 'Cotton knit garments',
    keywords: ['针织', '毛衣', '针织衫', 'sweater', 'cotton knit', 'pullover', '套头衫'],
    subCodes: [
      {
        code: '6110.20.10.00',
        descriptionZh: '棉制男式针织套头衫',
        descriptionEn: "Men's cotton knit pullovers",
        mfnRate: 0.166,
        section301: { list: 'List 4A', rate: 0.075 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
      {
        code: '6110.20.20.00',
        descriptionZh: '棉制女式针织套头衫',
        descriptionEn: "Women's cotton knit pullovers",
        mfnRate: 0.166,
        section301: { list: 'List 4A', rate: 0.075 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
      {
        code: '6110.20.60.00',
        descriptionZh: '其他棉制针织衫（含儿童）',
        descriptionEn: 'Other cotton knit garments (including children)',
        mfnRate: 0.166,
        section301: { list: 'List 4A', rate: 0.075 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
    ],
  },
  {
    hs6: '940540',
    nameZh: 'LED 灯具',
    nameEn: 'LED lighting fixtures',
    keywords: ['LED', '灯', '照明', 'lighting', 'lamp', '灯具', 'light'],
    subCodes: [
      {
        code: '9405.40.10.00',
        descriptionZh: 'LED 灯带及模组',
        descriptionEn: 'LED light strips and modules',
        mfnRate: 0.039,
        section301: { list: 'List 3', rate: 0.25 },
        section232: { category: '含铝/钢', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
      {
        code: '9405.40.20.00',
        descriptionZh: 'LED 吸顶灯/面板灯',
        descriptionEn: 'LED ceiling/panel lights',
        mfnRate: 0.039,
        section301: { list: 'List 3', rate: 0.25 },
        section232: { category: '含铝/钢', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
      {
        code: '9405.40.60.00',
        descriptionZh: '其他 LED 灯具',
        descriptionEn: 'Other LED lighting fixtures',
        mfnRate: 0.039,
        section301: { list: 'List 3', rate: 0.25 },
        section232: { category: '含铝/钢', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
    ],
  },
  {
    hs6: '870899',
    nameZh: '汽车零部件（通用）',
    nameEn: 'Auto parts (general)',
    keywords: ['汽车零件', 'auto part', '汽车配件', 'vehicle part', '车用'],
    subCodes: [
      {
        code: '8708.99.10.00',
        descriptionZh: '汽车用绞盘及千斤顶',
        descriptionEn: 'Winches and jacks for vehicles',
        mfnRate: 0.025,
        section301: { list: 'List 3', rate: 0.25 },
        section232: { category: '汽车零部件', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
      {
        code: '8708.99.30.00',
        descriptionZh: '汽车用铰链及门锁',
        descriptionEn: 'Hinges and door locks for vehicles',
        mfnRate: 0.025,
        section301: { list: 'List 3', rate: 0.25 },
        section232: { category: '汽车零部件', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
      {
        code: '8708.99.60.00',
        descriptionZh: '其他汽车零部件（未列名）',
        descriptionEn: 'Other motor vehicle parts (not elsewhere specified)',
        mfnRate: 0.025,
        section301: { list: 'List 3', rate: 0.25 },
        section232: { category: '汽车零部件', rate: 0.25 },
        ftaRates: { KORUS: 0, 'US-Singapore FTA': 0, USMCA: 0 },
      },
    ],
  },
]
