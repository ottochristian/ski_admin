#!/bin/bash

# Script to add supabase client initialization in files that use it

echo "🔧 Adding supabase client initialization..."

# Find files that import createClient but don't initialize supabase
FILES=$(grep -l "import.*createClient.*from.*supabase/client" app/**/*.tsx 2>/dev/null | while read file; do
  if grep -q "createClient" "$file" && ! grep -q "supabase.*=.*createClient()" "$file"; then
    echo "$file"
  fi
done)

for file in $FILES; do
  echo "📝 Fixing $file..."
  
  # Check if it's a client component
  if grep -q "^'use client'" "$file"; then
    # Find the component function declaration
    FUNC_LINE=$(grep -n "^export default function" "$file" | head -1 | cut -d: -f1)
    
    if [ -n "$FUNC_LINE" ]; then
      # Add useState initialization after the function declaration
      # Check if useState is imported
      if ! grep -q "import.*useState" "$file"; then
        # Add useState to imports
        sed -i '' "s/import {/import { useState,/" "$file"
      fi
      
      # Find first line inside function (after the opening brace)
      INSERT_LINE=$((FUNC_LINE + 1))
      
      # Add supabase initialization if not already there
      if ! grep -q "supabase.*useState.*createClient" "$file"; then
        sed -i '' "${INSERT_LINE}a\\
  const [supabase] = useState(() => createClient())\\
" "$file"
      fi
    fi
  fi
done

echo "✅ Client initialization complete!"
