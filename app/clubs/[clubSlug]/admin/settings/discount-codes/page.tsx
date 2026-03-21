'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useRequireAdmin } from '@/lib/auth-context'
import { InlineLoading } from '@/components/ui/loading-states'
import {
  useDiscountCodes,
  useCreateDiscountCode,
  useUpdateDiscountCode,
  useDeactivateDiscountCode,
  type DiscountCode,
} from '@/lib/hooks/use-discount-codes'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Tag,
  Plus,
  Copy,
  Check,
  Pencil,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from 'lucide-react'

// ─── Code generator ──────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return (
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') +
    '-' +
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  )
}

// ─── Form defaults ────────────────────────────────────────────────────────────

const emptyForm = {
  code: '',
  description: '',
  type: 'percent' as 'percent' | 'fixed',
  value: '',
  min_order_cents: '',
  max_uses: '',
  max_uses_per_household: '1',
  max_uses_per_athlete: '',
  valid_from: '',
  valid_to: '',
  season_id: null as string | null,
}

type FormState = typeof emptyForm

function codeToForm(c: DiscountCode): FormState {
  return {
    code: c.code,
    description: c.description ?? '',
    type: c.type,
    value: String(c.value),
    min_order_cents: c.min_order_cents ? String(c.min_order_cents) : '',
    max_uses: c.max_uses !== null ? String(c.max_uses) : '',
    max_uses_per_household: c.max_uses_per_household !== null ? String(c.max_uses_per_household) : '',
    max_uses_per_athlete: c.max_uses_per_athlete !== null ? String(c.max_uses_per_athlete) : '',
    valid_from: c.valid_from ? c.valid_from.slice(0, 16) : '',
    valid_to: c.valid_to ? c.valid_to.slice(0, 16) : '',
    season_id: c.season_id,
  }
}

function formToPayload(f: FormState) {
  return {
    code: f.code.toUpperCase().trim(),
    description: f.description || null,
    type: f.type,
    value: parseFloat(f.value),
    min_order_cents: f.min_order_cents ? parseInt(f.min_order_cents) : 0,
    max_uses: f.max_uses ? parseInt(f.max_uses) : null,
    max_uses_per_household: f.max_uses_per_household ? parseInt(f.max_uses_per_household) : null,
    max_uses_per_athlete: f.max_uses_per_athlete ? parseInt(f.max_uses_per_athlete) : null,
    valid_from: f.valid_from ? new Date(f.valid_from).toISOString() : null,
    valid_to: f.valid_to ? new Date(f.valid_to).toISOString() : null,
    season_id: f.season_id || null,
    is_active: true,
  }
}

// ─── Code form dialog ─────────────────────────────────────────────────────────

function CodeFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing: DiscountCode | null
}) {
  const [form, setForm] = useState<FormState>(editing ? codeToForm(editing) : emptyForm)
  const [error, setError] = useState<string | null>(null)

  const create = useCreateDiscountCode()
  const update = useUpdateDiscountCode()
  const saving = create.isPending || update.isPending

  function set(key: keyof FormState, value: string | null) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.code) { setError('Code is required'); return }
    if (!form.value || isNaN(parseFloat(form.value))) { setError('Value is required'); return }
    if (form.type === 'percent' && parseFloat(form.value) > 100) {
      setError('Percentage cannot exceed 100')
      return
    }

    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...formToPayload(form) })
      } else {
        await create.mutateAsync(formToPayload(form) as any)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save code')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Discount Code' : 'Create Discount Code'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Code */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Code</label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm uppercase tracking-widest font-mono placeholder:normal-case placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="e.g. EARLYBIRD25"
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                disabled={!!editing}
                maxLength={50}
              />
              {!editing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() => set('code', generateCode())}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Generate
                </Button>
              )}
            </div>
            {editing && (
              <p className="text-xs text-muted-foreground">Code cannot be changed after creation.</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="e.g. Early bird discount — expires Oct 1"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={255}
            />
          </div>

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Discount type</label>
              <select
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed amount ($)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {form.type === 'percent' ? 'Percent off' : 'Amount off ($)'}
              </label>
              <input
                type="number"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder={form.type === 'percent' ? '10' : '25.00'}
                value={form.value}
                onChange={(e) => set('value', e.target.value)}
                min={form.type === 'percent' ? 1 : 0.01}
                max={form.type === 'percent' ? 100 : undefined}
                step={form.type === 'percent' ? 1 : 0.01}
              />
            </div>
          </div>

          {/* Min order */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Minimum order <span className="text-muted-foreground font-normal">(optional, in cents — e.g. 5000 = $50)</span>
            </label>
            <input
              type="number"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="0"
              value={form.min_order_cents}
              onChange={(e) => set('min_order_cents', e.target.value)}
              min={0}
              step={100}
            />
          </div>

          {/* Usage limits */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Max total uses</label>
              <input
                type="number"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="∞"
                value={form.max_uses}
                onChange={(e) => set('max_uses', e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Per family</label>
              <input
                type="number"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="∞"
                value={form.max_uses_per_household}
                onChange={(e) => set('max_uses_per_household', e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Per athlete</label>
              <input
                type="number"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="∞"
                value={form.max_uses_per_athlete}
                onChange={(e) => set('max_uses_per_athlete', e.target.value)}
                min={1}
              />
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Valid from <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                type="datetime-local"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.valid_from}
                onChange={(e) => set('valid_from', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Expires <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                type="datetime-local"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={form.valid_to}
                onChange={(e) => set('valid_to', e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create code'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-zinc-500 hover:text-zinc-300 transition-colors"
      title="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DiscountCodesPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string
  const { profile, loading: authLoading } = useRequireAdmin()

  const { data: codes = [], isLoading } = useDiscountCodes()
  const deactivate = useDeactivateDiscountCode()
  const update = useUpdateDiscountCode()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DiscountCode | null>(null)

  if (authLoading || !profile) return <InlineLoading message="Loading…" />

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(code: DiscountCode) {
    setEditing(code)
    setDialogOpen(true)
  }

  async function toggleActive(code: DiscountCode) {
    if (code.is_active) {
      await deactivate.mutateAsync(code.id)
    } else {
      await update.mutateAsync({ id: code.id, is_active: true })
    }
  }

  function formatValue(code: DiscountCode) {
    return code.type === 'percent'
      ? `${code.value}% off`
      : `$${Number(code.value).toFixed(2)} off`
  }

  function formatExpiry(code: DiscountCode) {
    if (!code.valid_to) return null
    const d = new Date(code.valid_to)
    const expired = d < new Date()
    return (
      <span className={expired ? 'text-red-400' : 'text-muted-foreground'}>
        {expired ? 'Expired ' : 'Expires '}
        {d.toLocaleDateString()}
      </span>
    )
  }

  const active = codes.filter((c) => c.is_active)
  const inactive = codes.filter((c) => !c.is_active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Tag className="h-6 w-6" />
            Discount Codes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage promotional codes for registration discounts.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Code
        </Button>
      </div>

      {isLoading ? (
        <InlineLoading message="Loading codes…" />
      ) : codes.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <Tag className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-muted-foreground">No discount codes yet.</p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Create your first code
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active codes */}
          {active.length > 0 && (
            <CodeTable
              codes={active}
              onEdit={openEdit}
              onToggle={toggleActive}
              formatValue={formatValue}
              formatExpiry={formatExpiry}
            />
          )}

          {/* Inactive codes */}
          {inactive.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Inactive / Deactivated
              </p>
              <CodeTable
                codes={inactive}
                onEdit={openEdit}
                onToggle={toggleActive}
                formatValue={formatValue}
                formatExpiry={formatExpiry}
                dim
              />
            </div>
          )}
        </div>
      )}

      <CodeFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        editing={editing}
      />
    </div>
  )
}

// ─── Code table ───────────────────────────────────────────────────────────────

function CodeTable({
  codes,
  onEdit,
  onToggle,
  formatValue,
  formatExpiry,
  dim = false,
}: {
  codes: DiscountCode[]
  onEdit: (c: DiscountCode) => void
  onToggle: (c: DiscountCode) => void
  formatValue: (c: DiscountCode) => string
  formatExpiry: (c: DiscountCode) => React.ReactNode
  dim?: boolean
}) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden ${dim ? 'opacity-60' : ''}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wide">
            <th className="px-5 py-3 text-left">Code</th>
            <th className="px-5 py-3 text-left">Discount</th>
            <th className="px-5 py-3 text-left">Limits</th>
            <th className="px-5 py-3 text-left">Expiry</th>
            <th className="px-5 py-3 text-left">Uses</th>
            <th className="px-5 py-3 text-left">Status</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {codes.map((code) => (
            <tr key={code.id} className="hover:bg-zinc-800/40 transition-colors">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold tracking-widest text-foreground">
                    {code.code}
                  </span>
                  <CopyButton text={code.code} />
                </div>
                {code.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{code.description}</p>
                )}
              </td>
              <td className="px-5 py-3 font-medium text-green-400">
                {formatValue(code)}
                {code.min_order_cents > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Min ${(code.min_order_cents / 100).toFixed(0)} order
                  </p>
                )}
              </td>
              <td className="px-5 py-3 text-xs text-muted-foreground space-y-0.5">
                <p>{code.max_uses !== null ? `${code.max_uses} total` : '∞ total'}</p>
                <p>{code.max_uses_per_household !== null ? `${code.max_uses_per_household}/family` : '∞/family'}</p>
                {code.max_uses_per_athlete !== null && (
                  <p>{code.max_uses_per_athlete}/athlete</p>
                )}
              </td>
              <td className="px-5 py-3 text-xs">
                {formatExpiry(code) ?? <span className="text-muted-foreground">No expiry</span>}
              </td>
              <td className="px-5 py-3">
                <span className="font-semibold">{code.use_count}</span>
                {code.max_uses !== null && (
                  <span className="text-muted-foreground"> / {code.max_uses}</span>
                )}
              </td>
              <td className="px-5 py-3">
                <Badge
                  className={
                    code.is_active
                      ? 'bg-green-950/40 text-green-400 border-green-800/40'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                  }
                  variant="outline"
                >
                  {code.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(code)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggle(code)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    title={code.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {code.is_active
                      ? <ToggleRight className="h-5 w-5 text-green-400" />
                      : <ToggleLeft className="h-5 w-5" />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
