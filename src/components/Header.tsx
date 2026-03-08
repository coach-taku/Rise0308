'use client'

import { useRouter, usePathname } from 'next/navigation'
import { logoutUser } from '@/lib/data'

export default function Header({ userName, role }: { userName: string; role: 'player' | 'coach' }) {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    await logoutUser()
    router.push('/login')
  }

  const navItems = role === 'coach'
    ? [
        { href: '/coach/dashboard', label: 'チーム一覧' },
        { href: '/coach/tournament', label: '大会設定' },
      ]
    : [
        { href: '/player/dashboard', label: 'ホーム' },
        { href: '/player/daily', label: '日々の記録' },
        { href: '/player/mandala', label: '目標設定' },
        { href: '/player/timeline', label: 'グループ共有' },
      ]

  return (
    <header className="bg-brand-dark text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <h1
              className="text-lg font-bold text-brand-main cursor-pointer"
              onClick={() => router.push(role === 'coach' ? '/coach/dashboard' : '/player/dashboard')}
            >
              RISE NOTE
            </h1>
            {/* PC nav items */}
            <nav className="hidden md:flex items-center gap-1 ml-6">
              {navItems.map(item => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    pathname.startsWith(item.href)
                      ? 'bg-brand-main text-brand-dark font-semibold'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300 hidden sm:inline">{userName}</span>
            <button
              onClick={handleLogout}
              className="text-xs bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded-md transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
