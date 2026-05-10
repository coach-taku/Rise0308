'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/session'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const session = getSession()
    if (session) {
      if (session.role === 'staff') {
        router.push('/coach/dashboard')
      } else {
        router.push('/player/dashboard')
      }
    } else {
      router.push('/login')
    }
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-pulse">
          <h1 className="text-3xl font-bold text-brand-main">RISE NOTE</h1>
          <p className="mt-2 text-brand-dark">読み込み中...</p>
        </div>
      </div>
    </div>
  )
}
