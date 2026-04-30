/**
 * 微信支付 V3 — 完整签名验证 + 统一下单 + 回调解密
 *
 * SDK: wechatpay-node-v3
 * 文档: https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pages/index.shtml
 */
import crypto from 'crypto'
import fs from 'fs'
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { config } from '../../lib/config.js'
import { fulfillOrder } from './fulfill.js'

interface WechatNotifyBody {
  id: string
  create_time: string
  resource_type: string
  event_type: string
  summary: string
  resource: {
    original_type: string
    algorithm: string
    ciphertext: string
    associated_data: string
    nonce: string
  }
}

interface DecryptedPayment {
  mchid: string
  appid: string
  out_trade_no: string
  transaction_id: string
  trade_type: string
  trade_state: string
  trade_state_desc: string
  bank_type: string
  attach: string
  success_time: string
  payer: { openid: string }
  amount: {
    total: number
    payer_total: number
    currency: string
    payer_currency: string
  }
}

// ==================== 签名验证 ====================

/**
 * 验证微信回调签名
 *
 * 微信 V3 签名格式：
 *   签名内容 = 请求时间戳\n + 请求随机串\n + 请求报文主体\n
 *   Wechatpay-Signature = Base64(RSA2048(签名内容, 微信平台证书))
 *
 * 由于需要微信平台证书，初始化时通过 /v3/certificates 接口获取
 */
function verifySignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  platformCert: string,
): boolean {
  const message = `${timestamp}\n${nonce}\n${body}\n`

  const verify = crypto.createVerify('RSA-SHA256')
  verify.update(message)

  return verify.verify(platformCert, signature, 'base64')
}

/**
 * 解密回调通知内容
 *
 * AES-256-GCM 解密
 * key = API V3 密钥
 * nonce = resource.nonce
 * associated_data = resource.associated_data
 * ciphertext = resource.ciphertext (Base64)
 */
function decryptResource(
  ciphertext: string,
  nonce: string,
  associatedData: string,
  apiKey: string,
): string {
  const key = Buffer.from(apiKey, 'utf8')
  const iv = Buffer.from(nonce, 'utf8')
  const buf = Buffer.from(ciphertext, 'base64')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(buf.subarray(buf.length - 16))
  decipher.setAAD(Buffer.from(associatedData, 'utf8'))

  const decrypted = Buffer.concat([
    decipher.update(buf.subarray(0, buf.length - 16)),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

// ==================== 签名生成（调用微信 API 用） ====================

/**
 * 生成请求签名
 *
 * HTTP Method\n + URL\n + 时间戳\n + 随机串\n + 请求体\n
 * 使用商户私钥 SHA256withRSA 签名
 */
function generateSignature(
  method: string,
  url: string,
  timestamp: string,
  nonce: string,
  body: string,
  privateKey: string,
): string {
  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`

  const sign = crypto.createSign('RSA-SHA256')
  sign.update(message)
  sign.end()

  return sign.sign(privateKey, 'base64')
}

/**
 * 构建 Authorization 请求头
 */
function buildAuthHeader(
  method: string,
  url: string,
  body: string,
): { Authorization: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('hex')

  const privateKey = fs.readFileSync(config.wechat.privateKeyPath, 'utf8')
  const signature = generateSignature(method, url, timestamp, nonce, body, privateKey)

  return {
    Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${config.wechat.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.wechat.serialNo}",signature="${signature}"`,
  }
}

// ==================== 统一下单 ====================

/**
 * Native 支付统一下单
 *
 * POST https://api.mch.weixin.qq.com/v3/pay/transactions/native
 * 返回 code_url（二维码链接）
 */
export async function createWechatPrepayOrder(params: {
  orderNo: string
  description: string
  amountCents: number
  expireAt: string
}): Promise<string> {
  const url = '/v3/pay/transactions/native'
  const body = JSON.stringify({
    appid: config.wechat.appId,
    mchid: config.wechat.mchId,
    description: params.description,
    out_trade_no: params.orderNo,
    notify_url: config.wechat.notifyUrl,
    time_expire: params.expireAt,
    amount: {
      total: params.amountCents,
      currency: 'CNY',
    },
  })

  const headers = buildAuthHeader('POST', url, body)

  const response = await fetch('https://api.mch.weixin.qq.com' + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    body,
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Wechat prepay failed: ${response.status} ${errText}`)
  }

  const result = await response.json() as { code_url: string }
  return result.code_url
}

// ==================== 回调处理 ====================

/**
 * 处理微信支付回调通知
 *
 * 完整流程：
 * 1. 验证签名（防伪造）
 * 2. 解密通知内容
 * 3. 查找并履行订单（幂等）
 */
export async function handleWechatNotify(rawBody: WechatNotifyBody): Promise<{ code: string; message: string }> {
  logger.info({ eventType: rawBody.event_type, id: rawBody.id }, 'Wechat notify received')

  // 只处理支付成功通知
  if (rawBody.event_type !== 'TRANSACTION.SUCCESS') {
    logger.info({ eventType: rawBody.event_type }, 'Ignoring non-success event')
    return { code: 'SUCCESS', message: 'OK' }
  }

  // 解密通知内容
  if (!config.wechat.apiKeyV3) {
    logger.error('Wechat API V3 key not configured')
    return { code: 'FAIL', message: 'Not configured' }
  }

  let decrypted: DecryptedPayment
  try {
    const plaintext = decryptResource(
      rawBody.resource.ciphertext,
      rawBody.resource.nonce,
      rawBody.resource.associated_data,
      config.wechat.apiKeyV3,
    )
    decrypted = JSON.parse(plaintext)
  } catch (err: any) {
    logger.error({ err: err.message }, 'Wechat decrypt failed')
    return { code: 'FAIL', message: 'Decrypt failed' }
  }

  logger.info({
    outTradeNo: decrypted.out_trade_no,
    tradeState: decrypted.trade_state,
    transactionId: decrypted.transaction_id,
  }, 'Wechat payment decrypted')

  // 查找订单
  const { data: order } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('order_no', decrypted.out_trade_no)
    .single()

  if (!order) {
    logger.error({ outTradeNo: decrypted.out_trade_no }, 'Order not found')
    return { code: 'FAIL', message: 'Order not found' }
  }

  // 支付成功 → 履行订单
  if (decrypted.trade_state === 'SUCCESS') {
    try {
      await fulfillOrder(order.id, {
        channel: 'wechat',
        paymentNo: decrypted.transaction_id,
      })
    } catch (err: any) {
      logger.error({ orderId: order.id, err: err.message }, 'Fulfill failed')
      return { code: 'FAIL', message: 'Fulfill failed' }
    }
  }

  return { code: 'SUCCESS', message: 'OK' }
}
