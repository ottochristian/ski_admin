#!/bin/bash

# Add supabase initialization to files that need it

FILES=(
  "app/admin/coaches/new/page.tsx"
  "app/admin/programs/[programId]/sub-programs/page.tsx"
  "app/admin/programs/page.tsx"
  "app/admin/sub-programs/[subProgramId]/edit/page.tsx"
  "app/admin/sub-programs/[subProgramId]/groups/page.tsx"
  "app/clubs/[clubSlug]/admin/athletes/new/page.tsx"
  "app/clubs/[clubSlug]/admin/coaches/new/page.tsx"
  "app/clubs/[clubSlug]/admin/programs/[programId]/sub-programs/page.tsx"
  "app/clubs/[clubSlug]/admin/programs/page.tsx"
  "app/clubs/[clubSlug]/admin/sub-programs/[subProgramId]/groups/page.tsx"
  "app/clubs/[clubSlug]/parent/athletes/new/page.tsx"
  "app/clubs/[clubSlug]/parent/billing/page.tsx"
  "app/clubs/[clubSlug]/parent/cart/page.tsx"
  "app/clubs/[clubSlug]/parent/layout.tsx"
  "app/clubs/[clubSlug]/parent/profile/page.tsx"
  "app/coach/athletes/page.tsx"
  "app/coach/profile/page.tsx"
  "app/page.tsx"
  "app/system-admin/admins/page.tsx"
  "components/create-club-admin-dialog.tsx"
  "components/image-upload.tsx"
  "components/profile-menu.tsx"
)

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    continue
  fi
  
  echo "📝 Adding supabase init to $file..."
  
  # Find the first function/component declaration
  FUNC_LINE=$(grep -n "export default function\|^function\|^export function" "$file" | head -1 | cut -d: -f1)
  
  if [ -n "$FUNC_LINE" ]; then
    # Find the line after the opening brace of the function
    BRACE_LINE=$(tail -n +$FUNC_LINE "$file" | grep -n "{" | head -1 | cut -d: -f1)
    if [ -n "$BRACE_LINE" ]; then
      INSERT_LINE=$((FUNC_LINE + BRACE_LINE))
      
      # Add supabase initialization
      sed -i '' "${INSERT_LINE}a\\
  const [supabase] = useState(() => createClient())\\
" "$file"
    fi
  fi
done

echo "✅ Done!"
