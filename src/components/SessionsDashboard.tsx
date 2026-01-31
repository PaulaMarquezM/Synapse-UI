import React, { useEffect, useMemo, useState } from "react"
import { RefreshCcw, LogOut, X, BarChart2 } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts"
import AuthForm from "~components/AuthForm"
import { useAuth } from "~hooks/useAuth"
import { supabase, signOut } from "~lib/supabase"

const formatDate = (iso?: string | null) => {
  if (!iso) return "-"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleString()
}

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "-"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

type SessionRow = {
  id: string
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  avg_focus: number | null
  avg_stress: number | null
  avg_fatigue: number | null
  avg_distraction: number | null
  pct_focused: number | null
  pct_distracted: number | null
  pct_stressed: number | null
  pct_tired: number | null
  interruptions: number | null
  focus_periods: number | null
  dominant_state: string | null
  avg_confidence: number | null
}

const SessionsDashboard = () => {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])

  const totalSessions = sessions.length
  const avgFocus = useMemo(() => {
    if (sessions.length === 0) return 0
    const sum = sessions.reduce((acc, s) => acc + (s.avg_focus || 0), 0)
    return Math.round(sum / sessions.length)
  }, [sessions])

  const trendData = useMemo(() => {
    const ordered = [...sessions].reverse()
    return ordered.map((s, index) => ({
      name: `S${index + 1}`,
      focus: Math.round(s.avg_focus || 0)
    }))
  }, [sessions])

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
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg, #60a5fa, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 18px rgba(96,165,250,0.35)"
            }}
          >
            <BarChart2 size={22} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>SYNAPSE UI - Dashboard</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{user?.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleClose}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(148, 163, 184, 0.35)",
              background: "rgba(148, 163, 184, 0.12)",
              color: "#cbd5e1",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
            title="Cerrar"
          >
            <X size={14} />
            Cerrar
          </button>

          <button
            onClick={fetchSessions}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(96, 165, 250, 0.35)",
              background: "rgba(96, 165, 250, 0.12)",
              color: "#93c5fd",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <RefreshCcw size={14} />
            {loading ? "Cargando" : "Actualizar"}
          </button>

          <button
            onClick={handleLogout}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(239, 68, 68, 0.35)",
              background: "rgba(239, 68, 68, 0.12)",
              color: "#fca5a5",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <LogOut size={14} />
            Salir
          </button>
        </div>
      </div>

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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16
          }}
        >
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)"
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Sesiones</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{totalSessions}</div>
          </div>
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)"
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Promedio foco</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{avgFocus}</div>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 16
          }}
        >
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
            Tendencia de foco promedio por sesion
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={trendData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="4 4" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "white",
                    fontSize: 12
                  }}
                  labelStyle={{ color: "#94a3b8", fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="focus"
                  stroke="#60a5fa"
                  strokeWidth={3}
                  dot={{ r: 3, stroke: "#60a5fa", fill: "#0b1220" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "10px 8px" }}>Inicio</th>
                <th style={{ padding: "10px 8px" }}>Duracion</th>
                <th style={{ padding: "10px 8px" }}>Foco</th>
                <th style={{ padding: "10px 8px" }}>Estres</th>
                <th style={{ padding: "10px 8px" }}>Fatiga</th>
                <th style={{ padding: "10px 8px" }}>Distraccion</th>
                <th style={{ padding: "10px 8px" }}>Dominante</th>
                <th style={{ padding: "10px 8px" }}>Interrupciones</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: "10px 8px" }}>{formatDate(s.started_at)}</td>
                  <td style={{ padding: "10px 8px" }}>{formatDuration(s.duration_seconds)}</td>
                  <td style={{ padding: "10px 8px" }}>{Math.round(s.avg_focus || 0)}</td>
                  <td style={{ padding: "10px 8px" }}>{Math.round(s.avg_stress || 0)}</td>
                  <td style={{ padding: "10px 8px" }}>{Math.round(s.avg_fatigue || 0)}</td>
                  <td style={{ padding: "10px 8px" }}>{Math.round(s.avg_distraction || 0)}</td>
                  <td style={{ padding: "10px 8px" }}>{s.dominant_state || "-"}</td>
                  <td style={{ padding: "10px 8px" }}>{s.interruptions ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {sessions.length === 0 && !loading && (
            <div style={{ marginTop: 12, color: "#94a3b8" }}>
              Aun no hay sesiones guardadas.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionsDashboard
