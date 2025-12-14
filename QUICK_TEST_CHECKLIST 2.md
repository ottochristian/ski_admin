# Quick Testing Checklist - Phase 2 Migration

## ⚡ 5-Minute Smoke Test

### 1. Admin Portal (2 min)
- [ ] Login as admin
- [ ] Dashboard loads with stats
- [ ] Athletes page shows athletes
- [ ] Programs page shows programs
- [ ] Can navigate between pages

### 2. Parent Portal (2 min)
- [ ] Login as parent
- [ ] Programs page shows available programs
- [ ] Can add program to cart
- [ ] Cart shows items correctly
- [ ] Billing page loads (even if empty)

### 3. Security Check (1 min)
- [ ] Login as Admin A
- [ ] Note some athlete names
- [ ] Login as Admin B (different club)
- [ ] Verify different athletes shown (or empty if no data)

## ✅ If all pass: Ready for detailed testing
## ❌ If any fail: Check browser console for errors

---

## 🔍 Detailed Testing (30 min)

### Admin Portal
- [ ] Create new program → Verify it appears
- [ ] Create new sub-program → Verify it appears
- [ ] Edit program → Verify changes save
- [ ] Create new season → Verify it appears
- [ ] Set season as current → Verify it updates
- [ ] Assign coach → Verify assignment saves

### Parent Portal
- [ ] Add multiple items to cart → Verify all show
- [ ] Remove item from cart → Verify it removes
- [ ] Create new athlete → Verify it appears
- [ ] Checkout flow → Verify order created (or error handled)

### Data Isolation
- [ ] Two admins from different clubs see different data
- [ ] Two parents from different clubs see different programs
- [ ] Parent can only see their household's athletes

---

## 🐛 Quick Debug Commands

### Check user's club_id:
```sql
SELECT id, email, club_id, role 
FROM profiles 
WHERE id = auth.uid();
```

### Check data exists:
```sql
SELECT COUNT(*) FROM athletes WHERE club_id = '<your_club_id>';
SELECT COUNT(*) FROM programs WHERE club_id = '<your_club_id>';
```

### Check RLS is enabled:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('athletes', 'programs', 'coaches');
```

---

## 🚨 Common Quick Fixes

**Empty page but data exists?**
- Check user's club_id matches data's club_id
- Check season is set correctly
- Check browser console for errors

**Can't create/update?**
- Check RLS INSERT/UPDATE policies
- Check browser console for error messages
- Verify user has correct role

**Slow loading?**
- Check Network tab for slow queries
- Check if React Query is caching properly
- Check RLS policies use indexes

---

**If all quick tests pass, proceed with full testing guide!**

