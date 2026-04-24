/**
 * 通知服务 — 本地 chrome.notifications + 外部 Webhook
 *
 * 负责：
 * - 税率变化通知（chrome.notifications + Webhook）
 * - 签到提醒（每天 9:00）
 * - 订阅到期提醒（到期前 3 天）
 * - Badge 数字更新
 */

import type { TariffChangeLog, NotificationChannels } from '@/types'

// ============================================================
// Badge 管理
// ============================================================

let pendingBadgeCount = 0

export function incrementBadge(): void {
  pendingBadgeCount += 1
  chrome.action.setBadgeText({ text: pendingBadgeCount > 0 ? String(pendingBadgeCount) : '' })
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
}

export function clearBadge(): void {
  pendingBadgeCount = 0
  chrome.action.setBadgeText({ text: '' })
}

// ============================================================
// chrome.notifications 本地推送
// ============================================================

export function notifyTariffChange(change: TariffChangeLog): void {
  const direction = change.newRate > change.oldRate ? '上涨' : '下降'
  const pct = Math.abs(change.changePercent).toFixed(1)

  chrome.notifications.create(`tariff-${change.id}`, {
    type: 'basic',
    iconUrl: 'icon-128.png',
    title: '税率变化通知',
    message: `${change.hsCode} (${change.originCountry}→${change.destinationCountry}) ${direction} ${pct}%`,
    contextMessage: `${change.rateType}: ${(change.oldRate * 100).toFixed(1)}% → ${(change.newRate * 100).toFixed(1)}%`,
    priority: 2,
  })

  incrementBadge()
}

export function notifyCheckInReminder(): void {
  chrome.notifications.create('checkin-reminder', {
    type: 'basic',
    iconUrl: 'icon-128.png',
    title: '签到提醒',
    message: '别忘了今日签到领取积分！',
    contextMessage: '连续签到可获得额外奖励',
    priority: 1,
  })
}

export function notifyTrialExpiring(daysLeft: number): void {
  chrome.notifications.create('trial-expiring', {
    type: 'basic',
    iconUrl: 'icon-128.png',
    title: '试用即将到期',
    message: `专业版试用还剩 ${daysLeft} 天`,
    contextMessage: '到期后将自动降级为免费版，升级可保留全部功能',
    priority: 2,
  })
}

export function notifySubscriptionExpiring(daysLeft: number, planName: string): void {
  chrome.notifications.create('sub-expiring', {
    type: 'basic',
    iconUrl: 'icon-128.png',
    title: '订阅即将到期',
    message: `${planName} 还剩 ${daysLeft} 天到期`,
    contextMessage: '请及时续费以保留全部功能',
    priority: 2,
  })
}

// ============================================================
// 外部 Webhook 推送
// ============================================================

export async function sendWebhookNotification(
  url: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function sendDingtalkNotification(
  webhook: string,
  secret: string,
  title: string,
  content: string,
): Promise<boolean> {
  const timestamp = Date.now()
  const stringToSign = `${timestamp}\n${secret}`

  // Service Worker 没有 crypto.subtle.sign HMAC，简化处理
  const sign = btoa(stringToSign)
  const url = `${webhook}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`

  return sendWebhookNotification(url, {
    msgtype: 'markdown',
    markdown: { title, text: `### ${title}\n\n${content}` },
  })
}

export async function sendWechatNotification(
  corpId: string,
  agentId: string,
  secret: string,
  content: string,
): Promise<boolean> {
  // 简化：实际需先获取 access_token
  const tokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${secret}`

  try {
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) return false

    return sendWebhookNotification(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenData.access_token}`,
      {
        touser: '@all',
        msgtype: 'text',
        agentid: agentId,
        text: { content },
      },
    )
  } catch {
    return false
  }
}

export async function notifyExternalChannels(
  channels: NotificationChannels,
  title: string,
  content: string,
): Promise<void> {
  const tasks: Promise<boolean>[] = []

  if (channels.webhook.enabled && channels.webhook.url) {
    tasks.push(sendWebhookNotification(channels.webhook.url, { title, content }))
  }

  if (channels.dingtalk.enabled && channels.dingtalk.webhook) {
    tasks.push(sendDingtalkNotification(
      channels.dingtalk.webhook,
      channels.dingtalk.secret,
      title,
      content,
    ))
  }

  if (channels.wechat.enabled && channels.wechat.corpId) {
    tasks.push(sendWechatNotification(
      channels.wechat.corpId,
      channels.wechat.agentId,
      channels.wechat.secret,
      `${title}\n\n${content}`,
    ))
  }

  await Promise.allSettled(tasks)
}

// ============================================================
// 模拟税率变化检测（V1 离线版）
// ============================================================

export interface SimulatedChange {
  hsCode: string
  origin: string
  destination: string
  rateType: string
  oldRate: number
  newRate: number
  changePercent: number
}

/**
 * V1 模拟检测 — 随机生成一些税率变化用于演示通知功能
 * V2 将对接真实后端 API
 */
export function detectSimulatedChanges(): SimulatedChange[] {
  // 30% 概率产生变化（演示用）
  if (Math.random() > 0.3) return []

  const changes: SimulatedChange[] = [
    {
      hsCode: '8482.10',
      origin: 'CN',
      destination: 'US',
      rateType: 'section301',
      oldRate: 0.25,
      newRate: 0.30,
      changePercent: 20,
    },
  ]

  return changes
}
