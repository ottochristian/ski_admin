# Messaging System Plan

_Branch: `feat/messaging` — do not merge until ready to deploy alongside coach portal migration._

---

## 1. Current State

### Existing DB tables

**`messages`**
```
id          uuid PK
sender_id   uuid → profiles
subject     text NOT NULL
body        text NOT NULL
program_id  uuid nullable → programs
sub_program_id uuid nullable → sub_programs
group_id    uuid nullable → groups
club_id     uuid NOT NULL → clubs
season_id   uuid nullable → seasons
sent_at     timestamptz default now()
created_at  timestamptz default now()
```

**`message_recipients`**
```
id           uuid PK
message_id   uuid → messages
recipient_id uuid → profiles
read_at      timestamptz nullable
created_at   timestamptz default now()
```

### Existing RLS policies
- `messages` INSERT: coaches & admins only
- `messages` SELECT: sender only (`sender_id = auth.uid()`)
- `message_recipients` SELECT: recipient only
- `message_recipients` UPDATE: recipient only (for marking read)

> **Gap**: Recipients cannot SELECT the parent `messages` row — only the `message_recipients` join row. We need a policy so recipients can read message content.

### Existing component
`components/send-message-form.tsx` — functional broadcast composer. Uses `createBrowserSupabaseClient` (old import, should be `createClient`). Hardcodes redirect to `/coach/messages` (needs updating to `basePath`). Otherwise usable as a starting point.

### What does NOT exist yet
- Any messages page (coach or admin)
- API routes for messaging
- Thread/reply support
- Email delivery integration
- Read receipts displayed in UI
- Unread badge/count

---

## 2. Scope — Phase 1 (this branch)

**In scope:**
- Coach messages page: inbox (received) + sent tab + compose
- Admin messages page: compose to any program/sub-program/group + sent history
- API routes: list inbox, list sent, send, mark-as-read
- Email delivery via Resend on send (broadcast only, no reply threading yet)
- Unread count badge in sidebar
- Fix RLS gap so recipients can read message body

**Out of scope for Phase 1 (future):**
- Reply threading (parent_message_id)
- Email reply-to threading (inbound parsing)
- Parent-initiated messages
- Direct coach↔admin messages (no group target)
- SMS via Twilio
- AI draft assist
- Attachment uploads

---

## 3. DB Migration — `78_messaging_improvements.sql`

```sql
-- 1. Fix RLS: recipients need to read message content
CREATE POLICY "Recipients can view messages sent to them"
  ON messages FOR SELECT
  USING (
    id IN (
      SELECT message_id FROM message_recipients
      WHERE recipient_id = auth.uid()
    )
  );

-- 2. Admins can view all messages in their club
CREATE POLICY "Admins can view club messages"
  ON messages FOR SELECT
  USING (
    club_id IN (
      SELECT club_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
    )
  );

-- 3. Add reply threading support (nullable — Phase 1 leaves it NULL)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES messages(id),
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'broadcast'
    CHECK (message_type IN ('broadcast', 'reply', 'direct'));

-- 4. Track email delivery
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_provider_id text; -- Resend message ID

-- 5. Useful indexes
CREATE INDEX IF NOT EXISTS idx_messages_club_sent ON messages(club_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_recipients_unread
  ON message_recipients(recipient_id, read_at)
  WHERE read_at IS NULL;
```

---

## 4. API Routes

All routes live under `/api/messages/` with club context passed as a query param or inferred from auth.

### `GET /api/messages/inbox`
Returns messages where `auth.uid()` is a recipient. Joins `messages` for subject/body/sender/sent_at, plus `read_at` from `message_recipients`.

Query params:
- `clubSlug` (required)
- `page`, `limit` (pagination, default limit 20)
- `unread_only=true` (optional)

