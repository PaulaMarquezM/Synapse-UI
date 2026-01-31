import React, { useEffect, useMemo, useState } from "react"
import AuthForm from "~components/AuthForm"
import { useAuth } from "~hooks/useAuth"
import { supabase, signOut } from "~lib/supabase"
import { formatDate, formatDateShort } from "~lib/dashboardUtils"
import DashboardHeader from "~components/dashboard/DashboardHeader"
import DashboardStats from "~components/dashboard/DashboardStats"
import RangeFilter, { type RangeDays } from "~components/dashboard/RangeFilter"
import FocusTrendChart from "~components/dashboard/FocusTrendChart"
import SessionsTable, { type SessionRow } from "~components/dashboard/SessionsTable"
import SessionDetail from "~components/dashboard/SessionDetail"

const SessionsDashboard = () => {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [rangeDays, setRangeDays] = useState<RangeDays>("30")
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null)

  const filteredSessions = useMemo(() => {
    if (rangeDays === "all") return sessions
    const days = parseInt(rangeDays, 10)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return sessions.filter((s) => {
      const ts = s.started_at ? new Date(s.started_at).getTime() : 0
      return ts >= cutoff
    })
  }, [sessions, rangeDays])

  const totalSessions = filteredSessions.length
  const avgFocus = useMemo(() => {
    if (filteredSessions.length === 0) return 0
    const sum = filteredSessions.reduce((acc, s) => acc + (s.avg_focus || 0), 0)
    return Math.round(sum / filteredSessions.length)
  }, [filteredSessions])

  const trendData = useMemo(() => {
    const ordered = [...filteredSessions].reverse()
    return ordered.map((s, index) => ({
      name: formatDateShort(s.started_at),
      focus: Math.round(s.avg_focus || 0),
      fullDate: formatDate(s.started_at)
    }))
  }, [filteredSessions])

  const fetchSessions = async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from("work_sessions")
      .select(
        "id, started_at, ended_at, duration_seconds, avg_focus, avg_stress, avg_fatigue, avg_distraction, pct_focused, pct_distracted, pct_stressed, pct_tired, interruptions, focus_periods, dominant_state, avg_confidence"
      )
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(50)

    if (error) {
      setError(error.message)
      setSessions([])
    } else {
      setSessions(data as SessionRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!isAuthenticated) return
    void fetchSessions()
  }, [isAuthenticated, user?.id])

  const handleLogout = async () => {
    await signOut()
  }

  const handleClose = () => {
    window.close()
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1220 0%, #1e293b 100%)",
          color: "white"
        }}
      >
        Cargando...
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1220 0%, #1e293b 100%)",
          padding: 24
        }}
      >
        <AuthForm onAuthSuccess={() => void fetchSessions()} />
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        height: "100vh",
        overflowY: "auto",
        background: "#0b1220",
        color: "white"
      }}
    >
      <DashboardHeader
        email={user?.email}
        loading={loading}
        onClose={handleClose}
        onRefresh={fetchSessions}
        onLogout={handleLogout}
      />

      <div style={{ padding: 20 }}>
        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              fontSize: 12
            }}
          >
            {error}
          </div>
        )}

        <RangeFilter value={rangeDays} onChange={setRangeDays} />
        <DashboardStats totalSessions={totalSessions} avgFocus={avgFocus} />
        <FocusTrendChart data={trendData} />
        <SessionsTable sessions={filteredSessions} loading={loading} onSelect={setSelectedSession} />
        {selectedSession && <SessionDetail session={selectedSession} />}
      </div>
    </div>
  )
}

export default SessionsDashboard
