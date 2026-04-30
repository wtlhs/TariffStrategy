-- ============================================================
-- 税率政策工具 — 完整数据库架构
-- 迁移序号: 20260424000001
-- 说明: 初始化所有表、RLS、触发器、RPC 函数
-- ============================================================

BEGIN;

-- ==================== 辅助函数 ====================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 更新 updated_at 的通用触发器
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 第一节：用户 & 支付
-- ============================================================

-- public.users — 扩展用户字段（auth.users 通过 trigger 同步创建）
CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone           VARCHAR(20) UNIQUE,
  email           VARCHAR(255),
  display_name    VARCHAR(50),

  -- 积分
  credits         INTEGER NOT NULL DEFAULT 100 CHECK (credits >= 0),
  total_earned    INTEGER NOT NULL DEFAULT 100,
  total_spent     INTEGER NOT NULL DEFAULT 0,

  -- 套餐
  plan            VARCHAR(20) NOT NULL DEFAULT 'free'
                  CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  plan_expires_at TIMESTAMPTZ,
  trial_ends_at   TIMESTAMPTZ,

  -- 签到
  checkin_streak  INTEGER NOT NULL DEFAULT 0 CHECK (checkin_streak >= 0),
  last_checkin_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER handle_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- auth.users 创建时自动创建 public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- auth.users 更新时同步 public.users
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    phone = COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', users.phone),
    email = COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', users.email)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- payment_orders — 支付订单
CREATE TABLE public.payment_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_no        VARCHAR(32) UNIQUE NOT NULL,
  order_type      VARCHAR(20) NOT NULL CHECK (order_type IN ('credits', 'plan')),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),

  -- 金额
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  currency        VARCHAR(3) NOT NULL DEFAULT 'CNY',

  -- 积分购买
  credit_amount   INTEGER CHECK (credit_amount IS NULL OR credit_amount > 0),

  -- 套餐购买
  plan_tier       VARCHAR(20) CHECK (plan_tier IS NULL OR plan_tier IN ('starter', 'pro', 'enterprise')),
  plan_cycle      VARCHAR(10) CHECK (plan_cycle IS NULL OR plan_cycle IN ('monthly', 'yearly')),

  -- 支付渠道
  payment_channel VARCHAR(20) CHECK (payment_channel IS NULL OR payment_channel IN ('wechat', 'alipay', 'stripe')),
  payment_no      VARCHAR(64),

  -- 时间
  paid_at         TIMESTAMPTZ,
  expired_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON public.payment_orders(user_id);
CREATE INDEX idx_orders_status_pending ON public.payment_orders(status) WHERE status = 'pending';
CREATE INDEX idx_orders_created ON public.payment_orders(created_at DESC);

-- credit_transactions — 积分流水
CREATE TABLE public.credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  type            VARCHAR(10) NOT NULL CHECK (type IN ('earn', 'spend')),
  amount          INTEGER NOT NULL CHECK (amount > 0),
  reason          VARCHAR(50) NOT NULL,
  balance_after   INTEGER NOT NULL CHECK (balance_after >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credits_user ON public.credit_transactions(user_id);
CREATE INDEX idx_credits_created ON public.credit_transactions(created_at DESC);

-- 幂等约束：同一订单只能有一笔 purchase 类型的积分记录
CREATE UNIQUE INDEX idx_credit_purchase_order
  ON public.credit_transactions(order_id)
  WHERE order_id IS NOT NULL AND reason = 'purchase';

-- plan_subscriptions — 套餐订阅
CREATE TABLE public.plan_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  plan_tier       VARCHAR(20) NOT NULL CHECK (plan_tier IN ('starter', 'pro', 'enterprise')),
  cycle           VARCHAR(10) NOT NULL CHECK (cycle IN ('monthly', 'yearly')),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plans_user ON public.plan_subscriptions(user_id);
CREATE INDEX idx_plans_status ON public.plan_subscriptions(status);

-- 幂等约束：一个订单只能对应一条订阅记录
CREATE UNIQUE INDEX idx_plan_order
  ON public.plan_subscriptions(order_id)
  WHERE order_id IS NOT NULL;

-- 每个用户只能有一个活跃订阅
CREATE UNIQUE INDEX idx_plan_active_user
  ON public.plan_subscriptions(user_id)
  WHERE status = 'active';

-- ============================================================
-- 第二节：税率数据
-- ============================================================

-- tariff_dict — HS 编码字典（按目标国，HS6 为 WCO 统一编码）
CREATE TABLE public.tariff_dict (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL,
  hs6          VARCHAR(6) NOT NULL,
  name_zh      VARCHAR(200),
  name_en      VARCHAR(200),
  keywords     TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(country_code, hs6)
);

CREATE TRIGGER handle_tariff_dict_updated_at
  BEFORE UPDATE ON public.tariff_dict
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- tariff_sub_codes — 目标国 HTS 子分类
CREATE TABLE public.tariff_sub_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dict_id         UUID NOT NULL REFERENCES public.tariff_dict(id) ON DELETE CASCADE,
  code            VARCHAR(20) NOT NULL,
  description_zh  VARCHAR(500),
  description_en  VARCHAR(500),
  mfn_rate        DECIMAL(6,4) NOT NULL DEFAULT 0 CHECK (mfn_rate >= 0 AND mfn_rate <= 1),
  unit            VARCHAR(10),
  special_rate    DECIMAL(6,4) CHECK (special_rate IS NULL OR (special_rate >= 0 AND special_rate <= 1)),
  effective_date  DATE,
  source          VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dict_id, code)
);

