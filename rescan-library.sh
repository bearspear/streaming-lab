#!/bin/bash

# Rescan Library Script
# This script triggers a library rescan on the backend

echo "🔍 Rescanning media library..."

# Get JWT token (replace with your actual token or login first)
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"michael","password":"password"}' \
  | grep -o '"token":"[^"]*' \
  | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get authentication token"
  echo "Please ensure the backend is running and credentials are correct"
  exit 1
fi

echo "✅ Authenticated successfully"
echo "📚 Triggering library scan..."

# Trigger library scan
RESPONSE=$(curl -s -X POST http://localhost:4000/api/library/scan \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"/Users/mbehringer/Experimental/streaming-lab/test-videos"}')

echo "$RESPONSE"

echo ""
echo "✅ Library scan initiated!"
echo "Check the backend logs to see scan progress"
echo ""
echo "New videos will appear in the library once scan completes"
