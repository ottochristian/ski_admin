# Clubs Table RLS Security Fix

## Critical Security Vulnerability - FIXED ✅

**Date**: January 2, 2026  
**Severity**: CRITICAL  
**Status**: Fixed in Migration 49

---

## The Vulnerability

The `clubs` table had **RLS disabled**, making it completely public to anyone with your Supabase anon key. This meant:

❌ Anyone could read all club data (names, slugs, settings, contact info)  
❌ Anyone could modify any club  
❌ Anyone could delete clubs  
❌ No access control whatsoever

**Impact**: Complete exposure of all club data and potential for data corruption or deletion.

---

## The Fix - Migration 49

Created comprehensive RLS policies for the `clubs` table:

### **SELECT Policies**
1. **System admins can view all clubs**
   - System admins need to see all clubs for management
   
2. **Admins can view their own club**
   - Regular admins, coaches can see their club
   - Parents can see their club through household relationship

### **INSERT Policies**
3. **System admins can insert clubs**
   - Only system admins can create new clubs
   - Prevents unauthorized club creation

### **UPDATE Policies**
4. **System admins can update any club**
   - Full update access for system admins
   
5. **Admins can update their own club**
   - Regular admins can update their club settings
   - Application logic should limit which fields can be updated

### **DELETE Policies**
6. **System admins can delete clubs**
   - Only system admins can delete
   - Soft delete is preferred in application code

---

## How to Apply

Run this migration in your Supabase SQL Editor:

```bash
# Copy contents of migrations/49_add_clubs_rls.sql
# Paste into Supabase SQL Editor
# Execute
```

---

## Verification

After running the migration:

1. **Check RLS is enabled**:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'clubs';
```
Expected: `rowsecurity = true`

2. **Check policies exist**:
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'clubs';
```
Expected: 6 policies (2 SELECT, 1 INSERT, 2 UPDATE, 1 DELETE)

3. **Test access control**:
```sql
-- As admin, try to view another club (should fail)
SELECT * FROM clubs WHERE id != (SELECT club_id FROM profiles WHERE id = auth.uid());
```

---

## Related Tables to Check

You should also verify RLS is enabled on these critical tables:

✅ **profiles** - Has RLS  
✅ **athletes** - Has RLS  
✅ **households** - Has RLS  
✅ **household_guardians** - Has RLS  
✅ **registrations** - Has RLS  
✅ **programs** - Check this  
✅ **sub_programs** - Check this  
✅ **groups** - Check this  
✅ **seasons** - Check this  

Run this query to check all tables:

```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY rowsecurity, tablename;
```

Any table with `rls_enabled = false` is potentially vulnerable.

---

## Lessons Learned

1. **Always enable RLS** on new tables immediately
2. **Run security audits** regularly
3. **Use Supabase's built-in security scanner**
4. **Test with anon key** to verify access restrictions

---

## Status

- [x] Vulnerability identified
- [x] Migration created
- [ ] Migration applied (user needs to run it)
- [ ] Verification completed
- [ ] Other tables audited

---

## Next Steps

1. **Apply migration 49 immediately**
2. **Check other tables** for RLS status
3. **Create policies** for any other tables missing RLS
4. **Document RLS patterns** for future table creation
