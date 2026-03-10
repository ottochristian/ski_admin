# Get Your Sentry DSN

## Quick Steps

### 1. Get DSN from Sentry Dashboard

Visit your project settings:
```
https://sentry.io/settings/skiadmin-9z/projects/javascript-nextjs/keys/
```

Or manually navigate:
1. Go to https://sentry.io
2. Select organization: **skiadmin-9z**
3. Select project: **javascript-nextjs**
4. Click **Settings** (gear icon)
5. Click **Client Keys (DSN)** in the left sidebar
6. Copy the **DSN** value

### 2. Add DSN to `.env.local`

The DSN will look like:
```
https://1234567890abcdef@o123456.ingest.us.sentry.io/123456
```

Add this line to your `.env.local`:
```bash
NEXT_PUBLIC_SENTRY_DSN=your_dsn_here
```

### 3. Test Sentry is Working

I'll help you test it once you add the DSN!

---

## What the DSN Does

- **DSN** = Data Source Name
- It tells Sentry SDK where to send error data
- Public (safe to commit to git in Next.js apps)
- Unique to your project

---

## Next Steps After Adding DSN

Once you add the DSN, I'll help you:
1. ✅ Test error capture works
2. ✅ Enable performance monitoring
3. ✅ Build the monitoring dashboard
4. ✅ Set up alerts

---

**Go get your DSN and paste it here, or add it to `.env.local` directly!** 🚀
