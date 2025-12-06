'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useParentClub } from '@/lib/use-parent-club'
import { useAdminSeason } from '@/lib/use-admin-season'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, ShoppingCart, User, CreditCard } from 'lucide-react'

export default function ParentDashboardPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { household, athletes } = useParentClub()
  const { selectedSeason } = useAdminSeason()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your parent portal for {selectedSeason?.name || 'the current season'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Household</CardTitle>
            <CardDescription>Your family information</CardDescription>
          </CardHeader>
          <CardContent>
            {household && (
              <div className="space-y-2">
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
            <Link href={`/clubs/${clubSlug}/parent/athletes`}>
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
