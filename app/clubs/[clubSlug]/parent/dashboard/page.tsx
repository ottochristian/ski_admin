'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useParentClub } from '@/lib/use-parent-club'
import { useClub } from '@/lib/club-context'
import { useHouseholdGuardians } from '@/lib/hooks/use-household-guardians'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, ShoppingCart, User, CreditCard } from 'lucide-react'

export default function ParentDashboardPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { household, athletes, profile } = useParentClub()
  const { club } = useClub()
  const { data: guardians = [], isLoading: guardiansLoading } = useHouseholdGuardians(household?.id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {club?.logo_url && (
          <div className="h-16 w-16 flex-shrink-0">
            <img
              src={club.logo_url}
              alt={club.name || 'Club logo'}
              className="h-full w-full object-contain rounded-lg"
              onError={(e) => {
                // Hide image if it fails to load
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {club?.name ? `${club.name} Dashboard` : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            Welcome to your parent portal
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Household</CardTitle>
            <CardDescription>Your family information</CardDescription>
          </CardHeader>
          <CardContent>
            {household && (
              <div className="space-y-4">
                {/* Guardians */}
                {guardiansLoading ? (
                  <p className="text-sm text-muted-foreground">Loading guardians...</p>
                ) : guardians.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Guardians
                    </p>
                    {guardians.map((guardian) => {
                      const guardianProfile = guardian.profiles
                      const isCurrentUser = guardian.user_id === profile?.id
                      const displayName = guardianProfile?.first_name || guardianProfile?.last_name
                        ? `${guardianProfile.first_name || ''} ${guardianProfile.last_name || ''}`.trim()
                        : guardianProfile?.email || 'Unknown'
                      
                      return (
                        <div key={guardian.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="text-sm">
                              {displayName}
                              {isCurrentUser && (
                                <span className="ml-1 text-xs text-muted-foreground">(You)</span>
                              )}
                            </p>
                          </div>
                          {guardian.is_primary ? (
                            <Badge variant="default" className="text-xs">Primary</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Secondary</Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
                
                {/* Contact Information */}
                <div className="space-y-2 border-t pt-4">
                  {household.primary_email && (
                    <p className="text-sm">
                      <span className="font-medium">Email:</span> {household.primary_email}
                    </p>
                  )}
                  {household.phone && (
                    <p className="text-sm">
                      <span className="font-medium">Phone:</span> {household.phone}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Athletes</CardTitle>
            <CardDescription>Manage your athletes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-2xl font-bold">{athletes.length}</p>
              <Link href={`/clubs/${clubSlug}/parent/athletes`}>
                <Button variant="outline" size="sm" className="w-full">
                  <User className="h-4 w-4 mr-2" />
                  View Athletes
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/clubs/${clubSlug}/parent/programs`}>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Browse Programs
              </Button>
            </Link>
            <Link href={`/clubs/${clubSlug}/parent/athletes/new`}>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Plus className="h-4 w-4 mr-2" />
                Add Athlete
              </Button>
            </Link>
            <Link href={`/clubs/${clubSlug}/parent/billing`}>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <CreditCard className="h-4 w-4 mr-2" />
                View Billing
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
