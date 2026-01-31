import React from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts"

type TrendPoint = {
  name: string
  focus: number
  fullDate: string
}

type FocusTrendChartProps = {
  data: TrendPoint[]
}

const FocusTrendChart: React.FC<FocusTrendChartProps> = ({ data }) => {
  return (
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
          <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
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
              formatter={(value: number) => [`${value}`, "Foco"]}
              labelFormatter={(label: string, payload: any) => {
                const p = payload && payload[0] ? payload[0].payload : null
                return p?.fullDate ? `Inicio: ${p.fullDate}` : label
              }}
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
  )
}

export default FocusTrendChart
