'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const CART_STORAGE_KEY = 'cart_items'

export type CartItem = {
  id: string // temporary ID for cart
  athlete_id: string
  athlete_name: string
  sub_program_id: string
  sub_program_name: string
  program_name: string
  price: number
  isWaitlisted?: boolean // true = joining waitlist, no payment collected
  registration_id?: string // Set when registration is created
}

type CartContextType = {
  items: CartItem[]
  addItem: (item: CartItem) => boolean
  removeItem: (itemId: string) => void
  clearCart: () => void
  total: number
  itemCount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

function loadFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored) as CartItem[]
  } catch {
    return []
  }
}

function saveToStorage(items: CartItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Storage unavailable — fail silently
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Restore cart from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage()
    if (stored.length > 0) {
      setItems(stored)
    }
    setHydrated(true)
  }, [])

  // Persist cart to localStorage whenever it changes (after hydration)
  useEffect(() => {
    if (!hydrated) return
    saveToStorage(items)
  }, [items, hydrated])

  const addItem = (item: CartItem): boolean => {
    // Check for duplicates using current state
    const existing = items.find(
      i => i.athlete_id === item.athlete_id && i.sub_program_id === item.sub_program_id
    )

    if (existing) {
      return false // Don't add duplicates
    }

    setItems(prev => {
      // Safety check: prevent duplicates if state changed between check and update
      const duplicate = prev.find(
        i => i.athlete_id === item.athlete_id && i.sub_program_id === item.sub_program_id
      )
      if (duplicate) {
        return prev
      }
      return [...prev, item]
    })

    return true
  }

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
  }

  const clearCart = () => {
    setItems([])
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(CART_STORAGE_KEY)
      } catch {
        // Fail silently
      }
    }
  }

  const total = items.reduce((sum, item) => item.isWaitlisted ? sum : sum + item.price, 0)
  const itemCount = items.length

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearCart,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
