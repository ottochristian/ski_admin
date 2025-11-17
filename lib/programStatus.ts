// src/lib/programStatus.ts

export enum ProgramStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DELETED = "DELETED",
}

// Optional: helper for labels in the UI
export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  [ProgramStatus.ACTIVE]: "Active",
  [ProgramStatus.INACTIVE]: "Inactive",
  [ProgramStatus.DELETED]: "Deleted",
};
