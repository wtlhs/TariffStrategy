/**
 * Supabase 客户端适配层
 *
 * 封装 @supabase/supabase-js，提供：
 * 1. 离线 fallback 到 chrome.storage 本地缓存
 * 2. snake_case → camelCase 自动转换
 * 3. 与现有 Zustand store 体系无缝衔接
 *
 * 使用模式：
 *   import { supabaseAdapter } from '@/services/supabase'
 *   const dict = await supabaseAdapter.fetchTariffDict('US')
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type {
  TariffDictEntry,
  TariffDictCache,
  LandedCostInput,
  UserAccount,
} from '@/types'
import { MOCK_TARIFF_DICT_US } from '@/lib/mock-data'

// ==================== 配置 ====================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

const CACHE_PREFIX = 'tariff-dict-'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 天

// ==================== 客户端 ====================

let supabaseInstance: SupabaseClient | null = null

function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null

  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: {
          getItem: (key: string) => chrome.storage.local.get(key).then(r => r[key] ?? null),
          setItem: (key: string, value: string) => chrome.storage.local.set({ [key]: value }),
          removeItem: (key: string) => chrome.storage.local.remove(key),
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  }

  return supabaseInstance
}

// ==================== 存储辅助 ====================

async function loadFromStorage<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get(key)
    return (result[key] as T) ?? null
  } catch {
    // chrome.storage 不可用时 fallback 到 localStorage
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }
}

async function saveToStorage(key: string, value: unknown): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value })
  } catch {
    localStorage.setItem(key, JSON.stringify(value))
  }
}

function isCacheValid(cachedAt: string, ttlMs: number = CACHE_TTL_MS): boolean {
  return Date.now() - new Date(cachedAt).getTime() < ttlMs
}

// ==================== snake_case → camelCase 转换 ====================

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)
}

/** 递归转换对象 key：snake_case → camelCase */
export function snakeToCamel<T>(obj: unknown): T {
  if (obj === null || obj === undefined) return obj as T
  if (Array.isArray(obj)) return obj.map(item => snakeToCamel(item)) as T
  if (typeof obj !== 'object') return obj as T

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[toCamelCase(key)] = typeof value === 'object' && value !== null
      ? snakeToCamel(value)
      : value
  }
  return result as T
}

/** 递归转换对象 key：camelCase → snake_case */
export function camelToSnake<T>(obj: unknown): T {
  if (obj === null || obj === undefined) return obj as T
  if (Array.isArray(obj)) return obj.map(item => camelToSnake(item)) as T
  if (typeof obj !== 'object') return obj as T

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[toSnakeCase(key)] = typeof value === 'object' && value !== null
      ? camelToSnake(value)
      : value
  }
  return result as T
}

// ==================== 适配器 API ====================

