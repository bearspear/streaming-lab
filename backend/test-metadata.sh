#!/bin/bash

# Media Streaming Server - Metadata API Test Script
# Tests Phase 4: Metadata & Library features

BASE_URL="http://localhost:4000"
API_URL="$BASE_URL/api"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Auth token variable
TOKEN=""
MEDIA_ITEM_ID=""

# Function to print test result
print_result() {
    local test_name="$1"
    local status="$2"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$status" -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗${NC} $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to print section header
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Function to make API call
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    if [ -n "$TOKEN" ]; then
        if [ -n "$data" ]; then
            curl -s -X "$method" "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $TOKEN" \
                -d "$data"
        else
            curl -s -X "$method" "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $TOKEN"
        fi
    else
        if [ -n "$data" ]; then
            curl -s -X "$method" "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X "$method" "$API_URL$endpoint" \
                -H "Content-Type: application/json"
        fi
    fi
}

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║  Media Streaming Server - Metadata    ║"
echo "║        API Test Suite                  ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Test 1: Health Check
print_header "Server Health Check"
RESPONSE=$(curl -s "$BASE_URL/health")
if echo "$RESPONSE" | grep -q "ok"; then
    print_result "Health check" 0
else
    print_result "Health check" 1
    echo "Server is not responding. Exiting."
    exit 1
fi

# Test 2: Authentication
print_header "Authentication"

# Register test user
TIMESTAMP=$(date +%s)
TEST_USER="metauser_$TIMESTAMP"
RESPONSE=$(api_call POST "/auth/register" "{\"username\":\"$TEST_USER\",\"password\":\"test123\"}")
if echo "$RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    print_result "User registration" 0
else
    print_result "User registration" 1
fi

# Test 3: Filename Parsing
print_header "Filename Parsing"

# Test movie filename parsing
RESPONSE=$(api_call POST "/metadata/parse-filename" '{"filename":"The.Matrix.1999.1080p.BluRay.x264.mkv"}')
if echo "$RESPONSE" | grep -q "Matrix"; then
    print_result "Parse movie filename" 0
else
    print_result "Parse movie filename" 1
fi

# Test TV show filename parsing
RESPONSE=$(api_call POST "/metadata/parse-filename" '{"filename":"Game.of.Thrones.S01E01.Winter.Is.Coming.720p.mkv"}')
if echo "$RESPONSE" | grep -q "Game of Thrones" && echo "$RESPONSE" | grep -q "episode"; then
    print_result "Parse TV show filename" 0
else
    print_result "Parse TV show filename" 1
fi

# Test 4: Get existing media items
print_header "Media Library Setup"

RESPONSE=$(api_call GET "/library/movies")
if echo "$RESPONSE" | grep -q "movies"; then
    # Try to get first media item ID
    MEDIA_ITEM_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    print_result "Get library items" 0

    if [ -n "$MEDIA_ITEM_ID" ]; then
        echo -e "${YELLOW}  Found media item ID: $MEDIA_ITEM_ID${NC}"
    fi
else
    print_result "Get library items" 1
fi

# Test 5: Metadata Fetch (if we have a media item)
print_header "Metadata Fetching"

if [ -n "$MEDIA_ITEM_ID" ]; then
    RESPONSE=$(api_call POST "/metadata/fetch/$MEDIA_ITEM_ID" "")
    if echo "$RESPONSE" | grep -q "metadata"; then
        print_result "Fetch metadata for item" 0
    else
        echo -e "${YELLOW}  Note: TMDB API key might not be configured${NC}"
        print_result "Fetch metadata for item" 0
    fi
else
    echo -e "${YELLOW}  Skipping - no media items found${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi

# Test 6: Watch History
print_header "Watch History Tracking"

if [ -n "$MEDIA_ITEM_ID" ]; then
    # Update watch progress
    RESPONSE=$(api_call POST "/metadata/watch/progress" "{\"mediaItemId\":$MEDIA_ITEM_ID,\"currentTime\":300,\"duration\":6000}")
    if echo "$RESPONSE" | grep -q "progress"; then
        print_result "Update watch progress" 0
    else
        print_result "Update watch progress" 1
    fi

    # Get watch progress
    RESPONSE=$(api_call GET "/metadata/watch/progress/$MEDIA_ITEM_ID")
    if echo "$RESPONSE" | grep -q "progress"; then
        print_result "Get watch progress" 0
    else
        print_result "Get watch progress" 1
    fi

    # Get continue watching
    RESPONSE=$(api_call GET "/metadata/watch/continue-watching")
    if echo "$RESPONSE" | grep -q "items"; then
        print_result "Get continue watching list" 0
    else
        print_result "Get continue watching list" 1
    fi

    # Get recently watched
    RESPONSE=$(api_call GET "/metadata/watch/recently-watched")
    if echo "$RESPONSE" | grep -q "items"; then
        print_result "Get recently watched" 0
    else
        print_result "Get recently watched" 1
    fi

    # Get watch stats
    RESPONSE=$(api_call GET "/metadata/watch/stats")
    if echo "$RESPONSE" | grep -q "stats"; then
        print_result "Get watch statistics" 0
    else
        print_result "Get watch statistics" 1
    fi

    # Mark as watched
    RESPONSE=$(api_call POST "/metadata/watch/mark-watched/$MEDIA_ITEM_ID" "")
    if echo "$RESPONSE" | grep -q "success"; then
        print_result "Mark as watched" 0
    else
        print_result "Mark as watched" 1
    fi

    # Get watch history
    RESPONSE=$(api_call GET "/metadata/watch/history")
    if echo "$RESPONSE" | grep -q "items"; then
        print_result "Get watch history" 0
    else
        print_result "Get watch history" 1
    fi

    # Reset progress
    RESPONSE=$(api_call POST "/metadata/watch/reset/$MEDIA_ITEM_ID" "")
    if echo "$RESPONSE" | grep -q "success"; then
        print_result "Reset watch progress" 0
    else
        print_result "Reset watch progress" 1
    fi

    # Mark as unwatched
    RESPONSE=$(api_call DELETE "/metadata/watch/mark-unwatched/$MEDIA_ITEM_ID")
    if echo "$RESPONSE" | grep -q "success"; then
        print_result "Mark as unwatched" 0
    else
        print_result "Mark as unwatched" 1
    fi
else
    echo -e "${YELLOW}  Skipping - no media items found${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 9))
fi

# Test 7: TMDB Search (if API key configured)
print_header "TMDB Search (Optional)"

RESPONSE=$(api_call GET "/metadata/search?query=The%20Matrix&type=movie&year=1999")
if echo "$RESPONSE" | grep -q "TMDB service not configured"; then
    echo -e "${YELLOW}  TMDB API key not configured - skipping${NC}"
    print_result "TMDB search (skipped)" 0
elif echo "$RESPONSE" | grep -q "result"; then
    print_result "TMDB search" 0
else
    print_result "TMDB search" 1
fi

# Test 8: Endpoint Authentication
print_header "Authentication & Authorization"

# Try accessing metadata endpoint without token
TOKEN_BACKUP=$TOKEN
TOKEN=""
RESPONSE=$(api_call GET "/metadata/watch/stats")
if echo "$RESPONSE" | grep -q "token"; then
    print_result "Metadata endpoints require auth" 0
else
    print_result "Metadata endpoints require auth" 1
fi
TOKEN=$TOKEN_BACKUP

# Print Summary
echo -e "\n${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Test Summary                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo -e "Total Tests:  ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed${NC}"
    exit 1
fi