Response:
```json
{
  "messages": [
    {
      "id": "...",
      "subject": "Practice cancelled Tuesday",
      "body": "...",
      "sender": { "id": "...", "first_name": "Jane", "last_name": "Coach" },
      "sent_at": "2026-03-18T10:00:00Z",
      "read_at": null,
      "scope": { "type": "group", "name": "Moguls A" }
    }
  ],
  "unread_count": 3,
  "total": 12
}
```

### `GET /api/messages/sent`
Returns messages where `auth.uid()` is the sender, scoped to club. Includes recipient count.

Query params: `clubSlug`, `page`, `limit`

### `POST /api/messages/send`
Creates message + resolves recipients + fires emails.

Body:
```json
{
  "clubSlug": "gtssf",
  "subject": "Practice update",
  "body": "...",
  "target_type": "sub_program",  // "program" | "sub_program" | "group"
  "target_id": "<uuid>"
}
```

Logic:
1. Validate sender is coach or admin for this club
2. Insert into `messages`
3. Resolve recipient `user_ids` from registrations → athletes → household_guardians
4. Bulk insert into `message_recipients`
5. Fetch recipient emails from `profiles`
6. Send via Resend (batch, up to 100/call)
7. Update `messages.email_sent_at` and `email_provider_id`

### `PATCH /api/messages/[messageId]/read`
Sets `read_at = now()` on the `message_recipients` row for `auth.uid()`.

### `GET /api/messages/unread-count`
Fast query — count of `message_recipients` rows where `recipient_id = auth.uid()` and `read_at IS NULL`. Used for sidebar badge.

---

## 5. UI Layout

### 5a. Coach — `/clubs/[clubSlug]/coach/messages`

```
┌─────────────────────────────────────────────────────────────────┐
│  Messages                                    [+ Compose]         │
│  ─────────────────────────────────────────────────────────────── │
│  [Inbox (3)]  [Sent]                                             │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ● Practice cancelled Tuesday          Moguls A  2h ago   │   │
│  │   Coach Jane Smith                                        │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │   Race prep reminder                  Slalom B  1d ago   │   │
│  │   Coach Jane Smith                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

- **Inbox tab**: messages received by this coach (sent to a group/program they belong to)
- **Sent tab**: messages this coach sent, with recipient count
- **● dot**: unread indicator
- **[+ Compose]**: opens compose slide-over or navigates to compose page
- Clicking a row expands inline OR navigates to `/messages/[id]` detail page

**Message detail view** (same page, slide-in panel or route):
```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to inbox                                                  │
│                                                                   │
│  Practice cancelled Tuesday                                       │
│  Jane Smith · Moguls A · Mar 18, 2026 at 10:02 AM               │
│  ──────────────────────────────────────────────────────────────  │
│                                                                   │
│  Hi families, practice on Tuesday is cancelled due to icy        │
│  conditions. We'll resume Thursday as scheduled.                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Compose page** — `/clubs/[clubSlug]/coach/messages/compose`:
- Re-uses and refactors `SendMessageForm`
- Target scoped to coach's assigned programs only (same logic as schedule filter)
- Subject + body fields
- Preview of recipient count before sending: "Will reach ~12 families in Moguls A"

### 5b. Admin — `/clubs/[clubSlug]/admin/messages`

Same Inbox/Sent tab structure but:
- Can target any program / sub-program / group in the club
- Sent tab shows all messages sent by any coach in the club (for admins)
- "Sent by" column shows sender name

```
┌──────────────────────────────────────────────────────────────────┐
│  Messages                                          [+ Compose]    │
│  ──────────────────────────────────────────────────────────────  │
│  [Inbox]  [Sent (club-wide)]                                     │
│  ──────────────────────────────────────────────────────────────  │
│  Subject             Target         Sender     Recipients  Date   │
│  ──────────────────────────────────────────────────────────────  │
│  Race prep...        Slalom B       J. Smith   14          1d     │
│  Season kick-off     All Programs   Admin       87          3d     │
└──────────────────────────────────────────────────────────────────┘
```

### 5c. Sidebar Unread Badge

