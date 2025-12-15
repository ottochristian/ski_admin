# Athlete Tags Feature

## Summary

Added visual tags to the Athletes page in the admin portal for quick at-a-glance information about each athlete's registrations, programs, and status.

## Visual Tags Added

### 1. **Season Tag** (Green/Gray)
- Shows the latest season the athlete is registered for
- **Green badge** with checkmark: Current season
- **Gray badge**: Past season
- Example: `✓ 2024-2025` (green) or `2023-2024` (gray)

### 2. **Program Tags** (Blue)
- Shows all unique programs the athlete is enrolled in
- Multiple tags if registered for multiple programs
- Example: `Alpine Skiing`, `Nordic Skiing`

### 3. **Payment Status Tag** (Green/Amber/Red)
- **Green (Emerald)** with checkmark: `paid`
- **Amber** with clock: `pending`
- **Red** with X: `unpaid` or other status
- Shows the payment status from their latest registration

### 4. **Registration Status Tag** (Violet/Orange/Gray)
- **Violet**: `active` registration
- **Orange**: `pending` registration
- **Gray**: Other statuses (completed, cancelled, etc.)
- Reflects the current state of their registration

### 5. **No Registrations** (Gray)
- Shows `No registrations` for athletes without any registrations
- Helps identify athletes who need to be registered

## Visual Design

### Tag Colors & Icons:
```
✓ 2024-2025        [Green - Current Season]
  2023-2024        [Gray - Past Season]
  Alpine Skiing    [Blue - Program]
✓ paid             [Emerald - Paid]
⏱ pending          [Amber - Payment Pending]
✗ unpaid           [Red - Unpaid]
  active           [Violet - Active Registration]
  pending          [Orange - Pending Registration]
  No registrations [Gray - No Data]
```

## Implementation Details

### Database Query Enhancement

Updated `athletesService.getAthletes()` to include:
```typescript
.select(`
  *,
  registrations (
    id,
    status,
    payment_status,
    season_id,
    sub_program_id,
    seasons (id, name, is_current),
    sub_programs (
      id, name,
      programs (id, name)
    )
  )
`)
```

### Helper Functions

**`getLatestSeason(athlete)`**
- Finds the most recent season
- Prioritizes current season first
- Falls back to alphabetically latest season

**`getPrograms(athlete)`**
- Extracts unique program names from all registrations
- Deduplicates to show each program once

**`getPaymentStatus(athlete)`**
- Gets payment status from latest registration

**`getRegistrationStatus(athlete)`**
- Gets registration status from latest registration

## Benefits

### For Admins:
1. **Quick Scanning**: See key info without clicking into each athlete
2. **Status at a Glance**: Instantly identify payment issues
3. **Program Visibility**: Know which programs athletes are in
4. **Season Tracking**: See who's registered for current vs past seasons
5. **Registration Gaps**: Easily spot athletes with no registrations

### For Operations:
- **Payment Follow-up**: Quickly identify unpaid registrations
- **Program Balance**: See program enrollment at a glance
- **Season Transitions**: Track which athletes need to renew
- **Data Quality**: Identify athletes without registrations

## UI Before/After

### Before:
```
Jackson Athlete A
DOB: 12/11/2015
[View]
```

### After:
```
Jackson Athlete A
DOB: 12/11/2015
[✓ 2024-2025] [Alpine Skiing] [✓ paid] [active]
[View]
```

## Example Scenarios

### Scenario 1: Active, Paid Athlete
```
Tags: ✓ 2024-2025 | Alpine Skiing | ✓ paid | active
Meaning: Currently enrolled in Alpine for 2024-2025 season, payment complete
```

### Scenario 2: Multiple Programs
```
Tags: ✓ 2024-2025 | Alpine Skiing | Nordic Skiing | ⏱ pending | active
Meaning: Enrolled in 2 programs, payment pending
```

### Scenario 3: Past Season Only
```
Tags: 2023-2024 | Freestyle | ✓ paid | active
Meaning: Was active last season, hasn't registered for current season yet
```

### Scenario 4: No Registrations
```
Tags: No registrations
Meaning: Athlete added but never registered for any programs
```

## Performance Considerations

### Query Optimization:
- Single query with joins (no N+1 problem)
- RLS automatically filters by club
- Results cached by React Query
- Registrations pre-loaded with athlete data

### Render Optimization:
- Helper functions run once per athlete
- Minimal re-renders
- Tags only show if data exists

## Future Enhancements

### Possible Additions:
1. **Age Group Tag**: Show current age group category
2. **Coach Assignment Tag**: Show assigned coach
3. **Group Tag**: Show specific group within sub-program
4. **Attendance Tag**: Show attendance percentage
5. **Emergency Contact Tag**: Indicator if contact info complete
6. **Filter by Tags**: Click a tag to filter athlete list
7. **Tag Tooltips**: Hover for more details
8. **Export with Tags**: Include tag data in exports

### Analytics Opportunities:
- Track most common program combinations
- Identify payment delay patterns
- Monitor season-to-season retention
- Analyze registration timing

## Testing Checklist

- [ ] Athlete with current season registration shows green tag
- [ ] Athlete with past season shows gray tag
- [ ] Multiple programs show multiple blue tags
- [ ] Paid status shows green with checkmark
- [ ] Pending payment shows amber with clock
- [ ] Unpaid shows red with X
- [ ] Active registration shows violet tag
- [ ] Athlete with no registrations shows gray message
- [ ] Tags wrap properly on narrow screens
- [ ] Query performance is acceptable with many athletes
- [ ] RLS properly filters registrations by club

## Migration Notes

### No Database Changes Required
This is a pure UI enhancement using existing data structure.

### No Breaking Changes
- Existing athlete queries continue to work
- Backward compatible with old athlete list format
- Service method signature unchanged (just enhanced select)

## Summary

Added rich visual tags to athlete list providing instant visibility into:
- Season enrollment (current vs. past)
- Program participation (multi-program support)
- Payment status (paid/pending/unpaid)
- Registration state (active/pending/other)

This significantly improves admin efficiency by reducing clicks needed to understand athlete status.
