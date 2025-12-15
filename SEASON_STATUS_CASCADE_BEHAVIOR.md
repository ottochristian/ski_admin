# Season Status Cascade Behavior

## Overview

When changing a season's status, the system now automatically cascades the status change to all programs, sub-programs, and groups within that season.

## Behavior

### Setting Season to "Active"

When you set a season status to `active`, the system automatically:

1. ✅ Activates ALL programs in the season
2. ✅ Activates ALL sub-programs in the season
3. ✅ Activates ALL groups in the season

**Use Case:** You clone a season or create new programs. When you're ready to open registration, just set the season to "active" and everything becomes visible to parents.

### Setting Season to "Current"

When you make a season current (via "Make Current" button):
- If the season is already `active`, it ensures all programs are activated
- Updates `is_current` flag to `true`
- Reloads the page to refresh UI

### Setting Season to "Closed"

When you set a season to `closed`:
- Programs remain in their current state (active or inactive)
- No new registrations can be created (enforced in registration logic)
- Data remains viewable

### Setting Season to "Archived"

When you archive a season:
- Programs remain in their current state
- Season moves to "Archived Seasons" section
- Typically for historical/reporting purposes only

### Setting Season to "Draft"

When you set a season to `draft`:
- Programs remain in their current state
- Season is in setup mode
- Not visible to parents (should be enforced in parent portal)

## Implementation Details

### Cascade Logic

```typescript
// When setting status to 'active':
1. Update programs: SET status = 'ACTIVE' WHERE season_id = X
2. Update sub_programs: SET status = 'ACTIVE' WHERE season_id = X
3. Update groups: SET status = 'ACTIVE' WHERE sub_program_id IN (...)
4. Update season: SET status = 'active'
```

### Database Operations

- Uses club_id filtering for security
- Updates happen in sequence: programs → sub-programs → groups → season
- If any step fails, error is shown and remaining updates are skipped

## User Experience

### Before (Manual Activation)
1. Clone season → Programs created as INACTIVE
2. Go to each program individually
3. Manually activate each program
4. Manually activate each sub-program
5. Manually activate each group
6. Set season to active
**Result:** Tedious, error-prone

### After (Automatic Cascade)
1. Clone season → Programs created
2. Set season status to "active"
**Result:** Everything activates automatically ✅

## Edge Cases

### Mixed Status Programs
- If some programs are already ACTIVE and some INACTIVE
- Setting season to "active" will activate ALL of them
- No selective activation (it's all-or-nothing)

### Cloning
- Clone function now creates programs as ACTIVE by default
- But if you want to review first, you can:
  - Clone season (programs are ACTIVE)
  - Set season to 'draft' (programs stay ACTIVE but season hidden)
  - Review and edit programs
  - Set season to 'active' when ready (no-op, already active)

### Multiple Seasons
- Each season's programs are independent
- Activating Season A doesn't affect Season B's programs
- Only affects programs with matching season_id

## Benefits

1. **Faster Setup:** One click to activate entire season
2. **Less Error-Prone:** Can't forget to activate sub-programs
3. **Better UX:** Intuitive - active season = active programs
4. **Atomic Operation:** All programs activated together
5. **Reversible:** Can set back to 'draft' if needed

## Testing Checklist

- [ ] Set season to 'active' - verify programs activated
- [ ] Set season to 'draft' - verify programs unchanged
- [ ] Set season to 'closed' - verify programs unchanged
- [ ] Set season to 'archived' - verify programs unchanged
- [ ] Make season current (active) - verify programs activated
- [ ] Make season current (draft) - verify programs unchanged
- [ ] Clone season then activate - verify cascade works
- [ ] Parent portal shows programs after activation
- [ ] Admin portal shows programs after activation

## Future Enhancements

### Possible Improvements:
1. Add confirmation dialog: "Activate all X programs in this season?"
2. Show progress indicator during cascade
3. Add option for selective activation (advanced users)
4. Add inverse operation: Deactivate all when setting to 'draft'
5. Add audit log: "Season activated → 15 programs activated"

### Should We Deactivate on 'Draft'?
**Current:** Setting to 'draft' doesn't change program status
**Alternative:** Could deactivate all programs when setting to 'draft'

**Pros:** More symmetrical behavior
**Cons:** Could accidentally hide programs if clicked wrong button

**Decision:** Keep current behavior (no auto-deactivation) for safety

## Summary

Setting a season to **"active"** now automatically activates all programs, sub-programs, and groups within that season. This provides a much better admin experience and reduces the manual work required when setting up new seasons.
