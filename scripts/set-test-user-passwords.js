#!/usr/bin/env node

/**
 * Set passwords for all test users
 * 
 * Usage:
 *   node scripts/set-test-user-passwords.js
 * 
 * Requires environment variables:
 *   - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Or create a .env.local file with:
 *   NEXT_PUBLIC_SUPABASE_URL=your-project-url
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 */

// Try to load .env.local
const fs = require('fs');
const path = require('path');

// First try dotenv if available
let dotenvLoaded = false;
try {
  require('dotenv').config({ path: '.env.local' });
  dotenvLoaded = true;
} catch (e) {
  // dotenv not installed, manually parse .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
        process.env[key.trim()] = value.trim();
      }
    });
  }
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables!');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)');
  console.error('   Required: SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('   Create a .env.local file or set environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.error('');
  console.error('   Get your Service Role Key from:');
  console.error('   Supabase Dashboard > Settings > API > service_role (secret)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TEST_PASSWORD = 'test12345';

const TEST_USERS = [
  'ottilieotto+gtssf+admin+a@gmail.com',
  'ottilieotto+gtssf+admin+b@gmail.com',
  'ottilieotto+gtssf+coach+a@gmail.com',
  'ottilieotto+gtssf+coach+b@gmail.com',
  'ottilieotto+gtssf+parent+a@gmail.com',
  'ottilieotto+gtssf+parent+b@gmail.com',
  'ottilieotto+gtssf+parent+c@gmail.com',
  'ottilieotto+jackson+admin+a@gmail.com',
  'ottilieotto+jackson+admin+b@gmail.com',
  'ottilieotto+jackson+coach+a@gmail.com',
  'ottilieotto+jackson+coach+b@gmail.com',
  'ottilieotto+jackson+parent+a@gmail.com',
  'ottilieotto+jackson+parent+b@gmail.com',
  'ottilieotto+jackson+parent+c@gmail.com',
];

async function setPasswordForUser(email) {
  try {
    // First, try to find the user
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error(`❌ Error listing users: ${listError.message}`);
      return false;
    }

    const user = users.users.find(u => u.email === email);

    if (!user) {
      console.log(`⚠️  User not found: ${email} - Creating user...`);
      
      // Create user if it doesn't exist
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: TEST_PASSWORD,
        email_confirm: true, // Auto-confirm email so they can log in immediately
      });

      if (createError) {
        console.error(`❌ Error creating user ${email}: ${createError.message}`);
        return false;
      }

      console.log(`✅ Created and set password for: ${email}`);
      return true;
    }

    // Update password for existing user
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: TEST_PASSWORD,
        email_confirm: true, // Ensure email is confirmed
      }
    );

    if (updateError) {
      console.error(`❌ Error updating password for ${email}: ${updateError.message}`);
      return false;
    }

    console.log(`✅ Set password for: ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Unexpected error for ${email}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔐 Setting passwords for test users...\n');
  console.log(`Password: ${TEST_PASSWORD}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const email of TEST_USERS) {
    const success = await setPasswordForUser(email);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Success: ${successCount} users`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount} users`);
  }
  console.log('='.repeat(50));
  console.log('\n✨ All test users are ready!');
  console.log(`   Login with any email and password: ${TEST_PASSWORD}\n`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

