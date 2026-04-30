/**
 * 钉钉机器人 Webhook 通知
 */
import { logger } from '../../lib/logger.js'

interface DingTalkConfig {
  webhook: string
  secret?: string
}

interface DingTalkMessage {
  msgtype: 'text' | 'markdown'
  text?: { content: string }
  markdown?: { title: string; text: string }
}

export async function sendDingTalk(config: DingTalkConfig, message: DingTalkMessage): Promise<boolean> {
  let url = config.webhook

  // 如果配置了签名，计算 sign 参数
  if (config.secret) {
    const timestamp = Date.now()
    const stringToSign = `${timestamp}\n${config.secret}`
    // Node.js 18+ 内置 crypto
    const { createHmac } = await import('crypto')
    const hmac = createHmac('sha256', config.secret)
    hmac.update(stringToSign)
    const sign = encodeURIComponent(hmac.digest('base64'))
    url += `&timestamp=${timestamp}&sign=${sign}`
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000),
    })

    const result = await response.json() as { errcode: number; errmsg: string }

    if (result.errcode !== 0) {
      logger.warn({ errcode: result.errcode, errmsg: result.errmsg }, 'DingTalk send failed')
      return false
    }

    return true
  } catch (err: any) {
    logger.error({ err: err.message }, 'DingTalk send error')
    return false
  }
}

export function buildTariffChangeDingTalk(params: {
  hsCode: string
  originCountry: string
  destCountry: string
  oldRate: number
  newRate: number
  effectiveDate: string
}): DingTalkMessage {
  const oldPct = (params.oldRate * 100).toFixed(1)
  const newPct = (params.newRate * 100).toFixed(1)

  return {
    msgtype: 'markdown',
    markdown: {
      title: `税率变化: ${params.hsCode}`,
      text: [
        `### 税率变化提醒`,
        `- **HS编码**: ${params.hsCode}`,
        `- **路线**: ${params.originCountry} → ${params.destCountry}`,
        `- **原税率**: ${oldPct}%`,
        `- **新税率**: ${newPct}%`,
        `- **生效日期**: ${params.effectiveDate}`,
      ].join('\n\n'),
    },
  }
}
