function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value
}

export const config = {
  port: parseInt(process.env.PORT ?? '3002', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  wechat: {
    appId: process.env.WECHAT_APP_ID ?? '',
    mchId: process.env.WECHAT_MCH_ID ?? '',
    apiKeyV3: process.env.WECHAT_API_KEY_V3 ?? '',
    serialNo: process.env.WECHAT_SERIAL_NO ?? '',
    privateKeyPath: process.env.WECHAT_PRIVATE_KEY_PATH ?? '',
    notifyUrl: (process.env.WORKER_BASE_URL ?? 'http://localhost:3002') + '/api/payments/wechat/notify',
  },

  alipay: {
    appId: process.env.ALIPAY_APP_ID ?? '',
    privateKeyPath: process.env.ALIPAY_PRIVATE_KEY_PATH ?? '',
    publicKeyPath: process.env.ALIPAY_PUBLIC_KEY_PATH ?? '',
    notifyUrl: (process.env.WORKER_BASE_URL ?? 'http://localhost:3002') + '/api/payments/alipay/notify',
  },
} as const
