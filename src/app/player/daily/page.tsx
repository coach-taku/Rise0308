'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, MandalaChart, DailyRecord } from '@/types/database'
import { getMandalaChart, getDailyRecord, saveDailyRecord, getDailyRecords, calculateStreak } from '@/lib/data'
import { getSession } from '@/lib/session'
import { calculatePoints, getPointMessage } from '@/lib/points'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { format } from 'date-fns'

const PARTICIPATION_OPTIONS = [
  { value: '参加', label: '参加', emoji: '🏀' },
  { value: 'リハビリ', label: 'リハビリ', emoji: '🩹' },
  { value: '体調不良', label: '体調不良', emoji: '🤒' },
  { value: '通院', label: '通院', emoji: '🏥' },
  { value: 'REST', label: 'REST', emoji: '😴' },
] as const

// 連続日数に応じたメッセージを返す
function getStreakMessage(streak: number): string {
  if (streak >= 30) return '🏆 1ヶ月連続！本物の習慣になってる！'
  if (streak >= 21) return '⭐ 3週間連続！すごい粘り強さだ！'
  if (streak >= 14) return '✨ 2週間連続継続中！成長が加速している！'
  if (streak >= 7) return '🔥 1週間継続！この調子で行こう！'
  if (streak >= 3) return '👍 連続記録中！続けることが力になる！'
  if (streak >= 1) return '🌱 新しい一歩を踏み出した！'
  return '📝 記録完了！また明日も書いてね！'
}

