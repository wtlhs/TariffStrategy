/**
 * 数据标准化工具 — 采集器共用
 */

/** HS 编码标准化：去非数字，取前 N 位 */
export function normalizeHS(raw: string, digits: 6 | 8 | 10 = 6): string {
  return raw.replace(/[^0-9]/g, '').substring(0, digits)
}

/** 税率标准化：各种格式 → 小数 (0 ~ 1) */
export function normalizeRate(raw: string | number | null | undefined): number {
  if (raw == null) return 0
  if (typeof raw === 'number') return raw > 1 ? raw / 100 : raw

  const trimmed = String(raw).trim()
  if (!trimmed || trimmed === 'Free' || trimmed === 'free' || trimmed === '0' || trimmed === '-') {
    return 0
  }

  const num = parseFloat(trimmed.replace('%', '').replace(',', ''))
  if (isNaN(num)) return 0
  return num > 1 ? num / 100 : num
}

/** ISO 国家代码映射（常见名称 → 两位代码） */
const COUNTRY_CODE_MAP: Record<string, string> = {
  'United States': 'US', 'China': 'CN', 'Germany': 'DE',
  'Japan': 'JP', 'Korea, South': 'KR', 'South Korea': 'KR',
  'Singapore': 'SG', 'Vietnam': 'VN', 'Romania': 'RO',
  'Morocco': 'MA', 'Mexico': 'MX', 'Canada': 'CA',
  'France': 'FR', 'United Kingdom': 'GB', 'India': 'IN',
  'Thailand': 'TH', 'Malaysia': 'MY', 'Indonesia': 'ID',
  'Philippines': 'PH', 'Brazil': 'BR', 'Italy': 'IT',
  'Spain': 'ES', 'Netherlands': 'NL', 'Belgium': 'BE',
  'Australia': 'AU', 'Taiwan': 'TW', 'Hong Kong': 'HK',
}

export function toCountryCode(nameOrCode: string): string {
  const upper = nameOrCode.trim().toUpperCase()
  if (upper.length === 2) return upper
  return COUNTRY_CODE_MAP[nameOrCode] ?? upper.substring(0, 2)
}

/** 生成 dedupe_key（用于 tariff_change_log 的 metadata 去重） */
export function makeDedupeKey(source: string, ...parts: string[]): string {
  return [source, ...parts].filter(Boolean).join(':')
}
