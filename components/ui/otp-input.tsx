'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface OTPInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  className?: string
  error?: boolean
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  className,
  error = false
}: OTPInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

  React.useEffect(() => {
    // Auto-focus first input on mount
    if (inputRefs.current[0] && !value) {
      inputRefs.current[0].focus()
    }
  }, [])

  React.useEffect(() => {
    // Call onComplete when all digits are filled
    if (value.length === length && onComplete) {
      onComplete(value)
    }
  }, [value, length, onComplete])

  const handleChange = (index: number, digit: string) => {
    // Only allow digits
    if (digit && !/^\d$/.test(digit)) {
      return
    }

    const newValue = value.split('')
    newValue[index] = digit
    const updatedValue = newValue.join('')

    onChange(updatedValue)

    // Auto-focus next input
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      
      const newValue = value.split('')
      
      if (value[index]) {
        // Clear current digit
        newValue[index] = ''
        onChange(newValue.join(''))
      } else if (index > 0) {
        // Move to previous and clear
        newValue[index - 1] = ''
        onChange(newValue.join(''))
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text/plain').trim()
    
    // Only allow digits
    const digits = pastedData.replace(/\D/g, '').slice(0, length)
    
    if (digits.length > 0) {
      onChange(digits)
      
      // Focus the next empty input or the last input
      const nextEmptyIndex = Math.min(digits.length, length - 1)
      inputRefs.current[nextEmptyIndex]?.focus()
    }
  }

  const handleFocus = (index: number) => {
    // Select the input content on focus
    inputRefs.current[index]?.select()
  }

  return (
    <div 
      className={cn('flex gap-2 justify-center', className)}
      onPaste={handlePaste}
    >
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={() => handleFocus(index)}
          disabled={disabled}
          className={cn(
            'w-12 h-14 text-center text-2xl font-bold',
            'border-2 rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            'transition-all duration-200',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-100',
            value[index] && 'border-blue-500',
            className
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  )
}