export default function DailyInputPage() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [mandala, setMandala] = useState<MandalaChart | null>(null)
  const [recordDate, setRecordDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [sleepHours, setSleepHours] = useState(7)
  const [fatigueLevel, setFatigueLevel] = useState(5)
  const [hasPain, setHasPain] = useState(false)
  const [painDetail, setPainDetail] = useState('')
  const [participationStatus, setParticipationStatus] = useState<DailyRecord['participation_status']>('参加')
  const [targetItems, setTargetItems] = useState<string[]>([])
  const [selfEvaluation, setSelfEvaluation] = useState(5)
  const [reflection, setReflection] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [existingRecord, setExistingRecord] = useState(false)
  // 保存後に算出するストリーク日数
  const [streakDays, setStreakDays] = useState(0)
  // 今日が今回の保存で初めて完了したかどうか（初回保存 = 新規 ＝ ポジティブポップアップを強調）
  const [isNewRecord, setIsNewRecord] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/login'); return }
    if (session.role === 'staff') { router.push('/coach/dashboard'); return }
    setUser(session)
    getMandalaChart(session.id)
      .then(chart => { setMandala(chart) })
      .catch(e => { console.error('[daily] マンダラチャートの取得に失敗しました:', e) })
      .finally(() => { setLoading(false) })
  }, [router])

  useEffect(() => {
    if (!user) return
    getDailyRecord(user.id, recordDate)
      .then(record => {
        if (record) {
          setExistingRecord(true)
          setSleepHours(record.sleep_hours)
          setFatigueLevel(record.fatigue_level)
          setHasPain(record.has_pain)
          setPainDetail(record.pain_detail)
          setParticipationStatus(record.participation_status)
          setTargetItems(record.target_items)
          setSelfEvaluation(record.self_evaluation)
          setReflection(record.reflection)
        } else {
          setExistingRecord(false)
          setSleepHours(7); setFatigueLevel(5); setHasPain(false); setPainDetail('')
          setParticipationStatus('参加'); setTargetItems([]); setSelfEvaluation(5); setReflection('')
        }
      })
      .catch(e => { console.error('[daily] 日次記録の取得に失敗しました:', e) })
  }, [user, recordDate])

  const allGoals: string[] = mandala
    ? [...mandala.elements.filter(e => e.trim()), ...mandala.actions.flat().filter(g => g.trim())]
    : []

  const toggleGoal = (goal: string) => {
    if (targetItems.includes(goal)) setTargetItems(targetItems.filter(g => g !== goal))
    else if (targetItems.length < 3) setTargetItems([...targetItems, goal])
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    // 保存前に「既存レコードかどうか」を記録しておく（ポップアップの内容変更用）
    const wasNewRecord = !existingRecord
    try {
      const pts = calculatePoints(reflection)
      setEarnedPoints(pts)
      const savedRecord = await saveDailyRecord({
        user_id: user.id, record_date: recordDate, sleep_hours: sleepHours, fatigue_level: fatigueLevel,
        has_pain: hasPain, pain_detail: painDetail, participation_status: participationStatus,
        target_items: targetItems, self_evaluation: selfEvaluation, reflection, points: pts,
      })

      // 保存後に全件記録を取得してストリークを再計算する
      try {
        const latestRecords = await getDailyRecords(user.id)
        const streak = calculateStreak(latestRecords)
        setStreakDays(streak)
      } catch (e) {
        console.error('[daily] ストリーク計算に失敗しました:', e)
        setStreakDays(0)
      }

      // ============================================================
      // グロースマインドセット自動スコアリング
      // 振り返りテキストが20文字以上入力されている場合に実行する。
      // 新規・更新問わず、文字数条件を満たしていればスコアリングするよう修正。
      // ============================================================
      if (reflection.trim().length >= 20) {
        // fire-and-forget（エラーになっても保存完了は通知済みなので握りつぶす）
        fetch('/api/scoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId: savedRecord.id, reflection: reflection.trim() }),
        }).catch(e => {
          // スコアリング失敗はサイレントエラーとする（保存自体は完了している）
          console.warn('[daily] スコアリングAPI呼び出しに失敗しました:', e)
        })
      }

      setIsNewRecord(wasNewRecord)
      setShowSuccess(true)
    } catch (e) { console.error(e); alert('保存に失敗しました') }
    finally { setSaving(false) }
  }

  const fatigueLabels: Record<number, string> = {
    1: '全く疲れていない', 2: '少し疲れている', 3: 'やや疲れている', 4: '疲れている',
    5: 'そこそこ疲れている', 6: '結構疲れている', 7: 'かなり疲れている', 8: 'とても疲れている',
    9: '非常に疲れている', 10: '疲労困憊',
  }
  const evalMessages: Record<number, string> = {
    1: 'まだまだこれから!', 2: '次に繋げよう!', 3: '意識できた部分がある!',
    4: '少しずつ成長中!', 5: '着実に前進!', 6: 'いい感じ!',
    7: 'とても良い!', 8: '素晴らしい!', 9: '最高の一日!', 10: 'パーフェクト!',
  }

  if (loading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div></div>
  }

  // 記録完了画面（ポジティブフィードバック）
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-brand-bg pb-20 md:pb-8">
        <Header userName={user.name} role="player" />
        <div className="flex items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
          <div className="text-center max-w-sm w-full">
            {/* ポジティブフィードバック：中央ポップアップ風カード */}
            <div className="text-6xl mb-4">{isNewRecord ? '🎉' : '✏️'}</div>
            <h2 className="text-2xl font-bold text-brand-dark mb-2">
              {isNewRecord ? '記録完了！お疲れさま！' : '記録を更新しました！'}
            </h2>

            {/* ポイント表示 */}
            <div className="bg-brand-main text-brand-dark rounded-2xl p-4 mb-4">
              <p className="text-3xl font-bold">+{earnedPoints} pt</p>
              <p className="text-sm mt-1">{getPointMessage(earnedPoints)}</p>
            </div>

            {/* ストリーク表示（新規記録の場合のみ強調表示） */}
            {isNewRecord && (
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-4 mb-4">
                <p className="text-xs text-gray-500 mb-1">🔥 連続記録</p>
                <p className="text-4xl font-bold text-orange-500">{streakDays}日</p>
                <p className="text-sm font-medium text-gray-700 mt-1">{getStreakMessage(streakDays)}</p>
              </div>
            )}

            <p className="text-gray-600 text-sm mb-6">
              {isNewRecord
                ? '今日も振り返りおつかれさま！\n続けることが一番の成長の証です。'
                : '更新完了！引き続き頑張ろう！'}
            </p>

            <div className="space-y-3">
              <button onClick={() => router.push('/player/dashboard')} className="w-full bg-brand-main text-brand-dark font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors">ダッシュボードへ</button>
              <button onClick={() => { setShowSuccess(false); setExistingRecord(true) }} className="w-full bg-white text-brand-dark font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors">記録を編集する</button>
            </div>
          </div>
        </div>
        <BottomNav role="player" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-20 md:pb-8">
      <Header userName={user.name} role="player" />
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Date selector */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-brand-dark">日々の記録</h2>
              <p className="text-xs text-gray-500">3分で書ける、今日の振り返り</p>
            </div>
            <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-main focus:outline-none" />
          </div>
          {existingRecord && <p className="text-xs text-brand-main font-medium mt-2">この日の記録があります（編集モード）</p>}
        </div>

        {/* Condition */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span className="bg-brand-main w-1.5 h-5 rounded-full" />コンディション
          </h3>

          <div>
            <p className="text-sm text-gray-600 mb-2">練習の参加状況</p>
            <div className="flex flex-wrap gap-2">
              {PARTICIPATION_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setParticipationStatus(opt.value as DailyRecord['participation_status'])}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    participationStatus === opt.value ? 'bg-brand-main text-brand-dark shadow-md scale-105' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  <span>{opt.emoji}</span><span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-600">睡眠時間</p>
              <span className="text-lg font-bold text-brand-dark">{sleepHours}時間</span>
            </div>
            <input type="range" min={3} max={12} step={0.5} value={sleepHours} onChange={(e) => setSleepHours(parseFloat(e.target.value))} className="w-full" />
            <div className="flex justify-between text-xs text-gray-400 mt-1"><span>3h</span><span>12h</span></div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-600">疲労度</p>
              <span className={`text-lg font-bold ${fatigueLevel >= 8 ? 'text-red-500' : fatigueLevel >= 5 ? 'text-orange-500' : 'text-green-500'}`}>{fatigueLevel}</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={fatigueLevel} onChange={(e) => setFatigueLevel(parseInt(e.target.value))} className="w-full" />
            <p className="text-xs text-gray-500 text-center mt-1">{fatigueLabels[fatigueLevel]}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">部位の痛み</p>
              <div className="flex gap-2">
                <button onClick={() => setHasPain(false)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${!hasPain ? 'bg-green-100 text-green-700 shadow-sm' : 'bg-gray-100 text-gray-500'}`}>なし</button>
                <button onClick={() => setHasPain(true)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${hasPain ? 'bg-red-100 text-red-700 shadow-sm' : 'bg-gray-100 text-gray-500'}`}>あり</button>
              </div>
            </div>
            {hasPain && <textarea value={painDetail} onChange={(e) => setPainDetail(e.target.value)} placeholder="痛みの部位と状態を教えてください" className="w-full px-3 py-2 rounded-lg border border-red-200 focus:border-red-400 focus:outline-none text-sm bg-red-50 mt-1" rows={2} />}
          </div>
        </div>

        {/* Goals selection */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span className="bg-brand-main w-1.5 h-5 rounded-full" />今日の目標（最大3つ選択）
          </h3>
          {allGoals.length > 0 ? (
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {allGoals.map((goal, idx) => (
                <button key={idx} onClick={() => toggleGoal(goal)}
                  disabled={!targetItems.includes(goal) && targetItems.length >= 3}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    targetItems.includes(goal) ? 'bg-brand-main text-brand-dark shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40'
                  }`}>{goal}</button>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">まだマンダラチャートが作成されていません</p>
              <button onClick={() => router.push('/player/mandala')} className="text-brand-main text-sm font-medium mt-2 hover:underline">目標を設定する →</button>
            </div>
          )}
          {targetItems.length > 0 && (
            <div className="space-y-1">
              {targetItems.map((goal, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg">
                  <span className="text-brand-main font-bold text-xs">#{idx + 1}</span>
                  <span className="text-xs text-gray-700">{goal}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Self evaluation */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span className="bg-brand-main w-1.5 h-5 rounded-full" />自己評価
          </h3>
          <p className="text-xs text-gray-500 bg-yellow-50 px-3 py-2 rounded-lg">💡 「できなかったこと」より「できた部分」に目を向けてみよう!</p>
          <div className="flex justify-between items-center">
            <span className="text-4xl font-bold text-brand-main">{selfEvaluation}</span>
            <span className="text-sm text-gray-600">/10点</span>
          </div>
          <input type="range" min={1} max={10} step={1} value={selfEvaluation} onChange={(e) => setSelfEvaluation(parseInt(e.target.value))} className="w-full" />
          <p className="text-center text-sm font-medium text-brand-dark">{evalMessages[selfEvaluation]}</p>
        </div>

        {/* Reflection */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span className="bg-brand-main w-1.5 h-5 rounded-full" />振り返り
          </h3>
          <p className="text-xs text-gray-500">今日の練習で感じたこと、明日への意気込みを自由に書こう!</p>
          <textarea value={reflection} onChange={(e) => setReflection(e.target.value.slice(0, 1000))}
            placeholder="今日は〇〇を意識して練習した。特に△△が上手くいった..."
            className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm bg-gray-50 resize-none" rows={5} />
          <div className="flex justify-between text-xs text-gray-400">
            <span>ポジティブな言葉でポイントGET!</span>
            <span>{reflection.length}/1000</span>
          </div>
          {reflection.length > 0 && (
            <div className="bg-yellow-50 rounded-lg p-2 text-xs text-center">
              <span className="font-medium text-brand-dark">予想ポイント: +{calculatePoints(reflection)} pt</span>
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-brand-main text-brand-dark font-bold py-4 rounded-2xl hover:bg-yellow-400 transition-all disabled:opacity-50 text-lg shadow-lg mb-4">
          {saving ? '保存中...' : existingRecord ? '記録を更新する' : '記録を保存する'}
        </button>
      </main>
      <BottomNav role="player" />
    </div>
  )
}
