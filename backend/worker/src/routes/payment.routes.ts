import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'
import { logger } from '../lib/logger.js'
import { handleWechatNotify } from '../services/payment/wechat.pay.js'
import { handleAlipayNotify } from '../services/payment/alipay.js'

const payment = new Hono()

// 微信支付回调
payment.post('/wechat/notify', async (c) => {
  const body = await c.req.json()

  try {
    const result = await handleWechatNotify(body)
    return c.json(result)
  } catch (err: any) {
    logger.error({ err: err.message }, 'Wechat notify failed')
    return c.json({ code: 'FAIL', message: err.message }, 500)
  }
})

// 支付宝回调
payment.post('/alipay/notify', async (c) => {
  const params = await c.req.parseBody()

  try {
    const result = await handleAlipayNotify(Object.fromEntries(
      Object.entries(params as Record<string, unknown>)
        .map(([k, v]) => [k, String(v)])
    ) as any)
    return c.text(result)
  } catch (err: any) {
    logger.error({ err: err.message }, 'Alipay notify failed')
    return c.text('fail', 500)
  }
})

// Stripe Webhook（预留）
payment.post('/stripe/webhook', async (c) => {
  return c.json({ received: true })
})

// 手动触发订单过期清理
payment.post('/expire-pending', async (c) => {
  const { data, error } = await supabase
    .from('payment_orders')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expired_at', new Date().toISOString())
    .select('id')

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ expired: data?.length ?? 0 })
})

export default payment
