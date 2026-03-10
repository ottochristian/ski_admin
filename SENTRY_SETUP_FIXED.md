# Sentry Setup Fixed - Following Official Guide

## ✅ What Was Fixed

### **Problem**: Using Old File Structure
The previous setup used the deprecated file pattern (`sentry.client.config.ts`) instead of the current Next.js 13+ pattern.

### **Solution**: Migrated to Current Pattern

**Old Structure** ❌:
- `sentry.client.config.ts` (deprecated)
- `sentry.server.config.ts` ✅
- `sentry.edge.config.ts` ✅
- **Missing** `instrumentation.ts`
- **Missing** `withSentryConfig()` wrapper in next.config

**New Structure** ✅:
- `instrumentation-client.ts` (NEW - browser runtime)
- `sentry.server.config.ts` (kept, Node.js runtime)
- `sentry.edge.config.ts` (kept, Edge runtime)
- `instrumentation.ts` (NEW - runtime dispatcher)
- `next.config.ts` wrapped with `withSentryConfig()`

---

## 📂 Files Created/Modified

### 1. `instrumentation-client.ts` (NEW)
**Purpose**: Browser/client-side Sentry initialization  
**Features**:
- Error tracking
- Performance monitoring (10% in prod, 100% in dev)
- Session Replay (10% of sessions, 100% of error sessions)
- Privacy: masks all text, blocks media
- Filters sensitive data (auth headers, cookies, emails)
- Hooks into App Router navigation

### 2. `instrumentation.ts` (NEW)
**Purpose**: Server-side registration hook  
**Features**:
- Runtime dispatch (Node.js vs Edge)
- Automatic `onRequestError` capture
- Loads appropriate config per runtime

### 3. `next.config.ts` (MODIFIED)
**Added**: `withSentryConfig()` wrapper  
**Features**:
- Source map upload (requires `SENTRY_AUTH_TOKEN`)
- Ad-blocker bypass via tunnel route (`/monitoring-tunnel`)
- Wider client file upload for better stack traces
- Hide source maps from client bundles (security)

---

## 🔧 Configuration Details

### Environment Variables

**Already Set**:
```bash
NEXT_PUBLIC_SENTRY_DSN=https://2098b9b786231848cd146a782c9cecc1@o4511017788178432.ingest.us.sentry.io/4511017811771392
SENTRY_ENABLED_IN_DEV=true
```

**Needed for Source Maps** (optional, for production):
```bash
SENTRY_AUTH_TOKEN=your_auth_token_here
```

To get auth token:
1. Go to: https://sentry.io/settings/auth-tokens/
2. Create token with `project:releases` and `org:read` scopes
3. Add to `.env.sentry-build-plugin` (gitignored)

### Sentry Config

**Organization**: `skiadmin-9z`  
**Project**: `javascript-nextjs`  
**DSN**: Set in `.env.local`

### Sample Rates (Optimized for Free Tier)

**Performance Tracing**:
- Development: 100% (trace everything)
- Production: 10% (5K transactions/month max on free tier)

**Session Replay**:
- Normal sessions: 10%
- Sessions with errors: 100% (always record errors)

---

## 🧪 Testing

### Test 1: API Error
```bash
curl http://localhost:3000/api/test-sentry?error=true
```
Should return HTTP 500 and send error to Sentry.

### Test 2: Client Error
Add to any page:
```tsx
<button onClick={() => { throw new Error('Test client error!') }}>
  Test Sentry
</button>
```

### Test 3: Check Sentry Dashboard
Visit: https://sentry.io/organizations/skiadmin-9z/issues/

You should see errors appear within 10-30 seconds.

---

## 📊 What's Captured

### Automatic Capture
- ✅ **All server errors** (API routes, server actions, server components)
- ✅ **All client errors** (React errors, unhandled promise rejections)
- ✅ **Edge runtime errors** (middleware, edge functions)
- ✅ **Performance data** (API response times, navigation speed)
- ✅ **Session replays** (video of user sessions with errors)

### Privacy Features
- ✅ **Masks all text** in session replays
- ✅ **Blocks media** (images, videos) in replays
- ✅ **Filters auth headers** (Authorization, Cookie)
- ✅ **Removes PII** (emails, IP addresses)
- ✅ **Filters sensitive env vars** (Stripe keys, Supabase keys, etc.)

### Ignored Errors
- Browser extension errors
- Network timeouts (non-critical)
- ResizeObserver errors (cosmetic)
- Cancelled requests

---

## 🎯 Next Steps

1. **Verify Sentry is Working**
   - Check dashboard for test errors
   - Look for error count to increment

2. **Optional: Set Up Source Maps**
   - Get auth token from Sentry
   - Add `SENTRY_AUTH_TOKEN` to `.env.sentry-build-plugin`
   - Run `npm run build` to test upload

3. **Set Up Alerts** (Recommended)
   - Go to: https://sentry.io/organizations/skiadmin-9z/alerts/rules/
   - Create alert for new issues (email notification)
   - Create alert for error rate spike

4. **Build Monitoring Dashboard**
   - Now that Sentry is working, build the Super Admin dashboard
   - Integrate Sentry API to show real-time errors
   - Combine with custom business metrics

---

## 🔗 Reference

Based on official Sentry guide:
- https://github.com/getsentry/sentry-for-ai/blob/main/skills/sentry-nextjs-sdk/SKILL.md
- https://docs.sentry.io/platforms/javascript/guides/nextjs/

**Key Changes from Old Docs**:
- `sentry.client.config.ts` → `instrumentation-client.ts`
- Must have `instrumentation.ts` for server-side init
- Must wrap `next.config` with `withSentryConfig()`

---

## ✅ Status

- ✅ Sentry SDK installed (@sentry/nextjs 10.42.0)
- ✅ Config files migrated to current pattern
- ✅ Runtime dispatcher created
- ✅ Next.js config wrapped
- ✅ Test endpoint working (HTTP 500 on error)
- ⏳ **Awaiting verification in Sentry dashboard**

**Once verified, we can proceed to build the monitoring dashboard!** 🚀
