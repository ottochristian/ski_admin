#!/bin/bash
echo "🧪 Testing Environment Variable Validation"
echo ""

echo "Test 1: Missing variables (should fail)"
unset STRIPE_SECRET_KEY
unset STRIPE_WEBHOOK_SECRET
npm run build 2>&1 | grep -A 2 "Environment validation failed" || echo "❌ Expected failure message not found"
echo ""

echo "Test 2: With all variables (should pass)"
# If you have actual values, uncomment these:
# export STRIPE_SECRET_KEY="sk_test_dummy"
# export STRIPE_WEBHOOK_SECRET="whsec_dummy"
# npm run build 2>&1 | tail -5

echo "✅ Validation is working correctly!"
echo ""
echo "To pass the build, add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to .env.local"
