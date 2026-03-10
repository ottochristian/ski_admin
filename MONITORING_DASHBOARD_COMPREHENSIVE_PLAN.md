# Super Admin Monitoring Dashboard - Comprehensive Plan

## 🎯 Vision
A single-page dashboard that provides real-time visibility into 90%+ of your application's health, errors, performance, and business metrics.

**URL**: `/system-admin/monitoring`  
**Access**: System admin role only

---

## 📐 Dashboard Layout & Views

### **Layout Structure**

```
┌─────────────────────────────────────────────────────────────────┐
│  [Super Admin Header]                      [Last Updated: 2s ago]│
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    SYSTEM HEALTH STATUS                      ││
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           ││
│  │  │   🟢   │  │   🟢   │  │   ⚠️   │  │   🟢   │           ││
│  │  │Database│  │ Stripe │  │  Email │  │Webhooks│           ││
│  │  │Healthy │  │Connected│ │2 Failed│  │ 98% OK │           ││
│  │  └────────┘  └────────┘  └────────┘  └────────┘           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌────────────────────────────────────────┐  ┌────────────────┐│
│  │        KEY METRICS (Last 24h)          │  │  ERROR FEED    ││
│  │  ┌──────────────────────────────────┐  │  │                ││
│  │  │ 📊 Registrations:  147  (+12%)   │  │  │  🔴 Payment    ││
│  │  │ 💰 Revenue:    $12,450  (+8%)    │  │  │     failed     ││
│  │  │ ❌ Failed Payments:  3   (→)     │  │  │     2m ago     ││
│  │  │ ⚡ Avg Response:  234ms  (→)     │  │  │                ││
│  │  │ 🐛 Error Rate:   0.2%   (↓5%)    │  │  │  ⚠️ Slow API   ││
│  │  └──────────────────────────────────┘  │  │     detected   ││
│  └────────────────────────────────────────┘  │     5m ago     ││
│                                               │                ││
│  ┌────────────────────────────────────────┐  │  🟡 High       ││
│  │     PERFORMANCE INDICATORS             │  │     memory     ││
│  │  ┌──────────────────────────────────┐  │  │     8m ago     ││
│  │  │ API Endpoints (Slowest):         │  │  │                ││
│  │  │  • /api/registrations  1.2s      │  │  │  [View All]    ││
│  │  │  • /api/athletes       890ms     │  │  └────────────────┘│
│  │  │  • /api/programs       450ms     │  │                    │
│  │  │                                  │  │                    │
│  │  │ Database Queries:                │  │                    │
│  │  │  • Average: 45ms                 │  │                    │
│  │  │  • P95: 180ms                    │  │                    │
│  │  │  • Slow queries: 3               │  │                    │
│  │  └──────────────────────────────────┘  │                    │
│  └────────────────────────────────────────┘                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     ALERTS & WARNINGS                        ││
│  │  🔴 Critical: Payment webhook failed 3x in last 10 minutes  ││
│  │     [Retry Webhooks] [View Logs]                            ││
│  │                                                              ││
│  │  ⚠️  Warning: Error rate elevated (0.5% → 2.1%)            ││
│  │     [View Errors in Sentry]                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Detailed View Specifications

### **View 1: System Health Cards** (Top Section)

**Purpose**: At-a-glance system status

**Components**: 6 status cards

#### Card 1: Database
```
┌────────────────┐
│    DATABASE    │
│    🟢 Healthy  │
│                │
│  Response: 12ms│
│  RLS: Active   │
│  [Test Query]  │
└────────────────┘
```

**Data Points**:
- Status: Healthy / Degraded / Down
- Average query response time (last 5 min)
- RLS policies active
- Connection pool status
- Last successful query timestamp

**Test Action**: Run a test query to verify connectivity

#### Card 2: Stripe
```
┌────────────────┐
│     STRIPE     │
│  🟢 Connected  │
│                │
│ Webhooks: 98%  │
│ Last: 2m ago   │
│  [Test API]    │
└────────────────┘
```

**Data Points**:
- API connectivity status
- Webhook success rate (last 24h)
- Last successful webhook
- Pending failed webhooks
- Test mode vs Live mode indicator

**Test Action**: Ping Stripe API to verify connection

#### Card 3: Email (SendGrid)
```
┌────────────────┐
│     EMAIL      │
│  ⚠️ 2 Failed   │
│                │
│ Success: 95%   │
│ Queue: 3 msgs  │
│ [View Failures]│
└────────────────┘
```

**Data Points**:
- Success rate (last 24h)
- Failed emails count
- Queued messages
- Last successful send
- Bounce/spam rate

**Action**: View failed email logs

#### Card 4: SMS (Twilio)
```
┌────────────────┐
│      SMS       │
│   🟢 Active    │
│                │
│ Sent: 47       │
│ Cost: $2.35    │
│ [Test Send]    │
└────────────────┘
```

**Data Points**:
- Messages sent (last 24h)
- Failed messages
- Total cost
- Rate limit status
- Phone number active

#### Card 5: Webhooks
```
┌────────────────┐
│   WEBHOOKS     │
│   🟢 98% OK    │
│                │
│ Total: 156     │
│ Failed: 3      │
│ [Retry Failed] │
└────────────────┘
```

**Data Points**:
- Success rate (last 24h)
- Total webhooks received
- Failed webhooks (with types)
- Average processing time
- Last webhook timestamp

**Action**: Retry failed webhooks

#### Card 6: Background Jobs
```
┌────────────────┐
│  BACKGROUND    │
│   🟢 Running   │
│                │
│ Active: 2      │
│ Failed: 0      │
│ [View Queue]   │
└────────────────┘
```

**Data Points**:
- Active jobs
- Failed jobs (last 24h)
- Queue length
- Average job duration
- Next scheduled job

---

### **View 2: Key Business Metrics** (Middle Left)

**Purpose**: Track core business KPIs

**Layout**: Card with 6-8 metric rows

```
┌─────────────────────────────────────────────┐
│      KEY METRICS (Last 24 Hours)            │
├─────────────────────────────────────────────┤
│                                             │
│  📊 Registrations                           │
│     147 registrations   ↑ +12% vs yesterday│
│     Chart: ▁▂▃▅▇█▆▄▃                       │
│                                             │
│  💰 Revenue                                 │
│     $12,450.00         ↑ +8.2% vs yesterday│
│     Chart: ▂▃▄▅▇█▆▅▄                       │
│                                             │
│  ❌ Failed Payments                         │
│     3 failures         → Same as yesterday  │
│     [View Details]                          │
│                                             │
│  📝 Active Sessions                         │
│     45 users online    ↑ +5% vs yesterday  │
│                                             │
│  ⚡ API Response Time                       │
│     234ms average      → Same as yesterday  │
│     P95: 890ms                              │
│                                             │
│  🐛 Error Rate                              │
│     0.2% (2/1000)     ↓ -5% vs yesterday   │
│     Chart: ▇▅▄▃▂▁▁▁                        │
│                                             │
│  📧 Email Delivery                          │
│     95% success rate   ↓ -2% vs yesterday  │
│     [View Failed]                           │
│                                             │
└─────────────────────────────────────────────┘
```

**Data Sources**:
- Registrations: `application_metrics` table + Supabase query
- Revenue: Stripe API + local payment records
- Failed Payments: Stripe webhook events + local logs
- Active Sessions: Supabase auth sessions
- API Response: `application_metrics` table
- Error Rate: Sentry API + local error logs
- Email: SendGrid API + local tracking

**Features**:
- Sparkline charts (inline mini charts)
- Trend indicators (↑↓→)
- % change vs previous period
- Click to drill down for details

---

### **View 3: Real-Time Error Feed** (Middle Right)

**Purpose**: Live stream of errors from Sentry

**Layout**: Scrollable list of recent errors

```
┌──────────────────────────────────┐
│        ERROR FEED                │
├──────────────────────────────────┤
│                                  │
│  🔴 TypeError: Cannot read...    │
│     /api/checkout/route.ts:45    │
│     2 minutes ago                │
│     Affected 3 users             │
│     [View in Sentry] [Mark Read] │
│                                  │
│  ⚠️  Slow API Response            │
│     /api/registrations (2.1s)    │
│     5 minutes ago                │
│     [View Performance]           │
│                                  │
│  🟡 High Memory Usage (85%)      │
│     Server: production-1         │
│     8 minutes ago                │
│     [View Metrics]               │
│                                  │
│  🔴 Payment Failed                │
│     Stripe: card_declined        │
│     12 minutes ago               │
│     [Contact User]               │
│                                  │
│  ⚠️  Database Slow Query          │
│     SELECT * FROM athletes...    │
│     15 minutes ago (450ms)       │
│     [Optimize Query]             │
│                                  │
│  [Load More...]                  │
│  [View All in Sentry]            │
│                                  │
└──────────────────────────────────┘
```

**Error Severity Icons**:
- 🔴 Critical (requires immediate action)
- ⚠️ Warning (should investigate)
- 🟡 Info (FYI, no action needed)

**Data Source**: Sentry API `/organizations/{org}/issues/`

**Features**:
- Auto-refresh every 30s
- Click to open in Sentry
- Mark as read/acknowledged
- Filter by severity
- Search errors

---

### **View 4: Performance Indicators** (Bottom Left)

**Purpose**: Identify performance bottlenecks

```
┌─────────────────────────────────────────────┐
│      PERFORMANCE INDICATORS                 │
├─────────────────────────────────────────────┤
│                                             │
│  API Endpoints (Slowest Last Hour)          │
│  ┌─────────────────────────────────────┐   │
│  │ /api/registrations/summary   1.2s   │   │
│  │ /api/athletes                890ms  │   │
│  │ /api/programs                450ms  │   │
│  │ /api/orders                  320ms  │   │
│  └─────────────────────────────────────┘   │
│  [View All Endpoints]                       │
│                                             │
│  Database Performance                       │
│  ┌─────────────────────────────────────┐   │
│  │ Average Query Time:        45ms     │   │
│  │ P95 Query Time:           180ms     │   │
│  │ Slow Queries (>500ms):      3       │   │
│  │ Connection Pool:         8/20       │   │
│  └─────────────────────────────────────┘   │
│  [View Slow Queries]                        │
│                                             │
│  Frontend Performance                       │
│  ┌─────────────────────────────────────┐   │
│  │ Largest Contentful Paint: 1.2s      │   │
│  │ First Input Delay:        45ms      │   │
│  │ Cumulative Layout Shift:  0.05      │   │
│  └─────────────────────────────────────┘   │
│  [View Full Report]                         │
│                                             │
└─────────────────────────────────────────────┘
```

**Data Sources**:
- API Performance: `application_metrics` table
- Database: Supabase logs + custom tracking
- Frontend: Sentry Performance API + Web Vitals

---

### **View 5: Alerts & Warnings** (Bottom Full Width)

**Purpose**: Actionable alerts requiring attention

```
┌───────────────────────────────────────────────────────────────────┐
│                    ALERTS & WARNINGS                              │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  🔴 CRITICAL                                                      │
│  Payment webhook failed 3 consecutive times in last 10 minutes    │
│  Last error: "Connection timeout to Stripe"                       │
│  Affected: 3 pending payments ($450.00)                           │
│  [Retry Webhooks Now] [View Webhook Logs] [Notify Team]          │
│                                                                   │
│  ⚠️  WARNING                                                      │
│  Error rate elevated: 0.5% → 2.1% (4x increase)                  │
│  Most common: "TypeError in checkout flow"                        │
│  [View Errors in Sentry] [Check Recent Deploy]                   │
│                                                                   │
│  ⚠️  WARNING                                                      │
│  Email delivery rate dropped: 98% → 88%                           │
│  Bounces increased by 12 in last hour                             │
│  [Check SendGrid Status] [Review Bounce List]                    │
│                                                                   │
│  🟡 INFO                                                          │
│  Database backup completed successfully                           │
│  Size: 2.3 GB, Duration: 45s                                      │
│  [View Backup Details]                                            │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Alert Priority**:
1. 🔴 Critical: Immediate action required, affects users
2. ⚠️ Warning: Should investigate, potential issues
3. 🟡 Info: FYI, no action needed

