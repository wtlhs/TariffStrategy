/**
 * BullMQ 任务队列 — 采集任务调度
 */
import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { logger } from '../lib/logger.js'
import { config } from '../lib/config.js'

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null })

// 队列定义
export const collectQueue = new Queue('tariff-collect', { connection })

export type CollectJobData = {
  source: 'wits' | 'us-hts' | 'ustr' | 'federal-register' | 'eu-taric' | 'yale-budget' | 'drewry'
  mode: 'full' | 'incremental'
  params?: Record<string, string>
}

// 采集处理器映射（延迟加载）
const handlers: Record<string, (mode: 'full' | 'incremental') => Promise<number>> = {}

export function registerHandler(
  source: string,
  handler: (mode: 'full' | 'incremental') => Promise<number>,
) {
  handlers[source] = handler
}

// Worker
export function startCollectWorker() {
  const worker = new Worker<CollectJobData>('tariff-collect', async (job: Job<CollectJobData>) => {
    const { source, mode } = job.data
    const handler = handlers[source]

    if (!handler) {
      throw new Error(`No handler registered for source: ${source}`)
    }

    logger.info({ job: job.id, source, mode }, 'Collect job started')

    const count = await handler(mode)

    logger.info({ job: job.id, source, mode, count }, 'Collect job completed')
    return { source, mode, count }
  }, {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 60000 },
  })

  worker.on('failed', (job, err) => {
    logger.error({ job: job?.id, source: job?.data.source, error: err.message }, 'Collect job failed')
  })

  worker.on('completed', (job) => {
    logger.info({ job: job?.id, source: job?.data.source }, 'Collect job completed')
  })

  return worker
}

// 便捷入队方法
export async function enqueueCollect(
  source: CollectJobData['source'],
  mode: CollectJobData['mode'] = 'incremental',
  params?: Record<string, string>,
) {
  return collectQueue.add(`${source}-${mode}`, { source, mode, params }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  })
}
