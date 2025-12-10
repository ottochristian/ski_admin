# Setting Passwords for Test Users via Supabase API

Since Supabase doesn't allow direct password insertion in SQL, you need to set passwords using the Supabase Management API or Dashboard.

## Option 1: Supabase Dashboard (Manual - Good for Testing)

1. Go to Supabase Dashboard > Authentication > Users
2. For each test user email, either:
   - If user doesn't exist: Click "Add User" → Enter email → Set password to "test12345"
   - If user exists: Click on user → Click "Reset Password" → Set new password to "test12345"

This is tedious but works for testing.

## Option 2: Supabase Management API (Automated - Recommended)

Create a Node.js script or use curl to set passwords:

```bash
# Set your Supabase credentials
SUPABASE_URL="your-project-url"
SUPABASE_SERVICE_KEY="your-service-role-key"

# List of test user emails
EMAILS=(
  "ottilieotto+gtssf+admin+a@gmail.com"
  "ottilieotto+gtssf+admin+b@gmail.com"
  "ottilieotto+gtssf+coach+a@gmail.com"
  "ottilieotto+gtssf+coach+b@gmail.com"
  "ottilieotto+gtssf+parent+a@gmail.com"
  "ottilieotto+gtssf+parent+b@gmail.com"
  "ottilieotto+gtssf+parent+c@gmail.com"
  "ottilieotto+jackson+admin+a@gmail.com"
  "ottilieotto+jackson+admin+b@gmail.com"
  "ottilieotto+jackson+coach+a@gmail.com"
  "ottilieotto+jackson+coach+b@gmail.com"
  "ottilieotto+jackson+parent+a@gmail.com"
  "ottilieotto+jackson+parent+b@gmail.com"
  "ottilieotto+jackson+parent+c@gmail.com"
)

PASSWORD="test12345"

# Loop through and set passwords
for email in "${EMAILS[@]}"; do
  echo "Setting password for $email"
  
  # First, check if user exists and create if needed
  curl -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"${email}\",
      \"password\": \"${PASSWORD}\",
      \"email_confirm\": true
    }" || echo "User might already exist"
  
  # Update password
  USER_ID=$(curl -X GET "${SUPABASE_URL}/auth/v1/admin/users?email=${email}" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    | jq -r '.users[0].id')
  
  if [ "$USER_ID" != "null" ] && [ ! -z "$USER_ID" ]; then
    curl -X PUT "${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}" \
      -H "apikey: ${SUPABASE_SERVICE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"password\": \"${PASSWORD}\"
      }"
    echo "Password set for $email"
  fi
done
```

## Option 3: Use Supabase CLI

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Set password for a user
supabase auth users update ottilieotto+gtssf+admin+a@gmail.com --password test12345
```

## Option 4: Quick SQL Helper (After Users Created)

After creating users via Dashboard/API, you can use this SQL to verify and see which users need passwords:

```sql
-- Check which users exist but might not have profiles
SELECT 
  au.email,
  au.id,
  CASE WHEN p.id IS NULL THEN 'Missing Profile' ELSE 'Has Profile' END as status
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email LIKE 'ottilieotto+%'
ORDER BY au.email;
```

## Recommended Workflow

1. **Run GENERATE_TEST_DATA.sql** (Part 1) - This clears data and creates the structure
2. **Create users via Supabase Dashboard or API** - Set passwords to "test12345"
3. **Run GENERATE_TEST_DATA_PART2.sql** - This creates all the relationships (households, athletes, programs, etc.)
4. **Verify** - Check the verification queries at the end of Part 2

The test users will have:
- **First Name**: Club name (GTSSF or Jackson)
- **Last Name**: Role + identifier (e.g., "Admin A", "Parent B", "Coach A")
- **Email**: ottilieotto+[club]+[role]+[identifier]@gmail.com
- **Password**: test12345
