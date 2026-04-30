/**
 * 注册/登录服务 — 邮箱注册 + API Key 认证 + 手机号登录
 *
 * 离线模式：本地创建 guest 用户，不调用远程 API
 * 在线模式：对接后端 /auth/register, /auth/login, /auth/sms/*
 */

import { apiClient } from './api-client'
import { supabaseAdapter } from './supabase'
import { useUserStore } from '@/store/user-store'
import type { UserAccount } from '@/types'
import { generateId } from '@/lib/credit-engine'

interface RegisterParams {
  email: string
}

interface LoginParams {
  email: string
  apiKey: string
}

interface PhoneLoginParams {
  phone: string
  code: string
}

interface AuthResponse {
  user: UserAccount
  token: string
}

export async function registerWithEmail(params: RegisterParams): Promise<UserAccount> {
  const store = useUserStore.getState()

  if (!store.isOnline) {
    const guest = createOfflineUser(params.email)
    store.login(guest)
    return guest
  }

  const res = await apiClient.post<AuthResponse>('/auth/register', params)

  if (!res.success || !res.data) {
    throw new Error(res.error ?? 'register_failed')
  }

  const { user, token } = res.data
  apiClient.updateConfig({ apiKey: token })
  store.login(user)
  return user
}

export async function loginWithApiKey(params: LoginParams): Promise<UserAccount> {
  const store = useUserStore.getState()

  apiClient.updateConfig({ apiKey: params.apiKey })

  if (!store.isOnline) {
    throw new Error('offline')
  }

  const res = await apiClient.post<AuthResponse>('/auth/login', {
    email: params.email,
  })

  if (!res.success || !res.data) {
    apiClient.updateConfig({ apiKey: undefined })
    throw new Error(res.error ?? 'login_failed')
  }

  const { user, token } = res.data
  apiClient.updateConfig({ apiKey: token })
  store.login(user)
  return user
}

export async function sendVerificationCode(phone: string): Promise<{ success: boolean; error?: string }> {
  const store = useUserStore.getState()

  // 优先使用 Supabase Auth
  if (supabaseAdapter.isConfigured && store.isOnline) {
    const result = await supabaseAdapter.loginWithPhone(phone)
    if (result.success) return { success: true }
    return { success: false, error: result.error }
  }

  if (!store.isOnline) {
    return { success: true }
  }

  try {
    const res = await apiClient.post<{ sent: boolean }>('/auth/sms/send', { phone })
    if (!res.success) {
      return { success: false, error: res.error ?? 'send_code_failed' }
    }
    return { success: true }
  } catch {
    return { success: true }
  }
}

export async function loginWithPhone(params: PhoneLoginParams): Promise<UserAccount> {
  if (!/^\d{6}$/.test(params.code)) {
    throw new Error('invalid_code')
  }

  const store = useUserStore.getState()

  // 优先使用 Supabase Auth
  if (supabaseAdapter.isConfigured && store.isOnline) {
    const result = await supabaseAdapter.verifyOtp(params.phone, params.code)
    if (result.success) {
      const profile = await supabaseAdapter.getUserProfile()
      if (profile) {
        const user: UserAccount = {
          userId: profile.userId ?? await supabaseAdapter.getCurrentUserId() ?? generateId(),
          phone: profile.phone ?? params.phone,
          email: profile.email,
          plan: profile.plan ?? 'free',
          credits: profile.credits ?? 100,
          totalCreditsEarned: profile.totalCreditsEarned ?? 100,
          totalCreditsSpent: profile.totalCreditsSpent ?? 0,
          checkInStreak: profile.checkInStreak ?? 0,
          createdAt: profile.createdAt ?? new Date().toISOString(),
        }
        store.login(user)
        return user
      }
    }
    // Supabase 验证失败，回退
  }

  if (!store.isOnline) {
    const user = createOfflineUserWithPhone(params.phone)
    store.login(user)
    return user
  }

  try {
    const res = await apiClient.post<AuthResponse>('/auth/sms/verify', {
      phone: params.phone,
      code: params.code,
    })

    if (!res.success || !res.data) {
      throw new Error(res.error ?? 'phone_login_failed')
    }

    const { user, token } = res.data
    apiClient.updateConfig({ apiKey: token })
    store.login(user)
    return user
  } catch {
    const user = createOfflineUserWithPhone(params.phone)
    store.login(user)
    return user
  }
}

export async function fetchProfile(): Promise<UserAccount | null> {
  const store = useUserStore.getState()

  if (!store.isOnline || !store.isLoggedIn) {
    return store.user
  }

  const res = await apiClient.get<UserAccount>('/user/profile')

  if (res.success && res.data) {
    store.login(res.data)
    return res.data
  }

  return store.user
}

export function logout(): void {
  apiClient.updateConfig({ apiKey: undefined })
  if (supabaseAdapter.isConfigured) {
    supabaseAdapter.logout()
  }
  useUserStore.getState().logout()
}

function createOfflineUser(email: string): UserAccount {
  return {
    userId: generateId(),
    email,
    plan: 'free',
    credits: 100,
    totalCreditsEarned: 100,
    totalCreditsSpent: 0,
    checkInStreak: 0,
    createdAt: new Date().toISOString(),
  }
}

function createOfflineUserWithPhone(phone: string): UserAccount {
  return {
    userId: generateId(),
    phone,
    plan: 'free',
    credits: 100,
    totalCreditsEarned: 100,
    totalCreditsSpent: 0,
    checkInStreak: 0,
    createdAt: new Date().toISOString(),
  }
}
