/**
 * 通知推送核心 — Fan-out 引擎
 *
 * 流程：
 * 1. 从 tariff_change_log 读取未推送的记录
 * 2. 查询所有匹配的订阅规则
 * 3. 按用户 × 渠道展开，写入 user_notification_events（dedupe）
 * 4. 外部渠道（邮件/钉钉/企微/webhook）立即发送
 * 5. system 渠道由扩展端通过 Realtime 自行拉取
 * 6. 标记 tariff_change_log.pushed = true
 */
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { sendEmail, buildTariffChangeEmail } from './email.js'
import { sendDingTalk, buildTariffChangeDingTalk } from './dingtalk.js'
import { sendWeChat, buildTariffChangeWeChat } from './wechat.js'
import { sendWebhook, buildTariffChangeWebhook } from './webhook.js'

interface ChangeLogRecord {
  id: string
  hs_code: string
  origin_country: string | null
  destination_country: string | null
  change_type: string | null
  old_rate: number | null
  new_rate: number | null
  effective_date: string
  source: string
  metadata: Record<string, unknown>
}

interface SubscriptionRule {
  id: string
  user_id: string
  rule_type: string
  rule_config: Record<string, unknown>
  channels: string[]
}

interface NotificationConfig {
  channels: {
    email: { enabled: boolean; address: string | null }
    dingtalk: { enabled: boolean; webhook: string | null; secret: string | null }
    wechat: { enabled: boolean }
    webhook: { enabled: boolean; url: string | null }
  }
}

/** 检查订阅规则是否匹配该变更 */
function matchesRule(ruleConfig: Record<string, unknown>, change: ChangeLogRecord): boolean {
  // 空规则匹配所有变更
  if (!ruleConfig || Object.keys(ruleConfig).length === 0) return true

  // 按规则类型匹配
  if (ruleConfig.hsCode) {
    const pattern = String(ruleConfig.hsCode).replace(/[^0-9]/g, '')
    if (pattern && !change.hs_code.startsWith(pattern)) return false
  }

  if (ruleConfig.originCountry) {
    if (change.origin_country !== String(ruleConfig.originCountry)) return false
  }

  if (ruleConfig.destCountry) {
    if (change.destination_country !== String(ruleConfig.destCountry)) return false
  }

  if (ruleConfig.minChangePercent != null) {
    if (change.old_rate && change.new_rate) {
      const pct = Math.abs(((change.new_rate - change.old_rate) / change.old_rate) * 100)
      if (pct < Number(ruleConfig.minChangePercent)) return false
    }
  }

  return true
}

/** 标记通知事件为已送达 */
async function markDelivered(eventId: string): Promise<void> {
  await supabase
    .from('user_notification_events')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', eventId)
}

/** 标记通知事件为失败 */
async function markFailed(eventId: string, errorMessage: string): Promise<void> {
  await supabase
    .from('user_notification_events')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('id', eventId)
}

/** 生成通知标题 */
function buildTitle(change: ChangeLogRecord): string {
  const oldPct = change.old_rate != null ? (change.old_rate * 100).toFixed(1) + '%' : '?'
  const newPct = change.new_rate != null ? (change.new_rate * 100).toFixed(1) + '%' : '?'
  const origin = change.origin_country ?? '?'
  const dest = change.destination_country ?? '?'

  return `${change.hs_code} (${origin}→${dest}) 税率 ${oldPct}→${newPct}`
}

/**
 * 推送一条变更到所有匹配的订阅用户
 */
async function pushChange(change: ChangeLogRecord): Promise<number> {
  // 查询所有活跃订阅规则
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('id, user_id, rule_type, rule_config, channels')
    .eq('is_active', true)

  if (!subs || subs.length === 0) return 0

  let pushedCount = 0

  for (const sub of subs as SubscriptionRule[]) {
    if (!matchesRule(sub.rule_config, change)) continue

    // 查询用户通知配置
    const { data: configRow } = await supabase
      .from('notification_config')
      .select('channels')
      .eq('user_id', sub.user_id)
      .maybeSingle()

    const config: NotificationConfig = configRow?.channels ?? {
      channels: {
        email: { enabled: false, address: null },
        dingtalk: { enabled: false, webhook: null, secret: null },
        wechat: { enabled: false },
        webhook: { enabled: false, url: null },
      },
    }

    for (const channel of sub.channels) {
      const dedupeKey = `${change.id}:${sub.user_id}:${channel}`

      // 创建通知事件（幂等）
      const { data: event, error } = await supabase
        .from('user_notification_events')
        .upsert({
          user_id: sub.user_id,
          change_id: change.id,
          subscription_id: sub.id,
          channel,
          title: buildTitle(change),
          payload: {
            hsCode: change.hs_code,
            originCountry: change.origin_country,
            destinationCountry: change.destination_country,
            changeType: change.change_type,
            oldRate: change.old_rate,
            newRate: change.new_rate,
            effectiveDate: change.effective_date,
            source: change.source,
          },
          dedupe_key: dedupeKey,
        }, { onConflict: 'dedupe_key' })
        .select('id')
        .single()

      if (error || !event) continue

      // 按渠道发送
      const params = {
        hsCode: change.hs_code,
        originCountry: change.origin_country ?? '',
        destCountry: change.destination_country ?? '',
        changeType: change.change_type ?? '',
        oldRate: change.old_rate ?? 0,
        newRate: change.new_rate ?? 0,
        effectiveDate: change.effective_date,
        source: change.source,
      }

      let sent = false

      switch (channel) {
        case 'email': {
          if (config.channels.email.enabled && config.channels.email.address) {
            const email = buildTariffChangeEmail(params)
            sent = await sendEmail({ to: config.channels.email.address, ...email })
          }
          break
        }
        case 'dingtalk': {
          if (config.channels.dingtalk.enabled && config.channels.dingtalk.webhook) {
            const msg = buildTariffChangeDingTalk(params)
            sent = await sendDingTalk(
              { webhook: config.channels.dingtalk.webhook, secret: config.channels.dingtalk.secret ?? undefined },
              msg,
            )
          }
          break
        }
        case 'wechat': {
          if (config.channels.wechat.enabled) {
            const msg = buildTariffChangeWeChat(params)
            sent = await sendWeChat({ webhook: undefined }, msg)
          }
          break
        }
        case 'webhook': {
          if (config.channels.webhook.enabled && config.channels.webhook.url) {
            const payload = buildTariffChangeWebhook(params)
            sent = await sendWebhook(config.channels.webhook.url, payload)
          }
          break
        }
        case 'system': {
          // system 渠道不在这里发送，扩展端通过 Realtime 订阅
          sent = true
          break
        }
      }

      if (sent) {
        await markDelivered(event.id)
        pushedCount++
      } else if (channel !== 'system') {
        await markFailed(event.id, `${channel} send failed`)
      }
    }
  }

  return pushedCount
}

/**
 * 主入口：推送所有未处理的变更
 */
export async function pushPendingChanges(): Promise<number> {
  // 查询未推送的变更
  const { data: changes, error } = await supabase
    .from('tariff_change_log')
    .select('*')
    .eq('pushed', false)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error || !changes || changes.length === 0) return 0

  logger.info({ count: changes.length }, 'Pushing pending tariff changes')

  let totalPushed = 0

  for (const change of changes as ChangeLogRecord[]) {
    const count = await pushChange(change)
    totalPushed += count

    // 标记为已推送（不论是否有订阅者匹配）
    await supabase
      .from('tariff_change_log')
      .update({ pushed: true })
      .eq('id', change.id)
  }

  logger.info({ totalPushed, changes: changes.length }, 'Push completed')
  return totalPushed
}
