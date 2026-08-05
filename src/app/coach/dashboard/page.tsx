'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, DailyRecord, DailyRecordWithUser, Tournament, PhysicalRecord, MaxTrainingRecord, PracticeSession, GoalUpdatePhase, EvaluationDelivery, EvaluationAnswer, EvaluationGroup, EvaluationGroupMember, Notice } from '@/types/database'
import { getUsers, getAllDailyRecords, getActiveTournament, addComment, updateComment, getTeamConditionRecords, getAllPhysicalRecords, getAllMaxTrainingRecords, getPracticeSession, getPracticeSessions, upsertPracticeSession, getMindsetScores, getActiveGoalUpdatePhase, startGoalUpdatePhase, endGoalUpdatePhase, getEvaluationDeliveries, deliverEvaluationTasks, getAllEvaluationAnswers, getEvaluationGroups, addEvaluationGroup, updateEvaluationGroup, deleteEvaluationGroup, addEvaluationGroupMember, removeEvaluationGroupMember, updateEvaluationDelivery, deleteEvaluationDelivery, EVALUATION_CATEGORIES, calcCategoryScores, getNotices, createNotice, deleteNotice, completeNotice, uncompleteNotice } from '@/lib/data'
import { getSession } from '@/lib/session'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, subDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from 'recharts'

// ============================================================
// チームダッシュボード用の型・ユーティリティ
// ============================================================

/** 日付ごとの平均値を表す型（折れ線グラフ用） */
interface DailyAverage {
  date: string          // 表示用ラベル "M/d"
  rawDate: string       // ソート用 "YYYY-MM-DD"
  avgFatigue: number | null
  avgSleep: number | null
}

/**
 * 選択された選手のレコードから日次平均疲労度・睡眠時間を計算する。
 * データのない日は null を返す。
 */
