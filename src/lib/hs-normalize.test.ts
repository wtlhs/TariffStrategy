import { describe, it, expect } from 'vitest'
import { normalizeHS, searchDict } from './hs-normalize'
import type { TariffDictEntry } from '@/types'

const MOCK_DICT: TariffDictEntry[] = [
  {
    hs6: '848210',
    nameZh: '滚珠轴承',
    nameEn: 'Ball bearings',
    keywords: ['bearing', '轴承'],
    subCodes: [
      {
        code: '8482.10.10.00',
        descriptionZh: '滚珠轴承',
        descriptionEn: 'Ball bearings',
        mfnRate: 0.08,
      },
    ],
  },
  {
    hs6: '847130',
    nameZh: '便携式自动数据处理设备',
    nameEn: 'Portable automatic data processing machines',
    keywords: ['laptop', 'computer', '电脑', '笔记本'],
    subCodes: [
      {
        code: '8471.30.01.00',
        descriptionZh: '笔记本电脑',
        descriptionEn: 'Laptop computers',
        mfnRate: 0,
      },
    ],
  },
]

describe('normalizeHS', () => {
  it('should normalize standard 10-digit code to 6 digits', () => {
    expect(normalizeHS('8482.10.10.00')).toBe('848210')
  })

  it('should normalize plain digits to 6 digits', () => {
    expect(normalizeHS('8482101000')).toBe('848210')
  })

  it('should handle input with spaces', () => {
    expect(normalizeHS('8482 10 10 00')).toBe('848210')
  })

  it('should handle 8-digit output', () => {
    expect(normalizeHS('8482.10.10.00', 8)).toBe('84821010')
  })

  it('should handle 10-digit output', () => {
    expect(normalizeHS('8482.10.10.00', 10)).toBe('8482101000')
  })

  it('should return empty string for non-numeric input', () => {
    expect(normalizeHS('abc')).toBe('')
  })

  it('should handle empty string', () => {
    expect(normalizeHS('')).toBe('')
  })

  it('should handle short input', () => {
    expect(normalizeHS('84')).toBe('84')
  })
})

describe('searchDict', () => {
  it('should find by HS6 code', () => {
    const results = searchDict('848210', MOCK_DICT)
    expect(results).toHaveLength(1)
    expect(results[0].hs6).toBe('848210')
  })

  it('should find by partial HS code', () => {
    const results = searchDict('8482', MOCK_DICT)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('should find by Chinese name', () => {
    const results = searchDict('轴承', MOCK_DICT)
    expect(results).toHaveLength(1)
    expect(results[0].hs6).toBe('848210')
  })

  it('should find by English name (case insensitive)', () => {
    const results = searchDict('ball', MOCK_DICT)
    expect(results).toHaveLength(1)
    expect(results[0].hs6).toBe('848210')
  })

  it('should find by keyword', () => {
    const results = searchDict('laptop', MOCK_DICT)
    expect(results).toHaveLength(1)
    expect(results[0].hs6).toBe('847130')
  })

  it('should return limited results', () => {
    const results = searchDict('', MOCK_DICT, 1)
    expect(results).toHaveLength(1)
  })

  it('should return all entries for empty query (up to limit)', () => {
    const results = searchDict('', MOCK_DICT)
    expect(results).toHaveLength(2)
  })

  it('should return empty for no match', () => {
    const results = searchDict('zzzznoexist', MOCK_DICT)
    expect(results).toHaveLength(0)
  })
})
