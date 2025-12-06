# Parent Signup & Registration Flow Guide

## Complete Flow

### 1. **Sign Up as Parent**
- Go to `/signup`
- Fill in:
  - First Name
  - Last Name
  - Email
  - Password (min 6 characters)
- Click "Sign Up"
- System automatically:
  - Creates auth account
  - Creates profile with `role: 'parent'`
  - Creates household (or family as fallback)
  - Links user to household
  - Redirects to parent dashboard

### 2. **Log In as Parent**
- Go to `/login`
- Enter email and password
- Click "Log in"
- System redirects based on role:
  - `parent` → `/clubs/[clubSlug]/parent/dashboard`
  - `admin` → `/admin`
  - `coach` → `/coach`

### 3. **Add Athlete**
- From parent dashboard, click "Add Athlete" or go to `/clubs/[clubSlug]/parent/athletes`
- Click "Add Athlete" button
- Fill in athlete form:
  - First Name * (required)
  - Last Name * (required)
  - Date of Birth (optional)
  - Gender (optional)
- Click "Add Athlete"
- Athlete is added to your household

### 4. **Browse Programs**
- Go to `/clubs/[clubSlug]/parent/programs`
- Select an athlete from dropdown
- Browse available programs/sub-programs for current season
- Click "Add to Cart" for desired programs

### 5. **Review Cart & Checkout**
- Go to `/clubs/[clubSlug]/parent/cart`
- Review registrations
- Click "Proceed to Checkout"
- System creates:
  - Registrations (status: 'pending')
  - Order (status: 'unpaid')
  - Order items
- Redirects to Stripe Checkout

### 6. **Complete Payment**
- Enter payment details in Stripe
- Use test card: `4242 4242 4242 4242`
- Complete payment
- Stripe webhook updates:
  - Order → 'paid'
  - Creates payment record
  - Registrations → 'confirmed'
- Redirects to billing page with success message

### 7. **View Billing History**
- Go to `/clubs/[clubSlug]/parent/billing`
- See all orders for current season
- View payment status and details

## Testing Checklist

- [ ] Sign up new parent account
- [ ] Log in as parent
- [ ] Add first athlete
- [ ] Browse programs (should show programs for current season)
- [ ] Add programs to cart
- [ ] View cart
- [ ] Checkout (creates order)
- [ ] Complete Stripe payment
- [ ] Verify order shows as paid in billing
- [ ] Verify registrations are confirmed

## Database Requirements

The signup process requires:
- `profiles` table with `role` column
- `households` table (or `families` as fallback)
- `household_guardians` table (or `families.profile_id` as fallback)
- `athletes` table with `household_id` or `family_id`
- `clubs` table with at least one club (slug: 'default')

## Notes

- If `households` table doesn't exist, system falls back to `families` table
- Athletes can be linked via `household_id` or `family_id` depending on schema
- Club is determined from URL (`/clubs/[clubSlug]`) or defaults to user's `club_id` from profile
- Season is determined from `useAdminSeason` hook (current season or selected season)
