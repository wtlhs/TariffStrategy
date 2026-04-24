export interface Country {
  code: string
  name: string
  nameEn: string
  flag: string
}

export const COUNTRIES: Country[] = [
  { code: 'CN', name: '中国', nameEn: 'China', flag: '🇨🇳' },
  { code: 'DE', name: '德国', nameEn: 'Germany', flag: '🇩🇪' },
  { code: 'KR', name: '韩国', nameEn: 'South Korea', flag: '🇰🇷' },
  { code: 'RO', name: '罗马尼亚', nameEn: 'Romania', flag: '🇷🇴' },
  { code: 'US', name: '美国', nameEn: 'United States', flag: '🇺🇸' },
  { code: 'MA', name: '摩洛哥', nameEn: 'Morocco', flag: '🇲🇦' },
  { code: 'MX', name: '墨西哥', nameEn: 'Mexico', flag: '🇲🇽' },
  { code: 'JP', name: '日本', nameEn: 'Japan', flag: '🇯🇵' },
  { code: 'SG', name: '新加坡', nameEn: 'Singapore', flag: '🇸🇬' },
  { code: 'VN', name: '越南', nameEn: 'Vietnam', flag: '🇻🇳' },
  { code: 'CL', name: '智利', nameEn: 'Chile', flag: '🇨🇱' },
  { code: 'HK', name: '中国香港', nameEn: 'Hong Kong', flag: '🇭🇰' },
  { code: 'CA', name: '加拿大', nameEn: 'Canada', flag: '🇨🇦' },
  { code: 'FR', name: '法国', nameEn: 'France', flag: '🇫🇷' },
  { code: 'GB', name: '英国', nameEn: 'United Kingdom', flag: '🇬🇧' },
  { code: 'IN', name: '印度', nameEn: 'India', flag: '🇮🇳' },
]

/** 目的地国家（当前仅支持美国） */
export const DESTINATION_COUNTRIES: Country[] = [
  COUNTRIES.find(c => c.code === 'US')!,
]

/** 发货国家（排除目的地） */
export const ORIGIN_COUNTRIES = COUNTRIES.filter(c => c.code !== 'US')

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code)
}
