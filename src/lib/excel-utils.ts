/**
 * Excel 工具 — 数据导出/导入/批量报告
 */

import * as XLSX from 'xlsx'
import { SAMPLE_SECTION301, SAMPLE_MFN_RATES, SAMPLE_AD_CVD, SAMPLE_SECTION232, SAMPLE_RECIPROCAL } from '@/lib/mock-data'
import type { BatchResult, BatchResultRow } from './batch-engine'

// ============================================================
// 数据中心导出
// ============================================================

/** 将数据中心所有税率表导出为 xlsx */
export function exportTariffData(): void {
  const wb = XLSX.utils.book_new()

  const s301Data = SAMPLE_SECTION301.map((r) => ({
    '法律依据': r.legalBasis, '国家': r.country, '税率范围': r.rateRange,
    '最低税率%': r.min, '最高税率%': r.max, '覆盖产品': r.products, '生效日期': r.effectiveDate,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s301Data), 'Section 301')

  const mfnData = SAMPLE_MFN_RATES.map((r) => ({
    'HS章': r.hsChapter, 'HS编码': r.hsCode, '描述': r.description, 'MFN税率': r.rate,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mfnData), 'MFN税率')

  const adCvdData = SAMPLE_AD_CVD.map((r) => ({
    'HS编码': r.hsCode, '描述': r.description, '目标国': r.target,
    '税率范围': r.rate, '状态': r.active ? '生效中' : '已撤销',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(adCvdData), 'AD_CVD')

  const s232Data = SAMPLE_SECTION232.map((r) => ({
    '国家': r.country, '法律依据': r.legalBasis, '税率范围': r.rateRange,
    '覆盖产品': r.products, '生效日期': r.effectiveDate,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s232Data), 'Section 232')

  const reciprocalData = SAMPLE_RECIPROCAL.map((r) => ({
    '国家': r.country, '法律依据': r.legalBasis, '税率范围': r.rateRange,
    '覆盖产品': r.products, '生效日期': r.effectiveDate,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reciprocalData), 'IEEPA历史')

  const dateStr = formatDate(new Date())
  XLSX.writeFile(wb, `税率数据_${dateStr}.xlsx`)
}

/** 导入 xlsx 文件，解析税率数据 */
export async function importTariffData(file: File): Promise<{ sheetCount: number; rowCount: number; sheets: string[] }> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheets = wb.SheetNames
  let totalRows = 0
  for (const name of sheets) {
    const ws = wb.Sheets[name]
    if (!ws) continue
    totalRows += XLSX.utils.sheet_to_json(ws).length
  }
  return { sheetCount: sheets.length, rowCount: totalRows, sheets }
}

// ============================================================
// 批量导入模板下载
// ============================================================

/** 下载标准批量测算导入模板 */
export function downloadBatchTemplate(): void {
  const wb = XLSX.utils.book_new()

  // 模板数据（3 行示例）
  const templateData = [
    {
      'SKU编号': 'SKU-001',
      '产品名称': '滚珠轴承',
      'HS编码': '8482.10',
      '原产地': 'CN',
      '货值(USD)': 50000,
      '运费(USD)': 2400,
      '运输方式': 'ocean',
      '入境日期': '2026-04-15',
      '备注': '示例数据，请替换',
    },
    {
      'SKU编号': 'SKU-002',
      '产品名称': '电动机',
      'HS编码': '8501.10',
      '原产地': 'KR',
      '货值(USD)': 30000,
      '运费(USD)': 2500,
      '运输方式': 'ocean',
      '入境日期': '2026-04-15',
      '备注': 'KORUS FTA',
    },
    {
      'SKU编号': 'SKU-003',
      '产品名称': 'LED 灯具',
      'HS编码': '9405.40',
      '原产地': 'VN',
      '货值(USD)': 40000,
      '运费(USD)': 2400,
      '运输方式': 'ocean',
      '入境日期': '2026-04-15',
      '备注': '',
    },
  ]

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateData), '批量测算模板')

  // 说明 Sheet
  const instructions = [
    { '字段': 'SKU编号', '是否必填': '选填', '说明': 'SKU 或产品编号，不填则自动生成' },
    { '字段': '产品名称', '是否必填': '选填', '说明': '产品中文名称' },
    { '字段': 'HS编码', '是否必填': '必填', '说明': '4-10 位 HS/HTS 编码，如 8482.10' },
    { '字段': '原产地', '是否必填': '必填', '说明': 'ISO 2 字母代码，如 CN、KR、MX' },
    { '字段': '货值(USD)', '是否必填': '必填', '说明': '美元金额，不含运费' },
    { '字段': '运费(USD)', '是否必填': '选填', '说明': '美元运费，默认 $2,400' },
    { '字段': '运输方式', '是否必填': '选填', '说明': 'ocean / air / rail / land，默认 ocean' },
    { '字段': '入境日期', '是否必填': '选填', '说明': 'YYYY-MM-DD 格式，默认当天' },
    { '字段': '备注', '是否必填': '选填', '说明': '自由备注' },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instructions), '填写说明')

  // 原产地代码参考
  const origins = [
    { '代码': 'CN', '国家': '中国' }, { '代码': 'KR', '国家': '韩国' },
    { '代码': 'JP', '国家': '日本' }, { '代码': 'VN', '国家': '越南' },
    { '代码': 'SG', '国家': '新加坡' }, { '代码': 'MX', '国家': '墨西哥' },
    { '代码': 'CA', '国家': '加拿大' }, { '代码': 'DE', '国家': '德国' },
    { '代码': 'RO', '国家': '罗马尼亚' }, { '代码': 'TW', '国家': '台湾' },
    { '代码': 'TH', '国家': '泰国' }, { '代码': 'MY', '国家': '马来西亚' },
    { '代码': 'IN', '国家': '印度' }, { '代码': 'ID', '国家': '印尼' },
    { '代码': 'GB', '国家': '英国' }, { '代码': 'FR', '国家': '法国' },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(origins), '原产地代码')

  XLSX.writeFile(wb, '关税测算导入模板.xlsx')
}

// ============================================================
// 批量测算报告导出
// ============================================================

/** 导出批量测算中文报告（多 Sheet） */
export function exportBatchReport(result: BatchResult): void {
  const wb = XLSX.utils.book_new()
  const dateStr = formatDate(new Date())

  // Sheet 1: 汇总概览
  const summaryData = [
    { '项目': '报告日期', '值': dateStr },
    { '项目': '测算行数', '值': result.summary.totalRows },
    { '项目': '成功行数', '值': result.summary.successRows },
    { '项目': '失败行数', '值': result.summary.errorRows },
    { '项目': '高风险行数', '值': result.summary.highRiskRows },
    { '项目': '中风险行数', '值': result.summary.mediumRiskRows },
    { '项目': '总货值 (USD)', '值': `$${result.summary.totalGoodsValue.toLocaleString()}` },
    { '项目': '总到岸成本 (USD)', '值': `$${result.summary.totalLandedCost.toLocaleString()}` },
    { '项目': '总税费 (USD)', '值': `$${result.summary.totalTax.toLocaleString()}` },
    { '项目': '平均有效税率', '值': `${(result.summary.avgEffectiveRate * 100).toFixed(1)}%` },
    { '项目': '最高税率商品', '值': result.summary.highestRateRow ? `${result.summary.highestRateRow.sku} (${(result.summary.highestRateRow.effectiveRate * 100).toFixed(1)}%)` : 'N/A' },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), '汇总概览')

  // Sheet 2: 原产地排名
  if (result.summary.originRanking.length > 0) {
    const originData = result.summary.originRanking.map((r, i) => ({
      '排名': i + 1,
      '原产地': r.originName,
      '代码': r.origin,
      '平均有效税率': `${(r.avgRate * 100).toFixed(1)}%`,
      'SKU 数量': r.count,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(originData), '原产地排名')
  }

  // Sheet 3: 逐行拆解
  if (result.rows.length > 0) {
    const rowData = result.rows.map((r) => ({
      '行号': r.rowIndex,
      'SKU': r.sku,
      '产品名称': r.productName,
      'HS编码': r.hsCode,
      '原产地': r.originName,
      '原产地代码': r.origin,
      '入境日期': r.entryDate,
      '货值(USD)': r.goodsValue,
      'MFN关税': round2(r.customsDuty),
      'Section 301': round2(r.section301),
      'Section 232': round2(r.section232),
      'Section 122': round2(r.section122),
      'MPF': round2(r.mpf),
      'HMF': round2(r.hmf),
      '运费': round2(r.shippingCost),
      '保险': round2(r.insurance),
      '总税费': round2(r.totalTax),
      '到岸总成本': round2(r.totalCost),
      '有效税率': `${(r.effectiveRate * 100).toFixed(1)}%`,
      'FTA': r.ftaApplied ? r.ftaName : '—',
      'De Minimis': r.deMinimisStatus,
      'AD/CVD风险': r.adCvdRisk ?? '—',
      '置信度': r.confidence,
      '风险等级': r.riskLevel === 'high' ? '高' : r.riskLevel === 'medium' ? '中' : '低',
      '风险原因': r.riskReasons.join('; '),
      '缺失数据': r.missingData.join('; '),
      '备注': r.remark,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowData), '逐行拆解')
  }

  // Sheet 4: 风险列表
  const riskRows = result.rows.filter(r => r.riskLevel === 'high' || r.riskLevel === 'medium')
  if (riskRows.length > 0) {
    const riskData = riskRows.map((r) => ({
      '行号': r.rowIndex,
      'SKU': r.sku,
      '产品名称': r.productName,
      'HS编码': r.hsCode,
      '原产地': r.originName,
      '有效税率': `${(r.effectiveRate * 100).toFixed(1)}%`,
      '到岸总成本': `$${r.totalCost.toLocaleString()}`,
      '风险等级': r.riskLevel === 'high' ? '高风险' : '中风险',
      '风险原因': r.riskReasons.join('; '),
      '建议': r.riskLevel === 'high' ? '建议人工复核税率和适用条款' : '建议确认数据完整性',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riskData), '风险列表')
  }

  // Sheet 5: 假设与说明
  const assumptions = [
    { '项目': '说明' },
    { '项目': '本报告由税率政策工具自动生成，仅供参考。' },
    { '项目': '实际关税以美国海关 (CBP) 核定为准，不构成法律、税务或报关建议。' },
    { '项目': '' },
    { '项目': '计算假设：' },
    { '项目': '1. MFN 税率基于 USITC HTS 年度版 (hts.usitc.gov)' },
    { '项目': '2. Section 301 仅适用于中国原产商品，按 USTR 清单分批' },
    { '项目': '3. Section 232 覆盖钢铁、铝及衍生品、汽车及零部件，全球适用' },
    { '项目': '4. Section 122 临时附加税 10%，有效期 2026-02-24 至 2026-07-24，USMCA 国家豁免' },
    { '项目': '5. IEEPA 对等关税已于 2026-02-20 被 SCOTUS 推翻，不再生效' },
    { '项目': '6. AD/CVD 仅作风险提示，不自动计入确定总成本' },
    { '项目': '7. De Minimis ($800) 已于 2025-08-29 全球暂停' },
    { '项目': '8. MPF 费率 0.3464%（最低 $31.67，最高 $614.35），HMF 费率 0.125%（仅海运）' },
    { '项目': '9. 保险费率按 CIF 价值的 0.5% 估算' },
    { '项目': '10. Section 122 实际终止日以官方后续公告为准' },
    { '项目': '' },
    { '项目': '数据来源：' },
    { '项目': '• USITC HTS: https://hts.usitc.gov' },
    { '项目': '• USTR Section 301: https://ustr.gov' },
    { '项目': '• CBP: https://www.cbp.gov' },
    { '项目': '• Federal Register: https://www.federalregister.gov' },
    { '项目': '• White House: https://www.whitehouse.gov' },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assumptions), '假设与说明')

  XLSX.writeFile(wb, `关税测算报告_${dateStr}.xlsx`)
}

// ============================================================
// 辅助
// ============================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
