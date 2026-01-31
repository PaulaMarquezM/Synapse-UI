import React from "react"

type DashboardStatsProps = {
  totalSessions: number
  avgFocus: number
}

const cardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)"
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ totalSessions, avgFocus }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 16
      }}
    >
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>Sesiones</div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{totalSessions}</div>
      </div>
      <div style={cardStyle}>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>Promedio foco</div>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{avgFocus}</div>
      </div>
    </div>
  )
}

export default DashboardStats
