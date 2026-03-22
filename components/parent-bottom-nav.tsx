'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, User, Calendar, ShoppingCart, CreditCard } from 'lucide-react'
import { useCart } from '@/lib/cart-context'

interface ParentBottomNavProps {
  clubSlug: string
}

export function ParentBottomNav({ clubSlug }: ParentBottomNavProps) {
  const pathname = usePathname()
  const { itemCount } = useCart()
  const base = `/clubs/${clubSlug}/parent`

  const items = [
    { label: 'Home', href: `${base}/dashboard`, icon: LayoutDashboard },
    { label: 'Programs', href: `${base}/programs`, icon: BookOpen },
    { label: 'Athletes', href: `${base}/athletes`, icon: User },
    { label: 'Schedule', href: `${base}/schedule`, icon: Calendar },
    { label: 'Billing', href: `${base}/billing`, icon: CreditCard },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-zinc-800 bg-zinc-950">
      <div className="flex items-stretch">
        {items.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (pathname.startsWith(item.href) && item.href !== `${base}/dashboard`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-orange-400' : ''}`} />
              {item.label}
            </Link>
          )
        })}

        {/* Cart — always shown, badge when items present */}
        <Link
          href={`${base}/cart`}
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors relative ${
            pathname.startsWith(`${base}/cart`) ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <div className="relative">
            <ShoppingCart className={`h-5 w-5 ${pathname.startsWith(`${base}/cart`) ? 'text-orange-400' : ''}`} />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-black">
                {itemCount}
              </span>
            )}
          </div>
          Cart
        </Link>
      </div>
    </nav>
  )
}