CREATE INDEX idx_sub_codes_dict ON public.tariff_sub_codes(dict_id);
CREATE INDEX idx_sub_codes_code ON public.tariff_sub_codes(code);

-- section_301_rates — Section 301 税率（中国专用）
CREATE TABLE public.section_301_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hs_code         VARCHAR(10) NOT NULL,
  list_number     VARCHAR(10),
  rate            DECIMAL(6,4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
  origin_country  VARCHAR(2) NOT NULL DEFAULT 'CN',
  effective_date  DATE NOT NULL,
  expiry_date     DATE,
  source          VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_s301_hs ON public.section_301_rates(hs_code);
CREATE INDEX idx_s301_origin ON public.section_301_rates(origin_country);
CREATE INDEX idx_s301_effective ON public.section_301_rates(effective_date DESC);

-- section_232_rates — Section 232 税率（全球）
CREATE TABLE public.section_232_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hs_code         VARCHAR(10) NOT NULL,
  category        VARCHAR(50),
  rate            DECIMAL(6,4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
  effective_date  DATE NOT NULL,
  source          VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_s232_hs ON public.section_232_rates(hs_code);

-- ad_cvd_orders — AD/CVD 反倾销/反补贴
CREATE TABLE public.ad_cvd_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number     VARCHAR(30) UNIQUE NOT NULL,
  country         VARCHAR(2) NOT NULL,
  hs_codes        TEXT[] NOT NULL DEFAULT '{}',
  product_name_zh VARCHAR(200),
  product_name_en VARCHAR(200),
  ad_rate         DECIMAL(6,4) CHECK (ad_rate IS NULL OR (ad_rate >= 0 AND ad_rate <= 1)),
  cvd_rate        DECIMAL(6,4) CHECK (cvd_rate IS NULL OR (cvd_rate >= 0 AND cvd_rate <= 1)),
  status          VARCHAR(20) CHECK (status IS NULL OR status IN ('active', 'revoked', 'review', 'expired')),
  effective_date  DATE,
  source          VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_adcvd_country ON public.ad_cvd_orders(country);
CREATE INDEX idx_adcvd_hs ON public.ad_cvd_orders USING GIN(hs_codes);

-- fta_rates — FTA 优惠税率
CREATE TABLE public.fta_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fta_name        VARCHAR(50) NOT NULL,
  hs6             VARCHAR(6) NOT NULL,
  origin_country  VARCHAR(2) NOT NULL,
  rate            DECIMAL(6,4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
  staging_year    INTEGER,
  source          VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fta_lookup ON public.fta_rates(fta_name, hs6, origin_country);

-- tariff_change_log — 税率变化日志
CREATE TABLE public.tariff_change_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hs_code               VARCHAR(10) NOT NULL,
  origin_country        VARCHAR(2),
  destination_country   VARCHAR(2),
  change_type           VARCHAR(30),
  old_rate              DECIMAL(6,4),
  new_rate              DECIMAL(6,4),
  change_percent        DECIMAL(8,2),
  effective_date        DATE NOT NULL,
  source                VARCHAR(20),
  metadata              JSONB NOT NULL DEFAULT '{}',
  pushed                BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_log_pushed ON public.tariff_change_log(pushed) WHERE pushed = false;
CREATE INDEX idx_change_log_hs ON public.tariff_change_log(hs_code);
CREATE INDEX idx_change_log_created ON public.tariff_change_log(created_at DESC);

-- shipping_routes — 运费路线
CREATE TABLE public.shipping_routes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_country       VARCHAR(2) NOT NULL,
  dest_country        VARCHAR(2) NOT NULL,
  mode                VARCHAR(10) NOT NULL CHECK (mode IN ('ocean', 'air', 'rail', 'land')),
  transit_days        INTEGER CHECK (transit_days IS NULL OR transit_days > 0),
  cost_per_container   DECIMAL(10,2) CHECK (cost_per_container IS NULL OR cost_per_container >= 0),
  cost_per_kg          DECIMAL(8,4) CHECK (cost_per_kg IS NULL OR cost_per_kg >= 0),
  effective_date       DATE,
  source               VARCHAR(20),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipping_route ON public.shipping_routes(origin_country, dest_country, mode);

-- ============================================================
-- 第三节：订阅 & 通知
-- ============================================================

-- subscriptions — 用户订阅规则
CREATE TABLE public.subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rule_name   VARCHAR(100) NOT NULL,
  rule_type   VARCHAR(20) NOT NULL CHECK (rule_type IN ('product', 'route', 'cost', 'policy')),
  rule_config JSONB NOT NULL DEFAULT '{}',
  channels    TEXT[] NOT NULL DEFAULT ARRAY['system'],
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subs_user ON public.subscriptions(user_id);
CREATE INDEX idx_subs_active ON public.subscriptions(is_active) WHERE is_active = true;

-- notification_config — 通知渠道配置
CREATE TABLE public.notification_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  channels    JSONB NOT NULL DEFAULT '{
    "email": {"enabled": false, "address": null},
    "dingtalk": {"enabled": false, "webhook": null, "secret": null},
    "wechat": {"enabled": false},
    "webhook": {"enabled": false, "url": null}
  }',
  preferences JSONB NOT NULL DEFAULT '{
    "notifyOnRateIncrease": true,
    "notifyOnRateDecrease": true,
    "minChangeThreshold": 5.0
  }',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- user_notification_events — 按用户 fan-out 的通知事件
CREATE TABLE public.user_notification_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  change_id       UUID REFERENCES public.tariff_change_log(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  channel         VARCHAR(20) NOT NULL CHECK (channel IN ('system', 'email', 'dingtalk', 'wechat', 'webhook')),
  title           VARCHAR(200) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  dedupe_key      VARCHAR(150) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'delivered', 'failed', 'read')),
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dedupe_key)
);

