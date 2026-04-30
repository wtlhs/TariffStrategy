import { Hono } from 'hono'

const notify = new Hono()

// 手动触发推送
notify.post('/push-pending', async (c) => {
  // TODO: 推送 tariff_change_log 中未推送的记录
  return c.json({ status: 'ok' })
})

export default notify
