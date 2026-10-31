"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

export type AssistantChartSpec = {
  type: "line" | "bar" | "hbar" | "pie";
  title?: string;
  unit?: "NGN" | "count" | "percent";
  labels: string[];
  series: Array<{ name: string; data: number[] }>;
};

export type AssistantKpi = {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "flat";
  good?: "up" | "down";
};

const COLORS = ["#0f172a", "#2563eb", "#0d9488", "#d97706", "#7c3aed", "#64748b"];

function compact(value: number, unit?: AssistantChartSpec["unit"]) {
  const abs = Math.abs(value);
  const fmt = (n: number, suffix: string) => `${Number.isInteger(n) ? n : n.toFixed(1)}${suffix}`;
  let text: string;
  if (abs >= 1_000_000_000) text = fmt(value / 1_000_000_000, "B");
  else if (abs >= 1_000_000) text = fmt(value / 1_000_000, "M");
  else if (abs >= 1_000) text = fmt(value / 1_000, "k");
  else text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (unit === "NGN") return `₦${text}`;
  if (unit === "percent") return `${text}%`;
  return text;
}

function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function maxOf(series: AssistantChartSpec["series"]) {
  let max = 0;
  for (const s of series) for (const v of s.data) if (Number.isFinite(v) && v > max) max = v;
  return niceMax(max);
}

function shortLabel(label: string, max = 12) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function VerticalChart({ spec }: { spec: AssistantChartSpec }) {
  const w = 640;
  const h = 260;
  const pad = { t: 22, r: 16, b: 40, l: 56 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = Math.max(spec.labels.length, 1);
  const max = maxOf(spec.series);
  const isLine = spec.type === "line";
  const xAt = (i: number) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => pad.t + innerH - (Math.max(0, v) / max) * innerH;
  const showValues = n <= 12;
  const labelEvery = Math.ceil(n / 10);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={spec.title || "Chart"}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.t + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="currentColor" strokeOpacity={t === 0 ? 0.25 : 0.08} />
            <text x={pad.l - 8} y={y + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.5}>
              {compact(max * t, spec.unit)}
            </text>
          </g>
        );
      })}
      {isLine
        ? spec.series.map((s, si) => {
            const color = COLORS[si % COLORS.length];
            const pts = s.data.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
            const area = `${xAt(0)},${pad.t + innerH} ${pts} ${xAt(s.data.length - 1)},${pad.t + innerH}`;
            return (
              <g key={si}>
                {spec.series.length === 1 ? <polygon points={area} fill={color} opacity={0.07} /> : null}
                <polyline fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" points={pts} />
                {s.data.map((v, i) => (
                  <g key={i}>
                    <circle cx={xAt(i)} cy={yAt(v)} r={3.25} fill="var(--elevated, #fff)" stroke={color} strokeWidth={2} />
                    {showValues && spec.series.length === 1 ? (
                      <text x={xAt(i)} y={yAt(v) - 8} textAnchor="middle" fontSize={9.5} fill="currentColor" opacity={0.75}>
                        {compact(v, spec.unit)}
                      </text>
                    ) : null}
                  </g>
                ))}
              </g>
            );
          })
        : spec.series.map((s, si) => {
            const groupW = innerW / n;
            const barW = Math.max(4, Math.min(42, (groupW * 0.72) / spec.series.length));
            const groupPad = (groupW - barW * spec.series.length) / 2;
            return s.data.map((v, i) => {
              const x = pad.l + i * groupW + groupPad + si * barW;
              const y = yAt(v);
              return (
                <g key={`${si}-${i}`}>
                  <rect
                    x={x}
                    y={y}
                    width={barW - 2}
                    height={Math.max(0, pad.t + innerH - y)}
                    fill={COLORS[si % COLORS.length]}
                    rx={2}
                  />
                  {showValues ? (
                    <text x={x + (barW - 2) / 2} y={y - 5} textAnchor="middle" fontSize={9.5} fill="currentColor" opacity={0.75}>
                      {compact(v, spec.unit)}
                    </text>
                  ) : null}
                </g>
              );
            });
          })}
      {spec.labels.map((label, i) =>
        i % labelEvery === 0 ? (
          <text
            key={i}
            x={isLine ? xAt(i) : pad.l + (i + 0.5) * (innerW / n)}
            y={h - 16}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            opacity={0.6}
          >
            {shortLabel(label)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function HorizontalBars({ spec }: { spec: AssistantChartSpec }) {
  const s = spec.series[0];
  const rows = spec.labels.map((label, i) => ({ label, value: s?.data[i] ?? 0 }));
  const max = maxOf(spec.series.slice(0, 1));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(90px,160px)_1fr_auto] items-center gap-3 text-[12.5px]">
          <span className="truncate text-muted" title={r.label}>
            <span className="mr-1.5 tabular-nums text-foreground/40">{i + 1}.</span>
            {r.label}
          </span>
          <div className="h-5 rounded-sm bg-foreground/[0.05]">
            <div
              className="h-5 rounded-sm"
              style={{ width: `${Math.max(1.5, (Math.max(0, r.value) / max) * 100)}%`, background: i === 0 ? COLORS[1] : COLORS[0] }}
            />
          </div>
          <span className="min-w-[56px] text-right font-medium tabular-nums">{compact(r.value, spec.unit)}</span>
        </div>
      ))}
    </div>
  );
}

