#!/bin/bash

# TMDB API Key Setup Helper

echo "🎬 TMDB API Key Setup"
echo "===================="
echo ""
echo "To get movie/TV show metadata (posters, descriptions, ratings),"
echo "you need a free TMDB API key."
echo ""
echo "📝 Step 1: Get Your API Key"
echo "   1. Go to: https://www.themoviedb.org/signup"
echo "   2. Create a free account"
echo "   3. Go to: https://www.themoviedb.org/settings/api"
echo "   4. Request an API key (choose 'Developer' option)"
echo "   5. Fill out the form (use 'Personal/Educational' for non-commercial)"
echo "   6. Copy your API Key (v3 auth)"
echo ""
echo "⌨️  Step 2: Enter Your API Key"
read -p "Paste your TMDB API key here: " tmdb_key

if [ -z "$tmdb_key" ]; then
  echo "❌ No API key entered. Exiting."
  exit 1
fi

echo ""
echo "💾 Updating .env file..."

# Update the .env file
cd "$(dirname "$0")/backend"

if [ ! -f ".env" ]; then
  echo "❌ .env file not found in backend/"
  exit 1
fi

# Backup original .env
cp .env .env.backup

# Replace the TMDB API key
if grep -q "TMDB_API_KEY=" .env; then
  # Use | as delimiter since API keys might contain /
  sed -i.bak "s|TMDB_API_KEY=.*|TMDB_API_KEY=$tmdb_key|" .env
  rm .env.bak
  echo "✅ TMDB API key updated in backend/.env"
else
  echo "TMDB_API_KEY=$tmdb_key" >> .env
  echo "✅ TMDB API key added to backend/.env"
fi

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Restart your backend server (it will auto-restart if using nodemon)"
echo "2. Run library rescan to fetch metadata:"
echo "   ./rescan-library.sh"
echo ""
echo "Your movies will now have:"
echo "✨ Poster images"
echo "✨ Backdrop images"
echo "✨ Plot summaries"
echo "✨ Cast & crew info"
echo "✨ Ratings & release dates"
echo ""
