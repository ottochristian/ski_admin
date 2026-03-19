'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SearchSelectOption = {
  id: string
  label: string
}

interface SearchSelectProps {
  options: SearchSelectOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  disabled = false,
  clearable = false,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value)

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
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

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }

  function handleTriggerClick() {
    if (disabled) return
    setOpen((o) => !o)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors',
          'border-zinc-700 bg-zinc-900 text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
          disabled && 'opacity-40 cursor-not-allowed',
          !disabled && 'hover:border-zinc-600'
        )}
      >
        <span className={cn('truncate', !selected && 'text-zinc-500')}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {clearable && selected && (
            <span
              role="button"
              tabIndex={0}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClear(e as any) }}
              className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg overflow-hidden">
          {/* Search input */}
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

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-600">No results</li>
            ) : (
              filtered.map((o) => (
                <li
                  key={o.id}
                  onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                  onClick={() => handleSelect(o.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors',
                    o.id === value
                      ? 'bg-orange-600/20 text-orange-400'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  )}
                >
                  <Check className={cn('h-3.5 w-3.5 flex-shrink-0', o.id === value ? 'opacity-100' : 'opacity-0')} />
                  {o.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
