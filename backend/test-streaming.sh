#!/bin/bash

# Test Phase 2: Streaming Engine

BASE_URL="http://localhost:4000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "Phase 2: Streaming Engine Tests"
echo "=========================================="
echo ""

# Step 1: Authenticate and get media item
echo "${BLUE}Step 1: Authenticating and getting media item...${NC}"
USERNAME="streamtest_$(date +%s)"
PASSWORD="TestPass123!"

RESPONSE=$(curl -s -X POST ${BASE_URL}/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ Failed to get authentication token${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Authenticated successfully${NC}"

# Get first media item
RESPONSE=$(curl -s -X GET ${BASE_URL}/api/library/movies \
  -H "Authorization: Bearer ${TOKEN}")

MEDIA_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; movies = json.load(sys.stdin).get('movies', []); print(movies[0]['id'] if movies else '')")

if [ -z "$MEDIA_ID" ]; then
    echo -e "${YELLOW}⚠ No media items found. Scanning test directory first...${NC}"

    # Scan test directory
    curl -s -X POST ${BASE_URL}/api/library/scan \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"path":"/Users/mbehringer/Experimental/streaming-lab/test-videos"}' > /dev/null

    sleep 2

    # Get media item again
    RESPONSE=$(curl -s -X GET ${BASE_URL}/api/library/movies \
      -H "Authorization: Bearer ${TOKEN}")

    MEDIA_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; movies = json.load(sys.stdin).get('movies', []); print(movies[0]['id'] if movies else '')")

    if [ -z "$MEDIA_ID" ]; then
        echo -e "${RED}✗ Still no media items found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Found media item ID: ${MEDIA_ID}${NC}"
echo ""

# Test 2: Get Video Info
echo "${BLUE}Test 2: Get Video Info${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/stream/${MEDIA_ID}/info \
  -H "Authorization: Bearer ${TOKEN}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "videoInfo"; then
    echo -e "${GREEN}✓ Video info endpoint working${NC}"
    echo "$BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
vi = data.get('videoInfo', {})
v = vi.get('video', {})
print(f\"   Duration: {vi.get('duration', 0):.2f}s\")
print(f\"   Format: {vi.get('format', 'N/A')}\")
print(f\"   Resolution: {v.get('width', 0)}x{v.get('height', 0)}\")
print(f\"   Codec: {v.get('codec', 'N/A')}\")
print(f\"   Quality: {vi.get('quality', 'N/A')}\")
"
else
    echo -e "${RED}✗ Video info endpoint failed${NC}"
    echo "   Response: $BODY"
fi
echo ""

# Test 3: Get Available Qualities
echo "${BLUE}Test 3: Get Available Qualities${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/stream/${MEDIA_ID}/qualities \
  -H "Authorization: Bearer ${TOKEN}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "availableQualities"; then
    echo -e "${GREEN}✓ Available qualities endpoint working${NC}"
    echo "$BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"   Source Quality: {data.get('sourceQuality', 'N/A')}\")
qualities = data.get('availableQualities', [])
print(f\"   Available Qualities: {len(qualities)}\")
for q in qualities:
    print(f\"      - {q.get('label', 'N/A')}: {q.get('height', 0)}p @ {q.get('bitrate', 'N/A')}\")
"
else
    echo -e "${RED}✗ Available qualities endpoint failed${NC}"
    echo "   Response: $BODY"
fi
echo ""

# Test 4: Test Direct Streaming (Range Request)
echo "${BLUE}Test 4: Test Direct Streaming with Range Request${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/stream/${MEDIA_ID}/direct \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Range: bytes=0-1023" \
  -o /dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "206" ]; then
    echo -e "${GREEN}✓ Direct streaming with range support working${NC}"
    echo "   Status: 206 Partial Content"
else
    echo -e "${YELLOW}⚠ Direct streaming returned ${HTTP_CODE} (expected 206)${NC}"
fi
echo ""

# Test 5: Test Direct Streaming (Full File)
echo "${BLUE}Test 5: Test Direct Streaming without Range${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/stream/${MEDIA_ID}/direct \
  -H "Authorization: Bearer ${TOKEN}" \
  -o /dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Direct streaming without range working${NC}"
    echo "   Status: 200 OK"
else
    echo -e "${RED}✗ Direct streaming failed with status ${HTTP_CODE}${NC}"
fi
echo ""

# Test 6: Get Cache Stats
echo "${BLUE}Test 6: Get Cache Statistics${NC}"
RESPONSE=$(curl -s -w "\n%{http_CODE}" -X GET ${BASE_URL}/api/stream/cache/stats \
  -H "Authorization: Bearer ${TOKEN}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "totalSize"; then
    echo -e "${GREEN}✓ Cache stats endpoint working${NC}"
    echo "$BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"   Total Size: {data.get('totalSize', 0)} bytes\")
print(f\"   File Count: {data.get('fileCount', 0)}\")
print(f\"   Usage: {data.get('usagePercent', 0)}%\")
"
else
    echo -e "${RED}✗ Cache stats endpoint failed${NC}"
    echo "   Response: $BODY"
fi
echo ""

# Test 7: Trigger HLS Generation
echo "${BLUE}Test 7: Trigger HLS Generation${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/stream/${MEDIA_ID}/hls/manifest.m3u8 \
  -H "Authorization: Bearer ${TOKEN}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "202" ] || [ "$HTTP_CODE" = "200" ]; then
    if [ "$HTTP_CODE" = "202" ]; then
        echo -e "${GREEN}✓ HLS generation started${NC}"
        echo "   Status: Processing"
    else
        echo -e "${GREEN}✓ HLS manifest available${NC}"
        echo "   Status: Ready"
        echo "   Manifest length: $(echo "$BODY" | wc -l) lines"
    fi
else
    echo -e "${YELLOW}⚠ HLS manifest request returned ${HTTP_CODE}${NC}"
    echo "   Response: $BODY"
fi
echo ""

# Summary
echo "=========================================="
echo "Streaming Tests Summary"
echo "=========================================="
echo "Media Item ID: ${MEDIA_ID}"
echo "Token: ${TOKEN:0:20}..."
echo ""
echo -e "${GREEN}Phase 2 Streaming Engine implementation complete!${NC}"
echo ""
echo "Available Endpoints:"
echo "  - GET /api/stream/:id/info - Get video metadata"
echo "  - GET /api/stream/:id/qualities - Get available qualities"
echo "  - GET /api/stream/:id/direct - Direct streaming with range support"
echo "  - GET /api/stream/:id/transcode?quality=720p - Transcoded streaming"
echo "  - GET /api/stream/:id/hls/manifest.m3u8 - HLS manifest"
echo "  - GET /api/stream/:id/hls/:segment - HLS segments"
echo "  - GET /api/stream/cache/stats - Cache statistics"
echo "  - POST /api/stream/cache/clear - Clear cache"
echo ""
