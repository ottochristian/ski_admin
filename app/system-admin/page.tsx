'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystemAdmin } from '@/lib/use-system-admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, UserCheck, TrendingUp } from 'lucide-react'

export default function SystemAdminDashboard() {
  const { profile, loading: authLoading } = useSystemAdmin()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalClubs: 0,
    activeClubs: 0,
    totalAdmins: 0,
    totalAthletes: 0,
  })

  useEffect(() => {
    async function loadStats() {
      if (authLoading) return

      try {
        setLoading(true)

        // Get total clubs
        const { count: totalClubs } = await supabase
          .from('clubs')
          .select('*', { count: 'exact', head: true })

        // Get active clubs (clubs with at least one admin)
        const { data: clubsWithAdmins } = await supabase
          .from('profiles')
          .select('club_id', { count: 'exact' })
          .eq('role', 'admin')
          .not('club_id', 'is', null)

        const activeClubs = new Set(clubsWithAdmins?.map((p) => p.club_id) || []).size

        // Get total club admins
        const { count: totalAdmins } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin')

        // Get total athletes
        const { count: totalAthletes } = await supabase
          .from('athletes')
          .select('*', { count: 'exact', head: true })

        setStats({
          totalClubs: totalClubs || 0,
          activeClubs,
          totalAdmins: totalAdmins || 0,
          totalAthletes: totalAthletes || 0,
        })
      } catch (err) {
        console.error('Error loading stats:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [authLoading])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
        <p className="text-muted-foreground">System-wide metrics and statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clubs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClubs}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeClubs} with active admins
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Club Admins</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAdmins}</div>
            <p className="text-xs text-muted-foreground">Active administrators</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Athletes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAthletes}</div>
            <p className="text-xs text-muted-foreground">Across all clubs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clubs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeClubs}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalClubs > 0
                ? `${Math.round((stats.activeClubs / stats.totalClubs) * 100)}% of total`
                : '0%'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
