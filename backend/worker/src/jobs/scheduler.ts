import cron from 'node-cron'
import { logger } from '../lib/logger.js'
import { enqueueCollect } from './queue.js'
import { supabase } from '../lib/supabase.js'
import { pushPendingChanges } from '../services/notify/index.js'

export function startCronJobs() {
  // ==================== 数据采集 ====================

  // 每 30 分钟清理过期订单
  cron.schedule('*/30 * * * *', async () => {
    try {
      const { count } = await supabase
        .from('payment_orders')
        .update({ status: 'expired' })
        .eq('status', 'pending')
        .lt('expired_at', new Date().toISOString())

      if (count && count > 0) {
        logger.info({ expiredOrders: count }, 'Expired pending orders cleaned')
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Order expiry cleanup failed')
    }
  })

  // 每周日凌晨 2:00 — WITS 全量同步
  cron.schedule('0 2 * * 0', () => {
    logger.info('Triggering WITS full sync')
    enqueueCollect('wits', 'full')
  })

  // 每月 1 日 3:00 — HTS 全量更新
  cron.schedule('0 3 1 * *', () => {
    logger.info('Triggering US HTS full import')
    enqueueCollect('us-hts', 'full')
  })

  // 每日 6:00 — Section 301 变化检测
  cron.schedule('0 6 * * *', () => {
    logger.info('Triggering USTR incremental check')
    enqueueCollect('ustr', 'incremental')
  })

  // 每日 6:30 — AD/CVD 新裁决
  cron.schedule('30 6 * * *', () => {
    logger.info('Triggering Federal Register check')
    enqueueCollect('federal-register', 'incremental')
  })

  // 每日 7:00 — Yale Budget Lab 变化检测
  cron.schedule('0 7 * * *', () => {
    logger.info('Triggering Yale Budget Lab check')
    enqueueCollect('yale-budget', 'incremental')
  })

  // ==================== 通知推送 ====================

  // 每 2 小时 — 推送未推送的税率变更
  cron.schedule('0 */2 * * *', async () => {
    try {
      const count = await pushPendingChanges()
      if (count > 0) {
        logger.info({ notificationsPushed: count }, 'Notification push cycle completed')
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Notification push failed')
    }
  })

  logger.info('Cron jobs started (order expiry, data collection, notification push)')
}