**Auto-Generated Alerts**:
- Error rate spike (>2x normal)
- Payment failures (>5 in 10 min)
- API response time >5s
- Webhook failures (>3 consecutive)
- Email delivery rate <90%
- Database connection failures
- High memory/CPU usage (>90%)

---

## 🛠️ Technical Implementation

### **Frontend Stack**

**Framework**: Next.js App Router  
**Location**: `app/system-admin/monitoring/page.tsx`

**Components**:
```
components/monitoring/
  ├── SystemHealthCard.tsx
  ├── MetricsPanel.tsx
  ├── ErrorFeed.tsx
  ├── PerformancePanel.tsx
  ├── AlertsList.tsx
  └── SparklineChart.tsx
```

**UI Libraries**:
- shadcn/ui for cards, buttons, badges
- Recharts or Chart.js for sparklines
- React Query for data fetching
- SWR for real-time updates (auto-refresh)

### **Backend APIs**

Create these new API routes:

#### 1. Health Check (Enhanced)
```
GET /api/monitoring/health
```

**Response**:
```json
{
  "database": {
    "status": "healthy",
    "responseTime": 12,
    "rlsActive": true,
    "connectionPool": { "active": 8, "max": 20 }
  },
  "stripe": {
    "status": "connected",
    "webhookSuccessRate": 0.98,
    "lastWebhook": "2026-03-09T20:25:00Z"
  },
  "email": {
    "status": "degraded",
    "successRate": 0.95,
    "failed": 2,
    "queued": 3
  },
  "sms": {
    "status": "active",
    "sent24h": 47,
    "cost24h": 2.35
  }
}
```

