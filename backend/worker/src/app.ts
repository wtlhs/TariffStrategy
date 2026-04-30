import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { logger } from './lib/logger.js'
import { config } from './lib/config.js'

// 路由
import paymentRoutes from './routes/payment.routes.js'
import collectRoutes from './routes/collect.routes.js'
import notifyRoutes from './routes/notify.routes.js'
import adminRoutes from './routes/admin.routes.js'

const app = new Hono()

// 中间件
app.use('*', honoLogger())
app.use('*', cors({
  origin: ['chrome-extension://*', 'https://pay.tarifftool.com', 'http://localhost:*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'apikey'],
}))

// 路由注册
app.route('/api/payments', paymentRoutes)
app.route('/api/collect', collectRoutes)
app.route('/api/notify', notifyRoutes)
app.route('/api/admin', adminRoutes)

// 根路径
app.get('/', (c) => c.json({ name: 'tariff-worker', version: '1.0.0' }))

// 启动
const port = config.port

if (config.nodeEnv !== 'test') {
  // 注册采集器到 BullMQ 队列
  import('./jobs/queue.js').then(({ registerHandler, startCollectWorker }) => {
    import('./services/collect/wits.js').then(({ collectWITS }) => registerHandler('wits', collectWITS))
    import('./services/collect/ushts.js').then(({ collectUSHTS }) => registerHandler('us-hts', collectUSHTS))
    import('./services/collect/ustr.js').then(({ collectUSTR }) => registerHandler('ustr', collectUSTR))
    import('./services/collect/federal-register.js').then(({ collectFederalRegister }) =>
      registerHandler('federal-register', collectFederalRegister))
    import('./services/collect/yale-budget.js').then(({ collectYaleBudget }) =>
      registerHandler('yale-budget', collectYaleBudget))

    startCollectWorker()
  })

  // 启动定时任务
  import('./jobs/scheduler.js').then(({ startCronJobs }) => {
    startCronJobs()
  })
}

export default {
  port,
  fetch: app.fetch,
}

logger.info({ port, env: config.nodeEnv }, 'Tariff Worker starting')
