'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ProgramsDebugPage() {
  return (
    <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Programs debug page ✅</h1>
      <p>
        This version of the page makes <strong>no Supabase calls</strong>. If you
        still see a Postgres / uuid error, it is coming from some <em>other</em>{' '}
        component (likely an admin layout or shared header).
      </p>

      <div style={{ marginTop: 24 }}>
        <Link href="/admin">
          <Button variant="outline">Back to Admin Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
