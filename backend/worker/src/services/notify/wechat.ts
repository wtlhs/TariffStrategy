/**
 * 企业微信 Webhook 通知
 */
import { logger } from '../../lib/logger.js'

interface WeChatConfig {
  webhook?: string
}

interface WeChatMessage {
  msgtype: 'text' | 'markdown'
  text?: { content: string }
  markdown?: { content: string }
}

export async function sendWeChat(config: WeChatConfig, message: WeChatMessage): Promise<boolean> {
  if (!config.webhook) return false

  try {
    const response = await fetch(config.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000),
    })

    const result = await response.json() as { errcode: number; errmsg: string }

    if (result.errcode !== 0) {
      logger.warn({ errcode: result.errcode, errmsg: result.errmsg }, 'WeChat Work send failed')
      return false
    }

    return true
  } catch (err: any) {
    logger.error({ err: err.message }, 'WeChat Work send error')
    return false
  }
}

export function buildTariffChangeWeChat(params: {
  hsCode: string
  originCountry: string
  destCountry: string
  oldRate: number
  newRate: number
  effectiveDate: string
}): WeChatMessage {
  const oldPct = (params.oldRate * 100).toFixed(1)
  const newPct = (params.newRate * 100).toFixed(1)

  return {
    msgtype: 'markdown',
    markdown: {
      content: [
        `### 税率变化提醒`,
        `> HS编码: ${params.hsCode}`,
        `> 路线: ${params.originCountry} → ${params.destCountry}`,
        `> 原税率: ${oldPct}% → 新税率: ${newPct}%`,
        `> 生效日期: ${params.effectiveDate}`,
      ].join('\n'),
    },
  }
}
