/**
 * 全局类型定义 — 统一 camelCase
 *
 * 数据模型覆盖：产品、发货国家、策略对比、订阅规则、用户账户、积分、签到、通知
 */

// ============================================================
// 通用
// ============================================================

/** 套餐等级 */
export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise'

/** 税率类型 */
export type RateType =
  | 'mfn'
  | 'preferential'
  | 'section301'
  | 'ad_cvd'
  | 'section201'
  | 'section232'
  | 'section122'
  | 'ieepa_historical'

/** 税率单位 */
export type RateUnit = 'ad_valorem' | 'specific_per_kg' | 'specific_per_unit' | 'compound'

/** 数据可信度 */
export type Confidence = 'high' | 'medium' | 'low'

/** 运输方式 */
export type ShippingMode = 'ocean' | 'air' | 'rail' | 'land'

/** 订阅规则类型 */
export type RuleType = 'product' | 'route' | 'cost' | 'policy'

// ============================================================
// 产品
// ============================================================

export interface TariffProduct {
  id: string
  hsCode: string        // "8482.10"
  name: string          // "滚珠轴承"
  defaultValue: number  // 50000 USD
  remark?: string
  createdAt: string
  updatedAt: string
}

// ============================================================
// 发货国家
// ============================================================

export interface TariffOrigin {
  id: string
  code: string           // "RO"
  name: string           // "罗马尼亚"
  shippingDays: number
  shippingCost: number   // USD
  createdAt: string
  updatedAt: string
}

// ============================================================
// 策略对比
// ============================================================

export interface StrategyResult {
  routing: string         // "RO→US"
  totalCost: number
  taxCost: number
  shippingCost: number
  taxRate: number         // 小数 0.035
  savingsVsBest: number
  isBest: boolean
}

export interface StrategyResponse {
  success: boolean
  bestStrategy: StrategyResult | null
  allStrategies: StrategyResult[]
  aiSuggestion: string
}

/** De Minimis 状态 */
export type DeMinimisStatus = 'active' | 'globally_suspended' | 'suspended_cn_hk'

/** 路线详细数据（内部计算用） */
export interface RouteData {
  routing: string
  originCode: string
  originName: string
  destinationCode: string
  destinationName: string
  mfnRate: number
  effectiveRate: number
  ftaApplied: boolean
  ftaName: string | null
  section301Rate: number
  section232Rate: number
  section122Rate: number
  adCvdRate: number
  reciprocalTariffRate: number
  totalTaxRate: number
  goodsValue: number
  customsDuty: number
  section301: number
  section232: number
  section122: number
  adCvd: number
  reciprocalTariff: number
  mpf: number
  hmf: number
  shippingCost: number
  insurance: number
  totalCost: number
  shippingDays: number
  shippingMode: ShippingMode
  geopoliticalRisk: number
  deMinimisStatus: DeMinimisStatus
  adCvdRisk: string | null
  /** 每层税种的详细应用信息 */
  appliedMeasures: AppliedMeasure[]
  isBest?: boolean
  savingsVsBest?: number
  rank?: number
}

// ============================================================
// 税率数据（服务端）
// ============================================================

export interface TariffRate {
  id: string
  hsCode: string
  originCountry: string
  destinationCountry: string
  rateType: RateType
  rate: number
  rateUnit: RateUnit
  specificRate?: number
  effectiveDate: string
  expiryDate?: string
  source: string
  confidence: Confidence
  notes?: string
}

export interface ShippingRoute {
  id: string
  originCountry: string
  destinationCountry: string
  originPort: string
  destinationPort: string
  mode: ShippingMode
  transitDays: number
  costPerKg?: number
  costPerCbm?: number
  costPerContainer?: number
  insuranceRate: number
  effectiveDate: string
  source: string
}

export interface TariffChangeLog {
  id: string
  hsCode: string
  originCountry: string
  destinationCountry: string
  rateType: string
  oldRate: number
  newRate: number
  changePercent: number
  effectiveDate: string
  source: string
  createdAt: string
}

// ============================================================
// TariffMeasure 统一税种模型
// ============================================================

/** 叠加规则 */
export type StackingRule = 'additive' | 'exclusive' | 'max_of' | 'conditional'

