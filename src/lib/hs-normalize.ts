import type { TariffDictEntry } from '@/types'

/** 去除非数字字符，取前 N 位 */
export function normalizeHS(raw: string, digits: 6 | 8 | 10 = 6): string {
  const d = raw.replace(/[^0-9]/g, '')
  return d.substring(0, digits)
}

/** 从字典中模糊搜索 HS 编码或关键词 */
export function searchDict(
  query: string,
  dict: TariffDictEntry[],
  limit: number = 20,
): TariffDictEntry[] {
  const q = query.toLowerCase().trim()
  if (!q) return dict.slice(0, limit)

  return dict
    .filter((e) => {
      const digits = q.replace(/[^0-9]/g, '')
      if (digits.length >= 2 && e.hs6.includes(digits)) return true
      if (e.nameZh.includes(q) || e.nameEn.toLowerCase().includes(q)) return true
      if (e.keywords.some((k) => k.toLowerCase().includes(q))) return true
      if (e.subCodes.some((s) => s.descriptionZh.includes(q) || s.descriptionEn.toLowerCase().includes(q))) return true
      return false
    })
    .slice(0, limit)
}
