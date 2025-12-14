# Season Design: Dual-Flag Architecture

## Decision: Keep Both `is_current` and `status` ✅

### Rationale

After analyzing use cases, we determined that **two separate fields** provide the flexibility needed for real-world club management scenarios.

## Field Definitions

### `is_current` (Boolean)
- **Purpose**: Identifies THE season that is active in the UI
- **Constraint**: Only ONE per club (enforced by unique index)
- **Usage**: Determines which season users see by default
- **Example**: Winter 2024-2025 season is what everyone is currently working with

### `status` (Enum: draft | active | closed | archived)
- **Purpose**: Indicates the lifecycle state and what operations are allowed
- **Values**:
  - `draft`: Being set up by admins, not visible to parents
  - `active`: Open for registrations and normal operations
  - `closed`: No new registrations accepted, but data still accessible
  - `archived`: Historical data only, read-only for reports
- **Constraint**: Multiple seasons can have same status
- **Example**: Old season can remain `active` for late registrations while new season is `current`

## Use Case Matrix

| Scenario | is_current | status | Description |
|----------|-----------|--------|-------------|
| **Current Active Season** | `true` | `active` | Normal operation - accepting registrations |
| **Preparing Next Season** | `false` | `draft` | Admin setting up programs, not visible to parents |
| **Old Season (Late Regs)** | `false` | `active` | Accepting stragglers while new season is current |
| **Season Closed** | `true` | `closed` | Current for viewing, but no new registrations |
| **Historical Season** | `false` | `archived` | Read-only, for reports only |
| **Switching Seasons** | `true` → `false` | `active` | Admin flips is_current to new season |

## Real-World Scenarios

### Scenario 1: End of Season Preparation
**Timeline**: March 2025

1. **Current Season (Winter 2024-2025)**
   - `is_current = true`
   - `status = 'active'`
   - Parents registering kids for remaining programs

2. **Next Season (Summer 2025)**
   - `is_current = false`
   - `status = 'draft'`
   - Admin setting up programs, pricing, schedules

3. **Action**: When ready, admin clicks "Make Current"
   - Summer → `is_current = true`
   - Winter → `is_current = false, status = 'closed'`

### Scenario 2: Registration Deadline
**Timeline**: Season in progress

- **Before Deadline**
  - `is_current = true, status = 'active'`
  
- **After Deadline**
  - `is_current = true, status = 'closed'`
  - UI still shows season for viewing athletes/schedules
  - Registration buttons disabled

### Scenario 3: Year-End Cleanup
**Timeline**: End of year

- **Active Seasons**: `status = 'active'` (current and maybe 1 old)
- **Old Seasons**: `status = 'closed'` (2-3 recent ones)
- **Very Old**: `status = 'archived'` (historical data only)

## Database Constraints

```sql
-- Only ONE current season per club
CREATE UNIQUE INDEX idx_seasons_one_current_per_club 
ON seasons (club_id) 
WHERE is_current = true;

-- Valid status values only
ALTER TABLE seasons 
ADD CONSTRAINT seasons_status_check 
CHECK (status IN ('draft', 'active', 'closed', 'archived'));
```

## UI Behavior by Status

| Status | Parents Can See | Parents Can Register | Admin Can Edit |
|--------|----------------|---------------------|----------------|
| `draft` | ❌ No | ❌ No | ✅ Yes |
| `active` | ✅ Yes | ✅ Yes | ✅ Yes |
| `closed` | ✅ Yes | ❌ No | ✅ Yes (limited) |
| `archived` | ✅ Yes (if selected) | ❌ No | ❌ No |

## API / Service Layer Rules

### When Fetching "Current Season"
```typescript
// Get the ONE current season for a club
const currentSeason = await supabase
  .from('seasons')
  .select('*')
  .eq('club_id', clubId)
  .eq('is_current', true)
  .single(); // Should always return exactly one
```

### When Fetching "Active Seasons" (e.g., for dropdown)
```typescript
// Get all active/closed seasons (not draft, not archived)
const activeSeasonsForDropdown = await supabase
  .from('seasons')
  .select('*')
  .eq('club_id', clubId)
  .in('status', ['active', 'closed'])
  .order('start_date', { ascending: false });
```

### When Creating Registration
```typescript
// Only allow if season is active
if (season.status !== 'active') {
  throw new Error('This season is not accepting registrations');
}
```

## Migration Path

If you want to clean up existing data:

1. **Run Migration**: `migrations/42_improve_season_constraints.sql`
2. **Verify**: Check that each club has only ONE `is_current = true`
3. **Set Status**: Update old seasons to `closed` or `archived`
4. **Future Seasons**: Set to `draft` until ready

## Why NOT Consolidate?

**Alternative: Single "state" field** (`current`, `active`, `draft`, `archived`)

**Problems:**
1. **Can't have multiple active seasons** - What if you need late registrations?
2. **Forces either/or choice** - Can't be "current but closed"
3. **Less flexible** - Hard to prepare next season while current one is active
4. **Breaking change** - Would require rewriting all season logic

## Conclusion

**Keep both fields.** The dual-flag design provides:
- ✅ Flexibility for complex real-world scenarios
- ✅ Clear separation of concerns (UI vs. business logic)
- ✅ Ability to prepare future seasons
- ✅ Support for transitional states
- ✅ Easier admin workflows

The slight complexity is worth the operational flexibility.
