#!/bin/bash

# Media Streaming Server API Test Script
# This script tests all API endpoints

BASE_URL="http://localhost:4000"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
print_test() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ $2${NC}"
        ((TESTS_FAILED++))
    fi
}

echo "=========================================="
echo "Media Streaming Server API Test Suite"
echo "=========================================="
echo ""

# Test 1: Health Check
echo "Test 1: Health Check Endpoint"
RESPONSE=$(curl -s -w "\n%{http_code}" ${BASE_URL}/health)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "ok"; then
    print_test 0 "Health check endpoint returns 200 OK"
    echo "   Response: $BODY"
else
    print_test 1 "Health check endpoint returns 200 OK"
fi
echo ""

# Test 2: API Root
echo "Test 2: API Root Endpoint"
RESPONSE=$(curl -s -w "\n%{http_code}" ${BASE_URL}/api)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "Media Streaming Server API"; then
    print_test 0 "API root endpoint returns 200 OK"
    echo "   Response: $BODY"
else
    print_test 1 "API root endpoint returns 200 OK"
fi
echo ""

# Test 3: User Registration
echo "Test 3: User Registration"
USERNAME="testuser_$(date +%s)"
PASSWORD="TestPassword123!"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ] && echo "$BODY" | grep -q "token"; then
    print_test 0 "User registration successful"
    TOKEN=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")
    echo "   Token: ${TOKEN:0:20}..."
else
    print_test 1 "User registration successful"
    echo "   Response: $BODY"
fi
echo ""

# Test 4: Duplicate Registration
echo "Test 4: Duplicate User Registration (Should Fail)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "409" ] && echo "$BODY" | grep -q "already exists"; then
    print_test 0 "Duplicate registration properly rejected"
    echo "   Response: $BODY"
else
    print_test 1 "Duplicate registration properly rejected"
fi
echo ""

# Test 5: Login with Correct Credentials
echo "Test 5: User Login (Correct Credentials)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "token"; then
    print_test 0 "Login with correct credentials successful"
    TOKEN=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")
    echo "   Token received"
else
    print_test 1 "Login with correct credentials successful"
    echo "   Response: $BODY"
fi
echo ""

# Test 6: Login with Incorrect Credentials
echo "Test 6: User Login (Incorrect Password)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"WrongPassword123!\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ] && echo "$BODY" | grep -q "Invalid credentials"; then
    print_test 0 "Invalid login properly rejected"
    echo "   Response: $BODY"
else
    print_test 1 "Invalid login properly rejected"
fi
echo ""

# Test 7: Token Verification
echo "Test 7: Token Verification"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/auth/verify \
  -H "Authorization: Bearer ${TOKEN}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "valid"; then
    print_test 0 "Token verification successful"
    echo "   Response: $BODY"
else
    print_test 1 "Token verification successful"
    echo "   Response: $BODY"
fi
echo ""

# Test 8: Access Protected Route Without Token
echo "Test 8: Access Protected Route Without Token"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/library/movies)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
    print_test 0 "Protected route properly requires authentication"
    echo "   Response: $BODY"
else
    print_test 1 "Protected route properly requires authentication"
fi
echo ""

# Test 9: Get Movies with Valid Token
echo "Test 9: Get Movies (Authenticated)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/library/movies \
  -H "Authorization: Bearer ${TOKEN}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "count"; then
    print_test 0 "Get movies with authentication successful"
    echo "   Response: $BODY"
else
    print_test 1 "Get movies with authentication successful"
    echo "   Response: $BODY"
fi
echo ""

# Test 10: Invalid Token
echo "Test 10: Access with Invalid Token"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/library/movies \
  -H "Authorization: Bearer invalid_token_here")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "403" ]; then
    print_test 0 "Invalid token properly rejected"
    echo "   Response: $BODY"
else
    print_test 1 "Invalid token properly rejected"
fi
echo ""

# Test 11: Registration Validation (Short Password)
echo "Test 11: Registration Validation (Short Password)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"validuser","password":"123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ] && echo "$BODY" | grep -qi "password.*6"; then
    print_test 0 "Short password properly rejected"
    echo "   Response: $BODY"
else
    print_test 1 "Short password properly rejected"
    echo "   Response: $BODY"
fi
echo ""

# Test 12: Registration Validation (Short Username)
echo "Test 12: Registration Validation (Short Username)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${BASE_URL}/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"ab","password":"ValidPassword123!"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ] && echo "$BODY" | grep -qi "username.*3"; then
    print_test 0 "Short username properly rejected"
    echo "   Response: $BODY"
else
    print_test 1 "Short username properly rejected"
    echo "   Response: $BODY"
fi
echo ""

# Test 13: 404 for Non-existent Routes
echo "Test 13: 404 for Non-existent Routes"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/nonexistent)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "404" ]; then
    print_test 0 "Non-existent route returns 404"
    echo "   Response: $BODY"
else
    print_test 1 "Non-existent route returns 404"
fi
echo ""

# Test 14: Get Scan Progress
echo "Test 14: Get Scan Progress"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET ${BASE_URL}/api/library/scan/progress \
  -H "Authorization: Bearer ${TOKEN}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "isScanning"; then
    print_test 0 "Get scan progress successful"
    echo "   Response: $BODY"
else
    print_test 1 "Get scan progress successful"
    echo "   Response: $BODY"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed ✗${NC}"
    exit 1
fi