function Pie({ spec }: { spec: AssistantChartSpec }) {
  const values = spec.series[0]?.data ?? [];
  const total = values.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const cx = 110;
  const cy = 110;
  const r = 84;
  const inner = 50;
  let angle = -Math.PI / 2;
  const slices = values.map((v, i) => {
    const sweep = (Math.max(0, v) / total) * Math.PI * 2;
    const a0 = angle;
    angle += sweep;
    const a1 = angle;
    const large = sweep > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
    const d =
      sweep >= Math.PI * 2 - 0.0001
        ? `M ${p(r, 0)} A ${r} ${r} 0 1 1 ${p(r, Math.PI)} A ${r} ${r} 0 1 1 ${p(r, 0)} Z`
        : `M ${p(r, a0)} A ${r} ${r} 0 ${large} 1 ${p(r, a1)} L ${p(inner, a1)} A ${inner} ${inner} 0 ${large} 0 ${p(inner, a0)} Z`;
    return {
      d,
      color: COLORS[i % COLORS.length],
      label: spec.labels[i] || `Item ${i + 1}`,
      value: v,
      pct: Math.round((Math.max(0, v) / total) * 1000) / 10,
    };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 220 220" className="h-44 w-44 shrink-0" role="img" aria-label={spec.title || "Pie chart"}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="var(--elevated, #fff)" strokeWidth={1.5} />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={15} fontWeight={600} fill="currentColor">
          {compact(total, spec.unit)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={9.5} fill="currentColor" opacity={0.55}>
          total
        </text>
      </svg>
      <ul className="w-full space-y-1.5 text-[12.5px]">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-muted">{s.label}</span>
            <span className="tabular-nums text-muted">{s.pct}%</span>
            <span className="min-w-[60px] text-right font-medium tabular-nums">{compact(s.value, spec.unit)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AssistantChart({ spec, index }: { spec: AssistantChartSpec; index?: number }) {
  if (!spec.labels?.length || !spec.series?.length) return null;
  return (
    <figure className="report-figure my-4 break-inside-avoid rounded-lg border border-foreground/10 bg-[var(--elevated)] p-4">
      {spec.title ? (
        <figcaption className="mb-3 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold tracking-tight">
            {index ? <span className="mr-1.5 text-muted">Figure {index}.</span> : null}
            {spec.title}
          </span>
          {spec.unit ? (
            <span className="text-[10.5px] uppercase tracking-wide text-muted">
              {spec.unit === "NGN" ? "₦ Naira" : spec.unit}
            </span>
          ) : null}
        </figcaption>
      ) : null}
      {spec.type === "pie" ? <Pie spec={spec} /> : spec.type === "hbar" ? <HorizontalBars spec={spec} /> : <VerticalChart spec={spec} />}
      {spec.series.length > 1 && spec.type !== "pie" && spec.type !== "hbar" ? (
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
          {spec.series.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  );
}

export function KpiStrip({ items }: { items: AssistantKpi[] }) {
  if (!items.length) return null;
  return (
    <div className="my-3 grid break-inside-avoid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((k, i) => {
        const trend = k.trend ?? "flat";
        const goodDir = k.good ?? "up";
        const positive = trend === "flat" ? null : trend === goodDir;
        const tone =
          positive === null ? "text-muted" : positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
        const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight;
        return (
          <div key={i} className="rounded-lg border border-foreground/10 bg-[var(--elevated)] px-3.5 py-3">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted">{k.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{k.value}</p>
            {k.change ? (
              <p className={`mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-medium ${tone}`}>
                <Icon className="h-3.5 w-3.5" />
                {k.change}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function parseChartSpec(raw: string): AssistantChartSpec | null {
  try {
    const data = JSON.parse(raw) as Partial<AssistantChartSpec>;
    if (!Array.isArray(data.labels) || !Array.isArray(data.series)) return null;
    const type = data.type === "line" || data.type === "pie" || data.type === "hbar" || data.type === "bar" ? data.type : "bar";
    const unit = data.unit === "NGN" || data.unit === "count" || data.unit === "percent" ? data.unit : undefined;
    return {
      type,
      unit,
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

export function parseKpis(raw: string): AssistantKpi[] | null {
  try {
    const data = JSON.parse(raw) as AssistantKpi[];
    if (!Array.isArray(data)) return null;
    return data
      .filter((k) => k && typeof k.label === "string" && k.value != null)
      .slice(0, 6)
      .map((k) => ({
        label: k.label,
        value: String(k.value),
        change: k.change ? String(k.change) : undefined,
        trend: k.trend === "up" || k.trend === "down" ? k.trend : "flat",
        good: k.good === "down" ? "down" : "up",
      }));
  } catch {
    return null;
  }
}
