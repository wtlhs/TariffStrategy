import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'

const admin = new Hono()

// 健康检查
admin.get('/health', async (c) => {
  const { error } = await supabase.from('tariff_dict').select('id').limit(1)
  return c.json({
    status: error ? 'degraded' : 'ok',
    database: error ? 'disconnected' : 'connected',
    timestamp: new Date().toISOString(),
  })
})

// 统计信息
admin.get('/stats', async (c) => {
  const [dict, subCodes, s301, orders] = await Promise.all([
    supabase.from('tariff_dict').select('id', { count: 'exact', head: true }),
    supabase.from('tariff_sub_codes').select('id', { count: 'exact', head: true }),
    supabase.from('section_301_rates').select('id', { count: 'exact', head: true }),
    supabase.from('payment_orders').select('id', { count: 'exact', head: true }),
  ])

  return c.json({
    tariffDict: dict.count ?? 0,
    tariffSubCodes: subCodes.count ?? 0,
    section301Rates: s301.count ?? 0,
    paymentOrders: orders.count ?? 0,
  })
})

export default admin