export const supabaseAdapter = {
  /**
   * 是否有有效的 Supabase 连接
   */
  get isConfigured(): boolean {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
  },

  get isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  },

  /**
   * 获取原始 Supabase 客户端（高级用途）
   */
  get client(): SupabaseClient | null {
    return getSupabase()
  },

  // ==================== 认证 ====================

  /**
   * 手机号登录（OTP）
   */
  async loginWithPhone(phone: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabase()
    if (!client) return { success: false, error: 'Supabase not configured' }

    const { error } = await client.auth.signInWithOtp({ phone })
    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  /**
   * 验证 OTP 码
   */
  async verifyOtp(phone: string, token: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabase()
    if (!client) return { success: false, error: 'Supabase not configured' }

    const { error } = await client.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  /**
   * 获取当前用户 ID
   */
  async getCurrentUserId(): Promise<string | null> {
    const client = getSupabase()
    if (!client) return null

    const { data } = await client.auth.getUser()
    return data.user?.id ?? null
  },

  /**
   * 登出
   */
  async logout(): Promise<void> {
    const client = getSupabase()
    if (!client) return
    await client.auth.signOut()
  },

  // ==================== HS 编码字典 ====================

  /**
   * 获取目标国 HS 字典（带缓存）
   *
   * 流程：本地缓存 → Supabase 查询 → Mock fallback
   */
  async fetchTariffDict(countryCode: string): Promise<TariffDictEntry[]> {
    // 1. 检查本地缓存
    const cacheKey = `${CACHE_PREFIX}${countryCode}`
    const cached = await loadFromStorage<TariffDictCache>(cacheKey)

    if (cached?.meta?.fetchedAt && isCacheValid(cached.meta.fetchedAt)) {
      return cached.entries
    }

    // 2. 尝试 Supabase
    if (this.isConfigured && this.isOnline) {
      const client = getSupabase()!

      try {
        const { data, error } = await client
          .from('tariff_dict')
          .select('*, sub_codes:tariff_sub_codes(*)')
          .eq('country_code', countryCode)

        if (!error && data && data.length > 0) {
          const entries = snakeToCamel<TariffDictEntry[]>(data)

          // 写入缓存
          await saveToStorage(cacheKey, {
            entries,
            meta: {
              countryCode,
              fetchedAt: new Date().toISOString(),
              entryCount: entries.length,
              source: 'api',
            },
          })

          return entries
        }
      } catch {
        // 网络错误，fallback
      }
    }

    // 3. Mock fallback
    if (countryCode === 'US') return MOCK_TARIFF_DICT_US
    return []
  },

  // ==================== 税率查询 ====================

  /**
   * 查询有效税率（调用 RPC）
   */
  async getEffectiveTariff(
    hsCode: string,
    originCountry: string,
    destCountry: string = 'US',
  ): Promise<{
    mfnRate: number
    section301Rate: number
    section232Rate: number
    ftaRate: number | null
    adCvdRate: number
  } | null> {
    const client = getSupabase()
    if (!client || !this.isOnline) return null

    try {
      const { data, error } = await client.rpc('get_effective_tariff', {
        p_hs_code: hsCode,
        p_origin_country: originCountry,
        p_dest_country: destCountry,
      })

      if (error || !data) return null

      return {
        mfnRate: data.mfnRate ?? 0,
        section301Rate: data.section301Rate ?? 0,
        section232Rate: data.section232Rate ?? 0,
        ftaRate: data.ftaRate ?? null,
        adCvdRate: data.adCvdRate ?? 0,
      }
    } catch {
      return null
    }
  },

  // ==================== 支付 ====================

  /**
   * 创建支付订单
   */
  async createPaymentOrder(params: {
    orderType: 'credits' | 'plan'
    paymentChannel: 'wechat' | 'alipay'
    creditPackId?: string
    planTier?: string
    planCycle?: string
  }): Promise<{
    orderId: string
    orderNo: string
    amountYuan: number
    paymentPageUrl: string
    expireAt: string
  } | null> {
    const client = getSupabase()
    if (!client) return null

    const { data, error } = await client.rpc('create_payment_order', {
      p_order_type: params.orderType,
      p_payment_channel: params.paymentChannel,
      p_credit_pack_id: params.creditPackId ?? null,
      p_plan_tier: params.planTier ?? null,
      p_plan_cycle: params.planCycle ?? null,
    })

    if (error) {
      console.error('Create payment order failed:', error.message)
      return null
    }

    return data
  },

  /**
   * 订阅订单状态变化（Realtime）
   */
  subscribeOrderStatus(
    orderId: string,
    onPaid: () => void,
    onExpired?: () => void,
  ) {
    const client = getSupabase()
    if (!client) return { unsubscribe: () => {} }

    const channel = client
      .channel(`order-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'payment_orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        const newStatus = payload.new as { status: string }
        if (newStatus.status === 'paid') {
          channel.unsubscribe()
          onPaid()
        }
        if (newStatus.status === 'expired') {
          channel.unsubscribe()
          onExpired?.()
        }
      })
      .subscribe()

    // 30 分钟超时
    const timeout = setTimeout(() => channel.unsubscribe(), 30 * 60 * 1000)

    return {
      unsubscribe: () => {
        clearTimeout(timeout)
        channel.unsubscribe()
      },
    }
  },

  // ==================== 用户数据 ====================

  /**
   * 获取当前用户资料
   */
  async getUserProfile(): Promise<Partial<UserAccount> | null> {
    const client = getSupabase()
    if (!client) return null

    const { data: { user } } = await client.auth.getUser()
    if (!user) return null

    const { data } = await client
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!data) return null
    return snakeToCamel<Partial<UserAccount>>(data)
  },

  // ==================== 订阅通知 ====================

  /**
   * 创建订阅规则
   */
  async createSubscription(params: {
    ruleType: string
    ruleConfig: Record<string, unknown>
    channels: string[]
  }): Promise<string | null> {
    const client = getSupabase()
    if (!client) return null

    const userId = await this.getCurrentUserId()
    if (!userId) return null

    const { data, error } = await client
      .from('subscriptions')
      .insert({
        user_id: userId,
        rule_type: params.ruleType,
        rule_config: params.ruleConfig,
        channels: params.channels,
        is_active: true,
      })
      .select('id')
      .single()

    if (error || !data) return null
    return data.id
  },

  /**
   * 获取当前用户的订阅列表
   */
  async getSubscriptions(): Promise<Array<{
    id: string
    ruleType: string
    ruleConfig: Record<string, unknown>
    channels: string[]
    isActive: boolean
  }>> {
    const client = getSupabase()
    if (!client) return []

    const userId = await this.getCurrentUserId()
    if (!userId) return []

    const { data } = await client
      .from('subscriptions')
      .select('id, rule_type, rule_config, channels, is_active')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!data) return []
    return snakeToCamel<Array<{
      id: string
      ruleType: string
      ruleConfig: Record<string, unknown>
      channels: string[]
      isActive: boolean
    }>>(data)
  },

  /**
   * 更新通知渠道配置
   */
  async updateNotificationConfig(config: {
    email?: { enabled: boolean; address?: string }
    dingtalk?: { enabled: boolean; webhook?: string; secret?: string }
    wechat?: { enabled: boolean }
    webhook?: { enabled: boolean; url?: string }
  }): Promise<boolean> {
    const client = getSupabase()
    if (!client) return false

    const userId = await this.getCurrentUserId()
    if (!userId) return false

    const { error } = await client.rpc('update_notification_config', {
      p_user_id: userId,
      p_channels: camelToSnake(config),
    })

    return !error
  },

  /**
   * 订阅个人系统通知（Realtime）
   */
  subscribeNotifications(
    userId: string,
    onNewNotification: (event: { title: string; payload: Record<string, unknown> }) => void,
  ) {
    const client = getSupabase()
    if (!client) return { unsubscribe: () => {} }

    const channel = client
      .channel(`notify-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_notification_events',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const newRow = payload.new as { title: string; payload: Record<string, unknown>; channel: string }
        if (newRow.channel === 'system') {
          onNewNotification({ title: newRow.title, payload: newRow.payload })
        }
      })
      .subscribe()

    return {
      unsubscribe: () => channel.unsubscribe(),
    }
  },
}

export default supabaseAdapter