/** 税种定义（静态配置，描述税种本身） */
export interface TariffMeasure {
  /** 税种类型 */
  type: RateType
  /** 法律依据 */
  legalBasis: string
  /** Chapter 99 编码（如适用） */
  chapter99Code?: string
  /** 税率 */
  rate: number
  /** 税率单位 */
  rateUnit?: RateUnit
  /** 生效日期 */
  effectiveDate: string
  /** 失效日期（如适用） */
  expiryDate?: string
  /** 叠加规则 */
  stackingRule: StackingRule
  /** 豁免条件/国家 */
  exemptions?: string[]
  /** 数据来源 URL */
  sourceUrl: string
  /** 数据采集时间 */
  dataFetchedAt: string
  /** 置信度 */
  confidence: Confidence
  /** 备注 */
  notes?: string
}

/** 已应用税种（计算结果，每层税种附加可追溯信息） */
export interface AppliedMeasure {
  /** 税种类型 */
  type: RateType
  /** 税种中文名称 */
  label: string
  /** 税率 */
  rate: number
  /** 税额 */
  amount: number
  /** 是否实际生效 */
  applied: boolean
  /** 生效/不生效原因 */
  reason?: string
  /** 法律依据 */
  legalBasis: string
  /** 数据来源 URL */
  sourceUrl: string
  /** 数据采集时间 */
  dataFetchedAt: string
  /** 生效日期 */
  effectiveDate: string
  /** 失效日期 */
  expiryDate?: string
  /** 置信度 */
  confidence: Confidence
  /** 缺失项提示 */
  missingFields?: string[]
}

// ============================================================
// Landed Cost 计算
// ============================================================

export interface LandedCostInput {
  hsCode: string
  origin: string
  destination: string
  goodsValue: number
  quantity?: number
  weightKg?: number
  shippingMode: ShippingMode
  shippingCost: number
  selectedSubCode?: string
  /** 入境日期，用于 Section 122/IEEPA 历史税率切换，默认当天 */
  entryDate?: string
}

export interface LandedCostResult {
  goodsValue: number
  customsDuty: number
  section301: number
  section232: number
  section122: number
  adCvd: number
  section201: number
  reciprocalTariff: number
  mpf: number
  hmf: number
  insurance: number
  shippingCost: number
  totalCost: number
  effectiveRate: number
  mfnRate: number
  section301Rate: number
  section232Rate: number
  section122Rate: number
  adCvdRate: number
  reciprocalTariffRate: number
  ftaApplied: boolean
  ftaName?: string
  deMinimis: boolean
  deMinimisStatus: DeMinimisStatus
  adCvdRisk: string | null
  confidence: Confidence
  missingData: string[]
  /** 每层税种的详细应用信息（来源、有效期、置信度） */
  appliedMeasures: AppliedMeasure[]
}

// ============================================================
// 订阅规则
// ============================================================

export interface TariffSubscription {
  id: string
  ruleName: string
  ruleType: RuleType
  ruleConfig: Record<string, unknown>
  channels: string[]
  isActive: boolean
  createdAt: string
}

// ============================================================
// 用户账户
// ============================================================

export interface UserAccount {
  userId: string
  email?: string
  phone?: string
  plan: PlanTier
  planExpiresAt?: string
  trialEndsAt?: string
  credits: number
  totalCreditsEarned: number
  totalCreditsSpent: number
  checkInStreak: number
  lastCheckInAt?: string
  lastSearchAt?: string
  lastSearchParams?: SearchParams
  createdAt: string
}

export interface SearchParams {
  hsCode: string
  origin: string
  destination: string
  goodsValue: number
}

// ============================================================
// 积分
// ============================================================

export type CreditAction =
  | 'local_compare'
  | 'ai_analysis'
  | 'ai_deep_report'
  | 'data_refresh'
  | 'excel_export'
  | 'excel_import'
  | 'create_subscription'
  | 'send_notification'

export interface CreditTransaction {
  id: string
  type: 'earn' | 'spend'
  amount: number
  reason: string
  balanceAfter: number
  createdAt: string
}

/** 操作积分消耗配置 */
export interface CreditCostConfig {
  action: CreditAction
  freeUserCost: number
  paidUserCost: number
  freeWeeklyLimit?: number
}