In `CoachSidebar`, the Messages nav item gets a badge:
```
Messages  [3]
```
Fetched once on mount via `/api/messages/unread-count`, not polling.

---

## 6. Email Delivery

### Template (Resend)
Plain transactional email — no heavy design. Club-branded if club has a `from_email` set, otherwise falls back to `noreply@west110.com`.

```
Subject: [Club Name] {subject}

{body}

---
This message was sent to you because your athlete is enrolled in {scope name}
at {club name}. You are receiving this as a guardian on file.
```

### Sender
`From: {Club Name} <noreply@west110.com>` (single verified domain)
`Reply-To: {sender email}` (enables direct email reply back to coach)

### Batching
Resend supports up to 100 recipients per API call. For large groups, chunk into batches of 100 and send sequentially. Record `email_sent_at` after all batches succeed.

### Error handling
- If Resend fails, message is still saved to DB (in-app delivery works)
- Log error to Sentry, don't block the API response
- Future: retry queue via edge function cron

---

## 7. Recipient Count Preview

Before sending, the compose form can call a lightweight endpoint:

`GET /api/messages/recipient-count?target_type=sub_program&target_id=<uuid>`

Returns `{ count: 12 }` — the number of guardian accounts that would receive the message. Shown as helper text below the target selector.

---

## 8. Implementation Order

### Step 1 — DB migration
Run `78_messaging_improvements.sql` via `mcp__supabase__apply_migration`.

### Step 2 — API routes
1. `POST /api/messages/send` (core, needed first)
2. `GET /api/messages/inbox`
3. `GET /api/messages/sent`
4. `PATCH /api/messages/[messageId]/read`
5. `GET /api/messages/unread-count`
6. `GET /api/messages/recipient-count` (nice-to-have for compose UX)

### Step 3 — Coach messages page
1. `/clubs/[clubSlug]/coach/messages/page.tsx` — inbox/sent tabs, list
2. `/clubs/[clubSlug]/coach/messages/compose/page.tsx` — compose form (refactored from `SendMessageForm`)
3. `/clubs/[clubSlug]/coach/messages/[messageId]/page.tsx` — message detail

### Step 4 — Sidebar badge
Update `CoachSidebar` to fetch unread count and show badge on Messages item.

### Step 5 — Admin messages page
1. `/clubs/[clubSlug]/admin/messages/page.tsx` — sent history (club-wide)
2. `/clubs/[clubSlug]/admin/messages/compose/page.tsx` — compose (full program/sub-program/group targeting)

### Step 6 — Email integration
Wire Resend into `POST /api/messages/send`. Test with a real address before enabling in prod.

---

## 9. Future Phases

### Phase 2 — Reply threading
- Add `parent_message_id` FK in messages (column already added in migration above)
- Parse inbound email replies via Resend webhook → create a reply message in DB
- Thread view in inbox: collapsible reply chain

### Phase 3 — AI assist
- "Draft for me" button in compose → calls Claude with context (program name, recent events, coach notes)
- AI nudge: surface coaches who haven't sent a message to their group in 2+ weeks
- Sentiment scan on outbound messages (flag anything that looks problematic before send)

### Phase 4 — SMS (Twilio)
- Opt-in field on parent profile
- Short-form SMS for urgent messages (cancelled practice, location change)
- Delivery log alongside email log

---

## 10. Open Questions

1. **Admin inbox**: Should admins receive copies of all coach messages? Or only messages sent directly to them? → For now: admins see sent history club-wide but don't get added as recipients of coach broadcasts.
2. **Coach inbox**: Coaches receive messages sent to programs they're assigned to? → Requires adding coaches to `message_recipients` at send time, same as guardians. Confirm before building.
3. **Message scope in inbox**: If a parent has two athletes in two different groups that both received the same broadcast — do they get one message or two? → One message (deduped by message_id in message_recipients).
4. **Season scoping**: Should sent messages be filtered by active season? → Yes — the existing `season_id` column on `messages` supports this; pre-populate from the active season context on send.
