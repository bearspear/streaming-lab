#!/bin/bash

# Test the filesystem scanning functionality

BASE_URL="http://localhost:4000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "Filesystem Scanner Test"
echo "=========================================="
echo ""

# Step 1: Register/Login to get token
echo "Step 1: Authenticating..."
USERNAME="scantest_$(date +%s)"
PASSWORD="TestPass123!"

RESPONSE=$(curl -s -X POST ${BASE_URL}/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to get authentication token${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Authenticated successfully${NC}"
echo ""

# Step 2: Check library before scan
echo "Step 2: Checking library before scan..."
RESPONSE=$(curl -s -X GET ${BASE_URL}/api/library/movies \
  -H "Authorization: Bearer ${TOKEN}")

COUNT_BEFORE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('count', 0))")
echo "   Movies in library: $COUNT_BEFORE"
echo ""

# Step 3: Start scan
echo "Step 3: Starting directory scan..."
SCAN_PATH="/Users/mbehringer/Experimental/streaming-lab/test-videos"

RESPONSE=$(curl -s -X POST ${BASE_URL}/api/library/scan \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"${SCAN_PATH}\"}")

echo "   Scan response: $RESPONSE"
echo ""

# Step 4: Wait for scan to complete
echo "Step 4: Waiting for scan to complete..."
for i in {1..10}; do
    sleep 1
    PROGRESS=$(curl -s -X GET ${BASE_URL}/api/library/scan/progress \
      -H "Authorization: Bearer ${TOKEN}")

    IS_SCANNING=$(echo "$PROGRESS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('isScanning', False))")
    SCANNED=$(echo "$PROGRESS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('scannedFiles', 0))")
    TOTAL=$(echo "$PROGRESS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('totalFiles', 0))")
    ADDED=$(echo "$PROGRESS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('addedFiles', 0))")

    echo "   Progress: $SCANNED/$TOTAL files scanned, $ADDED added"

    if [ "$IS_SCANNING" = "False" ]; then
        echo -e "${GREEN}✓ Scan completed${NC}"
        break
    fi
done
echo ""

# Step 5: Check library after scan
echo "Step 5: Checking library after scan..."
RESPONSE=$(curl -s -X GET ${BASE_URL}/api/library/movies \
  -H "Authorization: Bearer ${TOKEN}")

COUNT_AFTER=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('count', 0))")
echo "   Movies in library: $COUNT_AFTER"

if [ $COUNT_AFTER -gt $COUNT_BEFORE ]; then
    echo -e "${GREEN}✓ Successfully added $((COUNT_AFTER - COUNT_BEFORE)) new media items${NC}"
else
    echo -e "${RED}✗ No new items added${NC}"
fi
echo ""

# Step 6: Display scanned movies
echo "Step 6: Scanned movies:"
echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for movie in data.get('movies', []):
    print(f\"   - {movie.get('title')} ({movie.get('file_path', 'N/A')})\")
"
echo ""

# Step 7: Test getting a specific movie
echo "Step 7: Testing get media item by ID..."
FIRST_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; movies = json.load(sys.stdin).get('movies', []); print(movies[0]['id'] if movies else '')")

if [ ! -z "$FIRST_ID" ]; then
    ITEM=$(curl -s -X GET ${BASE_URL}/api/library/item/${FIRST_ID} \
      -H "Authorization: Bearer ${TOKEN}")

    echo "   Movie details:"
    echo "$ITEM" | python3 -c "
import sys, json
item = json.load(sys.stdin)
print(f\"   Title: {item.get('title', 'N/A')}\")
print(f\"   Type: {item.get('type', 'N/A')}\")
print(f\"   Source: {item.get('source_type', 'N/A')}\")
print(f\"   File: {item.get('file_path', 'N/A')}\")
print(f\"   File Size: {item.get('file_size', 0)} bytes\")
"
    echo -e "${GREEN}✓ Successfully retrieved media item details${NC}"
else
    echo -e "${YELLOW}⚠ No movies found to test${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo "Scan Test Summary"
echo "=========================================="
echo "Test video directory: $SCAN_PATH"
echo "Files scanned: $TOTAL"
echo "Files added: $ADDED"
echo "Movies in library: $COUNT_AFTER"
echo ""

if [ $COUNT_AFTER -gt 0 ]; then
    echo -e "${GREEN}Scan test completed successfully! ✓${NC}"
    exit 0
else
    echo -e "${RED}Scan test failed - no items added ✗${NC}"
    exit 1
fi
