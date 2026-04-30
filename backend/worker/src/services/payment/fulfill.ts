import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'

interface FulfillParams {
  channel: string
  paymentNo: string
}

/**
 * 调用 PostgreSQL RPC 完成订单履行
 * 核心逻辑在数据库函数 fulfill_payment_order 中（单事务、行锁、幂等）
 */
export async function fulfillOrder(orderId: string, params: FulfillParams) {
  const { data, error } = await supabase.rpc('fulfill_payment_order', {
    p_order_id: orderId,
    p_payment_channel: params.channel,
    p_payment_no: params.paymentNo,
    p_paid_at: new Date().toISOString(),
  })

  if (error) {
    logger.error({ orderId, error: error.message }, 'Fulfill order failed')
    throw error
  }

  logger.info({ orderId, idempotent: data.idempotent }, 'Order fulfilled')
  return data
}
