import crypto from 'crypto'
import fs from 'fs'
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { config } from '../../lib/config.js'
import { fulfillOrder } from './fulfill.js'

interface AlipayNotifyParams {
  out_trade_no: string
  trade_no: string
  trade_status: string
  total_amount: string
  buyer_id: string
  gmt_payment: string
  notify_type: string
  notify_id: string
  sign_type: string
  sign: string
  [key: string]: string
}

// ==================== 签名验证 ====================

function verifyNotifySign(params: AlipayNotifyParams): boolean {
  const publicKeyPath = config.alipay.publicKeyPath
  if (!publicKeyPath) {
    logger.error('Alipay public key not configured')
    return false
  }

  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '')
    .sort()

  const signContent = sortedKeys
    .map(k => `${k}=${params[k]}`)
    .join('&')

  let publicKey: string
  try {
    const raw = fs.readFileSync(publicKeyPath, 'utf8')
    if (raw.includes('-----BEGIN')) {
      publicKey = raw
    } else {
      publicKey = `-----BEGIN PUBLIC KEY-----\n${raw}\n-----END PUBLIC KEY-----`
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ path: publicKeyPath, err: msg }, 'Failed to read Alipay public key')
    return false
  }

  const verify = crypto.createVerify('RSA-SHA256')
  verify.update(signContent, 'utf8')
  verify.end()

  return verify.verify(publicKey, params.sign, 'base64')
}

// ==================== 统一下单 ====================

export async function createAlipayPrepayOrder(params: {
  orderNo: string
  subject: string
  amountYuan: string
  timeout: string
}): Promise<string> {
  const privateKeyPath = config.alipay.privateKeyPath
  if (!privateKeyPath) {
    throw new Error('Alipay private key not configured')
  }

  const bizContent = JSON.stringify({
    out_trade_no: params.orderNo,
    total_amount: params.amountYuan,
    subject: params.subject,
    timeout_express: params.timeout,
  })

  const requestParams: Record<string, string> = {
    app_id: config.alipay.appId,
    method: 'alipay.trade.precreate',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatAlipayTimestamp(new Date()),
    version: '1.0',
    notify_url: config.alipay.notifyUrl,
    biz_content: bizContent,
  }

  const sign = signAlipayRequest(requestParams, privateKeyPath)
  requestParams.sign = sign

  const formData = new URLSearchParams(requestParams)

  const response = await fetch('https://openapi.alipay.com/gateway.do', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`Alipay precreate failed: ${response.status}`)
  }

  const result = await response.json() as Record<string, unknown>
  const resp = result?.alipay_trade_precreate_response as Record<string, unknown> | undefined

  if (!resp || resp.code !== '10000') {
    throw new Error(`Alipay error: ${resp?.code} ${resp?.msg} ${resp?.sub_msg ?? ''}`)
  }

  return resp.qr_code as string
}

function signAlipayRequest(
  params: Record<string, string>,
  privateKeyPath: string,
): string {
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8')

  const sortedKeys = Object.keys(params)
    .filter(k => params[k] !== '' && params[k] !== undefined)
    .sort()

  const signContent = sortedKeys
    .map(k => `${k}=${params[k]}`)
    .join('&')

  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signContent, 'utf8')
  sign.end()

  return sign.sign(privateKey, 'base64')
}

function formatAlipayTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// ==================== 回调处理 ====================

export async function handleAlipayNotify(params: AlipayNotifyParams): Promise<string> {
  logger.info({
    outTradeNo: params.out_trade_no,
    tradeStatus: params.trade_status,
    tradeNo: params.trade_no,
  }, 'Alipay notify received')

  if (!verifyNotifySign(params)) {
    logger.error('Alipay signature verification failed')
    return 'fail'
  }

  if (params.trade_status !== 'TRADE_SUCCESS' && params.trade_status !== 'TRADE_FINISHED') {
    return 'success'
  }

  const { data: order } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('order_no', params.out_trade_no)
    .single()

  if (!order) {
    logger.error({ outTradeNo: params.out_trade_no }, 'Order not found')
    return 'fail'
  }

  try {
    await fulfillOrder(order.id, {
      channel: 'alipay',
      paymentNo: params.trade_no,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ orderId: order.id, err: msg }, 'Fulfill failed')
    return 'fail'
  }

  return 'success'
}