CREATE INDEX idx_notify_events_user ON public.user_notification_events(user_id, created_at DESC);
CREATE INDEX idx_notify_events_status ON public.user_notification_events(status, channel);

-- ============================================================
-- 第四节：RLS 策略
-- ============================================================

-- 设计原则：
-- 1. 前端只直连"本人数据"和"公开税率只读数据"
-- 2. 所有影响余额/套餐/订单的写操作，一律走 RPC 或 Worker
-- 3. service_role 仅保留在 Worker，扩展端永不持有

-- ==================== 用户资料 ====================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_self_select"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- users 禁止客户端直接 UPDATE（由 RPC 管理）
-- 如需修改 display_name / email，走 update_user_profile RPC

-- ==================== 订单 / 权益 ====================
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_self_select"
  ON public.payment_orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credits_self_select"
  ON public.credit_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.plan_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_self_select"
  ON public.plan_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ==================== 订阅 / 通知配置 ====================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_self_crud"
  ON public.subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notify_config_self_crud"
  ON public.notification_config
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notify_events_self_select"
  ON public.user_notification_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notify_events_self_update"
  ON public.user_notification_events
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ==================== 公开税率只读数据 ====================
ALTER TABLE public.tariff_dict ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_sub_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_301_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_232_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_cvd_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fta_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tariff_dict_public_read"
  ON public.tariff_dict
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "tariff_sub_codes_public_read"
  ON public.tariff_sub_codes
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "section_301_public_read"
  ON public.section_301_rates
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "section_232_public_read"
  ON public.section_232_rates
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "ad_cvd_public_read"
  ON public.ad_cvd_orders
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "fta_public_read"
  ON public.fta_rates
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "shipping_public_read"
  ON public.shipping_routes
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- tariff_change_log 仅供 Worker 内部使用
ALTER TABLE public.tariff_change_log ENABLE ROW LEVEL SECURITY;
-- 不设置任何给客户端的策略，仅 service_role 可读写

