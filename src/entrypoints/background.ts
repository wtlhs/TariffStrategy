/**
 * Background Service Worker — Phase 4
 *
 * 定时任务：
 * - tariff-check: 每 6 小时检查税率变化
 * - checkin-reminder: 每小时检查，9:00 签到提醒
 * - trial-expiry-check: 每天检查试用/订阅到期
 */

import {
  notifyTariffChange,
  notifyCheckInReminder,
  notifyTrialExpiring,
  notifySubscriptionExpiring,
  incrementBadge,
  detectSimulatedChanges,
} from '@/services/notification-service'

export default defineBackground(() => {
  console.log('[税率政策工具] Background Service Worker 已启动')

  // 点击扩展图标 → 打开全屏 Options 页
  chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage()
  })

  // 清除 Badge（打开 options 页时）
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'clear-badge') {
      chrome.action.setBadgeText({ text: '' })
    }
  })

  // 安装/更新时注册所有 alarms
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('tariff-check', { periodInMinutes: 360 })
    chrome.alarms.create('checkin-reminder', { periodInMinutes: 60 })
    chrome.alarms.create('trial-expiry-check', { periodInMinutes: 1440 })

    // 首次安装打开 Welcome 页
    chrome.tabs.create({ url: chrome.runtime.getURL('/options.html') })

    console.log('[税率政策工具] 定时任务已注册')
  })

  // Alarm 调度
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    switch (alarm.name) {
      case 'tariff-check':
        await handleTariffCheck()
        break
      case 'checkin-reminder':
        await handleCheckInReminder()
        break
      case 'trial-expiry-check':
        await handleTrialExpiryCheck()
        break
    }
  })
})

// ============================================================
// 税率变化检查（每 6 小时）
// ============================================================

async function handleTariffCheck(): Promise<void> {
  console.log('[税率政策工具] 执行税率变化检查...')

  const changes = detectSimulatedChanges()

  if (changes.length === 0) {
    console.log('[税率政策工具] 无税率变化')
    return
  }

  console.log(`[税率政策工具] 检测到 ${changes.length} 条税率变化`)

  for (const change of changes) {
    const logId = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    notifyTariffChange({
      id: logId,
      hsCode: change.hsCode,
      originCountry: change.origin,
      destinationCountry: change.destination,
      rateType: change.rateType,
      oldRate: change.oldRate,
      newRate: change.newRate,
      changePercent: change.changePercent,
      effectiveDate: new Date().toISOString().split('T')[0],
      source: 'simulated',
      createdAt: new Date().toISOString(),
    })
  }

  // 存储变化记录到 storage
  await storeChangeLog(changes)
}

async function storeChangeLog(changes: ReturnType<typeof detectSimulatedChanges>): Promise<void> {
  const key = 'tariff-change-log'
  const stored = await chrome.storage.local.get(key)
  const existing = (stored[key] as unknown[]) ?? []

  const logs = changes.map((c) => ({
    ...c,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    effectiveDate: new Date().toISOString().split('T')[0],
    source: 'simulated',
    createdAt: new Date().toISOString(),
  }))

  // 保留最近 100 条
  await chrome.storage.local.set({
    [key]: [...logs, ...existing].slice(0, 100),
  })
}

// ============================================================
// 签到提醒（每小时检查，9:00 触发）
// ============================================================

async function handleCheckInReminder(): Promise<void> {
  const now = new Date()
  if (now.getHours() !== 9) return

  const today = now.toISOString().split('T')[0]
  const stored = await chrome.storage.local.get('tariff-checkin')
  const checkinData = stored['tariff-checkin'] as { state: { lastCheckIn: string | null } } | undefined

  if (checkinData?.state?.lastCheckIn === today) return

  notifyCheckInReminder()
  console.log('[税率政策工具] 签到提醒已发送')
}

// ============================================================
// 试用/订阅到期检查（每天）
// ============================================================

async function handleTrialExpiryCheck(): Promise<void> {
  const stored = await chrome.storage.local.get('tariff-user')
  const userData = stored['tariff-user'] as {
    state: {
      user: {
        trialEndsAt?: string
        planExpiresAt?: string
        plan: string
      } | null
    }
  } | undefined
  const user = userData?.state?.user

  if (!user) return

  const now = Date.now()

  // 试用到期检查
  if (user.trialEndsAt) {
    const daysLeft = Math.ceil(
      (new Date(user.trialEndsAt).getTime() - now) / (24 * 60 * 60 * 1000),
    )

    if (daysLeft > 0 && daysLeft <= 3) {
      notifyTrialExpiring(daysLeft)
      console.log(`[税率政策工具] 试用到期提醒: ${daysLeft} 天`)
    }
  }

  // 订阅到期检查
  if (user.planExpiresAt && user.plan !== 'free') {
    const planNames: Record<string, string> = {
      starter: '基础版',
      pro: '专业版',
      enterprise: '企业版',
    }
    const daysLeft = Math.ceil(
      (new Date(user.planExpiresAt).getTime() - now) / (24 * 60 * 60 * 1000),
    )

    if (daysLeft > 0 && daysLeft <= 3) {
      notifySubscriptionExpiring(daysLeft, planNames[user.plan] ?? user.plan)
      console.log(`[税率政策工具] 订阅到期提醒: ${daysLeft} 天`)
    }
  }
}