// ============================================================
// 签到
// ============================================================

export interface CheckInRecord {
  date: string
  baseCredits: number
  streakBonus: number
  planMultiplier: number
  totalCredits: number
}

// ============================================================
// 通知渠道
// ============================================================

export interface NotificationChannels {
  email: { enabled: boolean; address: string }
  dingtalk: { enabled: boolean; webhook: string; secret: string }
  wechat: { enabled: boolean; corpId: string; agentId: string; secret: string }
  webhook: { enabled: boolean; url: string }
}

export interface NotificationPreferences {
  notifyOnRateIncrease: boolean
  notifyOnRateDecrease: boolean
  minChangeThreshold: number
}

export interface NotificationConfig {
  channels: NotificationChannels
  preferences: NotificationPreferences
}

// ============================================================
// 套餐方案
// ============================================================

export interface PlanDefinition {
  tier: PlanTier
  name: string
  nameEn: string
  price: number
  yearlyPrice?: number
  monthlyCredits: number
  features: {
    localCompare: 'limited' | 'unlimited'
    localCompareWeeklyLimit?: number
    aiAnalysis: 'limited' | 'unlimited'
    aiAnalysisMonthlyLimit?: number
    aiDeepReport: 'limited' | 'unavailable' | 'unlimited'
    aiDeepReportMonthlyLimit?: number
    maxProducts: number
    maxOrigins: number
    maxSubscriptions: number
    historyDays: number
    excelImport: boolean
    cloudSync: boolean
    trendChart: boolean
    batchCompare: boolean
    apiAccess: boolean
    teamAccounts: number
    checkInMultiplier: number
  }
}

// ============================================================
// HS 编码字典
// ============================================================

/** HS 编码字典条目（按目标国维度，以 HS6 为根节点） */
export interface TariffDictEntry {
  hs6: string
  nameZh: string
  nameEn: string
  keywords: string[]

  /** 目标国子分类（用户需根据产品特性选择） */
  subCodes: TariffSubCode[]
}

/** 目标国 HTS 子分类 */
export interface TariffSubCode {
  code: string
  descriptionZh: string
  descriptionEn: string
  mfnRate: number
  unit?: string
  specialRate?: number
  section301?: { list: string; rate: number }
  section232?: { category: string; rate: number }
  adCvd?: string
  ftaRates?: Record<string, number>
}

/** 字典缓存元数据 */
export interface TariffDictMeta {
  countryCode: string
  fetchedAt: string
  version: string
  entryCount: number
  source: 'api' | 'mock'
}

/** 字典缓存完整结构 */
export interface TariffDictCache {
  entries: TariffDictEntry[]
  meta: TariffDictMeta
}

// ============================================================
// 数据健康与政策变更
// ============================================================

/** 数据源健康状态 */
export type DataFreshness = 'fresh' | 'stale' | 'expired' | 'unknown'

/** 数据源健康信息 */
export interface DataSourceHealth {
  /** 数据源标识 */
  id: string
  /** 数据源名称 */
  name: string
  /** 数据来源 URL */
  sourceUrl: string
  /** 最后同步时间 */
  lastSyncAt: string
  /** 数据版本 */
  version: string
  /** 记录数 */
  recordCount: number
  /** 同步状态 */
  freshness: DataFreshness
  /** 连续失败次数 */
  failureCount: number
  /** 最后失败原因 */
  lastError?: string
  /** 数据采集方式 */
  method: string
}

/** 政策变更条目 */
export interface TariffChangeEntry {
  /** 变更 ID */
  id: string
  /** 变更日期 */
  date: string
  /** 变更标题 */
  title: string
  /** 变更描述 */
  description: string
  /** 影响税种 */
  tariffType: RateType
  /** 影响国家/地区 */
  affectedOrigins: string[]
  /** 影响 HS 章节 */
  affectedChapters?: string[]
  /** 税率变化方向 */
  changeDirection: 'increase' | 'decrease' | 'new' | 'expired' | 'suspended'
  /** 变化幅度（如适用） */
  changeAmount?: string
  /** 数据来源 */
  sourceUrl: string
  /** 来源机构 */
  sourceAuthority: string
  /** 生效日期 */
  effectiveDate: string
  /** 可靠度 */
  confidence: Confidence
}
