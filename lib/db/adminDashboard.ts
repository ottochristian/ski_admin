// lib/db/adminDashboard.ts
import { supabase } from "@/lib/supabaseClient"
import { ProgramStatus } from "@/lib/programStatus"
import { RecentRegistration } from "@/lib/types"

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
      athletes (
        first_name,
        last_name,
        families ( family_name )
      ),
      sub_programs (
        name,
        programs ( name )
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data || []) as RecentRegistration[]
}
