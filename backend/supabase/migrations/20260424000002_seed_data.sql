-- ============================================================
-- 税率政策工具 — 种子数据
-- 迁移序号: 20260424000002
-- 说明: 从扩展 mock-data.ts 导入 P0 初始税率数据
-- ============================================================

BEGIN;

-- ==================== tariff_dict: 5 个 HS6 品类 ====================

INSERT INTO public.tariff_dict (id, country_code, hs6, name_zh, name_en, keywords) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'US', '848210', '滚珠轴承', 'Ball bearings',
    ARRAY['轴承', 'bearing', 'ball bearing', '滚珠', 'bearing unit']),
  ('a0000001-0000-0000-0000-000000000002', 'US', '850110', '电动机（小型）', 'Electric motors (small)',
    ARRAY['电机', '电动机', 'motor', 'electric motor', '马达']),
  ('a0000001-0000-0000-0000-000000000003', 'US', '611020', '棉制针织衫', 'Cotton knit garments',
    ARRAY['针织', '毛衣', '针织衫', 'sweater', 'cotton knit', 'pullover', '套头衫']),
  ('a0000001-0000-0000-0000-000000000004', 'US', '940540', 'LED 灯具', 'LED lighting fixtures',
    ARRAY['LED', '灯', '照明', 'lighting', 'lamp', '灯具', 'light']),
  ('a0000001-0000-0000-0000-000000000005', 'US', '870899', '汽车零部件（通用）', 'Auto parts (general)',
    ARRAY['汽车零件', 'auto part', '汽车配件', 'vehicle part', '车用'])
ON CONFLICT (country_code, hs6) DO NOTHING;

-- ==================== tariff_sub_codes: HTS10 子分类 ====================

-- 848210 滚珠轴承
INSERT INTO public.tariff_sub_codes (dict_id, code, description_zh, description_en, mfn_rate, unit, source) VALUES
  ('a0000001-0000-0000-0000-000000000001', '8482.10.10.00', '组合式径向推力滚珠轴承', 'Combined radial and thrust ball bearings', 0.09, 'kg', 'seed'),
  ('a0000001-0000-0000-0000-000000000001', '8482.10.50.00', '其他滚珠轴承（非组合式）', 'Other ball bearings, not combined types', 0.09, 'kg', 'seed')
ON CONFLICT (dict_id, code) DO NOTHING;

-- 850110 电动机
INSERT INTO public.tariff_sub_codes (dict_id, code, description_zh, description_en, mfn_rate, unit, source) VALUES
  ('a0000001-0000-0000-0000-000000000002', '8501.10.10.00', '输出功率不超过 18.65W 的电动机', 'Motors with output not exceeding 18.65W', 0.028, 'kg', 'seed'),
  ('a0000001-0000-0000-0000-000000000002', '8501.10.40.00', '输出功率 18.65W~746W 的电动机', 'Motors exceeding 18.65W but not exceeding 746W', 0.028, 'kg', 'seed'),
  ('a0000001-0000-0000-0000-000000000002', '8501.10.60.00', '输出功率 746W~7.5kW 的电动机', 'Motors exceeding 746W but not exceeding 7.5kW', 0.028, 'kg', 'seed')
ON CONFLICT (dict_id, code) DO NOTHING;

-- 611020 棉制针织衫
INSERT INTO public.tariff_sub_codes (dict_id, code, description_zh, description_en, mfn_rate, unit, source) VALUES
  ('a0000001-0000-0000-0000-000000000003', '6110.20.10.00', '棉制男式针织套头衫', 'Men''s cotton knit pullovers', 0.166, 'doz', 'seed'),
  ('a0000001-0000-0000-0000-000000000003', '6110.20.20.00', '棉制女式针织套头衫', 'Women''s cotton knit pullovers', 0.166, 'doz', 'seed'),
  ('a0000001-0000-0000-0000-000000000003', '6110.20.60.00', '其他棉制针织衫（含儿童）', 'Other cotton knit garments (including children)', 0.166, 'doz', 'seed')
ON CONFLICT (dict_id, code) DO NOTHING;

-- 940540 LED 灯具
INSERT INTO public.tariff_sub_codes (dict_id, code, description_zh, description_en, mfn_rate, unit, source) VALUES
  ('a0000001-0000-0000-0000-000000000004', '9405.40.10.00', 'LED 灯带及模组', 'LED light strips and modules', 0.039, 'kg', 'seed'),
  ('a0000001-0000-0000-0000-000000000004', '9405.40.20.00', 'LED 吸顶灯/面板灯', 'LED ceiling/panel lights', 0.039, 'kg', 'seed'),
  ('a0000001-0000-0000-0000-000000000004', '9405.40.60.00', '其他 LED 灯具', 'Other LED lighting fixtures', 0.039, 'kg', 'seed')
ON CONFLICT (dict_id, code) DO NOTHING;

