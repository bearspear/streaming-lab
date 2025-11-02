#!/bin/bash

echo "Testing authentication flow..."
echo ""

# Login and get token
echo "1. Logging in..."
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"michael","password":"password"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Login successful, token: ${TOKEN:0:50}..."
echo ""

# Verify token
echo "2. Verifying token..."
VERIFY_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET http://localhost:4000/api/auth/verify \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$VERIFY_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$VERIFY_RESPONSE" | sed '/HTTP_CODE/d')

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Token verification successful"
else
  echo "❌ Token verification failed"
fi
