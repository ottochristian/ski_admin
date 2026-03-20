export const IMP_COOKIE = 'imp'

export interface ImpersonationContext {
  userId: string
  userName: string
  userEmail: string
  role: string
  clubSlug: string | null
  clubName: string | null
  logId: string
}

export function parseImpersonationCookie(cookieHeader: string): ImpersonationContext | null {
  const match = cookieHeader.match(/(?:^|;\s*)imp=([^;]*)/)
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

export function redirectUrlForRole(role: string, clubSlug: string | null): string {
  if (role === 'admin' && clubSlug) return `/clubs/${clubSlug}/admin`
  if (role === 'coach' && clubSlug) return `/clubs/${clubSlug}/coach`
  if (role === 'parent' && clubSlug) return `/clubs/${clubSlug}/parent/dashboard`
  return '/system-admin'
}

