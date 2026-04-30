/**
 * 邮件通知服务
 *
 * 使用 SMTP / 阿里云邮件推送 / Resend 等
 * 初期用简单的 fetch 调用，后续可替换为 SDK
 */
import { logger } from '../../lib/logger.js'

interface EmailPayload {
  to: string
  subject: string
  body: string
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  // TODO: 接入实际邮件服务
  // 可选方案：
  // 1. Resend (https://resend.com) — 个人免费 100 封/天
  // 2. 阿里云邮件推送
  // 3. Nodemailer + SMTP

  logger.info({ to: payload.to, subject: payload.subject }, 'Email notification (mock)')
  return true
}

export function buildTariffChangeEmail(params: {
  hsCode: string
  originCountry: string
  destCountry: string
  oldRate: number
  newRate: number
  effectiveDate: string
  source: string
}): { subject: string; body: string } {
  const direction = params.newRate > params.oldRate ? '上涨' : '下降'
  const oldPct = (params.oldRate * 100).toFixed(1)
  const newPct = (params.newRate * 100).toFixed(1)

  return {
    subject: `税率变化提醒: ${params.hsCode} ${direction}至 ${newPct}%`,
    body: [
      `HS编码: ${params.hsCode}`,
      `路线: ${params.originCountry} → ${params.destCountry}`,
      `原税率: ${oldPct}%`,
      `新税率: ${newPct}%`,
      `生效日期: ${params.effectiveDate}`,
      `数据来源: ${params.source}`,
      '',
      '请登录税率政策工具查看详细影响分析。',
    ].join('\n'),
  }
}
