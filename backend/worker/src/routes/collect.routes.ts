import { Hono } from 'hono'

const collect = new Hono()

// 手动触发采集（管理用）
collect.post('/trigger/:source', async (c) => {
  const source = c.req.param('source')
  const mode = c.req.query('mode') ?? 'incremental'

  // TODO: 推送到 BullMQ 队列
  return c.json({ queued: true, source, mode })
})

// 采集状态查询
collect.get('/status', async (c) => {
  // TODO: 从 Redis 读取最近采集记录
  return c.json({ status: 'ok' })
})

export default collect
