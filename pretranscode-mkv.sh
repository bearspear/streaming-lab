#!/bin/bash

# Pre-transcode MKV Files Utility
# This script triggers pre-transcoding of MKV files to MP4 for faster playback

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎬 MKV Pre-Transcoding Utility${NC}"
echo ""

# Check if backend is running
if ! curl -s http://localhost:4000/health > /dev/null 2>&1; then
  echo -e "${RED}❌ Backend server is not running${NC}"
  echo "Please start the backend server first:"
  echo "  cd backend && npm run dev"
  exit 1
fi

echo -e "${GREEN}✅ Backend server is running${NC}"
echo ""

# Get JWT token
echo -e "${BLUE}🔐 Authenticating...${NC}"
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"michael","password":"password"}' \
  | grep -o '"token":"[^"]*' \
  | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to get authentication token${NC}"
  echo "Please check your credentials"
  exit 1
fi

echo -e "${GREEN}✅ Authenticated successfully${NC}"
echo ""

# Display menu
echo -e "${YELLOW}Select an option:${NC}"
echo "1) Pre-transcode a specific MKV file (by ID)"
echo "2) Pre-transcode ALL MKV files in library"
echo "3) List all MKV files"
echo "4) Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    # Pre-transcode specific file
    read -p "Enter media ID: " media_id
    read -p "Enter quality (360p/480p/720p/1080p) [default: 720p]: " quality
    quality=${quality:-720p}

    echo ""
    echo -e "${BLUE}📹 Starting pre-transcode for media ID $media_id at $quality...${NC}"

    RESPONSE=$(curl -s -X POST "http://localhost:4000/api/stream/$media_id/pretranscode" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"quality\":\"$quality\"}")

    echo "$RESPONSE" | jq '.'
    echo ""
    echo -e "${GREEN}✅ Pre-transcoding initiated!${NC}"
    echo "Check backend logs for progress"
    ;;

  2)
    # Pre-transcode all MKV files
    read -p "Enter quality (360p/480p/720p/1080p) [default: 720p]: " quality
    quality=${quality:-720p}

    echo ""
    echo -e "${YELLOW}⚠️  This will pre-transcode ALL MKV files in your library.${NC}"
    echo "This may take a long time and consume significant CPU resources."
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
      echo "Cancelled."
      exit 0
    fi

    echo ""
    echo -e "${BLUE}📹 Starting batch pre-transcode at $quality...${NC}"

    RESPONSE=$(curl -s -X POST "http://localhost:4000/api/stream/pretranscode/all" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"quality\":\"$quality\"}")

    echo "$RESPONSE" | jq '.'
    echo ""
    echo -e "${GREEN}✅ Batch pre-transcoding initiated!${NC}"
    echo "Check backend logs for progress"
    echo ""
    echo "Transcoded files will be saved in: backend/data/cache/"
    ;;

  3)
    # List all MKV files
    echo ""
    echo -e "${BLUE}📋 Listing all MKV files in library...${NC}"
    echo ""

    MOVIES=$(curl -s -X GET "http://localhost:4000/api/library/movies" \
      -H "Authorization: Bearer $TOKEN")

    echo "$MOVIES" | jq -r '.movies[] | select(.file_path | contains(".mkv")) | "\(.id)\t\(.title)\t\(.file_path)"' | \
      while IFS=$'\t' read -r id title path; do
        echo -e "${GREEN}ID: $id${NC}"
        echo -e "  Title: $title"
        echo -e "  Path: $path"
        echo ""
      done
    ;;

  4)
    echo "Exiting..."
    exit 0
    ;;

  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac
