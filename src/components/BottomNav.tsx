'use client'

import { useRouter, usePathname } from 'next/navigation'

const playerNavItems = [
  { href: '/player/dashboard', label: 'ホーム', icon: '🏠' },
  { href: '/player/daily', label: '記録', icon: '✏️' },
  { href: '/player/mandala', label: '目標', icon: '🎯' },
  { href: '/player/timeline', label: '共有', icon: '💬' },
]

const staffNavItems = [
  { href: '/coach/dashboard', label: 'チーム', icon: '📊' },
  { href: '/coach/tournament', label: '大会設定', icon: '🏆' },
]

export default function BottomNav({ role }: { role: 'player' | 'staff' }) {
  const router = useRouter()
  const pathname = usePathname()
  const items = role === 'staff' ? staffNavItems : playerNavItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive ? 'text-brand-main' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs mt-0.5 font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
