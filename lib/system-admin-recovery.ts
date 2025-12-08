/**
 * System Admin Recovery Mechanism
 * 
 * This file contains hardcoded recovery emails that will ALWAYS have system admin access.
 * This ensures you can never be locked out of the system.
 * 
 * IMPORTANT: Keep this file secure and update it if your email changes.
 */

/**
 * Hardcoded system admin emails that bypass role checks
 * These users will always have system admin access regardless of their profile role
 */
export const RECOVERY_SYSTEM_ADMIN_EMAILS = [
  // Add your email(s) here - these will ALWAYS have system admin access
  'ottilieotto@gmail.com',
  // Add backup emails if you have them
  // 'backup@example.com',
]

/**
 * Check if an email is a recovery system admin
 */
export function isRecoverySystemAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return RECOVERY_SYSTEM_ADMIN_EMAILS.includes(email.toLowerCase())
}
