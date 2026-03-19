'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MultiSearchSelectOption = {
  id: string
  label: string
}

interface MultiSearchSelectProps {
  options: MultiSearchSelectOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export function MultiSearchSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  disabled = false,
}: MultiSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  function selectAll() {
    onChange(options.map((o) => o.id))
  }

  function clearAll() {
    onChange([])
  }

  function handleTriggerClick() {
    if (disabled) return
    setOpen((o) => !o)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const triggerLabel = () => {
    if (selected.length === 0) return null
    if (selected.length === options.length) return 'All'
    if (selected.length === 1) return options.find((o) => o.id === selected[0])?.label
    return `${selected.length} selected`
  }

  const label = triggerLabel()

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors',
          'border-zinc-700 bg-zinc-900',
          'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
          disabled && 'opacity-40 cursor-not-allowed',
          !disabled && 'hover:border-zinc-600'
        )}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {label ? (
            <>
              <span className="text-foreground truncate">{label}</span>
              <span
                role="button"
                tabIndex={0}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); clearAll() }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); clearAll() }}}
                className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 flex-shrink-0 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </span>
            </>
          ) : (
            <span className="text-zinc-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-zinc-500 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg overflow-hidden">
          {/* Search */}
          <div className="border-b border-zinc-800 px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-zinc-600 focus:outline-none"
            />
          </div>

          {/* Select all / Clear */}
          {options.length > 1 && !query && (
            <div className="border-b border-zinc-800 px-3 py-1.5 flex gap-3">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={selectAll}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Select all
              </button>
              {selected.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearAll}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Options */}
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-600">No results</li>
            ) : (
              filtered.map((o) => {
                const isSelected = selected.includes(o.id)
                return (
                  <li
                    key={o.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(o.id)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors',
                      isSelected ? 'text-foreground' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    )}
                  >
                    <div className={cn(
                      'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                      isSelected ? 'bg-orange-600 border-orange-600' : 'border-zinc-600'
                    )}>
                      {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    {o.label}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
