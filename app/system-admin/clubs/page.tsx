'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSystemAdmin } from '@/lib/use-system-admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Building2, Plus, Eye, Edit } from 'lucide-react'
import Link from 'next/link'

type Club = {
  id: string
  name: string
  slug: string
  primary_color: string | null
  created_at: string
  admin_count?: number
  athlete_count?: number
  program_count?: number
}

export default function ClubsPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const { profile, loading: authLoading } = useSystemAdmin()
  const [loading, setLoading] = useState(true)
  const [clubs, setClubs] = useState<Club[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadClubs() {
      if (authLoading) return

      try {
        setLoading(true)
        setError(null)

        // Load all clubs
        const { data: clubsData, error: clubsError } = await supabase
          .from('clubs')
          .select('*')
          .order('name', { ascending: true })

        if (clubsError) {
          setError(clubsError.message)
          setLoading(false)
          return
        }

        // Get counts for each club
        const clubsWithCounts = await Promise.all(
          (clubsData || []).map(async (club) => {
            // Count admins
            const { count: adminCount } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('role', 'admin')
              .eq('club_id', club.id)

            // Count athletes
            const { count: athleteCount } = await supabase
              .from('athletes')
              .select('*', { count: 'exact', head: true })
              .eq('club_id', club.id)

            // Count programs
            const { count: programCount } = await supabase
              .from('programs')
              .select('*', { count: 'exact', head: true })
              .eq('club_id', club.id)

            return {
              ...club,
              admin_count: adminCount || 0,
              athlete_count: athleteCount || 0,
              program_count: programCount || 0,
            }
          })
        )

        setClubs(clubsWithCounts)
      } catch (err) {
        console.error('Error loading clubs:', err)
        setError('Failed to load clubs')
      } finally {
        setLoading(false)
      }
    }

    loadClubs()
  }, [authLoading, supabase])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading clubs...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Clubs</h2>
          <p className="text-muted-foreground">Manage all clubs in the system</p>
        </div>
        <Button asChild>
          <Link href="/system-admin/clubs/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Club
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clubs</CardTitle>
          <CardDescription>{clubs.length} clubs total</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Admins</TableHead>
                <TableHead>Athletes</TableHead>
                <TableHead>Programs</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clubs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No clubs found
                  </TableCell>
                </TableRow>
              ) : (
                clubs.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: club.primary_color || '#3B82F6',
                          }}
                        />
                        {club.name}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{club.slug}</TableCell>
                    <TableCell>{club.admin_count || 0}</TableCell>
                    <TableCell>{club.athlete_count || 0}</TableCell>
                    <TableCell>{club.program_count || 0}</TableCell>
                    <TableCell>
                      {new Date(club.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/system-admin/clubs/${club.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/system-admin/clubs/${club.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
