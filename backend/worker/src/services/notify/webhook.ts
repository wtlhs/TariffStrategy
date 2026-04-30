/**
 * 自定义 Webhook 通知
 */
import { logger } from '../../lib/logger.js'

export async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      logger.warn({ status: response.status, url }, 'Webhook send failed')
      return false
    }

    return true
  } catch (err: any) {
    logger.error({ err: err.message, url }, 'Webhook send error')
    return false
  }
}

export function buildTariffChangeWebhook(params: {
  hsCode: string
  originCountry: string
  destCountry: string
  changeType: string
  oldRate: number
  newRate: number
  effectiveDate: string
  source: string
}): Record<string, unknown> {
  return {
    event: 'tariff_change',
    data: {
      hsCode: params.hsCode,
      originCountry: params.originCountry,
      destinationCountry: params.destCountry,
      changeType: params.changeType,
      oldRate: params.oldRate,
      newRate: params.newRate,
      effectiveDate: params.effectiveDate,
      source: params.source,
      timestamp: new Date().toISOString(),
    },
  }
}
