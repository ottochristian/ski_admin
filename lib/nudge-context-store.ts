/**
 * Module-level store for passing nudge context from the notification bell
 * to the compose page. Avoids sessionStorage which breaks under React 18
 * StrictMode's double-mount (first mount reads & removes item; second mount
 * finds nothing and loses the async setState from mount #1).
 *
 * Module scope persists across React's StrictMode unmount/remount cycle,
 * so both invocations of useState(() => getNudgeContext()) see the same value.
 */

export type NudgeContextPayload = {
  nudgeType: string
  title: string
  detail: string
  target_name: string
  target: { type: 'program' | 'sub_program' | 'group'; id: string; name: string } | null
  household_ids: string[]
  recipient_count: number | null
  preview_names: string[]
  draft_endpoint: string
}

let _pending: NudgeContextPayload | null = null

export function storeNudgeContext(payload: NudgeContextPayload): void {
  _pending = payload
}

export function getNudgeContext(): NudgeContextPayload | null {
  return _pending
}

export function clearNudgeContext(): void {
  _pending = null
}
