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
  adCvdRate: number
  reciprocalTariffRate: number
  totalTaxRate: number
  goodsValue: number
  customsDuty: number
  section301: number
  section232: number
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
  deMinimisRevoked?: boolean
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
}

export interface LandedCostResult {
  goodsValue: number
  customsDuty: number
  section301: number
  section232: number
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
  adCvdRate: number
  reciprocalTariffRate: number
  ftaApplied: boolean
  ftaName?: string
  deMinimis: boolean
  deMinimisRevoked: boolean
  confidence: Confidence
  missingData: string[]
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
