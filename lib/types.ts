// lib/types.ts
import { ProgramStatus } from "./programStatus"

export interface Program {
  id: string
  name: string
  // add whatever fields you really have
  status: ProgramStatus
}

export interface SubProgram {
  id: string
  program_id: string
  name: string
  status: ProgramStatus
}

export interface Group {
  id: string
  sub_program_id: string
  name: string
  status: ProgramStatus
}

export interface Profile {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
  role: string
  club_id?: string | null
}

export interface RecentRegistration {
  id: string
  status: string // or a union if you know them ("pending" | "paid" | ...)
  created_at: string
  athletes?: {
    first_name?: string
    last_name?: string
    households?: {
      primary_email?: string | null
    } | null
  } | null
  sub_programs?: {
    name?: string
    programs?: {
      name?: string
    } | null
  } | null
}
