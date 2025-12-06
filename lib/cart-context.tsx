'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export type CartItem = {
  id: string // temporary ID for cart
  athlete_id: string
  athlete_name: string
  sub_program_id: string
  sub_program_name: string
  program_name: string
  price: number
  registration_id?: string // Set when registration is created
}

type CartContextType = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (itemId: string) => void
  clearCart: () => void
  total: number
  itemCount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const addItem = (item: CartItem) => {
    setItems(prev => {
      // Check if this athlete is already registered for this sub-program
      const existing = prev.find(
        i => i.athlete_id === item.athlete_id && i.sub_program_id === item.sub_program_id
      )
      if (existing) {
        return prev // Don't add duplicates
      }
      return [...prev, item]
    })
  }

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
  }

  const clearCart = () => {
    setItems([])
  }

  const total = items.reduce((sum, item) => sum + item.price, 0)
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