function calcDailyAverages(
  records: DailyRecord[],
  selectedIds: string[]
): DailyAverage[] {
  const result: DailyAverage[] = []
  const today = new Date()

  // 過去21日間（直近3週間）の日付列を生成
  for (let i = 20; i >= 0; i--) {
    const d = subDays(today, i)
    const rawDate = format(d, 'yyyy-MM-dd')
    const dateLabel = format(d, 'M/d')

    const dayRecords = records.filter(
      r => r.record_date === rawDate && selectedIds.includes(r.user_id)
    )

    if (dayRecords.length === 0) {
      result.push({ date: dateLabel, rawDate, avgFatigue: null, avgSleep: null })
    } else {
      const avgFatigue =
        Math.round(
          (dayRecords.reduce((s, r) => s + r.fatigue_level, 0) / dayRecords.length) * 10
        ) / 10
      const avgSleep =
        Math.round(
          (dayRecords.reduce((s, r) => s + r.sleep_hours, 0) / dayRecords.length) * 10
        ) / 10
      result.push({ date: dateLabel, rawDate, avgFatigue, avgSleep })
    }
  }
  return result
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function CoachDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [todayRecords, setTodayRecords] = useState<DailyRecordWithUser[]>([])
  const [recentRecords, setRecentRecords] = useState<DailyRecordWithUser[]>([])
  // 成長・達成度タブ用：全期間レコード（startDate制限なし）
  const [allTimeRecords, setAllTimeRecords] = useState<DailyRecordWithUser[]>([])
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [showComments, setShowComments] = useState<Record<string, boolean>>({})
  // 送信完了メッセージの表示管理（recordId → true/false）
  const [sentFeedback, setSentFeedback] = useState<Record<string, boolean>>({})
  // 編集モード管理（commentId）
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  // 編集中テキスト（commentId → テキスト）
  const [editInputs, setEditInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'condition' | 'timeline' | 'growth' | 'team' | 'karte' | 'rpe' | 'mindset' | 'evaluation'>('condition')

  // ---- 目標更新フェーズ管理（コーチ主導・今回追加） ----
  const [activePhase, setActivePhase] = useState<GoalUpdatePhase | null>(null)
  // フェーズ開始モーダルの表示フラグ
  const [showPhaseModal, setShowPhaseModal] = useState(false)
  // 新フェーズのターム名入力
  const [newTermLabel, setNewTermLabel] = useState('')
  const [phaseStarting, setPhaseStarting] = useState(false)
  const [phaseStartFeedback, setPhaseStartFeedback] = useState(false)

  // ---- メタ認知スコアタブ用 state ----
  // 全選手のスコア履歴（直近30日分）
  const [mindsetRecords, setMindsetRecords] = useState<import('@/types/database').DailyRecord[]>([])
  const [mindsetLoading, setMindsetLoading] = useState(false)
  // グラフ表示対象の選手ID（選手カードをクリックで選択）
  const [selectedMindsetPlayerId, setSelectedMindsetPlayerId] = useState<string | null>(null)

  // ---- Session RPEタブ用 state ----
  // コーチが入力・保存する練習時間（分）
  const [rpePracticeSession, setRpePracticeSession] = useState<PracticeSession | null>(null)
  // 入力フォームの値（文字列として管理し保存時に数値変換する）
  const [rpeDurationInput, setRpeDurationInput] = useState<string>('')
  // 表示対象日（コンディションタブの selectedDate と共用）
  const [rpeSaving, setRpeSaving] = useState(false)
  // 保存完了フィードバック
  const [rpeSavedFeedback, setRpeSavedFeedback] = useState(false)

  // ---- Session RPEグラフ用 state ----
  // グラフ表示期間（日数）
  const [rpeGraphDays, setRpeGraphDays] = useState<30 | 60 | 90>(30)
  // 期間内の練習時間データ（グラフ描画用）
  const [rpeGraphSessions, setRpeGraphSessions] = useState<PracticeSession[]>([])
  // 期間内の全選手コンディションデータ（グラフ描画用）
  const [rpeGraphRecords, setRpeGraphRecords] = useState<import('@/types/database').DailyRecord[]>([])
  const [rpeGraphLoading, setRpeGraphLoading] = useState(false)

  // ---- タイムラインタブ用：日付フィルタ state ----
  // '' = 全件表示、'YYYY-MM-DD' = 選択日のみ表示
  const [timelineDate, setTimelineDate] = useState<string>('')
  // タイムライン用データ（別途広い期間で取得）
  const [timelineRecords, setTimelineRecords] = useState<DailyRecordWithUser[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  // ---- カルテタブ用 state ----
  const [allPhysicalRecords, setAllPhysicalRecords] = useState<PhysicalRecord[]>([])
  const [allMaxRecords, setAllMaxRecords] = useState<MaxTrainingRecord[]>([])
  const [karteLoading, setKarteLoading] = useState(false)
  const [selectedKartePlayerId, setSelectedKartePlayerId] = useState<string | null>(null)
  const [karteTab, setKarteTab] = useState<'physical' | 'max'>('physical')

  // ---- チームダッシュボード用 state ----
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [teamRecords, setTeamRecords] = useState<DailyRecord[]>([])
  const [teamLoading, setTeamLoading] = useState(false)

  // ---- 10ヶ条評価タブ用 state ----
  // 配信履歴
  const [evaluationDeliveries, setEvaluationDeliveries] = useState<EvaluationDelivery[]>([])
  // 選択中の配信
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null)
  // 回答データ（選択配信の全回答）
  const [evaluationAnswers, setEvaluationAnswers] = useState<EvaluationAnswer[]>([])
  const [evaluationLoading, setEvaluationLoading] = useState(false)
  // 配信モーダル
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [deliveryLabel, setDeliveryLabel] = useState('')
  const [delivering, setDelivering] = useState(false)
  const [deliverFeedback, setDeliverFeedback] = useState(false)
  // グループ設定
  type GroupWithMembers = EvaluationGroup & { members: EvaluationGroupMember[] }
  const [evaluationGroups, setEvaluationGroups] = useState<GroupWithMembers[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  // グループ作成モーダル
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupType, setNewGroupType] = useState('custom')
  const [groupSaving, setGroupSaving] = useState(false)
  // メンバー追加モーダル
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null)
  const [memberAddUserId, setMemberAddUserId] = useState<string>('')
  const [memberSaving, setMemberSaving] = useState(false)
  // フィードバック
  const [groupFeedback, setGroupFeedback] = useState<string | null>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  // ---- グループ編集モーダル ----
  const [showEditGroupModal, setShowEditGroupModal] = useState(false)
  const [editGroupId, setEditGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [editGroupType, setEditGroupType] = useState('custom')
  const [editGroupSaving, setEditGroupSaving] = useState(false)

  // ---- 配信名編集モーダル ----
  const [showEditDeliveryModal, setShowEditDeliveryModal] = useState(false)
  const [editDeliveryId, setEditDeliveryId] = useState<string | null>(null)
  const [editDeliveryLabel, setEditDeliveryLabel] = useState('')
  const [editDeliverySaving, setEditDeliverySaving] = useState(false)
  // ---- 配信削除 state ----
  const [deletingDeliveryId, setDeletingDeliveryId] = useState<string | null>(null)

  // ---- 連絡事項・TODOリスト state ----
  const [notices, setNotices] = useState<Notice[]>([])
  const [noticesLoading, setNoticesLoading] = useState(false)
  // 新規作成モーダル
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeBody, setNoticeBody] = useState('')
  const [noticeType, setNoticeType] = useState<'notice' | 'todo'>('notice')
  const [noticeSaving, setNoticeSaving] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/login'); return }
    if (session.role !== 'staff') { router.push('/player/dashboard'); return }
    setUser(session)
    loadData()
    // 連絡事項・TODOをsessionのIDで取得する
    getNotices(session.id).then(data => setNotices(data)).catch(e => console.error('[coach] 連絡事項取得エラー:', e))
  }, [router])

  const loadData = async () => {
    try {
      // コンディション・Session RPEタブ用は過去14日間で取得
      const startDate = format(subDays(new Date(), 14), 'yyyy-MM-dd')
      // 成長・達成度タブ用は全期間（startDate未指定）で取得
      const [users, records, allRecords, t, phase] = await Promise.all([
        getUsers(),
        getAllDailyRecords(startDate),
        getAllDailyRecords(),
        getActiveTournament(),
        getActiveGoalUpdatePhase(),
      ])
      setAllUsers(users)
      setRecentRecords(records)
      setAllTimeRecords(allRecords)
      setTournament(t)
      setActivePhase(phase)
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      setTodayRecords(records.filter(r => r.record_date === todayStr))

      // 全選手を初期選択状態にする
      const playerIds = users.filter(u => u.role === 'player').map(u => u.id)
      setSelectedPlayerIds(playerIds)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }

  }

  /**
   * 目標更新フェーズを開始するハンドラ（コーチ専用）
   */
  const handleStartGoalUpdatePhase = async () => {
    if (!user || !newTermLabel.trim()) return
    setPhaseStarting(true)
    try {
      const started = await startGoalUpdatePhase(newTermLabel.trim(), user.id)
      setActivePhase(started)
      setPhaseStartFeedback(true)
      setShowPhaseModal(false)
      setNewTermLabel('')
      setTimeout(() => setPhaseStartFeedback(false), 3000)
    } catch (e) {
      console.error('[Coach] フェーズ開始エラー:', e)
      alert('フェーズの開始に失敗しました。再度お試しください。')
    } finally {
      setPhaseStarting(false)
    }
  }

  /**
   * 目標更新フェーズを終了するハンドラ（コーチ専用）
   */
  const handleEndGoalUpdatePhase = async () => {
    if (!activePhase) return
    if (!confirm(`「${activePhase.term_label}」の目標更新フェーズを終了しますか？`)) return
    try {
      await endGoalUpdatePhase(activePhase.id)
      setActivePhase(null)
    } catch (e) {
      console.error('[Coach] フェーズ終了エラー:', e)
      alert('フェーズの終了に失敗しました。再度お試しください。')
    }
  }

  /**
   * Session RPEタブ用に指定日の練習時間データを取得する（コーチ専用）。
   */
  const loadRpePracticeSession = useCallback(async (date: string) => {
    try {
      const session = await getPracticeSession(date)
      setRpePracticeSession(session)
      // 既存データがあれば入力欄に反映する
      setRpeDurationInput(session ? String(session.duration_minutes) : '')
    } catch (e) {
      console.error('[RPE] 練習時間データ取得エラー:', e)
    }
  }, [])

  // RPEタブがアクティブになった / 日付が変わったときに練習時間データを取得する
  useEffect(() => {
    if (activeTab === 'rpe') {
      loadRpePracticeSession(selectedDate)
    }
  }, [activeTab, selectedDate, loadRpePracticeSession])

  /**
   * Session RPEグラフ用に期間内の練習時間・コンディションデータを取得する。
   */
  const loadRpeGraphData = useCallback(async (days: number) => {
    setRpeGraphLoading(true)
    try {
      const endDate = format(new Date(), 'yyyy-MM-dd')
      const startDate = format(subDays(new Date(), days - 1), 'yyyy-MM-dd')
      // 全選手のIDリストを取得して期間内のコンディションデータを取得する
      const allPlayerIds = allUsers.filter(u => u.role === 'player').map(u => u.id)
      const [sessions, records] = await Promise.all([
        getPracticeSessions(startDate, endDate),
        allPlayerIds.length > 0
          ? getTeamConditionRecords(allPlayerIds, startDate, endDate)
          : Promise.resolve([]),
      ])
      setRpeGraphSessions(sessions)
      setRpeGraphRecords(records)
    } catch (e) {
      console.error('[RPE Graph] データ取得エラー:', e)
    } finally {
      setRpeGraphLoading(false)
    }
  }, [allUsers])

  // RPEタブがアクティブになった / グラフ期間が変わったときにデータ再取得する
  useEffect(() => {
    if (activeTab === 'rpe') {
      loadRpeGraphData(rpeGraphDays)
    }
  }, [activeTab, rpeGraphDays, loadRpeGraphData])

  /**
   * タイムラインタブ用のデータを取得する。
   * 日付未選択時は過去90日間の全件、日付選択時は選択日のみ取得する。
   */
  const loadTimelineRecords = useCallback(async (dateFilter: string) => {
    setTimelineLoading(true)
    try {
      if (dateFilter) {
        // 選択日のみ取得
        const data = await getAllDailyRecords(dateFilter, dateFilter)
        setTimelineRecords(data)
      } else {
        // 全件（過去90日間）取得
        const startDate = format(subDays(new Date(), 89), 'yyyy-MM-dd')
        const data = await getAllDailyRecords(startDate)
        setTimelineRecords(data)
      }
    } catch (e) {
      console.error('[Timeline] データ取得エラー:', e)
    } finally {
      setTimelineLoading(false)
    }
  }, [])

  /** チームタブ用に過去21日間のコンディションデータを取得する */
  const loadTeamRecords = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setTeamRecords([])
      return
    }
    setTeamLoading(true)
    try {
      const startDate = format(subDays(new Date(), 20), 'yyyy-MM-dd')
      const endDate = format(new Date(), 'yyyy-MM-dd')
      const data = await getTeamConditionRecords(ids, startDate, endDate)
      setTeamRecords(data)
    } catch (e) {
      console.error('[TeamDashboard] データ取得エラー:', e)
    } finally {
      setTeamLoading(false)
    }
  }, [])

  // タイムラインタブがアクティブになった / 日付フィルタが変わったときにデータ再取得
  useEffect(() => {
    if (activeTab === 'timeline') {
      loadTimelineRecords(timelineDate)
    }
  }, [activeTab, timelineDate, loadTimelineRecords])

  // チームタブがアクティブになった / 選択選手が変わったときにデータ再取得
  useEffect(() => {
    if (activeTab === 'team') {
      loadTeamRecords(selectedPlayerIds)
    }
  }, [activeTab, selectedPlayerIds, loadTeamRecords])

  /** カルテタブがアクティブになったときにデータを取得する */
  const loadKarteData = useCallback(async () => {
    setKarteLoading(true)
    try {
      const [phys, max] = await Promise.all([
        getAllPhysicalRecords(),
        getAllMaxTrainingRecords(),
      ])
      setAllPhysicalRecords(phys)
      setAllMaxRecords(max)
    } catch (e) {
      console.error('[KarteDashboard] データ取得エラー:', e)
    } finally {
      setKarteLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'karte') {
      loadKarteData()
    }
  }, [activeTab, loadKarteData])

  /** メタ認知タブがアクティブになったときにスコアデータを取得する */
  const loadMindsetData = useCallback(async () => {
    setMindsetLoading(true)
    try {
      const playerIds = allUsers.filter(u => u.role === 'player').map(u => u.id)
      if (playerIds.length === 0) return
      const records = await getMindsetScores(playerIds, 30)
      setMindsetRecords(records)
    } catch (e) {
      console.error('[MindsetDashboard] データ取得エラー:', e)
    } finally {
      setMindsetLoading(false)
    }
  }, [allUsers])

  useEffect(() => {
    if (activeTab === 'mindset') {
      loadMindsetData()
    }
    if (activeTab === 'evaluation') {
      loadEvaluationData()
    }
  }, [activeTab, loadMindsetData])

  // ---- 10ヶ条評価タブのデータ取得 ----
  const loadEvaluationData = async () => {
    setEvaluationLoading(true)
    try {
      const [deliveries, groups] = await Promise.all([
        getEvaluationDeliveries(),
        getEvaluationGroups(),
      ])
      setEvaluationDeliveries(deliveries)
      setEvaluationGroups(groups)
      // 最新の配信を自動選択する
      if (deliveries.length > 0 && !selectedDeliveryId) {
        const latestId = deliveries[0].id
        setSelectedDeliveryId(latestId)
        const answers = await getAllEvaluationAnswers(latestId)
        setEvaluationAnswers(answers)
      }
    } catch (e) {
      console.error('[coach] 10ヶ条評価データ取得エラー:', e)
    } finally {
      setEvaluationLoading(false)
    }
  }

  // ---- 配信IDが変わったときに回答を再取得する ----
  useEffect(() => {
    if (!selectedDeliveryId) return
    const loadAnswers = async () => {
      try {
        const answers = await getAllEvaluationAnswers(selectedDeliveryId)
        setEvaluationAnswers(answers)
      } catch (e) {
        console.error('[coach] 回答取得エラー:', e)
      }
    }
    loadAnswers()
  }, [selectedDeliveryId])

  // ---- アンケート配信処理 ----
  const handleDeliverEvaluation = async () => {
    if (!user || !deliveryLabel.trim()) return
    setDelivering(true)
    try {
      const players = allUsers.filter(u => u.role === 'player')
      await deliverEvaluationTasks(deliveryLabel.trim(), user.id, players)
      setDeliverFeedback(true)
      setShowDeliveryModal(false)
      setDeliveryLabel('')
      // 配信一覧を再取得する
      const deliveries = await getEvaluationDeliveries()
      setEvaluationDeliveries(deliveries)
      setTimeout(() => setDeliverFeedback(false), 3000)
    } catch (e) {
      console.error('[coach] 配信エラー:', e)
      alert('配信に失敗しました。再度お試しください。')
    } finally {
      setDelivering(false)
    }
  }

  // ---- グループ作成処理 ----
  const handleAddGroup = async () => {
    if (!user || !newGroupName.trim()) return
    setGroupSaving(true)
    try {
      const newGroup = await addEvaluationGroup(newGroupName.trim(), newGroupType, user.id)
      setEvaluationGroups(prev => [...prev, { ...newGroup, members: [] }])
      setNewGroupName('')
      setNewGroupType('custom')
      setShowGroupModal(false)
      setGroupFeedback('group-created')
      setTimeout(() => setGroupFeedback(null), 3000)
    } catch (e) {
      console.error('[coach] グループ作成エラー:', e)
      alert('グループの作成に失敗しました。再度お試しください。')
    } finally {
      setGroupSaving(false)
    }
  }

  // ---- グループ削除処理 ----
  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('このグループを削除しますか？\nメンバー設定もすべて削除されます。')) return
    setDeletingGroupId(groupId)
    try {
      await deleteEvaluationGroup(groupId)
      setEvaluationGroups(prev => prev.filter(g => g.id !== groupId))
    } catch (e) {
      console.error('[coach] グループ削除エラー:', e)
      alert('削除に失敗しました。再度お試しください。')
    } finally {
      setDeletingGroupId(null)
    }
  }

  // ---- メンバー追加処理 ----
  const handleAddMember = async () => {
    if (!targetGroupId || !memberAddUserId) return
    const group = evaluationGroups.find(g => g.id === targetGroupId)
    if (!group) return
    // 重複チェック
    if (group.members.some(m => m.user_id === memberAddUserId)) {
      setGroupFeedback('error-dup-member')
      setTimeout(() => setGroupFeedback(null), 3000)
      return
    }
    setMemberSaving(true)
    try {
      const newMember = await addEvaluationGroupMember(targetGroupId, memberAddUserId)
      setEvaluationGroups(prev =>
        prev.map(g =>
          g.id === targetGroupId ? { ...g, members: [...g.members, newMember] } : g
        )
      )
      setMemberAddUserId('')
      setGroupFeedback('member-added')
      setTimeout(() => setGroupFeedback(null), 3000)
    } catch (e) {
      console.error('[coach] メンバー追加エラー:', e)
      alert('メンバーの追加に失敗しました。再度お試しください。')
    } finally {
      setMemberSaving(false)
    }
  }

  // ---- メンバー削除処理 ----
  const handleRemoveMember = async (memberId: string, groupId: string) => {
    setRemovingMemberId(memberId)
    try {
      await removeEvaluationGroupMember(memberId)
      setEvaluationGroups(prev =>
        prev.map(g =>
          g.id === groupId ? { ...g, members: g.members.filter(m => m.id !== memberId) } : g
        )
      )
    } catch (e) {
      console.error('[coach] メンバー削除エラー:', e)
      alert('削除に失敗しました。再度お試しください。')
    } finally {
      setRemovingMemberId(null)
    }
  }

  // ---- グループ一覧再読み込み ----
  const reloadGroups = async () => {
    setGroupsLoading(true)
    try {
      const groups = await getEvaluationGroups()
      setEvaluationGroups(groups)
    } catch (e) {
      console.error('[coach] グループ取得エラー:', e)
    } finally {
      setGroupsLoading(false)
    }
  }

  // ---- グループ編集モーダルを開く ----
  const openEditGroupModal = (group: GroupWithMembers) => {
    setEditGroupId(group.id)
    setEditGroupName(group.name)
    setEditGroupType(group.group_type || 'custom')
    setShowEditGroupModal(true)
  }

  // ---- グループ名・種別を保存する ----
  const handleSaveEditGroup = async () => {
    if (!editGroupId || !editGroupName.trim()) return
    setEditGroupSaving(true)
    try {
      await updateEvaluationGroup(editGroupId, editGroupName.trim(), editGroupType)
      setEvaluationGroups(prev =>
        prev.map(g =>
          g.id === editGroupId
            ? { ...g, name: editGroupName.trim(), group_type: editGroupType }
            : g
        )
      )
      setShowEditGroupModal(false)
      setGroupFeedback('group-updated')
      setTimeout(() => setGroupFeedback(null), 3000)
    } catch (e) {
      console.error('[coach] グループ更新エラー:', e)
      alert('更新に失敗しました。再度お試しください。')
    } finally {
      setEditGroupSaving(false)
    }
  }

  // ---- 配信削除処理（タスク・回答も連動削除） ----
  const handleDeleteDelivery = async (deliveryId: string, deliveryLabel: string) => {
    if (!confirm(`「${deliveryLabel}」の配信を削除しますか？\n関連する回答データ・タスクもすべて削除されます。\nこの操作は取り消せません。`)) return
    setDeletingDeliveryId(deliveryId)
    try {
      await deleteEvaluationDelivery(deliveryId)
      setEvaluationDeliveries(prev => prev.filter(d => d.id !== deliveryId))
      // 削除した配信が選択中だった場合は選択をリセットする
      if (selectedDeliveryId === deliveryId) {
        setSelectedDeliveryId(null)
        setEvaluationAnswers([])
      }
    } catch (e) {
      console.error('[coach] 配信削除エラー:', e)
      alert('削除に失敗しました。再度お試しください。')
    } finally {
      setDeletingDeliveryId(null)
    }
  }

  // ---- 連絡事項・TODO作成処理 ----
  const handleCreateNotice = async () => {
    if (!user || !noticeTitle.trim()) return
    setNoticeSaving(true)
    try {
      const newNotice = await createNotice(user.id, noticeTitle.trim(), noticeBody.trim() || null, noticeType)
      setNotices(prev => [newNotice, ...prev])
      setNoticeTitle('')
      setNoticeBody('')
      setNoticeType('notice')
      setShowNoticeModal(false)
    } catch (e) {
      console.error('[coach] 連絡事項作成エラー:', e)
      alert('作成に失敗しました。再度お試しください。')
    } finally {
      setNoticeSaving(false)
    }
  }

  // ---- 連絡事項・TODO削除処理 ----
  const handleDeleteNotice = async (noticeId: string) => {
    if (!confirm('この連絡事項・TODOを削除しますか？')) return
    try {
      await deleteNotice(noticeId)
      setNotices(prev => prev.filter(n => n.id !== noticeId))
    } catch (e) {
      console.error('[coach] 連絡事項削除エラー:', e)
      alert('削除に失敗しました。再度お試しください。')
    }
  }

  // ---- 連絡事項・TODOチェック処理（指導者自身のチェック） ----
  const handleToggleNoticeComplete = async (noticeId: string, isCompleted: boolean) => {
    if (!user) return
    try {
      if (isCompleted) {
        await uncompleteNotice(noticeId, user.id)
      } else {
        await completeNotice(noticeId, user.id)
      }
      // 再取得する
      const data = await getNotices(user.id)
      setNotices(data)
    } catch (e) {
      console.error('[coach] チェック処理エラー:', e)
    }
  }

  // ---- 配信名編集モーダルを開く ----
  const openEditDeliveryModal = (delivery: EvaluationDelivery) => {
    setEditDeliveryId(delivery.id)
    setEditDeliveryLabel(delivery.label)
    setShowEditDeliveryModal(true)
  }

  // ---- 配信名を保存する（回答・タスクは変更しない） ----
  const handleSaveEditDelivery = async () => {
    if (!editDeliveryId || !editDeliveryLabel.trim()) return
    setEditDeliverySaving(true)
    try {
      await updateEvaluationDelivery(editDeliveryId, editDeliveryLabel.trim())
      setEvaluationDeliveries(prev =>
        prev.map(d =>
          d.id === editDeliveryId ? { ...d, label: editDeliveryLabel.trim() } : d
        )
      )
      setShowEditDeliveryModal(false)
    } catch (e) {
      console.error('[coach] 配信名更新エラー:', e)
      alert('更新に失敗しました。再度お試しください。')
    } finally {
      setEditDeliverySaving(false)
    }
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    setTodayRecords(recentRecords.filter(r => r.record_date === date))
  }

  const handleAddComment = async (recordId: string) => {
    if (!user || !commentInputs[recordId]?.trim()) return
    try {
      const newComment = await addComment(recordId, user.id, commentInputs[recordId].trim())
      // recentRecords（コンディション・成長タブ用）を更新
      setRecentRecords(prev =>
        prev.map(r =>
          r.id === recordId ? { ...r, comments: [...(r.comments || []), newComment] } : r
        )
      )
      // timelineRecords（タイムラインタブ用）も更新
      setTimelineRecords(prev =>
        prev.map(r =>
          r.id === recordId ? { ...r, comments: [...(r.comments || []), newComment] } : r
        )
      )
      // 入力欄をリセットし、送信完了メッセージを一時表示する
      setCommentInputs(prev => ({ ...prev, [recordId]: '' }))
      setSentFeedback(prev => ({ ...prev, [recordId]: true }))
      setTimeout(() => {
        setSentFeedback(prev => ({ ...prev, [recordId]: false }))
      }, 2500)
    } catch (e) {
      console.error(e)
    }
  }

  /** コメント修正の開始（編集モードに切り替える） */
  const handleStartEdit = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId)
    setEditInputs(prev => ({ ...prev, [commentId]: currentContent }))
  }

  /** コメント修正の確定（保存） - タイムラインタブ用 */
  const handleSaveEdit = async (recordId: string, commentId: string) => {
    const newContent = editInputs[commentId]?.trim()
    if (!newContent) return
    try {
      const updated = await updateComment(commentId, newContent)
      const updateRecordComments = (prev: typeof timelineRecords) =>
        prev.map(r =>
          r.id === recordId
            ? {
                ...r,
                comments: (r.comments || []).map(c =>
                  c.id === commentId ? { ...c, content: updated.content } : c
                ),
              }
            : r
        )
      setTimelineRecords(updateRecordComments)
      setRecentRecords(updateRecordComments)
      setEditingCommentId(null)
    } catch (e) {
      console.error(e)
    }
  }

  /** コメント修正のキャンセル */
  const handleCancelEdit = () => {
    setEditingCommentId(null)
  }

  /**
   * 練習時間を保存するハンドラ（Session RPEタブ用・コーチ専用）
   */
  const handleSavePracticeSession = async () => {
    if (!user) return
    const mins = parseInt(rpeDurationInput, 10)
    if (isNaN(mins) || mins < 0) {
      alert('練習時間は0以上の整数を入力してください')
      return
    }
    setRpeSaving(true)
    try {
      const saved = await upsertPracticeSession(selectedDate, mins, user.id)
      setRpePracticeSession(saved)
      setRpeSavedFeedback(true)
      setTimeout(() => setRpeSavedFeedback(false), 2500)
    } catch (e) {
      console.error('[RPE] 練習時間保存エラー:', e)
      alert('保存に失敗しました。再度お試しください。')
    } finally {
      setRpeSaving(false)
    }
  }

  /** 選手チェックボックスのトグル */
  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    )
  }

  /** 全選択 / 全解除 */
  const toggleAll = () => {
    const allPlayerIds = players.map(p => p.id)
    if (selectedPlayerIds.length === allPlayerIds.length) {
      setSelectedPlayerIds([])
    } else {
      setSelectedPlayerIds(allPlayerIds)
    }
  }

  const players = allUsers.filter(u => u.role === 'player')
  const getUserName = (userId: string) => allUsers.find(u => u.id === userId)?.name || '不明'

  // コンディションタブ用の棒グラフデータ
  const fatigueData = players.map(player => {
    const latestRecord = recentRecords.find(r => r.user_id === player.id)
    return {
      name: player.name.split(' ')[1] || player.name,
      fatigue: latestRecord?.fatigue_level || 0,
      sleep: latestRecord?.sleep_hours || 0,
      hasPain: latestRecord?.has_pain || false,
    }
  })

  // チーム推移タブ用の折れ線グラフデータ（選択選手の日次平均）
  const dailyAverages = calcDailyAverages(teamRecords, selectedPlayerIds)

  // 21日間の全体平均（サマリー表示用）
  const validFatigue = dailyAverages.filter(d => d.avgFatigue !== null).map(d => d.avgFatigue as number)
  const validSleep = dailyAverages.filter(d => d.avgSleep !== null).map(d => d.avgSleep as number)
  const overallAvgFatigue = validFatigue.length > 0
    ? Math.round(validFatigue.reduce((s, v) => s + v, 0) / validFatigue.length * 10) / 10
    : null
  const overallAvgSleep = validSleep.length > 0
    ? Math.round(validSleep.reduce((s, v) => s + v, 0) / validSleep.length * 10) / 10
    : null

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-20 md:pb-8">
      <Header userName={user.name} role="staff" />
      <main className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-xl font-bold text-brand-dark">チームダッシュボード</h2>
            <p className="text-xs text-gray-500">
              {tournament
                ? `${tournament.name}まで ${Math.max(0, Math.ceil((new Date(tournament.target_date).getTime() - Date.now()) / 86400000))}日`
                : '大会未設定'}
            </p>
          </div>
          {/* チーム推移・カルテタブでは日付セレクターを非表示（RPEタブは自前で日付管理） */}
          {activeTab !== 'team' && activeTab !== 'karte' && activeTab !== 'rpe' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-main focus:outline-none"
            />
          )}
        </div>

        {/* ====== 連絡事項・TODOリスト（ダッシュボード最上部） ====== */}
        <NoticeBoard
          notices={notices}
          currentUserId={user.id}
          isCoach={true}
          loading={noticesLoading}
          onToggleComplete={handleToggleNoticeComplete}
          onDelete={handleDeleteNotice}
          onAddClick={() => setShowNoticeModal(true)}
          allUsersCount={allUsers.filter(u => u.role === 'player').length + allUsers.filter(u => u.role === 'staff').length}
        />

        {/* ====== 目標更新フェーズ バナー（今回追加） ====== */}
        {activePhase ? (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4 mb-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-bold text-orange-700">🏆 目標更新フェーズ 実施中</p>
                <p className="text-xs text-orange-600 mt-1">
                  「{activePhase.term_label}」の振り返り・新目標設定フェーズが有効です。
                  選手のアプリに通知バナーが表示されています。
                </p>
              </div>
              <button
                onClick={handleEndGoalUpdatePhase}
                className="bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-xl hover:bg-gray-300 transition-colors text-xs whitespace-nowrap"
              >
                フェーズを終了する
              </button>
            </div>
          </div>
        ) : (
          <>
            {phaseStartFeedback && (
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-3 mb-4 shadow-sm">
                <p className="text-sm font-bold text-green-700">✅ 目標更新フェーズを開始しました！選手のアプリに通知されます。</p>
              </div>
            )}
            <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-700">🎯 次期目標設定フェーズ</p>
                <p className="text-xs text-gray-500 mt-1">
                  ボタンを押すと全選手のアプリに振り返り・新目標設定の通知が届きます
                </p>
              </div>
              <button
                onClick={() => setShowPhaseModal(true)}
                className="bg-brand-main text-brand-dark font-bold px-4 py-2 rounded-xl hover:bg-yellow-400 transition-colors text-sm whitespace-nowrap shadow-md"
              >
                🚀 次期目標設定フェーズを開始
              </button>
            </div>
          </>
        )}

        {/* ====== フェーズ開始モーダル ====== */}
        {showPhaseModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-bold text-gray-800 mb-2">🏆 次期目標設定フェーズを開始</h3>
              <p className="text-xs text-gray-500 mb-4">
                大会ターム名を入力してください。選手のマンダラチャート画面に通知バナーが表示され、
                振り返り入力 → 新チャート作成のフローが起動します。
              </p>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  大会ターム名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTermLabel}
                  onChange={(e) => setNewTermLabel(e.target.value)}
                  placeholder="例: 2026年 インターハイ予選"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) handleStartGoalUpdatePhase()
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mb-5 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                ⚠️ フェーズを開始すると、全選手のマンダラチャート画面に振り返りを促す通知が表示されます。
                既存のフェーズがある場合は自動的に終了されます。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPhaseModal(false); setNewTermLabel('') }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleStartGoalUpdatePhase}
                  disabled={phaseStarting || !newTermLabel.trim()}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    phaseStarting || !newTermLabel.trim()
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-brand-main text-brand-dark hover:bg-yellow-400 shadow-md'
                  }`}
                >
                  {phaseStarting ? '開始中...' : 'フェーズを開始する'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====== タブ ====== */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {([
            { key: 'condition',  label: 'コンディション', icon: '❤️' },
            { key: 'timeline',   label: 'タイムライン',   icon: '📝' },
            { key: 'growth',     label: '成長・達成度',   icon: '📈' },
            { key: 'team',       label: 'チーム推移',     icon: '📊' },
            { key: 'karte',      label: 'カルテ',         icon: '📋' },
            { key: 'rpe',        label: 'Session RPE',    icon: '🏋️' },
            { key: 'mindset',    label: 'メタ認知',       icon: '🧠' },
            { key: 'evaluation', label: '10ヶ条評価',     icon: '📊' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-brand-main text-brand-dark shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ====== コンディションタブ ====== */}
        {activeTab === 'condition' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">疲労度一覧</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={fatigueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number, name: string) => [value, name === 'fatigue' ? '疲労度' : '睡眠時間']}
                  />
                  <Bar dataKey="fatigue" name="疲労度" radius={[4, 4, 0, 0]}>
                    {fatigueData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.fatigue >= 8 ? '#ef4444' : entry.fatigue >= 6 ? '#f59e0b' : '#22c55e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {players.map(player => {
                const record = todayRecords.find(r => r.user_id === player.id)
                const latestRecord = recentRecords.find(r => r.user_id === player.id)
                const displayRecord = record || latestRecord
                return (
                  <div
                    key={player.id}
                    className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                      displayRecord && displayRecord.fatigue_level >= 8
                        ? 'border-red-500'
                        : displayRecord && displayRecord.fatigue_level >= 6
                        ? 'border-orange-400'
                        : 'border-green-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-800">{player.name}</h4>
                      {!record && <span className="text-xs text-gray-400">最新データ</span>}
                    </div>
                    {displayRecord ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">疲労度</span>
                          <span className={`font-bold ${
                            displayRecord.fatigue_level >= 8 ? 'text-red-500'
                              : displayRecord.fatigue_level >= 6 ? 'text-orange-500'
                              : 'text-green-500'
                          }`}>
                            {displayRecord.fatigue_level}/10
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">睡眠</span>
                          <span className={`font-medium ${displayRecord.sleep_hours < 6 ? 'text-red-500' : 'text-gray-700'}`}>
                            {displayRecord.sleep_hours}時間
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">参加</span>
                          <span className="text-gray-700">{displayRecord.participation_status}</span>
                        </div>
                        {displayRecord.has_pain && (
                          <div className="bg-red-50 px-2 py-1.5 rounded-lg mt-1">
                            <p className="text-xs text-red-600 font-medium">⚠️ 痛みあり: {displayRecord.pain_detail}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">データなし</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ====== タイムラインタブ ====== */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">

            {/* ---- 日付フィルタ パネル ---- */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-bold text-gray-700">📅 日付を選択</span>
                  <input
                    type="date"
                    value={timelineDate}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setTimelineDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm transition-colors"
                  />
                </div>
                {timelineDate && (
                  <button
                    onClick={() => setTimelineDate('')}
                    className="text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
                  >
                    ✕ 絞り込みを解除
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {timelineDate
                  ? `${format(parseISO(timelineDate), 'yyyy年M月d日(E)', { locale: ja })} のデータを表示中`
                  : '過去90日間のデータを表示中（日付を選択すると絞り込めます）'}
              </p>
            </div>

            {/* ---- ローディング ---- */}
            {timelineLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="animate-pulse text-brand-main font-bold">データ読み込み中...</div>
              </div>
            )}

            {/* ---- レコード一覧 ---- */}
            {!timelineLoading && timelineRecords.length === 0 && (
              <div className="text-center py-12 text-gray-500 bg-white rounded-2xl shadow-sm">
                <p className="text-4xl mb-3">📝</p>
                <p className="text-sm">
                  {timelineDate ? 'この日の記録はありません' : 'まだ記録がありません'}
                </p>
                {timelineDate && (
                  <button
                    onClick={() => setTimelineDate('')}
                    className="mt-3 text-xs text-brand-dark bg-brand-main px-4 py-2 rounded-xl hover:bg-yellow-400 transition-colors"
                  >
                    全件表示に戻す
                  </button>
                )}
              </div>
            )}

            {!timelineLoading && timelineRecords.map(record => {
              const profileName = record.users?.name || getUserName(record.user_id)
              const comments = record.comments || []
              const isExpanded = showComments[record.id]
              return (
                <div key={record.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                          {profileName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{profileName}</p>
                          <p className="text-xs text-gray-400">
                            {format(parseISO(record.record_date), 'M月d日(E)', { locale: ja })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                          評価 {record.self_evaluation}/10
                        </span>
                        {record.fatigue_level >= 7 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                            疲労 {record.fatigue_level}
                          </span>
                        )}
                      </div>
                    </div>
                    {record.target_items.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {record.target_items.map((goal, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {goal}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{record.reflection}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                      <span>😴 {record.sleep_hours}h</span>
                      <span className={record.fatigue_level >= 7 ? 'text-red-500 font-medium' : ''}>
                        疲労 {record.fatigue_level}/10
                      </span>
                      {record.has_pain && <span className="text-red-500">⚠️ {record.pain_detail}</span>}
                    </div>
                  </div>
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => setShowComments(prev => ({ ...prev, [record.id]: !prev[record.id] }))}
                      className="w-full px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>💬 コメント ({comments.length})</span>
                      <span>{isExpanded ? '▲' : '▼'}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3">
                        {comments.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {comments.map(comment => {
                              const commenterName = comment.users?.name || getUserName(comment.user_id)
                              const isMyComment = user && comment.user_id === user.id
                              const isEditing = editingCommentId === comment.id
                              return (
                                <div key={comment.id} className="bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg text-xs">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold text-gray-700">{commenterName}</span>
                                    {/* 自分のコメントのみ「修正」ボタンを表示 */}
                                    {isMyComment && !isEditing && (
                                      <button
                                        onClick={() => handleStartEdit(comment.id, comment.content)}
                                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                                      >
                                        修正
                                      </button>
                                    )}
                                  </div>
                                  {/* 編集モードと通常表示の切り替え */}
                                  {isEditing ? (
                                    <div className="space-y-1.5 mt-1">
                                      <textarea
                                        value={editInputs[comment.id] || ''}
                                        onChange={(e) => setEditInputs(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                        rows={3}
                                        className="w-full px-2 py-1.5 rounded border border-gray-300 focus:border-brand-main focus:outline-none text-xs resize-none"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleSaveEdit(record.id, comment.id)
                                          }
                                        }}
                                      />
                                      <div className="flex gap-1.5 justify-end">
                                        <button
                                          onClick={handleCancelEdit}
                                          className="px-3 py-1 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                        >
                                          キャンセル
                                        </button>
                                        <button
                                          onClick={() => handleSaveEdit(record.id, comment.id)}
                                          className="px-3 py-1 rounded-lg text-xs bg-brand-main text-brand-dark font-medium hover:bg-yellow-400 transition-colors"
                                        >
                                          保存
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    /* 改行を反映して表示 */
                                    <p className="text-gray-600 whitespace-pre-wrap mt-0.5">{comment.content}</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {/* 送信完了メッセージ */}
                        {sentFeedback[record.id] && (
                          <p className="text-xs text-green-600 font-medium mb-2 text-center">✅ 送信しました</p>
                        )}
                        {/* コメント入力エリア（textarea で改行対応） */}
                        <div className="flex gap-2 items-end">
                          <textarea
                            value={commentInputs[record.id] || ''}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [record.id]: e.target.value }))}
                            placeholder="選手にコメントを送る..."
                            rows={2}
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-xs resize-none"
                            onKeyDown={(e) => {
                              // Shift+Enter で改行、Enter のみで送信
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleAddComment(record.id)
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAddComment(record.id)}
                            className="bg-brand-main text-brand-dark font-medium px-4 py-2 rounded-lg text-xs hover:bg-yellow-400 transition-colors whitespace-nowrap"
                          >
                            送信
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Shift+Enterで改行、Enterで送信</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ====== 成長・達成度タブ ====== */}
        {activeTab === 'growth' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map(player => {
              // 成長・達成度タブは全期間データを使用（14日制限を排除）
              const playerRecords = allTimeRecords.filter(r => r.user_id === player.id)
              const avgEval = playerRecords.length > 0
                ? (playerRecords.reduce((sum, r) => sum + r.self_evaluation, 0) / playerRecords.length).toFixed(1)
                : '-'
              const totalPoints = playerRecords.reduce((sum, r) => sum + r.points, 0)
              const recordCount = playerRecords.length
              const participationCounts = playerRecords.reduce((acc, r) => {
                acc[r.participation_status] = (acc[r.participation_status] || 0) + 1
                return acc
              }, {} as Record<string, number>)
              return (
                <div key={player.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-3">{player.name}</h4>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-brand-dark">{avgEval}</p>
                      <p className="text-xs text-gray-500">平均評価</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-brand-main">{totalPoints}</p>
                      <p className="text-xs text-gray-500">獲得pt</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-brand-dark">{recordCount}</p>
                      <p className="text-xs text-gray-500">記録数</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(participationCounts).map(([status, count]) => (
                      <span key={status} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                        {status}: {count}日
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ====== チーム推移タブ ====== */}
        {activeTab === 'team' && (
          <div className="space-y-4">

            {/* 選手選択パネル */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">📋 表示する選手を選択</h3>
                <button
                  onClick={toggleAll}
                  className="text-xs text-brand-dark bg-brand-main px-3 py-1 rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                >
                  {selectedPlayerIds.length === players.length ? '全員解除' : '全員選択'}
                </button>
              </div>

              {players.length === 0 ? (
                <p className="text-xs text-gray-400">選手が登録されていません</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {players.map(player => {
                    const checked = selectedPlayerIds.includes(player.id)
                    return (
                      <label
                        key={player.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm cursor-pointer select-none transition-all ${
                          checked
                            ? 'bg-brand-main border-yellow-400 text-brand-dark font-medium'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePlayer(player.id)}
                          className="sr-only"
                        />
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0 ${
                            checked ? 'bg-brand-dark border-brand-dark text-white' : 'border-gray-400'
                          }`}
                        >
                          {checked && '✓'}
                        </span>
                        <span>{player.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              <p className="text-xs text-gray-400 mt-3">
                {selectedPlayerIds.length}名選択中 / 全{players.length}名
              </p>
            </div>

            {/* ローディング中 */}
            {teamLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="animate-pulse text-brand-main font-bold">データ読み込み中...</div>
              </div>
            )}

            {/* 選手未選択 */}
            {!teamLoading && selectedPlayerIds.length === 0 && (
              <div className="bg-white rounded-2xl p-10 shadow-sm text-center text-gray-400">
                <p className="text-3xl mb-2">👆</p>
                <p className="text-sm">上のリストから選手を選択してください</p>
              </div>
            )}

            {/* グラフエリア */}
            {!teamLoading && selectedPlayerIds.length > 0 && (
              <>
                {/* サマリーカード */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                    <p className="text-xs text-gray-500 mb-1">疲労度 21日平均</p>
                    <p className={`text-2xl font-bold ${
                      overallAvgFatigue !== null && overallAvgFatigue >= 8
                        ? 'text-red-500'
                        : overallAvgFatigue !== null && overallAvgFatigue >= 6
                        ? 'text-orange-500'
                        : 'text-green-500'
                    }`}>
                      {overallAvgFatigue !== null ? overallAvgFatigue : '-'}
                    </p>
                    <p className="text-xs text-gray-400">/ 10点</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                    <p className="text-xs text-gray-500 mb-1">睡眠時間 21日平均</p>
                    <p className={`text-2xl font-bold ${
                      overallAvgSleep !== null && overallAvgSleep < 6 ? 'text-red-500' : 'text-blue-500'
                    }`}>
                      {overallAvgSleep !== null ? overallAvgSleep : '-'}
                    </p>
                    <p className="text-xs text-gray-400">時間</p>
                  </div>
                </div>

                {/* 疲労度折れ線グラフ */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-1">😓 疲労度の平均推移（過去3週間）</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    対象: {selectedPlayerIds.length}名 ／ Y軸: 疲労度スコア（0〜10）
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dailyAverages} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} tickCount={6} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value) => [`${value}`, '疲労度（平均）']}
                      />
                      <Legend
                        formatter={() => `疲労度平均（${selectedPlayerIds.length}名）`}
                        wrapperStyle={{ fontSize: '11px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgFatigue"
                        name="疲労度（平均）"
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#ef4444' }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {/* 判定基準補足 */}
                  <div className="flex gap-3 mt-2 justify-end flex-wrap">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-red-400 rounded" /> 8以上: 要注意
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-yellow-400 rounded" /> 6〜7: 注意
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-green-400 rounded" /> 〜5: 良好
                    </span>
                  </div>
                </div>

                {/* 睡眠時間折れ線グラフ */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-1">😴 睡眠時間の平均推移（過去3週間）</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    対象: {selectedPlayerIds.length}名 ／ Y軸: 睡眠時間（時間）
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dailyAverages} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis domain={[0, 12]} tick={{ fontSize: 11 }} tickCount={7} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value) => [`${value}h`, '睡眠時間（平均）']}
                      />
                      <Legend
                        formatter={() => `睡眠時間平均（${selectedPlayerIds.length}名）`}
                        wrapperStyle={{ fontSize: '11px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgSleep"
                        name="睡眠時間（平均）"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#3b82f6' }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {/* 判定基準補足 */}
                  <div className="flex gap-3 mt-2 justify-end flex-wrap">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-red-400 rounded" /> 6時間未満: 要注意
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-blue-400 rounded" /> 推奨: 7〜9時間
                    </span>
                  </div>
                </div>

                {/* 集計期間の補足 */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-1">📌 集計対象期間</h3>
                  <p className="text-xs text-gray-500">
                    {format(subDays(new Date(), 20), 'yyyy年M月d日')} 〜 {format(new Date(), 'yyyy年M月d日')}（直近21日間）
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    ※ データ未入力の日はグラフに点が表示されません。選手が入力した日のみ平均値を算出します。
                  </p>
                </div>
              </>
            )}

          </div>
        )}

        {/* ====== カルテタブ ====== */}
        {activeTab === 'karte' && (
          <KarteTab
            players={players}
            allPhysicalRecords={allPhysicalRecords}
            allMaxRecords={allMaxRecords}
            loading={karteLoading}
            selectedPlayerId={selectedKartePlayerId}
            onSelectPlayer={setSelectedKartePlayerId}
            karteTab={karteTab}
            onKarteTabChange={setKarteTab}
          />
        )}

        {/* ====== Session RPEタブ ====== */}
        {activeTab === 'rpe' && (
          <div className="space-y-4">

            {/* ---- 日付選択 + 練習時間入力パネル ---- */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-4">🏋️ 練習時間の入力（コーチ専用）</h3>

              {/* 日付選択 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <label className="text-sm text-gray-600 whitespace-nowrap">練習日</label>
                <input
                  type="date"
                  value={selectedDate}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm transition-colors"
                />
              </div>

              {/* 練習時間入力 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <label className="text-sm text-gray-600 whitespace-nowrap">練習時間（分）</label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={rpeDurationInput}
                  onChange={(e) => setRpeDurationInput(e.target.value)}
                  placeholder="例: 90"
                  className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm transition-colors"
                />
              </div>

              {/* 保存ボタン + 完了フィードバック */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSavePracticeSession}
                  disabled={rpeSaving || rpeDurationInput === ''}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    rpeSaving || rpeDurationInput === ''
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-brand-main text-brand-dark hover:bg-yellow-400 shadow-sm'
                  }`}
                >
                  {rpeSaving ? '保存中...' : '保存する'}
                </button>
                {rpeSavedFeedback && (
                  <span className="text-sm text-green-600 font-medium">✅ 保存しました</span>
                )}
              </div>

              {/* 保存済みデータの表示 */}
              {rpePracticeSession && (
                <p className="text-xs text-gray-400 mt-3">
                  ※ この日の練習時間: <strong className="text-gray-600">{rpePracticeSession.duration_minutes}分</strong>（保存済み）
                </p>
              )}
            </div>

            {/* ---- Session RPE 一覧 ---- */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-gray-700">📊 選手別 Session RPE</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Session RPE ＝ 練習時間（分）× 疲労度 ／
                対象日: {format(parseISO(selectedDate), 'yyyy年M月d日(E)', { locale: ja })}
              </p>

              {/* 練習時間未設定の場合 */}
              {!rpePracticeSession ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">⏱️</p>
                  <p className="text-sm">上のフォームで練習時間を入力・保存すると<br />Session RPEが自動計算されます</p>
                </div>
              ) : (
                <>
                  {/* 練習時間サマリー */}
                  <div className="bg-brand-main/10 border border-brand-main/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
                    <span className="text-2xl">⏱️</span>
                    <div>
                      <p className="text-sm font-bold text-brand-dark">練習時間: {rpePracticeSession.duration_minutes}分</p>
                      <p className="text-xs text-gray-500">この時間 × 各選手の疲労度 = Session RPE</p>
                    </div>
                  </div>

                  {/* 選手別RPEリスト */}
                  {players.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">選手が登録されていません</p>
                  ) : (
                    <div className="space-y-3">
                      {players.map(player => {
                        // 選択日 or 直近のレコードを優先する
                        const record = todayRecords.find(r => r.user_id === player.id)
                          || recentRecords.find(r => r.user_id === player.id)
                        const fatigue = record?.fatigue_level ?? null
                        const sessionRpe = fatigue !== null
                          ? rpePracticeSession.duration_minutes * fatigue
                          : null

                        // RPEレベルに応じた色分け
                        const rpeColor =
                          sessionRpe === null ? 'text-gray-400'
                          : sessionRpe >= 700 ? 'text-red-500'
                          : sessionRpe >= 500 ? 'text-orange-500'
                          : 'text-green-600'
                        const borderColor =
                          sessionRpe === null ? 'border-gray-200'
                          : sessionRpe >= 700 ? 'border-red-400'
                          : sessionRpe >= 500 ? 'border-orange-400'
                          : 'border-green-400'

                        return (
                          <div
                            key={player.id}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border-l-4 bg-gray-50 ${borderColor}`}
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{player.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {fatigue !== null
                                  ? `疲労度: ${fatigue}/10 × ${rpePracticeSession.duration_minutes}分`
                                  : 'この日のデータなし'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xl font-bold ${rpeColor}`}>
                                {sessionRpe !== null ? sessionRpe : '-'}
                              </p>
                              <p className="text-xs text-gray-400">Session RPE</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* RPEレベルの目安 */}
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <p className="text-xs font-bold text-gray-600 mb-2">📌 Session RPE の目安</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500">
                      <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                        <span className="w-3 h-3 rounded-full bg-green-400 flex-shrink-0" />
                        <span>〜499: 低負荷（回復系）</span>
                      </div>
                      <div className="flex items-center gap-2 bg-orange-50 rounded-lg px-3 py-2">
                        <span className="w-3 h-3 rounded-full bg-orange-400 flex-shrink-0" />
                        <span>500〜699: 中負荷（標準）</span>
                      </div>
                      <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
                        <span className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0" />
                        <span>700以上: 高負荷（要管理）</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      ※ 計算式: 練習時間（分）× 疲労度（1〜10）。疲労度は選手が入力したその日のデータを使用します。
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* ---- Session RPE 長期推移グラフ ---- */}
            <SessionRpeGraph
              sessions={rpeGraphSessions}
              records={rpeGraphRecords}
              players={players}
              days={rpeGraphDays}
              loading={rpeGraphLoading}
              onChangeDays={(d) => setRpeGraphDays(d)}
            />

          </div>
        )}

        {/* ====== メタ認知スコアタブ ====== */}
        {activeTab === 'mindset' && (
          <MindsetScoreTab
            players={players}
            mindsetRecords={mindsetRecords}
            loading={mindsetLoading}
            selectedPlayerId={selectedMindsetPlayerId}
            onSelectPlayer={setSelectedMindsetPlayerId}
            getUserName={getUserName}
          />
        )}

        {/* ====== 10ヶ条評価タブ ====== */}
        {activeTab === 'evaluation' && (
          <div className="space-y-4">

            {/* 配信完了フィードバック */}
            {deliverFeedback && (
              <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-3 shadow-sm">
                <p className="text-sm font-bold text-green-700">✅ アンケートを配信しました！選手のダッシュボードに通知が表示されます。</p>
              </div>
            )}

            {/* グループ管理セクション */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-700">👥 他者評価グループ設定</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    グループ内の全メンバーが互いに他者評価します（N人→N×(N-1)タスク自動生成）
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={reloadGroups}
                    disabled={groupsLoading}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
                    title="再読み込み"
                  >
                    🔄
                  </button>
                  <button
                    onClick={() => { setNewGroupName(''); setNewGroupType('custom'); setShowGroupModal(true) }}
                    className="bg-brand-main text-brand-dark font-bold px-4 py-2 rounded-xl hover:bg-yellow-400 transition-colors text-xs whitespace-nowrap shadow-md"
                  >
                    ＋ グループを作成
                  </button>
                </div>
              </div>

              {/* フィードバック */}
              {groupFeedback === 'group-created' && (
                <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700 font-bold">
                  ✅ グループを作成しました
                </div>
              )}
              {groupFeedback === 'group-updated' && (
                <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700 font-bold">
                  ✅ グループ情報を更新しました
                </div>
              )}
              {groupFeedback === 'member-added' && (
                <div className="mb-3 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700 font-bold">
                  ✅ メンバーを追加しました
                </div>
              )}
              {groupFeedback === 'error-dup-member' && (
                <div className="mb-3 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs text-orange-700 font-bold">
                  ⚠️ この選手はすでにグループに追加されています
                </div>
              )}

              {/* グループ一覧 */}
              {groupsLoading ? (
                <div className="text-center py-4 text-gray-400 text-xs">読み込み中...</div>
              ) : evaluationGroups.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs bg-gray-50 rounded-xl">
                  <p className="text-2xl mb-1">👥</p>
                  <p>グループが登録されていません</p>
                  <p className="mt-0.5">「＋ グループを作成」からグループを登録してください</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {evaluationGroups.map(group => {
                    const memberCount = group.members.length
                    const taskCount = memberCount * (memberCount - 1)
                    const isTarget = targetGroupId === group.id && showMemberModal
                    return (
                      <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* グループヘッダー */}
                        <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-gray-800 text-sm truncate">{group.name}</span>
                            {group.group_type && group.group_type !== 'custom' && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex-shrink-0">
                                {group.group_type}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {memberCount}人
                              {memberCount >= 2 && (
                                <span className="ml-1 text-blue-500">→ {taskCount}タスク</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => {
                                setTargetGroupId(group.id)
                                setMemberAddUserId('')
                                setShowMemberModal(true)
                              }}
                              className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                                isTarget
                                  ? 'bg-brand-main text-brand-dark'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                              }`}
                            >
                              ＋ メンバー追加
                            </button>
                            <button
                              onClick={() => openEditGroupModal(group)}
                              className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-200 px-2 py-1 rounded-lg transition-colors"
                            >
                              ✏️ 修正
                            </button>
                            <button
                              onClick={() => handleDeleteGroup(group.id)}
                              disabled={deletingGroupId === group.id}
                              className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {deletingGroupId === group.id ? '削除中...' : '削除'}
                            </button>
                          </div>
                        </div>

                        {/* メンバー追加インライン（このグループが選択中の場合） */}
                        {targetGroupId === group.id && showMemberModal && (
                          <div className="px-3 py-2.5 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
                            <select
                              value={memberAddUserId}
                              onChange={e => setMemberAddUserId(e.target.value)}
                              className="flex-1 px-3 py-2 rounded-xl border-2 border-blue-200 focus:border-brand-main focus:outline-none text-sm bg-white"
                            >
                              <option value="">選手を選択してください</option>
                              {allUsers
                                .filter(u => u.role === 'player' && !group.members.some(m => m.user_id === u.id))
                                .map(u => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}{u.position ? `（${u.position}）` : ''}
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={handleAddMember}
                              disabled={memberSaving || !memberAddUserId}
                              className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                memberSaving || !memberAddUserId
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-brand-main text-brand-dark hover:bg-yellow-400'
                              }`}
                            >
                              {memberSaving ? '追加中...' : '追加'}
                            </button>
                            <button
                              onClick={() => { setShowMemberModal(false); setTargetGroupId(null) }}
                              className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
                            >
                              閉じる
                            </button>
                          </div>
                        )}

                        {/* メンバー一覧 */}
                        {group.members.length === 0 ? (
                          <div className="px-3 py-3 text-center text-xs text-gray-400">
                            メンバーがいません。「＋ メンバー追加」から追加してください。
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {group.members.map((member, idx) => {
                              const u = allUsers.find(x => x.id === member.user_id)
                                || (member.users ? { ...member.users, role: 'player' as const, password: '' } : null)
                              return (
                                <div key={member.id} className="flex items-center justify-between px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 w-4">{idx + 1}</span>
                                    <span className="text-sm text-gray-800">{u?.name ?? '不明'}</span>
                                    {u && 'position' in u && u.position && (
                                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                        {u.position}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleRemoveMember(member.id, group.id)}
                                    disabled={removingMemberId === member.id}
                                    className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {removingMemberId === member.id ? '削除中...' : '外す'}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 配信ボタン */}
            <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-700">📋 10ヶ条評価アンケート</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ペア設定に基づき全選手にアンケートタスクが自動割り当てされます
                </p>
              </div>
              <button
                onClick={() => setShowDeliveryModal(true)}
                className="bg-brand-main text-brand-dark font-bold px-5 py-2.5 rounded-xl hover:bg-yellow-400 transition-colors text-sm whitespace-nowrap shadow-md"
              >
                アンケートを配信する
              </button>
            </div>

            {/* 配信履歴 */}
            {evaluationDeliveries.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-3">配信履歴</h3>
                <div className="flex flex-wrap gap-2">
                  {evaluationDeliveries.map((d: EvaluationDelivery) => (
                    <div key={d.id} className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedDeliveryId(d.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedDeliveryId === d.id
                            ? 'bg-brand-main text-brand-dark shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {d.label}
                      </button>
                      <button
                        onClick={() => openEditDeliveryModal(d)}
                        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-lg transition-colors"
                        title="配信名を修正"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      {/* 削除ボタン（回答・タスク含む連動削除） */}
                      <button
                        onClick={() => handleDeleteDelivery(d.id, d.label)}
                        disabled={deletingDeliveryId === d.id}
                        className="text-red-300 hover:text-red-500 hover:bg-red-50 p-1 rounded-lg transition-colors disabled:opacity-50"
                        title="この配信を削除（回答データも削除されます）"
                      >
                        {deletingDeliveryId === d.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 全選手スコア一覧 */}
            {evaluationLoading ? (
              <div className="text-center py-8 text-gray-400 text-sm">読み込み中...</div>
            ) : evaluationAnswers.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-gray-500 text-sm">
                  {evaluationDeliveries.length === 0
                    ? 'まだアンケートが配信されていません。「アンケートを配信する」から開始してください。'
                    : 'この配信の回答データがまだありません。'}
                </p>
              </div>
            ) : (
              <>
                {/* 選手別スコアカード */}
                <div className="space-y-3">
                  {allUsers
                    .filter((u: User) => u.role === 'player')
                    .map((player: User) => {
                      const selfAnswerList = evaluationAnswers.filter(
                        (a: EvaluationAnswer) => a.target_id === player.id && a.evaluator_id === player.id
                      )
                      const othersAnswerList = evaluationAnswers.filter(
                        (a: EvaluationAnswer) => a.target_id === player.id && a.evaluator_id !== player.id
                      )

                      if (selfAnswerList.length === 0 && othersAnswerList.length === 0) return null

                      // 自己評価・他者評価スコアを算出する
                      // calcCategoryScoresに正しいevaluatorIdを渡す（自己評価の場合はplayer.id、他者評価は省略）
                      const selfScores = calcCategoryScores(selfAnswerList, player.id)
                      const othersScores = calcCategoryScores(othersAnswerList)

                      // 他者評価データが存在するか確認する（バーグラフ表示の判定に使用）
                      const hasOthersData = othersAnswerList.length > 0

                      // 平均スコアを算出する（スコアが0より大きい値のみ対象）
                      const selfValues = Object.values(selfScores).filter((s: number) => s > 0)
                      const othersValues = Object.values(othersScores).filter((s: number) => s > 0)

                      const selfAvg = selfValues.length > 0
                        ? Math.round(selfValues.reduce((a: number, b: number) => a + b, 0) / selfValues.length * 10) / 10
                        : null
                      // 他者評価データがある場合のみ平均を表示する（データ0件でも平均値0表示を防ぐ）
                      const othersAvg = hasOthersData && othersValues.length > 0
                        ? Math.round(othersValues.reduce((a: number, b: number) => a + b, 0) / othersValues.length * 10) / 10
                        : null

                      const gap = selfAvg !== null && othersAvg !== null
                        ? Math.abs(selfAvg - othersAvg)
                        : null
                      const isLargeGap = gap !== null && gap >= 1.0

                      return (
                        <div
                          key={player.id}
                          className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${
                            isLargeGap ? 'border-red-300' : 'border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-800 text-sm">{player.name}</span>
                              {player.position && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                  {player.position}
                                </span>
                              )}
                              {isLargeGap && (
                                <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                                  ！ ギャップ大
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2 text-xs flex-shrink-0">
                              {selfAvg !== null && (
                                <span className="text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-full">
                                  自己 {selfAvg}
                                </span>
                              )}
                              {/* 他者評価データがある場合のみ平均スコアを表示する */}
                              {othersAvg !== null && (
                                <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                                  他者 {othersAvg}
                                </span>
                              )}
                              {/* 他者評価の回答はあるが全問未回答の場合 */}
                              {hasOthersData && othersAvg === null && (
                                <span className="text-gray-400 text-xs bg-gray-50 px-2 py-0.5 rounded-full">
                                  他者評価 集計中
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {EVALUATION_CATEGORIES.map((cat: string) => {
                              const self = selfScores[cat] || 0
                              const other = othersScores[cat] || 0
                              // ギャップ表示は両データが揃っている場合のみ
                              const catGap = self > 0 && other > 0 ? Math.abs(self - other) : null
                              const isCatGap = catGap !== null && catGap >= 1.0
                              return (
                                <div key={cat}>
                                  <div className="flex justify-between items-center mb-0.5">
                                    <span className={`text-xs ${isCatGap ? 'font-bold text-red-600' : 'text-gray-500'}`}>
                                      {isCatGap && '⚠ '}{cat}
                                    </span>
                                    <div className="flex gap-2 text-xs">
                                      {/* 自己評価の数値（データがある場合のみ） */}
                                      {self > 0 && <span className="text-yellow-600">{self}</span>}
                                      {/* 他者評価の数値（他者データがある場合のみ、0以外を表示） */}
                                      {hasOthersData && other > 0 && <span className="text-blue-500">{other}</span>}
                                    </div>
                                  </div>
                                  <div className="flex gap-0.5 items-center">
                                    {/* 自己評価バー */}
                                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                      <div
                                        className="bg-yellow-400 h-1.5 rounded-full"
                                        style={{ width: `${(self / 5) * 100}%` }}
                                      />
                                    </div>
                                    {/* 他者評価バー（他者評価データがある場合は常に表示し、幅で値を示す） */}
                                    {hasOthersData && (
                                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                        <div
                                          className="bg-blue-400 h-1.5 rounded-full opacity-70"
                                          style={{ width: `${(other / 5) * 100}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {isLargeGap && selfAvg !== null && othersAvg !== null && (
                            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5 mt-2">
                              {selfAvg > othersAvg
                                ? `自己評価が他者評価より ${gap?.toFixed(1)} 高い（過大評価の可能性）`
                                : `自己評価が他者評価より ${gap?.toFixed(1)} 低い（自信喪失の可能性）`}
                            </p>
                          )}
                        </div>
                      )
                    })
                    .filter(Boolean)
                  }
                </div>

                {/* 凡例 */}
                <div className="flex items-center gap-4 text-xs text-gray-400 justify-end">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-2 bg-yellow-400 rounded" /> 自己評価
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-2 bg-blue-400 rounded opacity-70" /> 他者評価
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-red-500">！</span> ギャップ1.0以上
                  </span>
                </div>
              </>
            )}

            {/* 配信モーダル */}
            {showDeliveryModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <h3 className="text-lg font-bold text-brand-dark mb-2">📋 アンケートを配信する</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    ペア設定に基づき、全選手に自己評価 + 他者評価タスクが自動割り当てされます。
                  </p>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      配信名・期間ラベル <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={deliveryLabel}
                      onChange={e => setDeliveryLabel(e.target.value)}
                      placeholder="例: 2026年7月 前期評価"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) handleDeliverEvaluation()
                      }}
                    />
                  </div>
                  {/* グループ設定サマリー */}
                  <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-700">
                    👥 登録済みグループ: <span className="font-bold">{evaluationGroups.length} グループ</span>
                    {evaluationGroups.length > 0 && (
                      <span className="ml-1">
                        （総メンバー: {evaluationGroups.reduce((s, g) => s + g.members.length, 0)}人）
                      </span>
                    )}
                    {evaluationGroups.length === 0 && (
                      <span className="ml-1 text-orange-600">（グループ未登録のため自己評価タスクのみ生成されます）</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-5 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    ⚠️ 配信すると全選手のダッシュボードに通知が表示されます。
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowDeliveryModal(false); setDeliveryLabel('') }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleDeliverEvaluation}
                      disabled={delivering || !deliveryLabel.trim()}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        delivering || !deliveryLabel.trim()
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-brand-main text-brand-dark hover:bg-yellow-400 shadow-md'
                      }`}
                    >
                      {delivering ? '配信中...' : '配信する'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* グループ作成モーダル */}
            {showGroupModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <h3 className="text-lg font-bold text-brand-dark mb-1">👥 グループを作成</h3>
                  <p className="text-xs text-gray-500 mb-5">
                    グループ名を入力してください。作成後にメンバーを追加できます。
                  </p>

                  {/* グループ名 */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      グループ名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      placeholder="例: Aグループ、シスターグループ1"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleAddGroup() }}
                    />
                  </div>

                  {/* グループ種別 */}
                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      種別 <span className="text-gray-400 font-normal">（任意）</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'custom', label: 'カスタム' },
                        { value: 'sister', label: 'シスター' },
                        { value: 'position', label: '同ポジ' },
                        { value: 'team', label: 'チーム全体' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setNewGroupType(opt.value)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border-2 transition-all ${
                            newGroupType === opt.value
                              ? 'border-brand-main bg-yellow-50 text-brand-dark'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowGroupModal(false); setNewGroupName(''); setNewGroupType('custom') }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleAddGroup}
                      disabled={groupSaving || !newGroupName.trim()}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        groupSaving || !newGroupName.trim()
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-brand-main text-brand-dark hover:bg-yellow-400 shadow-md'
                      }`}
                    >
                      {groupSaving ? '作成中...' : '作成する'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---- グループ編集モーダル ---- */}
            {showEditGroupModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <h3 className="text-lg font-bold text-brand-dark mb-1">✏️ グループを修正</h3>
                  <p className="text-xs text-gray-500 mb-5">
                    グループ名・種別を変更できます。メンバー設定は変わりません。
                  </p>

                  {/* グループ名 */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      グループ名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={e => setEditGroupName(e.target.value)}
                      placeholder="例: Aグループ、シスターグループ1"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSaveEditGroup() }}
                    />
                  </div>

                  {/* グループ種別 */}
                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      種別 <span className="text-gray-400 font-normal">（任意）</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'custom', label: 'カスタム' },
                        { value: 'sister', label: 'シスター' },
                        { value: 'position', label: '同ポジ' },
                        { value: 'team', label: 'チーム全体' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setEditGroupType(opt.value)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border-2 transition-all ${
                            editGroupType === opt.value
                              ? 'border-brand-main bg-yellow-50 text-brand-dark'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowEditGroupModal(false); setEditGroupId(null) }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleSaveEditGroup}
                      disabled={editGroupSaving || !editGroupName.trim()}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        editGroupSaving || !editGroupName.trim()
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-brand-main text-brand-dark hover:bg-yellow-400 shadow-md'
                      }`}
                    >
                      {editGroupSaving ? '保存中...' : '保存する'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---- 配信名編集モーダル ---- */}
            {showEditDeliveryModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <h3 className="text-lg font-bold text-brand-dark mb-1">✏️ 配信名を修正</h3>
                  <p className="text-xs text-gray-500 mb-1">
                    配信名（ラベル）のみ変更します。
                  </p>
                  <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-5">
                    ⚠️ 回答データ・タスクは一切変更されません。名前だけが変わります。
                  </p>

                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      配信名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editDeliveryLabel}
                      onChange={e => setEditDeliveryLabel(e.target.value)}
                      placeholder="例: 2026年7月 前期評価"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSaveEditDelivery() }}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowEditDeliveryModal(false); setEditDeliveryId(null) }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleSaveEditDelivery}
                      disabled={editDeliverySaving || !editDeliveryLabel.trim()}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        editDeliverySaving || !editDeliveryLabel.trim()
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-brand-main text-brand-dark hover:bg-yellow-400 shadow-md'
                      }`}
                    >
                      {editDeliverySaving ? '保存中...' : '保存する'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </main>
      <BottomNav role="staff" />

      {/* ====== 連絡事項・TODO新規作成モーダル ====== */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📢 連絡事項・TODOを追加</h3>

            {/* 種別選択 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setNoticeType('notice')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  noticeType === 'notice' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'
                }`}
              >
                📢 連絡事項
              </button>
              <button
                onClick={() => setNoticeType('todo')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  noticeType === 'todo' ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'
                }`}
              >
                ✅ TODO
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                タイトル・内容 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="例: 明日の練習は17時開始です"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                詳細（省略可）
              </label>
              <textarea
                value={noticeBody}
                onChange={(e) => setNoticeBody(e.target.value)}
                placeholder="詳細な説明があれば入力してください"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowNoticeModal(false); setNoticeTitle(''); setNoticeBody('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateNotice}
                disabled={noticeSaving || !noticeTitle.trim()}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  noticeSaving || !noticeTitle.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-brand-main text-brand-dark hover:bg-yellow-400 shadow-md'
                }`}
              >
                {noticeSaving ? '保存中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 連絡事項・TODOボード コンポーネント（指導者・選手共通）
// ============================================================
function NoticeBoard({
  notices,
  currentUserId,
  isCoach,
  loading,
  onToggleComplete,
  onDelete,
  onAddClick,
  allUsersCount,
}: {
  notices: Notice[]
  currentUserId: string
  isCoach: boolean
  loading: boolean
  onToggleComplete: (noticeId: string, isCompleted: boolean) => void
  onDelete?: (noticeId: string) => void
  onAddClick: () => void
  allUsersCount?: number
}) {
  // 自分がチェック済みのものを除いた一覧（表示用）
  const visibleNotices = notices.filter(n => {
    const completedByMe = (n.completions || []).some(c => c.user_id === currentUserId)
    return !completedByMe
  })

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-700">📢 連絡事項・TODOリスト</h3>
        <button
          onClick={onAddClick}
          className="text-xs bg-brand-main text-brand-dark font-bold px-3 py-1.5 rounded-xl hover:bg-yellow-400 transition-colors shadow-sm"
        >
          ＋ 追加
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
          読み込み中...
        </div>
      ) : visibleNotices.length === 0 ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
          現在の連絡事項・TODOはありません
        </div>
      ) : (
        <div className="space-y-2">
          {visibleNotices.map(n => {
            const completedByMe = (n.completions || []).some(c => c.user_id === currentUserId)
            const completedCount = (n.completions || []).length
            const uncheckedCount = allUsersCount !== undefined ? Math.max(0, allUsersCount - completedCount) : null

            return (
              <div key={n.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-start gap-3">
                {/* チェックボックス */}
                <button
                  onClick={() => onToggleComplete(n.id, completedByMe)}
                  className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mt-0.5 ${
                    completedByMe
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  {completedByMe && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      n.notice_type === 'todo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {n.notice_type === 'todo' ? '✅ TODO' : '📢 連絡'}
                    </span>
                    <p className="text-sm font-medium text-gray-800 leading-tight">{n.title}</p>
                  </div>
                  {n.body && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap">{n.body}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400">
                      {n.creator?.name || '不明'}・{new Date(n.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </span>
                    {/* 指導者のみ：未チェック人数を表示 */}
                    {isCoach && uncheckedCount !== null && uncheckedCount > 0 && (
                      <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                        未チェック {uncheckedCount}名
                      </span>
                    )}
                    {isCoach && uncheckedCount === 0 && completedCount > 0 && (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        全員チェック済み ✓
                      </span>
                    )}
                  </div>
                </div>

                {/* 削除ボタン（指導者のみ表示） */}
                {isCoach && onDelete && (
                  <button
                    onClick={() => onDelete(n.id)}
                    className="shrink-0 text-gray-300 hover:text-red-400 transition-colors p-1"
                    title="削除"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// カルテタブ コンポーネント
// ============================================================

/** 測定日ラベルを短く整形する（例: 2026-04-01 → 26/4） */
function formatMeasuredDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getFullYear()).slice(2)}/${d.getMonth() + 1}`
}

/** 数値配列の平均を計算する（null/undefined を除外） */
function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && v !== undefined)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10
}

interface KarteTabProps {
  players: User[]
  allPhysicalRecords: PhysicalRecord[]
  allMaxRecords: MaxTrainingRecord[]
  loading: boolean
  selectedPlayerId: string | null
  onSelectPlayer: (id: string | null) => void
  karteTab: 'physical' | 'max'
  onKarteTabChange: (tab: 'physical' | 'max') => void
}

function KarteTab({
  players,
  allPhysicalRecords,
  allMaxRecords,
  loading,
  selectedPlayerId,
  onSelectPlayer,
  karteTab,
  onKarteTabChange,
}: KarteTabProps) {
  // 表示対象の選手データ
  const selectedPlayer = players.find(p => p.id === selectedPlayerId)

  // 選択選手の個人データ
  const personalPhysical = allPhysicalRecords
    .filter(r => r.user_id === selectedPlayerId)
    .sort((a, b) => a.measured_date.localeCompare(b.measured_date))
  const personalMax = allMaxRecords
    .filter(r => r.user_id === selectedPlayerId)
    .sort((a, b) => a.measured_date.localeCompare(b.measured_date))

  // 測定日の全ユニークリストを取得する（チーム平均の基準日）
  const allPhysicalDates = Array.from(new Set(allPhysicalRecords.map(r => r.measured_date))).sort()
  const allMaxDates = Array.from(new Set(allMaxRecords.map(r => r.measured_date))).sort()

  // チーム平均を日付ごとに計算（身体測定）
  const teamPhysicalAvg = allPhysicalDates.map(date => {
    const dayRecords = allPhysicalRecords.filter(r => r.measured_date === date)
    return {
      date: formatMeasuredDate(date),
      rawDate: date,
      'チーム平均_体重': avg(dayRecords.map(r => r.weight_kg)),
      'チーム平均_体脂肪率': avg(dayRecords.map(r => r.body_fat_pct)),
      'チーム平均_筋肉量': avg(dayRecords.map(r => r.muscle_mass_kg)),
    }
  })

  // チーム平均を日付ごとに計算（MAX測定）
  const teamMaxAvg = allMaxDates.map(date => {
    const dayRecords = allMaxRecords.filter(r => r.measured_date === date)
    return {
      date: formatMeasuredDate(date),
      rawDate: date,
      'チーム平均_ベンチプレス': avg(dayRecords.map(r => r.bench_press_kg)),
      'チーム平均_スクワット': avg(dayRecords.map(r => r.squat_kg)),
      'チーム平均_デッドリフト': avg(dayRecords.map(r => r.deadlift_kg)),
    }
  })

  // 個人 + チーム平均のグラフデータをマージする（身体測定）
  const physicalChartData = allPhysicalDates.map(date => {
    const personalRec = personalPhysical.find(r => r.measured_date === date)
    const teamRec = teamPhysicalAvg.find(r => r.rawDate === date)
    return {
      date: formatMeasuredDate(date),
      '個人_体重': personalRec?.weight_kg ?? null,
      '個人_体脂肪率': personalRec?.body_fat_pct ?? null,
      '個人_筋肉量': personalRec?.muscle_mass_kg ?? null,
      'チーム平均_体重': teamRec?.['チーム平均_体重'] ?? null,
      'チーム平均_体脂肪率': teamRec?.['チーム平均_体脂肪率'] ?? null,
      'チーム平均_筋肉量': teamRec?.['チーム平均_筋肉量'] ?? null,
    }
  })

  // 個人 + チーム平均のグラフデータをマージする（MAX測定）
  const maxChartData = allMaxDates.map(date => {
    const personalRec = personalMax.find(r => r.measured_date === date)
    const teamRec = teamMaxAvg.find(r => r.rawDate === date)
    return {
      date: formatMeasuredDate(date),
      '個人_ベンチプレス': personalRec?.bench_press_kg ?? null,
      '個人_スクワット': personalRec?.squat_kg ?? null,
      '個人_デッドリフト': personalRec?.deadlift_kg ?? null,
      'チーム平均_ベンチプレス': teamRec?.['チーム平均_ベンチプレス'] ?? null,
      'チーム平均_スクワット': teamRec?.['チーム平均_スクワット'] ?? null,
      'チーム平均_デッドリフト': teamRec?.['チーム平均_デッドリフト'] ?? null,
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-brand-main font-bold">データ読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ---- 選手選択パネル ---- */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-3">📋 選手を選択してカルテを閲覧</h3>
        {players.length === 0 ? (
          <p className="text-xs text-gray-400">選手が登録されていません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {players.map(player => {
              const isSelected = selectedPlayerId === player.id
              return (
                <button
                  key={player.id}
                  onClick={() => onSelectPlayer(isSelected ? null : player.id)}
                  className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-brand-main border-yellow-400 text-brand-dark shadow-md'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {player.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ---- 選手未選択時 ---- */}
      {!selectedPlayerId && (
        <div className="bg-white rounded-2xl p-10 shadow-sm text-center text-gray-400">
          <p className="text-3xl mb-2">👆</p>
          <p className="text-sm">上のリストから選手を選んでカルテを表示します</p>
        </div>
      )}

      {/* ---- 選手選択済み ---- */}
      {selectedPlayer && (
        <>
          {/* 選手名ヘッダー */}
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-main flex items-center justify-center text-brand-dark font-bold text-lg">
              {selectedPlayer.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-gray-800">{selectedPlayer.name}</p>
              <p className="text-xs text-gray-400">{selectedPlayer.position || 'ポジション未設定'}</p>
            </div>
          </div>

          {/* INBODY / MAX タブ切り替え */}
          <div className="flex gap-2">
            <button
              onClick={() => onKarteTabChange('physical')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                karteTab === 'physical'
                  ? 'bg-brand-main text-brand-dark shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              INBODY測定
            </button>
            <button
              onClick={() => onKarteTabChange('max')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                karteTab === 'max'
                  ? 'bg-brand-main text-brand-dark shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              MAX測定
            </button>
          </div>

          {/* ---- INBODY測定 ---- */}
          {karteTab === 'physical' && (
            <div className="space-y-4">
              {/* 一覧表 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-3">📏 INBODY測定 一覧</h3>
                {personalPhysical.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">まだ記録がありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="py-2 px-2 text-gray-500 text-left">測定日</th>
                          <th className="py-2 px-2 text-gray-500">身長(cm)</th>
                          <th className="py-2 px-2 text-gray-500">体重(kg)</th>
                          <th className="py-2 px-2 text-gray-500">体脂肪(%)</th>
                          <th className="py-2 px-2 text-gray-500">筋肉量(kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...personalPhysical].reverse().map(r => (
                          <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-2 text-left font-medium text-gray-700">
                              {r.measured_date}
                            </td>
                            <td className="py-2 px-2 text-gray-800">{r.height_cm ?? '-'}</td>
                            <td className="py-2 px-2 text-gray-800">{r.weight_kg ?? '-'}</td>
                            <td className="py-2 px-2 text-gray-800">{r.body_fat_pct ?? '-'}</td>
                            <td className="py-2 px-2 text-gray-800">{r.muscle_mass_kg ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* グラフ（2件以上あるとき表示） */}
              {physicalChartData.length >= 2 && (
                <>
                  {/* 体重グラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">⚖️ 体重の推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={physicalChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} kg`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_体重" name="個人" stroke="#e1c614" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_体重" name="チーム平均" stroke="#e1c614" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 体脂肪率グラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">🔥 体脂肪率の推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={physicalChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} %`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_体脂肪率" name="個人" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_体脂肪率" name="チーム平均" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 筋肉量グラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">💪 筋肉量の推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={physicalChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} kg`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_筋肉量" name="個人" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_筋肉量" name="チーム平均" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {physicalChartData.length === 1 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
                  <p className="text-sm text-gray-400">グラフを表示するには2回以上の記録が必要です</p>
                </div>
              )}
            </div>
          )}

          {/* ---- MAX測定 ---- */}
          {karteTab === 'max' && (
            <div className="space-y-4">
              {/* 一覧表 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-3">🏋️ MAX測定 一覧</h3>
                {personalMax.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">まだ記録がありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="py-2 px-2 text-gray-500 text-left">測定日</th>
                          <th className="py-2 px-2 text-gray-500">ベンチ(kg)</th>
                          <th className="py-2 px-2 text-gray-500">スクワット(kg)</th>
                          <th className="py-2 px-2 text-gray-500">デッド(kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...personalMax].reverse().map(r => (
                          <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-2 text-left font-medium text-gray-700">
                              {r.measured_date}
                            </td>
                            <td className="py-2 px-2 text-gray-800">{r.bench_press_kg ?? '-'}</td>
                            <td className="py-2 px-2 text-gray-800">{r.squat_kg ?? '-'}</td>
                            <td className="py-2 px-2 text-gray-800">{r.deadlift_kg ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* グラフ（2件以上あるとき表示） */}
              {maxChartData.length >= 2 && (
                <>
                  {/* ベンチプレスグラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">🔵 ベンチプレスの推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={maxChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} kg`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_ベンチプレス" name="個人" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_ベンチプレス" name="チーム平均" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* スクワットグラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">🟡 スクワットの推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={maxChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} kg`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_スクワット" name="個人" stroke="#e1c614" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_スクワット" name="チーム平均" stroke="#e1c614" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* デッドリフトグラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">🔴 デッドリフトの推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={maxChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} kg`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_デッドリフト" name="個人" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_デッドリフト" name="チーム平均" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {maxChartData.length === 1 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
                  <p className="text-sm text-gray-400">グラフを表示するには2回以上の記録が必要です</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// Session RPEグラフ コンポーネント
// ============================================================

/**
 * Session RPEグラフのプロパティ定義
 */
interface SessionRpeGraphProps {
  /** 期間内の練習時間データ（日付ごと） */
  sessions: import('@/types/database').PracticeSession[]
  /** 期間内の全選手コンディションデータ */
  records: import('@/types/database').DailyRecord[]
  /** 選手一覧 */
  players: User[]
  /** 表示日数（30/60/90日） */
  days: 30 | 60 | 90
  /** ローディング中かどうか */
  loading: boolean
  /** 表示期間変更ハンドラ */
  onChangeDays: (d: 30 | 60 | 90) => void
}

/**
 * グラフ1点分のデータ型（日付・チーム平均Session RPE）
 */
interface RpeGraphPoint {
  /** 表示用日付ラベル（M/d形式） */
  date: string
  /** YYYY-MM-DD形式（ソート・特定用） */
  rawDate: string
  /** チーム平均 Session RPE（練習時間 × 疲労度平均）。データなしは null */
  avgRpe: number | null
  /** 練習時間（分）。その日の練習時間データ */
  duration: number | null
}

/**
 * Session RPE 長期推移グラフコンポーネント。
 * 各日の「練習時間 × チーム平均疲労度 = チーム平均Session RPE」を折れ線グラフで表示する。
 * 練習時間が未入力の日や疲労度データがない日はグラフ上に点が表示されない。
 */
function SessionRpeGraph({ sessions, records, players, days, loading, onChangeDays }: SessionRpeGraphProps) {
  const playerIds = players.map(p => p.id)

  // 日付ごとにSession RPEを計算してグラフ用データを生成する
  const graphData: RpeGraphPoint[] = (() => {
    const result: RpeGraphPoint[] = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(now, i)
      const rawDate = format(d, 'yyyy-MM-dd')
      const dateLabel = format(d, 'M/d')

      // その日の練習時間を取得する
      const session = sessions.find(s => s.session_date === rawDate)
      const duration = session?.duration_minutes ?? null

      // その日の選手の疲労度データを集計する
      const dayRecords = records.filter(
        r => r.record_date === rawDate && playerIds.includes(r.user_id)
      )

      if (duration === null || dayRecords.length === 0) {
        // 練習時間未入力 or 選手のデータなし → null（グラフに点を表示しない）
        result.push({ date: dateLabel, rawDate, avgRpe: null, duration })
      } else {
        // チーム平均疲労度を計算する
        const avgFatigue =
          dayRecords.reduce((s, r) => s + r.fatigue_level, 0) / dayRecords.length
        // Session RPE = 練習時間（分）× 疲労度平均
        const avgRpe = Math.round(duration * avgFatigue)
        result.push({ date: dateLabel, rawDate, avgRpe, duration })
      }
    }
    return result
  })()

  // 有効データ数（グラフに表示できる日数）
  const validCount = graphData.filter(d => d.avgRpe !== null).length

  // グラフの最大値（RPE目安の700を基準に余裕を持たせる）
  const maxRpe = Math.max(
    ...graphData.filter(d => d.avgRpe !== null).map(d => d.avgRpe as number),
    700
  )
  const yMax = Math.ceil(maxRpe / 100) * 100 + 100

  // 期間平均Session RPE（サマリー表示用）
  const validRpes = graphData.filter(d => d.avgRpe !== null).map(d => d.avgRpe as number)
  const overallAvgRpe =
    validRpes.length > 0
      ? Math.round(validRpes.reduce((s, v) => s + v, 0) / validRpes.length)
      : null

  // RPEレベル色判定
  const avgRpeColor =
    overallAvgRpe === null ? 'text-gray-400'
    : overallAvgRpe >= 700 ? 'text-red-500'
    : overallAvgRpe >= 500 ? 'text-orange-500'
    : 'text-green-600'

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      {/* タイトル + 期間切り替え */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
        <h3 className="text-sm font-bold text-gray-700">📈 Session RPE 長期推移グラフ</h3>
        {/* 表示期間切り替えボタン */}
        <div className="flex gap-1.5">
          {([30, 60, 90] as const).map(d => (
            <button
              key={d}
              onClick={() => onChangeDays(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                days === d
                  ? 'bg-brand-main text-brand-dark shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}日
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        チーム平均 Session RPE ＝ 練習時間（分）× チーム平均疲労度 ／ 過去{days}日間
      </p>

      {/* ローディング中 */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-pulse text-brand-main font-bold">データ読み込み中...</div>
        </div>
      )}

      {/* データ取得後 */}
      {!loading && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">期間平均 RPE</p>
              <p className={`text-xl font-bold ${avgRpeColor}`}>
                {overallAvgRpe !== null ? overallAvgRpe : '-'}
              </p>
              <p className="text-xs text-gray-400">/ セッション</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">練習日数</p>
              <p className="text-xl font-bold text-gray-700">{sessions.filter(s => {
                const start = format(subDays(new Date(), days - 1), 'yyyy-MM-dd')
                return s.session_date >= start
              }).length}</p>
              <p className="text-xs text-gray-400">日（過去{days}日）</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">データあり</p>
              <p className="text-xl font-bold text-gray-700">{validCount}</p>
              <p className="text-xs text-gray-400">日分</p>
            </div>
          </div>

          {/* 折れ線グラフ本体 */}
          {validCount === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">この期間に練習時間と疲労度のデータがある日が<br />見つかりませんでした</p>
              <p className="text-xs mt-2">練習時間を入力・保存すると、選手の疲労度と合わせてグラフが表示されます</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={graphData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    interval={days === 30 ? 4 : days === 60 ? 8 : 13}
                  />
                  <YAxis
                    domain={[0, yMax]}
                    tick={{ fontSize: 11 }}
                    tickCount={6}
                    tickFormatter={(v) => String(v)}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value, name) => {
                      if (name === 'avgRpe') return [`${value}`, 'Session RPE（チーム平均）']
                      return [value, name]
                    }}
                    labelFormatter={(label) => `📅 ${label}`}
                  />
                  <Legend
                    formatter={() => `Session RPE チーム平均（${players.length}名）`}
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                  {/* RPE目安の参照線 */}
                  <defs>
                    <linearGradient id="rpeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {/* Session RPE折れ線 */}
                  <Line
                    type="monotone"
                    dataKey="avgRpe"
                    name="avgRpe"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#f97316' }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* RPEゾーンの色帯 凡例 */}
              <div className="flex flex-wrap gap-3 mt-3 justify-end">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 bg-red-400 rounded" /> 700以上: 高負荷（要管理）
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 bg-orange-400 rounded" /> 500〜699: 中負荷（標準）
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 bg-green-400 rounded" /> 〜499: 低負荷（回復系）
                </span>
              </div>

              {/* データ補足 */}
              <p className="text-xs text-gray-400 mt-2">
                ※ 練習時間が未入力の日、または選手がその日の疲労度を入力していない日は点が表示されません。
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// メタ認知スコアダッシュボード コンポーネント（2026-07-14 追加）
// ============================================================

/** スコアに対応するラベルを返す */
function getMindsetLabel(score: number): string {
  const labels: Record<number, string> = {
    1: '固定マインドセット',
    2: '成長の芽生え',
    3: 'グロースマインドセット',
    4: '深いメタ認知',
  }
  return labels[score] || '-'
}

/** スコアに対応する色クラスを返す（テキスト色） */
function getMindsetColor(score: number): string {
  if (score <= 1) return 'text-red-500'
  if (score <= 2) return 'text-orange-500'
  if (score <= 3) return 'text-blue-500'
  return 'text-green-600'
}

/** スコアに対応する背景色クラスを返す */
function getMindsetBgColor(score: number): string {
  if (score <= 1) return 'bg-red-50 border-red-300'
  if (score <= 2) return 'bg-orange-50 border-orange-300'
  if (score <= 3) return 'bg-blue-50 border-blue-200'
  return 'bg-green-50 border-green-300'
}

interface MindsetScoreTabProps {
  players: User[]
  mindsetRecords: import('@/types/database').DailyRecord[]
  loading: boolean
  selectedPlayerId: string | null
  onSelectPlayer: (id: string | null) => void
  getUserName: (userId: string) => string
}

function MindsetScoreTab({
  players,
  mindsetRecords,
  loading,
  selectedPlayerId,
  onSelectPlayer,
  getUserName,
}: MindsetScoreTabProps) {
  // 選手ごとに最新スコアと7日平均スコアを計算する
  const playerStats = players.map(player => {
    const records = mindsetRecords
      .filter(r => r.user_id === player.id && r.mindset_score != null)
      .sort((a, b) => b.record_date.localeCompare(a.record_date))

    const latestRecord = records[0] || null
    const latestScore = latestRecord?.mindset_score ?? null
    const latestFeedback = latestRecord?.mindset_feedback ?? null

    // 過去7日分の平均を計算する
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const sevenDayStr = sevenDaysAgo.toISOString().split('T')[0]
    const recentRecords = records.filter(r => r.record_date >= sevenDayStr)
    const avg7day =
      recentRecords.length > 0
        ? Math.round(
            (recentRecords.reduce((s, r) => s + (r.mindset_score ?? 0), 0) /
              recentRecords.length) *
              10
          ) / 10
        : null

    return { player, latestScore, latestFeedback, avg7day, recordCount: records.length }
  })

  // 要サポート（スコア2以下）の選手を先に表示する
  const sortedStats = [...playerStats].sort((a, b) => {
    const aScore = a.latestScore ?? 5  // スコアなしは中間扱い
    const bScore = b.latestScore ?? 5
    return aScore - bScore  // 低いスコア（要サポート）を先頭に
  })

  // 選択選手のスコア推移グラフデータを生成する
  const selectedPlayerRecords = selectedPlayerId
    ? mindsetRecords
        .filter(r => r.user_id === selectedPlayerId && r.mindset_score != null)
        .sort((a, b) => a.record_date.localeCompare(b.record_date))
        .map(r => ({
          date: format(parseISO(r.record_date), 'M/d'),
          rawDate: r.record_date,
          score: r.mindset_score,
        }))
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-brand-main font-bold">データ読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ---- 説明パネル ---- */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🧠</span>
          <h3 className="text-sm font-bold text-gray-700">メタ認知スコア ダッシュボード</h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          選手の振り返りテキストをAIが分析し、「グロースマインドセット」への変容度を1〜4段階で自動判定します。
          スコアが低い選手（要サポート表示）には積極的な声かけをお勧めします。
        </p>
        {/* スコア凡例 */}
        <div className="grid grid-cols-2 gap-1.5 mt-3">
          {[
            { score: 1, label: '固定マインドセット', desc: '事象の羅列・能力帰属', color: 'bg-red-100 text-red-700' },
            { score: 2, label: '成長の芽生え', desc: '課題認識あり・改善策曖昧', color: 'bg-orange-100 text-orange-700' },
            { score: 3, label: 'グロースマインドセット', desc: '具体的改善策を記述', color: 'bg-blue-100 text-blue-700' },
            { score: 4, label: '深いメタ認知', desc: 'Plan Bを戦略的に立案', color: 'bg-green-100 text-green-700' },
          ].map(item => (
            <div key={item.score} className={`rounded-lg px-3 py-2 ${item.color}`}>
              <p className="text-xs font-bold">Lv.{item.score} {item.label}</p>
              <p className="text-xs opacity-80 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---- 選手スコア一覧 ---- */}
      <div className="space-y-3">
        {sortedStats.length === 0 && (
          <div className="bg-white rounded-2xl p-10 shadow-sm text-center text-gray-400">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm">スコアデータがありません</p>
            <p className="text-xs mt-1">選手がデイリーノートを記録するとAIが自動で分析します</p>
          </div>
        )}

        {sortedStats.map(({ player, latestScore, latestFeedback, avg7day, recordCount }) => {
          const isAlert = latestScore !== null && latestScore <= 2
          const isSelected = selectedPlayerId === player.id

          return (
            <div
              key={player.id}
              onClick={() => onSelectPlayer(isSelected ? null : player.id)}
              className={`bg-white rounded-xl p-4 shadow-sm border-l-4 cursor-pointer transition-all hover:shadow-md ${
                isAlert ? 'border-orange-400' : 'border-green-400'
              } ${isSelected ? 'ring-2 ring-brand-main' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                {/* 左: 選手情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-800">{player.name}</p>
                    {/* 要サポートアラート */}
                    {isAlert && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                        要サポート ⚠️
                      </span>
                    )}
                  </div>

                  {/* スコア表示 */}
                  {latestScore !== null ? (
                    <>
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className={`text-2xl font-bold ${getMindsetColor(latestScore)}`}>
                          Lv.{latestScore}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getMindsetBgColor(latestScore)} ${getMindsetColor(latestScore)} font-medium`}>
                          {getMindsetLabel(latestScore)}
                        </span>
                      </div>
                      {/* AIフィードバック */}
                      {latestFeedback && (
                        <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                          💬 {latestFeedback}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">まだスコアリング済みの記録がありません</p>
                  )}
                </div>

                {/* 右: 統計数値 */}
                <div className="text-right flex-shrink-0">
                  {avg7day !== null && (
                    <div className="mb-1">
                      <p className={`text-lg font-bold ${getMindsetColor(Math.round(avg7day))}`}>
                        {avg7day.toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-400">7日平均</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">{recordCount}件</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ---- 選択選手のスコア推移グラフ ---- */}
      {selectedPlayerId && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-1">
            📈 {getUserName(selectedPlayerId)} のスコア推移（過去30日間）
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Y軸の点線（Lv.2）は「要サポートライン」です。継続してLv.2以下の場合は声かけを検討してください。
          </p>

          {selectedPlayerRecords.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">この選手のスコアデータがまだありません</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={selectedPlayerRecords} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis
                  domain={[0, 4]}
                  ticks={[1, 2, 3, 4]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `Lv.${v}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value) => [`Lv.${value} ${getMindsetLabel(Number(value))}`, 'メタ認知スコア']}
                  labelFormatter={(label) => `📅 ${label}`}
                />
                {/* 要サポートライン（スコア2）の参照線 */}
                <Line
                  type="monotone"
                  dataKey={() => 2}
                  name="要サポートライン"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  legendType="none"
                />
                {/* スコア推移 */}
                <Line
                  type="monotone"
                  dataKey="score"
                  name="メタ認知スコア"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* 凡例補足 */}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400 justify-end">
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-orange-400 rounded" style={{ borderTop: '2px dashed #f97316' }} />
              点線: 要サポートライン（Lv.2）
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-indigo-500 rounded" />
              実線: メタ認知スコア推移
            </span>
          </div>
        </div>
      )}


    </div>
  )
}
