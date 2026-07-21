'use client'

import { useRouter, usePathname } from 'next/navigation'

const playerNavItems = [
  { href: '/player/dashboard', label: 'ホーム', icon: '🏠' },
  { href: '/player/daily', label: '記録', icon: '✏️' },
  { href: '/player/mandala', label: '目標', icon: '🎯' },
  { href: '/player/stats', label: 'スタッツ', icon: '🏀' },
  { href: '/player/karte', label: 'カルテ', icon: '📋' },
  { href: '/player/timeline', label: '共有', icon: '💬' },
]

const staffNavItems = [
  { href: '/coach/dashboard', label: 'チーム', icon: '📊' },
  { href: '/coach/stats', label: 'スタッツ', icon: '🏀' },
  { href: '/coach/tournament', label: '大会設定', icon: '🏆' },
  { href: '/coach/users', label: 'ユーザー管理', icon: '👥' },
]

export default function BottomNav({ role }: { role: 'player' | 'staff' }) {
  const router = useRouter()
  const pathname = usePathname()
  const items = role === 'staff' ? staffNavItems : playerNavItems

  // 選手は6ボタン・スタッフは4ボタンなので、選手の場合はアイコン・テキストを少し小さくする
  const isPlayer = role === 'player'

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors min-w-0 ${
                isActive ? 'text-brand-main' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {/* 選手（6ボタン）は少し小さめ、スタッフ（4ボタン）は通常サイズ */}
              <span className={isPlayer ? 'text-lg' : 'text-xl'}>{item.icon}</span>
              <span className={`mt-0.5 font-medium truncate w-full text-center ${isPlayer ? 'text-[10px]' : 'text-xs'}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
