#!/bin/bash

# Migration script to convert from old supabase client to SSR client
# Usage: ./migrate-to-ssr.sh

echo "🚀 Starting Supabase SSR migration..."

# Find all .tsx and .ts files that import from supabaseClient
FILES=$(grep -rl "from.*supabaseClient" app lib components 2>/dev/null | grep -E '\.(tsx|ts)$')

COUNT=0
for file in $FILES; do
  # Skip if already migrated (has supabase/client import)
  if grep -q "from.*supabase/client" "$file"; then
    echo "⏭️  Skipping $file (already migrated)"
    continue
  fi
  
  # Skip service files and base files (they use old client)
  if echo "$file" | grep -qE "(service\.ts|supabaseClient\.ts|supabase-server\.ts|supabase-helpers\.ts)"; then
    echo "⏭️  Skipping $file (service/helper file)"
    continue
  fi
  
  echo "🔄 Migrating $file..."
  
  # Step 1: Replace import statement
  sed -i '' "s|from.*['\"]@/lib/supabaseClient['\"]|from '@/lib/supabase/client'|g" "$file"
  sed -i '' "s|from.*['\"].*supabaseClient['\"]|from './supabase/client'|g" "$file"
  sed -i '' "s|import { supabase }|import { createClient }|g" "$file"
  
  # Step 2: For client components, add useState wrapper (manual review needed)
  if grep -q "^'use client'" "$file"; then
    echo "   ⚠️  Client component - may need useState wrapper"
  fi
  
  ((COUNT++))
done

echo "✅ Migration complete! Migrated $COUNT files."
echo ""
echo "📋 Next steps:"
echo "1. Review client components that may need: const [supabase] = useState(() => createClient())"
echo "2. Test the application"
echo "3. Remove old supabaseClient.ts when ready"