-- 870899 汽车零部件
INSERT INTO public.tariff_sub_codes (dict_id, code, description_zh, description_en, mfn_rate, unit, source) VALUES
  ('a0000001-0000-0000-0000-000000000005', '8708.99.10.00', '汽车用绞盘及千斤顶', 'Winches and jacks for vehicles', 0.025, 'kg', 'seed'),
  ('a0000001-0000-0000-0000-000000000005', '8708.99.30.00', '汽车用铰链及门锁', 'Hinges and door locks for vehicles', 0.025, 'kg', 'seed'),
  ('a0000001-0000-0000-0000-000000000005', '8708.99.60.00', '其他汽车零部件（未列名）', 'Other motor vehicle parts (not elsewhere specified)', 0.025, 'kg', 'seed')
ON CONFLICT (dict_id, code) DO NOTHING;

-- ==================== section_301_rates ====================

INSERT INTO public.section_301_rates (hs_code, list_number, rate, origin_country, effective_date, source) VALUES
  ('8482', 'List 3', 0.25, 'CN', '2018-09-24', 'seed'),
  ('8501', 'List 3', 0.25, 'CN', '2018-09-24', 'seed'),
  ('6110', 'List 4A', 0.075, 'CN', '2019-09-01', 'seed'),
  ('9405', 'List 3', 0.25, 'CN', '2018-09-24', 'seed'),
  ('8708', 'List 3', 0.25, 'CN', '2018-09-24', 'seed');

-- ==================== section_232_rates ====================

INSERT INTO public.section_232_rates (hs_code, category, rate, effective_date, source) VALUES
  ('7326', '钢铁制品', 0.25, '2018-03-23', 'seed'),
  ('7606', '铝制品', 0.25, '2018-03-23', 'seed'),
  ('7607', '铝箔', 0.25, '2018-03-23', 'seed'),
  ('8708', '汽车零部件', 0.25, '2025-05-01', 'seed'),
  ('8703', '整车', 0.25, '2025-05-01', 'seed'),
  ('8482', '轴承(钢铁类)', 0.25, '2018-03-23', 'seed'),
  ('9405', '灯具(含铝/钢)', 0.25, '2018-03-23', 'seed');

-- ==================== fta_rates ====================
-- 简化：KORUS / US-Singapore FTA / USMCA → 0% for seed HS codes

INSERT INTO public.fta_rates (hs6, fta_name, rate, origin_country, source) VALUES
  ('8482', 'KORUS', 0, 'KR', 'seed'),
  ('8482', 'US-Singapore FTA', 0, 'SG', 'seed'),
  ('8482', 'USMCA', 0, 'MX', 'seed'),
  ('8501', 'KORUS', 0, 'KR', 'seed'),
  ('8501', 'US-Singapore FTA', 0, 'SG', 'seed'),
  ('8501', 'USMCA', 0, 'MX', 'seed'),
  ('6110', 'KORUS', 0, 'KR', 'seed'),
  ('6110', 'US-Singapore FTA', 0, 'SG', 'seed'),
  ('6110', 'USMCA', 0, 'MX', 'seed'),
  ('9405', 'KORUS', 0, 'KR', 'seed'),
  ('9405', 'US-Singapore FTA', 0, 'SG', 'seed'),
  ('9405', 'USMCA', 0, 'MX', 'seed'),
  ('8708', 'KORUS', 0, 'KR', 'seed'),
  ('8708', 'US-Singapore FTA', 0, 'SG', 'seed'),
  ('8708', 'USMCA', 0, 'MX', 'seed');

-- ==================== shipping_routes ====================

INSERT INTO public.shipping_routes (origin_country, dest_country, transit_days, cost_per_container, cost_per_kg, mode, source) VALUES
  ('RO', 'US', 14, 2200, 0.12, 'ocean', 'seed'),
  ('KR', 'US', 16, 2500, 0.13, 'ocean', 'seed'),
  ('SG', 'US', 18, 2800, 0.15, 'ocean', 'seed'),
  ('JP', 'US', 12, 2200, 0.12, 'ocean', 'seed'),
  ('VN', 'US', 18, 2400, 0.13, 'ocean', 'seed'),
  ('DE', 'US', 12, 1900, 0.10, 'ocean', 'seed'),
  ('CN', 'US', 16, 2400, 0.13, 'ocean', 'seed'),
  ('MX', 'US', 4, 1600, 0.08, 'land', 'seed'),
  ('CA', 'US', 3, 1400, 0.07, 'land', 'seed');

-- ==================== ad_cvd_orders（样本） ====================

INSERT INTO public.ad_cvd_orders (case_number, country, hs_codes, product_name_zh, product_name_en, ad_rate, cvd_rate, status, effective_date, source) VALUES
  ('A-570-125', 'CN', ARRAY['7318.15'], '螺钉/螺栓', 'Screws/bolts', 0.584, NULL, 'active', '2024-01-01', 'seed'),
  ('A-570-098', 'CN', ARRAY['7308.90'], '钢结构部件', 'Steel structural parts', 0.32, NULL, 'active', '2024-03-01', 'seed'),
  ('A-570-112', 'CN', ARRAY['7606.11'], '铝合金薄板', 'Aluminum alloy sheet', 0.493, NULL, 'active', '2024-06-01', 'seed');

COMMIT;
