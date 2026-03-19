'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronRight, ChevronDown, Mail } from 'lucide-react'
import { SearchSelect } from '@/components/search-select'
import { cn } from '@/lib/utils'

// A recipient is either a known household or a raw email address
export type SelectedRecipient =
  | { kind: 'household'; id: string; name: string }
  | { kind: 'email'; email: string }

// Convenience alias used by pages that only care about households
export interface SelectedHousehold {
  id: string
  name: string
}

interface Group {
  id: string
  name: string
}

interface SubProgram {
  id: string
  name: string
  groups: Group[]
}

export interface Program {
  id: string
  name: string
  sub_programs: SubProgram[]
}

interface FamilyAudienceSelectorProps {
  selected: SelectedRecipient[]
  onChange: (recipients: SelectedRecipient[]) => void
  programs: Program[]
  loadingPrograms: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function FamilyAudienceSelector({
  selected,
  onChange,
  programs,
  loadingPrograms,
}: FamilyAudienceSelectorProps) {
  const [inputValue, setInputValue] = useState('')
  const [open, setOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<SelectedHousehold[]>([])
  const [searching, setSearching] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)

  // Cascade state
  const [programId, setProgramId] = useState('')
  const [subProgramId, setSubProgramId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [browseHouseholds, setBrowseHouseholds] = useState<SelectedHousehold[]>([])
  const [loadingBrowse, setLoadingBrowse] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedHouseholdIds = new Set(
    selected.filter((r): r is Extract<SelectedRecipient, { kind: 'household' }> => r.kind === 'household').map(r => r.id)
  )

  const selectedProgram = programs.find((p) => p.id === programId)
  const subProgramOptions = selectedProgram?.sub_programs ?? []
  const selectedSubProgram = subProgramOptions.find((sp) => sp.id === subProgramId)
  const groupOptions = selectedSubProgram?.groups ?? []

  const browseTarget: { type: 'program' | 'sub_program' | 'group'; id: string } | null =
    groupId ? { type: 'group', id: groupId }
    : subProgramId ? { type: 'sub_program', id: subProgramId }
    : programId ? { type: 'program', id: programId }
    : null

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = inputValue.trim()
    if (q.length < 2 || q.includes('@')) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/messages/households?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setSearchResults(data.households ?? [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [inputValue])

  // Fetch households when browse target changes
  useEffect(() => {
    if (!browseTarget) { setBrowseHouseholds([]); return }
    let cancelled = false
    setLoadingBrowse(true)
    fetch('/api/messages/households', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: browseTarget.type, target_id: browseTarget.id }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled) setBrowseHouseholds(data.households ?? []) })
      .catch(() => { if (!cancelled) setBrowseHouseholds([]) })
      .finally(() => { if (!cancelled) setLoadingBrowse(false) })
    return () => { cancelled = true }
  }, [browseTarget?.type, browseTarget?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleProgramChange(id: string) { setProgramId(id); setSubProgramId(''); setGroupId('') }
  function handleSubProgramChange(id: string) { setSubProgramId(id); setGroupId('') }

  function toggleHousehold(h: SelectedHousehold) {
    if (selectedHouseholdIds.has(h.id)) {
      onChange(selected.filter(r => !(r.kind === 'household' && r.id === h.id)))
    } else {
      onChange([...selected, { kind: 'household', id: h.id, name: h.name }])
      setInputValue('')
      setSearchResults([])
    }
  }

  function addEmail(raw: string) {
    const email = raw.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) return
    // Avoid duplicates
    const already = selected.some(r => r.kind === 'email' && r.email === email)
    if (!already) onChange([...selected, { kind: 'email', email }])
    setInputValue('')
  }

  function removeRecipient(idx: number) {
    onChange(selected.filter((_, i) => i !== idx))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const q = inputValue.trim()
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && q) {
      e.preventDefault()
      if (q.includes('@')) {
        addEmail(q)
      }
    }
    if (e.key === 'Backspace' && inputValue === '' && selected.length > 0) {
      removeRecipient(selected.length - 1)
    }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  const isEmailQuery = inputValue.includes('@')
  const emailIsValid = EMAIL_RE.test(inputValue.trim())

  return (
    <div ref={containerRef} className="relative">
      {/* To: field */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 min-h-[42px] px-3 py-2 rounded-lg border bg-zinc-900 cursor-text transition-colors',
          open ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-zinc-700'
        )}
        onClick={() => { inputRef.current?.focus(); setOpen(true) }}
      >
        {/* Recipient tags */}
        {selected.map((r, idx) => (
          <span
            key={idx}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm leading-tight',
              r.kind === 'household'
                ? 'bg-zinc-700 text-zinc-200'
                : 'bg-blue-900/40 border border-blue-700/50 text-blue-300'
            )}
          >
            {r.kind === 'email' && <Mail className="h-3 w-3 opacity-60 flex-shrink-0" />}
            {r.kind === 'household' ? r.name : r.email}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); removeRecipient(idx) }}
              className="ml-0.5 text-zinc-400 hover:text-white transition-colors"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? 'Search families, or type an email address…' : ''}
          className="flex-1 min-w-[200px] bg-transparent text-sm text-foreground placeholder:text-zinc-600 outline-none"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 shadow-2xl overflow-hidden ring-1 ring-black/40">

          {/* Email entry suggestion */}
          {isEmailQuery && (
            <div className="border-b border-zinc-700">
              {emailIsValid ? (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); addEmail(inputValue) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-zinc-700 transition-colors"
                >
                  <Mail className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <span className="text-zinc-300">Add <span className="text-blue-300 font-medium">{inputValue.trim().toLowerCase()}</span> as a direct recipient</span>
                </button>
              ) : (
                <div className="px-3 py-2.5 text-sm text-zinc-600 flex items-center gap-2">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  Finish typing a valid email address, then press Enter
                </div>
              )}
            </div>
          )}

          {/* Family search results */}
          {!isEmailQuery && inputValue.trim().length >= 2 && (
            <div className="border-b border-zinc-700">
              {searching ? (
                <div className="px-3 py-2.5 text-sm text-zinc-500">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-zinc-500">No families found for "{inputValue.trim()}"</div>
              ) : (
                <ul className="max-h-48 overflow-y-auto divide-y divide-zinc-700">
                  {searchResults.map((h) => {
                    const checked = selectedHouseholdIds.has(h.id)
                    return (
                      <li key={h.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); toggleHousehold(h) }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors',
                            checked ? 'bg-orange-600/10 text-zinc-200' : 'text-zinc-300 hover:bg-zinc-700'
                          )}
                        >
                          <span className={cn(
                            'h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center',
                            checked ? 'bg-orange-500 border-orange-500' : 'border-zinc-600'
                          )}>
                            {checked && (
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2.5 6.5L4.5 8.5L9.5 3.5" />
                              </svg>
                            )}
                          </span>
                          {h.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Browse by program */}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setBrowseOpen(v => !v) }}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
          >
            <span>Browse by program</span>
            {browseOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {browseOpen && (
            <div className="border-t border-zinc-700 px-3 py-3 space-y-2.5 bg-zinc-700/20">
              {loadingPrograms ? (
                <div className="h-9 rounded-lg bg-zinc-800 animate-pulse" />
              ) : (
                <SearchSelect
                  options={programs.map(p => ({ id: p.id, label: p.name }))}
                  value={programId}
                  onChange={handleProgramChange}
                  placeholder="Select program…"
                  clearable
                />
              )}
              {programId && subProgramOptions.length > 0 && (
                <SearchSelect
                  options={subProgramOptions.map(sp => ({ id: sp.id, label: sp.name }))}
                  value={subProgramId}
                  onChange={handleSubProgramChange}
                  placeholder="Sub-program (optional)…"
                  clearable
                />
              )}
              {subProgramId && groupOptions.length > 0 && (
                <SearchSelect
                  options={groupOptions.map(g => ({ id: g.id, label: g.name }))}
                  value={groupId}
                  onChange={setGroupId}
                  placeholder="Group (optional)…"
                  clearable
                />
              )}

              {browseTarget && (
                loadingBrowse ? (
                  <div className="space-y-1.5">
                    {[1, 2, 3].map(i => <div key={i} className="h-8 rounded bg-zinc-800 animate-pulse" />)}
                  </div>
                ) : browseHouseholds.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-1">No families in this selection.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500">{browseHouseholds.length} {browseHouseholds.length === 1 ? 'family' : 'families'}</p>
                      {browseHouseholds.some(h => !selectedHouseholdIds.has(h.id)) && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            const toAdd = browseHouseholds
                              .filter(h => !selectedHouseholdIds.has(h.id))
                              .map(h => ({ kind: 'household' as const, id: h.id, name: h.name }))
                            onChange([...selected, ...toAdd])
                          }}
                          className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                        >
                          Add all
                        </button>
                      )}
                    </div>
                    <ul className="max-h-44 overflow-y-auto rounded-lg border border-zinc-700 divide-y divide-zinc-700/60">
                      {browseHouseholds.map(h => {
                        const checked = selectedHouseholdIds.has(h.id)
                        return (
                          <li key={h.id}>
                            <label className={cn(
                              'flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm transition-colors',
                              checked ? 'bg-orange-600/10 text-zinc-200' : 'text-zinc-300 hover:bg-zinc-700/60'
                            )}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleHousehold(h)}
                                className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 accent-orange-500"
                              />
                              {h.name}
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )
              )}
              {!browseTarget && !loadingPrograms && (
                <p className="text-xs text-zinc-600">Select a program above to see families.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
