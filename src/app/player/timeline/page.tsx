'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, DailyRecordWithUser } from '@/types/database'
import { getAllDailyRecords, addComment, getUsers } from '@/lib/data'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, subDays } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function TimelinePage() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [records, setRecords] = useState<DailyRecordWithUser[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [showComments, setShowComments] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const session = localStorage.getItem('rise_note_session')
    if (!session) { router.push('/login'); return }
    const userData = JSON.parse(session)
    setUser(userData)

    const loadData = async () => {
      try {
        const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd')
        const [allRecords, users] = await Promise.all([getAllDailyRecords(startDate), getUsers()])
        setRecords(allRecords)
        setAllUsers(users)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    loadData()
  }, [router])

  const handleAddComment = async (recordId: string) => {
    if (!user || !commentInputs[recordId]?.trim()) return
    try {
      const newComment = await addComment(recordId, user.id, commentInputs[recordId].trim())
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, comments: [...(r.comments || []), newComment] } : r))
      setCommentInputs(prev => ({ ...prev, [recordId]: '' }))
    } catch (e) { console.error(e) }
  }

  const getUserName = (userId: string) => allUsers.find(u => u.id === userId)?.name || '不明'
  const getUserRole = (userId: string) => allUsers.find(u => u.id === userId)?.role || 'player'

  if (loading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div></div>
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-20 md:pb-8">
      <Header userName={user.name} role={user.role as 'player' | 'staff'} />
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-lg font-bold text-brand-dark">グループ共有</h2>
          <p className="text-xs text-gray-500">仲間の振り返りを見て、お互いを高め合おう!</p>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-3">📝</p><p className="text-sm">まだ投稿がありません</p></div>
        ) : (
          <div className="space-y-3">
            {records.map(record => {
              const profileName = record.users?.name || getUserName(record.user_id)
              const isOwnRecord = record.user_id === user.id
              const comments = record.comments || []
              const isExpanded = showComments[record.id]

              return (
                <div key={record.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isOwnRecord ? 'bg-brand-main text-brand-dark' : 'bg-gray-200 text-gray-600'}`}>
                          {profileName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{profileName}</p>
                          <p className="text-xs text-gray-400">{format(parseISO(record.record_date), 'M月d日(E)', { locale: ja })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">評価 {record.self_evaluation}/10</span>
                        <span className="text-xs bg-brand-main text-brand-dark px-2 py-1 rounded-full font-medium">+{record.points}pt</span>
                      </div>
                    </div>

                    {record.target_items.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {record.target_items.map((goal, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{goal}</span>
                        ))}
                      </div>
                    )}

                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{record.reflection}</p>

                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                      <span>😴 {record.sleep_hours}h</span>
                      <span className={record.fatigue_level >= 7 ? 'text-red-500 font-medium' : ''}>疲労 {record.fatigue_level}/10</span>
                      {record.has_pain && <span className="text-red-500">⚠️ 痛みあり</span>}
                      <span>{record.participation_status}</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100">
                    <button onClick={() => setShowComments(prev => ({ ...prev, [record.id]: !prev[record.id] }))}
                      className="w-full px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-between">
                      <span>💬 コメント ({comments.length})</span><span>{isExpanded ? '▲' : '▼'}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3">
                        {comments.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {comments.map(comment => {
                              const commenterName = comment.users?.name || getUserName(comment.user_id)
                              const isStaffComment = getUserRole(comment.user_id) === 'staff'
                              return (
                                <div key={comment.id} className={`px-3 py-2 rounded-lg text-xs ${isStaffComment ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="font-semibold text-gray-700">{commenterName}</span>
                                    {isStaffComment && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">コーチ</span>}
                                  </div>
                                  <p className="text-gray-600">{comment.content}</p>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input type="text" value={commentInputs[record.id] || ''}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [record.id]: e.target.value }))}
                            placeholder="コメントを書く..."
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-xs"
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(record.id) } }} />
                          <button onClick={() => handleAddComment(record.id)}
                            className="bg-brand-main text-brand-dark font-medium px-4 py-2 rounded-lg text-xs hover:bg-yellow-400 transition-colors">送信</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <BottomNav role={user.role as 'player' | 'staff'} />
    </div>
  )
}
