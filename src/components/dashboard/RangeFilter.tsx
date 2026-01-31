import React from "react"

export type RangeDays = "7" | "30" | "90" | "all"

type RangeFilterProps = {
  value: RangeDays
  onChange: (value: RangeDays) => void
}

const RangeFilter: React.FC<RangeFilterProps> = ({ value, onChange }) => {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
        flexWrap: "wrap"
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>Rango</div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as RangeDays)}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "white",
            padding: "6px 8px",
            borderRadius: 8,
            fontSize: 12
          }}
        >
          <option value="7">Ultimos 7 dias</option>
          <option value="30">Ultimos 30 dias</option>
          <option value="90">Ultimos 90 dias</option>
          <option value="all">Todo</option>
        </select>
      </div>
    </div>
  )
}

export default RangeFilter
