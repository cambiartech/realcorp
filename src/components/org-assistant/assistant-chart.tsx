"use client";

export type AssistantChartSpec = {
  type?: "line" | "bar" | "pie";
  title?: string;
  labels: string[];
  series: Array<{ name: string; data: number[] }>;
};

const COLORS = ["#0f172a", "#475569", "#64748b", "#94a3b8", "#cbd5e1"];

function maxOf(series: AssistantChartSpec["series"]) {
  let max = 0;
  for (const s of series) for (const v of s.data) if (Number.isFinite(v) && v > max) max = v;
  return max || 1;
}

function LineOrBar({ spec, mode }: { spec: AssistantChartSpec; mode: "line" | "bar" }) {
  const w = 560;
  const h = 220;
  const pad = { t: 16, r: 16, b: 36, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = Math.max(spec.labels.length, 1);
  const max = maxOf(spec.series);
  const xAt = (i: number) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => pad.t + innerH - (Math.max(0, v) / max) * innerH;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={spec.title || "Chart"}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.t + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.45}>
              {Math.round(max * t).toLocaleString()}
            </text>
          </g>
        );
      })}
      {mode === "bar"
        ? spec.series.map((s, si) => {
            const groupW = innerW / n;
            const barW = Math.max(4, (groupW * 0.7) / spec.series.length);
            return s.data.map((v, i) => {
              const x = pad.l + i * groupW + groupW * 0.15 + si * barW;
              const y = yAt(v);
              return (
                <rect
                  key={`${si}-${i}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(0, pad.t + innerH - y)}
                  fill={COLORS[si % COLORS.length]}
                  opacity={0.9}
                  rx={2}
                />
              );
            });
          })
        : spec.series.map((s, si) => {
            const pts = s.data
              .map((v, i) => `${xAt(i)},${yAt(v)}`)
              .join(" ");
            return (
              <g key={si}>
                <polyline fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2.25} points={pts} />
                {s.data.map((v, i) => (
                  <circle key={i} cx={xAt(i)} cy={yAt(v)} r={3} fill={COLORS[si % COLORS.length]} />
                ))}
              </g>
            );
          })}
      {spec.labels.map((label, i) => (
        <text
          key={i}
          x={mode === "bar" ? pad.l + (i + 0.5) * (innerW / n) : xAt(i)}
          y={h - 12}
          textAnchor="middle"
          fontSize={10}
          fill="currentColor"
          opacity={0.55}
        >
          {label.length > 10 ? `${label.slice(0, 9)}…` : label}
        </text>
      ))}
    </svg>
  );
}

function Pie({ spec }: { spec: AssistantChartSpec }) {
  const values = spec.series[0]?.data ?? [];
  const total = values.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const cx = 110;
  const cy = 110;
  const r = 78;
  let angle = -Math.PI / 2;
  const slices = values.map((v, i) => {
    const sweep = (Math.max(0, v) / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      color: COLORS[i % COLORS.length],
      label: spec.labels[i] || `Item ${i + 1}`,
      value: v,
    };
  });

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <svg viewBox="0 0 220 220" className="h-44 w-44 shrink-0" role="img" aria-label={spec.title || "Pie chart"}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} opacity={0.92} />
        ))}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="tabular-nums font-medium">{Number(s.value).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AssistantChart({ spec }: { spec: AssistantChartSpec }) {
  const type = spec.type || "bar";
  if (!spec.labels?.length || !spec.series?.length) return null;
  return (
    <div className="my-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
      {spec.title ? <p className="mb-2 text-[13px] font-semibold tracking-tight">{spec.title}</p> : null}
      {type === "pie" ? <Pie spec={spec} /> : <LineOrBar spec={spec} mode={type === "line" ? "line" : "bar"} />}
      {spec.series.length > 1 && type !== "pie" ? (
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
          {spec.series.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function parseChartSpec(raw: string): AssistantChartSpec | null {
  try {
    const data = JSON.parse(raw) as AssistantChartSpec;
    if (!Array.isArray(data.labels) || !Array.isArray(data.series)) return null;
    return {
      type: data.type === "line" || data.type === "pie" || data.type === "bar" ? data.type : "bar",
      title: typeof data.title === "string" ? data.title : undefined,
      labels: data.labels.map(String),
      series: data.series
        .filter((s) => s && Array.isArray(s.data))
        .map((s) => ({ name: String(s.name || "Series"), data: s.data.map((n) => Number(n) || 0) })),
    };
  } catch {
    return null;
  }
}
