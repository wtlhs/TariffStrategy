#!/usr/bin/env bash
# ============================================================
# 生成 Supabase JWT 密钥（ANON_KEY + SERVICE_ROLE_KEY）
#
# 用法:
#   bash scripts/generate-keys.sh
#
# 前置:
#   - openssl
#   - jq (可选，用于 JSON 格式化)
#
# 生成的密钥使用 HS256 算法签名
# payload 中的 role 分别为 anon 和 service_role
# ============================================================

set -euo pipefail

# 检查 JWT_SECRET 是否已设置
JWT_SECRET="${JWT_SECRET:-}"

if [ -z "$JWT_SECRET" ]; then
  echo "🔑 正在生成 JWT_SECRET..."
  JWT_SECRET=$(openssl rand -hex 64)
  echo "   JWT_SECRET=$JWT_SECRET"
fi

if [ ${#JWT_SECRET} -lt 32 ]; then
  echo "❌ JWT_SECRET 长度不足 32 字符"
  exit 1
fi

# base64url 编码函数
b64url() {
  echo -n "$1" | openssl base64 -e -A | tr '+/' '-_' | tr -d '='
}

# 生成 JWT
generate_jwt() {
  local role="$1"
  local header='{"alg":"HS256","typ":"JWT"}'
  local payload="{\"role\":\"${role}\",\"iss\":\"supabase\",\"iat\":$(date +%s),\"exp\":$(($(date +%s) + 10 * 365 * 24 * 3600))}"

  local header_b64=$(b64url "$header")
  local payload_b64=$(b64url "$payload")

  local signature=$(echo -n "${header_b64}.${payload_b64}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')

  echo "${header_b64}.${payload_b64}.${signature}"
}

echo ""
echo "📋 正在生成 Supabase JWT 密钥..."
echo ""

ANON_KEY=$(generate_jwt "anon")
SERVICE_ROLE_KEY=$(generate_jwt "service_role")

echo "✅ 密钥已生成："
echo ""
echo "ANON_KEY=$ANON_KEY"
echo ""
echo "SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
echo ""
echo "将以上值填入 .env 文件"