-- ============================================================
-- 第五节：RPC 函数
-- ============================================================

-- ==================== 创建支付订单 ====================
-- 客户端调用: supabase.rpc('create_payment_order', {...})
-- 内部使用 auth.uid()，不接受客户端传入 user_id
CREATE OR REPLACE FUNCTION public.create_payment_order(
  p_order_type VARCHAR,
  p_payment_channel VARCHAR,
  p_credit_pack_id VARCHAR DEFAULT NULL,
  p_plan_tier VARCHAR DEFAULT NULL,
  p_plan_cycle VARCHAR DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order_no VARCHAR(32);
  v_amount_cents INTEGER;
  v_credit_amount INTEGER;
  v_order_id UUID;
  v_payment_page_url VARCHAR;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_payment_channel NOT IN ('wechat', 'alipay') THEN
    RAISE EXCEPTION 'unsupported_payment_channel: %', p_payment_channel;
  END IF;

  -- 生成订单号: TFP + 时间戳 + 随机数
  v_order_no := 'TFP' || to_char(NOW(), 'YYYYMMDDHH24MISS') || lpad(floor(random() * 10000)::text, 4, '0');

  -- 计算金额和积分数
  IF p_order_type = 'credits' THEN
    v_amount_cents := CASE p_credit_pack_id
      WHEN 'small'   THEN 900
      WHEN 'medium'  THEN 3900
      WHEN 'large'   THEN 9900
      WHEN 'xlarge'  THEN 28900
      WHEN 'xxlarge' THEN 99900
      ELSE NULL
    END;
    v_credit_amount := CASE p_credit_pack_id
      WHEN 'small'   THEN 100
      WHEN 'medium'  THEN 500
      WHEN 'large'   THEN 1500
      WHEN 'xlarge'  THEN 5000
      WHEN 'xxlarge' THEN 20000
      ELSE NULL
    END;
    IF v_amount_cents IS NULL OR v_credit_amount IS NULL THEN
      RAISE EXCEPTION 'invalid_credit_pack: %', p_credit_pack_id;
    END IF;

  ELSIF p_order_type = 'plan' THEN
    v_amount_cents := CASE p_plan_tier || '-' || COALESCE(p_plan_cycle, 'monthly')
      WHEN 'starter-monthly'  THEN 2900
      WHEN 'starter-yearly'   THEN 29000
      WHEN 'pro-monthly'     THEN 7900
      WHEN 'pro-yearly'      THEN 69900
      WHEN 'enterprise-monthly' THEN 29900
      WHEN 'enterprise-yearly'  THEN 299900
      ELSE NULL
    END;
    IF v_amount_cents IS NULL THEN
      RAISE EXCEPTION 'invalid_plan: %-%', p_plan_tier, p_plan_cycle;
    END IF;
    IF p_plan_tier NOT IN ('starter', 'pro', 'enterprise') THEN
      RAISE EXCEPTION 'invalid_plan_tier: %', p_plan_tier;
    END IF;
    IF p_plan_cycle NOT IN ('monthly', 'yearly') THEN
      RAISE EXCEPTION 'invalid_plan_cycle: %', p_plan_cycle;
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_order_type: %', p_order_type;
  END IF;

  -- 创建订单
  INSERT INTO public.payment_orders (
    user_id, order_no, order_type, status,
    amount_cents, credit_amount, plan_tier, plan_cycle,
    payment_channel
  ) VALUES (
    v_user_id, v_order_no, p_order_type, 'pending',
    v_amount_cents, v_credit_amount, p_plan_tier, p_plan_cycle,
    p_payment_channel
  ) RETURNING id INTO v_order_id;

  -- 生成支付页 URL
  v_payment_page_url := '/pay/' || v_order_id || '?channel=' || p_payment_channel;

  RETURN json_build_object(
    'orderId', v_order_id,
    'orderNo', v_order_no,
    'amountYuan', v_amount_cents / 100.0,
    'creditAmount', v_credit_amount,
    'paymentPageUrl', v_payment_page_url,
    'expireAt', NOW() + INTERVAL '30 minutes'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_payment_order(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_order(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO authenticated;

-- ==================== 订单履行（支付成功后） ====================
-- 仅供 Worker 调用（service_role）
-- 单事务内完成：锁单 → 改状态 → 发放权益 → 记录流水
CREATE OR REPLACE FUNCTION public.fulfill_payment_order(
  p_order_id UUID,
  p_payment_channel VARCHAR,
  p_payment_no VARCHAR,
  p_paid_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_balance_after INTEGER;
  v_base_expires_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 锁定订单行，防止并发重复发放
  SELECT *
    INTO v_order
  FROM public.payment_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found: %', p_order_id;
  END IF;

  -- 幂等：已支付直接返回
  IF v_order.status = 'paid' THEN
    RETURN json_build_object(
      'ok', true,
      'idempotent', true,
      'orderId', v_order.id
    );
  END IF;

  -- 只允许从 pending 状态转为 paid
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'order_status_invalid: % (expected pending)', v_order.status;
  END IF;

  -- 更新订单状态
  UPDATE public.payment_orders
  SET
    status = 'paid',
    payment_channel = p_payment_channel,
    payment_no = p_payment_no,
    paid_at = p_paid_at
  WHERE id = v_order.id;

  -- 发放积分
  IF v_order.order_type = 'credits' AND v_order.credit_amount > 0 THEN
    UPDATE public.users
    SET
      credits = credits + v_order.credit_amount,
      total_earned = total_earned + v_order.credit_amount
    WHERE id = v_order.user_id
    RETURNING credits INTO v_balance_after;

    -- 幂等插入积分流水（通过唯一约束防止重复）
    BEGIN
      INSERT INTO public.credit_transactions (
        user_id, order_id, type, amount, reason, balance_after
      ) VALUES (
        v_order.user_id, v_order.id, 'earn',
        v_order.credit_amount, 'purchase', v_balance_after
      );
    EXCEPTION WHEN unique_violation THEN
      -- 已存在，跳过（幂等）
      NULL;
    END;
  END IF;

  -- 升级套餐
  IF v_order.order_type = 'plan' AND v_order.plan_tier IS NOT NULL THEN
    -- 计算新到期时间：叠加到当前有效订阅之后
    SELECT COALESCE(MAX(expires_at), p_paid_at)
      INTO v_base_expires_at
    FROM public.plan_subscriptions
    WHERE user_id = v_order.user_id
      AND status = 'active'
      AND expires_at > p_paid_at;

    v_expires_at := v_base_expires_at +
      CASE WHEN v_order.plan_cycle = 'yearly'
        THEN INTERVAL '1 year'
        ELSE INTERVAL '1 month'
      END;

    -- 取消当前活跃订阅
    UPDATE public.plan_subscriptions
    SET status = 'cancelled',
        cancelled_at = p_paid_at
    WHERE user_id = v_order.user_id
      AND status = 'active';

    -- 创建新订阅
    BEGIN
      INSERT INTO public.plan_subscriptions (
        user_id, order_id, plan_tier, cycle, status, started_at, expires_at
      ) VALUES (
        v_order.user_id, v_order.id, v_order.plan_tier, v_order.plan_cycle,
        'active', p_paid_at, v_expires_at
      );
    EXCEPTION WHEN unique_violation THEN
      -- 已存在，跳过
      NULL;
    END;

    -- 更新用户套餐
    UPDATE public.users
    SET plan = v_order.plan_tier,
        plan_expires_at = v_expires_at
    WHERE id = v_order.user_id;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'idempotent', false,
    'orderId', v_order.id,
    'orderType', v_order.order_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_payment_order(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fulfill_payment_order(UUID, VARCHAR, VARCHAR, TIMESTAMPTZ) TO service_role;

-- ==================== 创建订阅规则 ====================
CREATE OR REPLACE FUNCTION public.create_subscription(
  p_rule_name VARCHAR,
  p_rule_type VARCHAR,
  p_rule_config JSONB,
  p_channels TEXT[] DEFAULT ARRAY['system']
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result public.subscriptions;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_rule_type NOT IN ('product', 'route', 'cost', 'policy') THEN
    RAISE EXCEPTION 'invalid_rule_type: %', p_rule_type;
  END IF;

  INSERT INTO public.subscriptions (user_id, rule_name, rule_type, rule_config, channels)
  VALUES (v_user_id, p_rule_name, p_rule_type, p_rule_config, p_channels)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_subscription(VARCHAR, VARCHAR, JSONB, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_subscription(VARCHAR, VARCHAR, JSONB, TEXT[]) TO authenticated;

-- ==================== 更新通知配置 ====================
CREATE OR REPLACE FUNCTION public.update_notification_config(
  p_channels JSONB DEFAULT NULL,
  p_preferences JSONB DEFAULT NULL
)
RETURNS public.notification_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result public.notification_config;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.notification_config (user_id, channels, preferences)
  VALUES (v_user_id,
    COALESCE(p_channels, '{"email":{"enabled":false,"address":null},"dingtalk":{"enabled":false,"webhook":null,"secret":null},"wechat":{"enabled":false},"webhook":{"enabled":false,"url":null}}'::jsonb),
    COALESCE(p_preferences, '{"notifyOnRateIncrease":true,"notifyOnRateDecrease":true,"minChangeThreshold":5.0}'::jsonb)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    channels = COALESCE(public.notification_config.channels, EXCLUDED.channels),
    preferences = COALESCE(public.notification_config.preferences, EXCLUDED.preferences)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_notification_config(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_notification_config(JSONB, JSONB) TO authenticated;

-- ==================== 查询有效税率（策略引擎用） ====================
CREATE OR REPLACE FUNCTION public.get_effective_tariff(
  p_hs_code VARCHAR,
  p_origin_country VARCHAR,
  p_dest_country VARCHAR DEFAULT 'US'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- 归一化 HS 编码
  p_hs_code := regexp_replace(p_hs_code, '[^0-9]', '', 'g');
  IF length(p_hs_code) >= 6 THEN
    p_hs_code := substring(p_hs_code, 1, 6);
  END IF;

  SELECT json_build_object(
    'hsCode', p_hs_code,
    'originCountry', p_origin_country,
    'destCountry', p_dest_country,
    -- MFN 税率
    'mfnRate', (
      SELECT mfn_rate FROM public.tariff_sub_codes tsc
      JOIN public.tariff_dict td ON td.id = tsc.dict_id
      WHERE td.hs6 = p_hs_code AND td.country_code = p_dest_country
      LIMIT 1
    ),
    -- Section 301（仅中国）
    'section301Rate', CASE WHEN p_origin_country = 'CN' THEN (
      SELECT rate FROM public.section_301_rates
      WHERE hs_code LIKE p_hs_code || '%'
      ORDER BY effective_date DESC LIMIT 1
    ) ELSE 0 END,
    -- Section 232
    'section232Rate', (
      SELECT rate FROM public.section_232_rates
      WHERE hs_code LIKE p_hs_code || '%'
      LIMIT 1
    ),
    -- FTA 优惠
    'ftaRate', (
      SELECT rate FROM public.fta_rates
      WHERE hs6 = p_hs_code AND origin_country = p_origin_country
      LIMIT 1
    ),
    -- AD/CVD
    'adCvdRate', (
      SELECT COALESCE(ad_rate, 0) + COALESCE(cvd_rate, 0)
      FROM public.ad_cvd_orders
      WHERE p_hs_code = ANY(hs_codes) AND country = p_origin_country AND status = 'active'
      LIMIT 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_tariff(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_tariff(VARCHAR, VARCHAR, VARCHAR) TO authenticated, anon;

COMMIT;
