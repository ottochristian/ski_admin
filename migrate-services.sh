#!/bin/bash

# Script to migrate services to use dependency injection

echo "🔧 Migrating services to use dependency injection..."

SERVICES=(
  "lib/services/programs-service.ts"
  "lib/services/household-guardians-service.ts"
  "lib/services/registrations-service.ts"
  "lib/services/athletes-service.ts"
  "lib/services/orders-service.ts"
  "lib/services/coach-assignments-service.ts"
  "lib/services/households-service.ts"
  "lib/services/sub-programs-service.ts"
  "lib/services/seasons-service.ts"
  "lib/services/coaches-service.ts"
  "lib/services/profiles-service.ts"
  "lib/services/household-guardians-service.ts"
)

for service in "${SERVICES[@]}"; do
  if [ ! -f "$service" ]; then
    continue
  fi
  
  echo "📝 Processing $service..."
  
  # Remove old supabase import
  sed -i '' '/^import.*supabase.*from.*supabaseClient/d' "$service"
  
  # Add service client import after base-service import
  if ! grep -q "getServiceClient" "$service"; then
    sed -i '' '/import.*BaseService.*from.*base-service/a\
import { getServiceClient } from '\''./service-client'\''
' "$service"
  fi
  
  # Find the class name
  CLASS_NAME=$(grep -o 'export class [A-Za-z]*Service' "$service" | awk '{print $3}')
  
  if [ -n "$CLASS_NAME" ]; then
    # Add constructor after class declaration if not exists
    if ! grep -q "constructor" "$service"; then
      # Find line with "extends BaseService {"
      LINE_NUM=$(grep -n "extends BaseService {" "$service" | cut -d: -f1)
      if [ -n "$LINE_NUM" ]; then
        # Insert constructor after the class opening
        sed -i '' "${LINE_NUM}a\\
  constructor(supabase = getServiceClient()) {\\
    super(supabase)\\
  }\\
" "$service"
      fi
    fi
    
    # Update singleton export to use getServiceClient()
    INSTANCE_NAME=$(echo "$CLASS_NAME" | sed 's/Service$//' | awk '{print tolower(substr($0,1,1)) substr($0,2)}')
    if grep -q "export const ${INSTANCE_NAME}Service = new ${CLASS_NAME}()" "$service"; then
      sed -i '' "s/export const ${INSTANCE_NAME}Service = new ${CLASS_NAME}()/export const ${INSTANCE_NAME}Service = new ${CLASS_NAME}(getServiceClient())/" "$service"
    fi
  fi
done

echo "✅ Service migration complete!"
