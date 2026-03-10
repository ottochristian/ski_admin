#!/bin/bash

echo "🧪 Testing Sentry Integration"
echo "=============================="
echo ""

# Check if DSN is set
if grep -q "NEXT_PUBLIC_SENTRY_DSN" .env.local; then
  echo "✅ Sentry DSN found in .env.local"
else
  echo "❌ Sentry DSN not found in .env.local"
  exit 1
fi

# Check if dev server is running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "✅ Dev server is running"
else
  echo "⚠️  Dev server not running. Start it with: npm run dev"
  echo ""
  echo "After starting the server, run this script again."
  exit 1
fi

echo ""
echo "Testing Sentry configuration endpoint..."
RESPONSE=$(curl -s http://localhost:3000/api/test-sentry)
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "Triggering test error..."
echo "⚠️  The following error is INTENTIONAL to test Sentry:"
curl -s http://localhost:3000/api/test-sentry?error=true 2>&1 | head -5

echo ""
echo ""
echo "✅ Test complete!"
echo ""
echo "📊 Check your Sentry dashboard:"
echo "   https://sentry.io/organizations/skiadmin-9z/issues/"
echo ""
echo "You should see the test error within 1-2 minutes."
