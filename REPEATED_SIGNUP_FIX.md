# Fix for Repeated Signup Issue

## Problem
When trying to sign up with an email that already exists, Supabase returns `200 OK` with action `user_repeated_signup`, but no error is thrown. This causes confusion because:
- No new user is created
- No confirmation email is sent (user already exists)
- User sees "Account created" message but can't proceed

## Solution

### Option 1: Manually Confirm Existing User (For Testing)

If you've already signed up but didn't receive/confirm the email, manually confirm the user:

```sql
-- Find the user
SELECT id, email, email_confirmed_at, created_at
FROM auth.users 
WHERE email = 'ottilieotto@gmail.com';

-- Manually confirm the email (for testing only)
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'ottilieotto@gmail.com';
```

Then you can log in and the profile will be created automatically.

### Option 2: Delete the Existing User and Try Again

```sql
-- Delete the existing user (this will cascade delete related records)
DELETE FROM auth.users 
WHERE email = 'ottilieotto@gmail.com';
```

Then try signing up again.

### Option 3: Use a Different Email for Testing

Simply use a different email address for testing the signup flow.

## Code Updates

I've updated the signup code to:
1. Better detect when a user already exists
2. Show a clear error message
3. Redirect to login page with helpful message

## Next Steps

1. **For the existing user**: Manually confirm via SQL (Option 1) or delete and re-signup (Option 2)
2. **For future testing**: Use different emails or delete test users between tests
3. **For production**: The updated code will now properly handle this case
