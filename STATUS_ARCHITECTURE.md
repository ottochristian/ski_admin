# Status Architecture: Multi-Level Control

## Design Decision

We use status fields at multiple levels to provide granular control over visibility and registration.

## Status Hierarchy

```
Season (status: draft | active | closed | archived)
  └─ Programs (status: ACTIVE | INACTIVE)
      └─ Sub-Programs (status: ACTIVE | INACTIVE)
          └─ Groups (status: ACTIVE | INACTIVE)
```

## Why Multi-Level Status?

### Use Case 1: Gradual Rollout
```
Season: ACTIVE (accepting registrations)
├─ Alpine Skiing: ACTIVE (ready for parents)
├─ Nordic Skiing: ACTIVE (ready for parents)
└─ Freestyle Skiing: INACTIVE (still finalizing pricing)
```

**Benefit:** Season is open, but you can hide specific programs that aren't ready yet.

### Use Case 2: Soft Delete
```
Season: ACTIVE
├─ Alpine Skiing: ACTIVE
├─ Nordic Skiing: ACTIVE
└─ Snowboarding: INACTIVE (cancelled, but keeping for records)
```

**Benefit:** Don't delete data, just hide it. Can reactivate later if needed.

### Use Case 3: Testing
```
Season: ACTIVE
├─ Alpine Skiing: ACTIVE (public)
├─ Test Program: INACTIVE (admin can see in admin portal, parents can't)
└─ Nordic Skiing: ACTIVE (public)
```

**Benefit:** Create and configure programs without making them public.

### Use Case 4: Capacity Full
```
Season: ACTIVE
├─ Alpine Skiing: ACTIVE
│   ├─ Beginner: ACTIVE (spots available)
│   ├─ Intermediate: INACTIVE (full, closed)
│   └─ Advanced: ACTIVE (spots available)
```

**Benefit:** Close specific sub-programs when full, keep others open.

## Status Control Rules

### Season Status (Coarse-Grained)

**draft:**
- Automatically sets ALL programs to INACTIVE
- Parent portal shows "Season Not Available"
- Admin can see and edit everything

**active:**
- Automatically sets ALL programs to ACTIVE
- Parent portal shows programs
- Registrations enabled

**closed:**
- Programs stay in current state
- Parent portal shows programs but registration disabled
- Button says "Registration Closed"

**archived:**
- Programs stay in current state
- Typically not current, so not shown to parents
- Used for historical data/reports

### Program/Sub-Program/Group Status (Fine-Grained)

**ACTIVE:**
- Visible in parent portal (if season is active)
- Visible in admin portal
- Can be selected for registration

**INACTIVE:**
- Hidden from parent portal
- Visible in admin portal (grayed out or labeled)
- Cannot be selected for registration

## Visibility Matrix

| Season Status | Season is_current | Program Status | Visible to Parents? | Can Register? |
|--------------|-------------------|----------------|---------------------|---------------|
| draft        | true              | ACTIVE         | ❌ No               | ❌ No         |
| draft        | true              | INACTIVE       | ❌ No               | ❌ No         |
| active       | true              | ACTIVE         | ✅ Yes              | ✅ Yes        |
| active       | true              | INACTIVE       | ❌ No               | ❌ No         |
| closed       | true              | ACTIVE         | ✅ Yes              | ❌ No         |
| closed       | true              | INACTIVE       | ❌ No               | ❌ No         |
| archived     | false             | any            | ❌ No               | ❌ No         |

## Cascade Behavior

When admin changes season status, it automatically cascades:

### Season → draft
1. Updates season.status = 'draft'
2. Updates ALL programs.status = 'INACTIVE'
3. Updates ALL sub_programs.status = 'INACTIVE'
4. Updates ALL groups.status = 'INACTIVE'

### Season → active
1. Updates ALL programs.status = 'ACTIVE'
2. Updates ALL sub_programs.status = 'ACTIVE'
3. Updates ALL groups.status = 'ACTIVE'
4. Updates season.status = 'active'

### Season → closed or archived
- Only updates season.status
- Program statuses unchanged (manual control)

## Admin UI Behaviors

### Season Settings Page
- **"Active" button:** Activates season AND all programs
- **"Draft" button:** Sets season to draft AND deactivates all programs
- **"Close" button:** Closes season, programs unchanged
- **"Archive" button:** Archives season, programs unchanged

### Programs Page
- Shows all programs regardless of status
- INACTIVE programs shown with badge/indicator
- Individual "Activate" / "Deactivate" buttons per program
- Bulk actions: "Activate All" / "Deactivate All"

### Sub-Programs Page
- Individual status control per sub-program
- Can activate/deactivate independently
- Warning if parent program is INACTIVE

## Parent Portal Logic

```typescript
// Show program to parents if:
const showProgram = (
  season.is_current === true &&
  season.status === 'active' &&
  program.status === 'ACTIVE' &&
  subProgram.status === 'ACTIVE'
)

// Enable registration if:
const canRegister = (
  showProgram === true &&
  season.status === 'active'
)
```

## Benefits of This Design

1. **Flexibility:** Can control visibility at any level
2. **Gradual Rollout:** Add programs incrementally
3. **Testing:** Test programs before going public
4. **Capacity Management:** Close full sub-programs
5. **Soft Delete:** Hide without losing data
6. **Bulk Control:** Season status affects everything at once
7. **Fine Control:** Individual program control when needed

## Best Practices

### For Admins

**Setting Up New Season:**
1. Clone season (creates ACTIVE programs)
2. Review all programs/pricing
3. Set season to 'draft' (hides everything)
4. Make final edits
5. Set season to 'active' (shows everything)

**Closing Registration:**
1. Set season to 'closed' (prevents new registrations, keeps visible)
2. OR set season to 'draft' (hides everything)

**Hiding Specific Program:**
1. Go to Programs page
2. Click "Deactivate" on that program
3. Only that program is hidden

**Full Sub-Program:**
1. Go to Sub-Programs page
2. Deactivate the full sub-program
3. Parents see other sub-programs but not the full one

## Future Enhancements

### Possible Additions:
1. **Capacity Tracking:** Auto-deactivate when max_capacity reached
2. **Scheduled Activation:** Set date/time to auto-activate
3. **Status History:** Track when status changed and by whom
4. **Batch Operations:** Select multiple programs and bulk change status
5. **Smart Warnings:** Warn if deactivating program with active registrations
6. **Parent Notifications:** Notify when new programs become available

## Summary

The multi-level status architecture provides maximum flexibility:
- **Season status** for bulk control (draft/active/closed/archived)
- **Program/Sub-Program/Group status** for fine-grained control (ACTIVE/INACTIVE)
- **Automatic cascades** for convenience (season → programs)
- **Manual overrides** for special cases (deactivate one program)

This gives admins the power to manage programs exactly how they need, from simple bulk operations to complex selective visibility.
