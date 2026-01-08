// lib/db/adminDashboard.ts
import { createClient } from '@/lib/supabase/client'
import { ProgramStatus } from "@/lib/programStatus"
import { RecentRegistration } from "@/lib/types"

const supabase = createClient()

export async function fetchAdminStats() {
  const [
    { count: athletesCount },
    { count: registrationsCount },
    { count: activeProgramsCount },
  ] = await Promise.all([
    supabase.from("athletes").select("*", { count: "exact", head: true }),
    supabase.from("registrations").select("*", { count: "exact", head: true }),
    supabase
      .from("programs")
      .select("*", { count: "exact", head: true })
      .eq("status", ProgramStatus.ACTIVE),
  ])

  return {
    totalAthletes: athletesCount || 0,
    totalRegistrations: registrationsCount || 0,
    totalPrograms: activeProgramsCount || 0,
  }
}

export async function fetchRecentRegistrations(limit = 5) {
  const { data, error } = await supabase
    .from("registrations")
    .select(
      `
      id,
      status,
      created_at,
      athletes!inner (
        first_name,
        last_name,
        household_id,
        households (
          primary_email
        )
      ),
      sub_programs (
        name,
        programs ( name )
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent registrations:', error)
    throw error
  }

  // Transform data to match RecentRegistration type
  return (data || []).map((reg: any) => ({
    id: reg.id,
    status: reg.status,
    created_at: reg.created_at,
    athletes: reg.athletes ? {
      first_name: reg.athletes.first_name,
      last_name: reg.athletes.last_name,
      households: reg.athletes.households ? {
        primary_email: reg.athletes.households.primary_email,
      } : null,
    } : null,
    sub_programs: reg.sub_programs ? {
      name: reg.sub_programs.name,
      programs: reg.sub_programs.programs ? {
        name: reg.sub_programs.programs.name,
      } : null,
    } : null,
  })) as RecentRegistration[]
}
