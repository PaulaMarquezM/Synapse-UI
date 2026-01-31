import React from "react"

type AttentionStatus = {
  label: string
  color: string
  bg: string
}

type AttentionBadgeProps = {
  status: AttentionStatus
}

const AttentionBadge: React.FC<AttentionBadgeProps> = ({ status }) => {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}
      title={`Atencion visual: ${status.label}`}
    >
      <div style={{ fontSize: 12, color: "#94a3b8" }}>Atencion visual</div>
      <div
        style={{
          padding: "4px 10px",
          borderRadius: 999,
          background: status.bg,
          color: status.color,
          fontSize: 11,
          fontWeight: 700
        }}
      >
        {status.label}
      </div>
    </div>
  )
}

export default AttentionBadge