#### 2. Metrics Summary
```
GET /api/monitoring/metrics?period=24h
```

**Response**:
```json
{
  "registrations": {
    "count": 147,
    "trend": "+12%",
    "sparkline": [10, 15, 18, 22, 25, 30, 27]
  },
  "revenue": {
    "amount": 12450.00,
    "trend": "+8.2%",
    "sparkline": [1200, 1400, 1600, 1800, 2000, 2100, 1950]
  },
  "errors": {
    "count": 2,
    "rate": 0.002,
    "trend": "-5%"
  }
}
```

#### 3. Sentry Errors
```
GET /api/monitoring/errors?limit=20
```

Fetches from Sentry API:
```javascript
const sentryResponse = await fetch(
  `https://sentry.io/api/0/organizations/skiadmin-9z/issues/?project=4511017811771392&limit=20`,
  { headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` } }
)
```

#### 4. Performance Data
```
GET /api/monitoring/performance
```

**Response**:
```json
{
  "api": {
    "slowest": [
      { "endpoint": "/api/registrations", "avgTime": 1200 },
      { "endpoint": "/api/athletes", "avgTime": 890 }
    ]
  },
  "database": {
    "avgQueryTime": 45,
    "p95QueryTime": 180,
    "slowQueries": 3
  }
}
```

#### 5. Alerts
```
GET /api/monitoring/alerts
```

**Response**:
```json
{
  "alerts": [
    {
      "severity": "critical",
      "title": "Payment webhook failed",
      "message": "3 consecutive failures",
      "timestamp": "2026-03-09T20:15:00Z",
      "actions": ["retry", "view_logs"]
    }
  ]
}
```

### **Database Schema**

Create new table: `application_metrics`

```sql
CREATE TABLE application_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

CREATE INDEX idx_metrics_name_time ON application_metrics(metric_name, recorded_at DESC);
CREATE INDEX idx_metrics_severity ON application_metrics(severity, recorded_at DESC);
CREATE INDEX idx_metrics_recent ON application_metrics(recorded_at DESC) WHERE recorded_at > NOW() - INTERVAL '24 hours';
```

**Metric Examples**:
- `registration.created`
- `payment.succeeded`
- `payment.failed`
- `webhook.received`
- `webhook.failed`
- `api.response_time`
- `email.sent`
- `email.failed`

### **Helper Library**

Create `lib/metrics.ts`:

```typescript
export async function recordMetric(
  name: string,
  value: number,
  metadata?: Record<string, any>,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
) {
  // Non-blocking: fire and forget
  const supabase = createAdminClient()
  
  await supabase.from('application_metrics').insert({
    metric_name: name,
    metric_value: value,
    metadata: metadata || {},
    severity
  })
  
  // Also send critical events to Sentry
  if (severity === 'critical' || severity === 'error') {
    Sentry.captureMessage(`Metric Alert: ${name}`, {
      level: severity === 'critical' ? 'error' : 'warning',
      extra: { value, metadata }
    })
  }
}
```

---

## 🎨 UI Design Specs

### **Color Coding**

**Status Colors**:
- 🟢 Green: `#10B981` (Healthy, OK)
- 🟡 Yellow: `#F59E0B` (Warning, Degraded)
- 🔴 Red: `#EF4444` (Critical, Error)
- ⚪ Gray: `#6B7280` (Unknown, Offline)

**Backgrounds**:
- Cards: White (`#FFFFFF`)
- Dashboard: Light gray (`#F9FAFB`)
- Headers: Dark gray (`#1F2937`)

### **Typography**

- **Metrics Values**: `text-3xl font-bold`
- **Metric Labels**: `text-sm text-gray-600`
- **Trends**: `text-sm font-medium` (green for positive, red for negative)
- **Timestamps**: `text-xs text-gray-500`

### **Spacing**

- Card padding: `p-6`
- Grid gap: `gap-6`
- Section margin: `mb-8`

### **Responsive Design**

**Desktop (>1024px)**:
- 4 health cards across
- Side-by-side metrics + error feed

**Tablet (768-1024px)**:
- 2 health cards across
- Stacked metrics + error feed

**Mobile (<768px)**:
- 1 health card per row
- Fully stacked layout

---

## 🔄 Real-Time Updates

### **Auto-Refresh Strategy**

- **Health Cards**: Every 30 seconds
- **Metrics**: Every 60 seconds
- **Error Feed**: Every 30 seconds
- **Alerts**: Every 15 seconds (high priority)

**Implementation**:
```typescript
// Using SWR
const { data: health } = useSWR('/api/monitoring/health', fetcher, {
  refreshInterval: 30000,
  revalidateOnFocus: true
})
```

### **Manual Refresh**

Add a refresh button in header:
```
[↻ Refresh All] button
```

---

## 🚀 Development Phases

### **Phase 1: Foundation** (2-3 hours)
- ✅ Create database table
- ✅ Build metrics helper library
- ✅ Create basic API routes
- ✅ Set up page layout

### **Phase 2: Health Cards** (2 hours)
- ✅ Database health check
- ✅ Stripe connectivity
- ✅ Email/SMS status
- ✅ Webhook monitoring

### **Phase 3: Metrics & Errors** (2-3 hours)
- ✅ Business metrics panel
- ✅ Sentry integration
- ✅ Error feed component
- ✅ Sparkline charts

### **Phase 4: Performance & Alerts** (2 hours)
- ✅ Performance indicators
- ✅ Alert system
- ✅ Quick actions

### **Phase 5: Polish** (1 hour)
- ✅ Responsive design
- ✅ Loading states
- ✅ Error handling
- ✅ Documentation

**Total Time**: ~8-10 hours

---

## ✅ Success Criteria

**Dashboard is successful when**:
1. All 6 health cards show real data
2. Metrics update automatically every 60s
3. Errors from Sentry appear in real-time
4. Critical alerts are immediately visible
5. Page loads in <2 seconds
6. Works on mobile devices
7. Provides 90%+ app visibility

---

## 📊 Expected Coverage

With this dashboard:
- ✅ **100% error visibility** (via Sentry)
- ✅ **95% system health visibility** (via health checks)
- ✅ **90% business metrics** (via custom tracking)
- ✅ **85% performance visibility** (via metrics + Sentry)

**Total: 92.5% app coverage** 🎯

---

## 🎯 Next Steps

1. **Verify Sentry is working** (send test error)
2. **Create database migration** (application_metrics table)
3. **Build metrics helper** (lib/metrics.ts)
4. **Create API routes** (monitoring endpoints)
5. **Build dashboard page** (UI components)
6. **Test & iterate**

---

**Ready to build?** Let me know once Sentry shows the test error, and I'll start implementing! 🚀
