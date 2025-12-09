'use client'

import { useClub } from '@/lib/club-context'

interface AdminPageHeaderProps {
  title: string
  description?: string
}

export function AdminPageHeader({ title, description }: AdminPageHeaderProps) {
  const { club, loading: clubLoading } = useClub()
  const primaryColor = club?.primary_color || '#3B82F6'

  return (
    <div className="flex items-start gap-4 flex-wrap">
      {/* Logo */}
      {club && !clubLoading && (
        <div className="flex-shrink-0 flex items-start">
          {club.logo_url ? (
            <>
              <img
                src={club.logo_url}
                alt={`${club.name} logo`}
                className="h-16 w-16 rounded-md object-cover border border-slate-200"
                onError={(e) => {
                  // Hide image and show fallback
                  e.currentTarget.style.display = 'none'
                  const fallback = document.getElementById(`club-logo-fallback-${club.id}`)
                  if (fallback) {
                    fallback.style.display = 'flex'
                  }
                }}
              />
              {/* Fallback: Show club initial if logo fails to load */}
              <div
                id={`club-logo-fallback-${club.id}`}
                className="h-16 w-16 rounded-md border border-slate-200 hidden items-center justify-center text-2xl font-semibold"
                style={{
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor,
                }}
              >
                {club.name.charAt(0).toUpperCase()}
              </div>
            </>
          ) : (
            /* Show club initial if no logo */
            <div
              className="h-16 w-16 rounded-md border border-slate-200 flex items-center justify-center text-2xl font-semibold"
              style={{
                backgroundColor: `${primaryColor}15`,
                color: primaryColor,
              }}
            >
              {club.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      
      {/* Title and Description */}
      <div className="flex-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </div>
  )
}
