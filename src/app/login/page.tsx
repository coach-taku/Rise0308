'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProfiles, loginUser } from '@/lib/data'
import { Profile } from '@/types/database'

export default function LoginPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedName, setSelectedName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check existing session
    const session = localStorage.getItem('rise_note_session')
    if (session) {
      const user = JSON.parse(session)
      router.push(user.role === 'coach' ? '/coach/dashboard' : '/player/dashboard')
      return
    }

    getProfiles().then(setProfiles).catch(console.error)
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedName) {
      setError('名前を選択してください')
      return
    }
    if (!password) {
      setError('合言葉を入力してください')
      return
    }

    setLoading(true)
    try {
      const profile = await loginUser(selectedName, password)
      if (profile) {
        localStorage.setItem('rise_note_session', JSON.stringify(profile))
        router.push(profile.role === 'coach' ? '/coach/dashboard' : '/player/dashboard')
      } else {
        setError('合言葉が正しくありません')
      }
    } catch (err) {
      setError('ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #333333 0%, #555555 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-block bg-brand-main text-brand-dark px-6 py-3 rounded-xl mb-4">
            <h1 className="text-2xl font-bold tracking-wider">KUKI GYMRATS</h1>
            <p className="text-3xl font-bold tracking-widest">RISE NOTE</p>
          </div>
          <p className="text-gray-300 text-sm mt-3">
            本気になれば、何者にもなれる
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              名前を選択
            </label>
            <select
              value={selectedName}
              onChange={(e) => setSelectedName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none transition-colors bg-gray-50 text-gray-800 text-base"
            >
              <option value="">-- 選択してください --</option>
              <optgroup label="選手">
                {profiles.filter(p => p.role === 'player').map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </optgroup>
              <optgroup label="スタッフ">
                {profiles.filter(p => p.role === 'coach').map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              合言葉
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="チームの合言葉を入力"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none transition-colors bg-gray-50 text-base"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-main text-brand-dark font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 text-lg shadow-md"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <p className="text-center text-gray-400 text-xs mt-6">
          KUKI GYMRATS BASKETBALL CLUB
        </p>
      </div>
    </div>
  )
}
