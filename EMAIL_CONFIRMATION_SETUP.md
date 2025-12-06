# Email Confirmation Setup Guide

## Overview
This guide explains how to properly set up email confirmation in Supabase and ensure profiles are created when users confirm their email.

## Step 1: Enable Email Confirmation in Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Find **"Enable email confirmations"** and make sure it's **enabled**
3. Configure your email provider:
   - **Option A: Use Supabase's built-in email (limited)**
     - Works for development/testing
     - Limited to a few emails per hour
   - **Option B: Configure custom SMTP (recommended for production)**
     - Go to **Settings** → **Auth** → **SMTP Settings**
     - Configure your SMTP provider (SendGrid, Mailgun, AWS SES, etc.)

## Step 2: Email Templates

Supabase uses email templates for confirmation emails. You can customize them:

1. Go to **Authentication** → **Email Templates**
2. Customize the **"Confirm signup"** template
3. The confirmation link will be: `{{ .ConfirmationURL }}`

## Step 3: How It Works

### Signup Flow:
1. User fills out signup form with all household details
2. User signs up → `auth.users` record created with:
   - `email_confirmed_at = NULL` (not confirmed yet)
   - User metadata contains all signup form data (first_name, last_name, address, etc.)
   - `profile_pending = true` flag
3. Supabase sends confirmation email
4. User clicks confirmation link → `email_confirmed_at` is set
5. User can now log in

### Profile Creation Flow:
1. **During signup**: Signup form data is stored in `user_metadata`
2. **After email confirmation**: User logs in
3. **On login**: System checks if profile exists
4. **If no profile**: Creates profile + household using data from `user_metadata`
5. **Clears pending flag**: Sets `profile_pending = false`

## Step 4: Testing Email Confirmation

### In Development:
1. Sign up with a real email address
2. Check your email (and spam folder)
3. Click the confirmation link
4. Log in - profile and household should be created automatically with all your signup data

### If emails aren't sending:
1. Check Supabase Dashboard → **Logs** → **Auth Logs** for errors
2. Verify SMTP settings if using custom SMTP
3. Check email provider's sending limits
4. For testing, you can temporarily disable email confirmation

## Step 5: Current Implementation

The code now:
1. **Stores all signup data** in `user_metadata` during signup
2. **Waits for email confirmation** before creating profile
3. **Creates profile + household** on first login after confirmation using stored metadata
4. **Handles both scenarios**: Email confirmation enabled or disabled

## Troubleshooting

### Emails not sending:
- Check Supabase logs: **Dashboard** → **Logs** → **Auth Logs**
- Verify SMTP configuration in **Settings** → **Auth** → **SMTP Settings**
- Check email provider limits (Supabase free tier has limits)
- Ensure email confirmation is enabled in **Authentication** → **Settings**

### Profile not created after confirmation:
- Check that user exists in `auth.users` with `email_confirmed_at` set
- Verify `user_metadata` contains signup form data
- Check that `create_user_profile` function exists and has proper permissions
- Review login flow - profile should be created automatically on first login
- Check browser console for any errors during login

### Missing household data:
- Verify signup form data is being stored in `user_metadata`
- Check that household creation runs after profile creation
- Ensure `household_guardians` link is created

## Next Steps

1. **Enable email confirmation** in Supabase Dashboard
2. **Configure SMTP** (if not using Supabase's built-in email)
3. **Test the flow**: Sign up → Confirm email → Log in → Verify profile/household created
4. **Customize email templates** to match your branding
