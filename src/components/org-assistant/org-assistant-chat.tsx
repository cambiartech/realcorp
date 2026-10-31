"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, Download, FileText, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { AssistantChart, KpiStrip, parseChartSpec, parseKpis } from "@/components/org-assistant/assistant-chart";

type Message = { role: "user" | "assistant"; text: string; error?: boolean };

function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, i) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return <strong key={`${keyBase}-${i}`}>{chunk.slice(2, -2)}</strong>;
    }
    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      return (
        <code key={`${keyBase}-${i}`} className="rounded bg-foreground/[0.06] px-1 py-0.5 text-[0.9em]">
          {chunk.slice(1, -1)}
        </code>
      );
    }
    return chunk;
  });
}

function tableCells(line: string) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Pull markdown tables and chart series into one CSV blob for download. */
export function messageToCsv(text: string): string | null {
  const chunks: string[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++]);
      const body = rows.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r)).map(tableCells);
      if (body.length) {
        chunks.push(body.map((r) => r.map(csvEscape).join(",")).join("\n"));
      }
      continue;
    }
    if (line.trim().startsWith("```kpis")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      if (i < lines.length) i++;
      const items = parseKpis(body.join("\n"));
      if (items?.length) {
        chunks.push(
          ["KPI,Value,Change", ...items.map((k) => [k.label, k.value, k.change ?? ""].map(csvEscape).join(","))].join("\n"),
        );
      }
      continue;
    }
    if (line.trim().startsWith("```chart")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      if (i < lines.length) i++;
      const spec = parseChartSpec(body.join("\n"));
      if (spec) {
        const title = spec.title ? `${csvEscape(spec.title)}\n` : "";
        const header = ["label", ...spec.series.map((s) => s.name)].map(csvEscape).join(",");
        const rows = spec.labels.map((label, idx) =>
          [label, ...spec.series.map((s) => String(s.data[idx] ?? ""))].map(csvEscape).join(","),
        );
        chunks.push(title + [header, ...rows].join("\n"));
      }
      continue;
    }
    i++;
  }
  return chunks.length ? chunks.join("\n\n") : null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/** Opens the answer as a standalone, print-ready report (Save as PDF from the print dialog). */
function printReport(node: HTMLElement, opts: { orgName: string; question: string }) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return;
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((el) => el.outerHTML).join("\n");
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(opts.orgName)} report: ${date}</title>${styles}
<style>
  html,body{background:#fff!important;color:#0f172a!important}
  body{padding:40px 48px;font-size:13px}
  .report-head{border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:22px}
  .report-head h1{font-size:20px;font-weight:700;letter-spacing:-.01em;margin:0}
  .report-head p{margin:4px 0 0;color:#475569;font-size:12px}
  .report-foot{margin-top:28px;border-top:1px solid #e2e8f0;padding-top:10px;color:#64748b;font-size:10.5px}
  .report-figure,table,.break-inside-avoid{break-inside:avoid}
  @page{size:A4;margin:16mm}
  @media print{body{padding:0}}
</style></head><body>
<div class="report-head">
  <h1>${escapeHtml(opts.orgName)}: Management report</h1>
  <p><strong>Prepared:</strong> ${date} &nbsp;·&nbsp; <strong>Scope:</strong> ${escapeHtml(opts.question)}</p>
  <p>Source: live data from the ${escapeHtml(opts.orgName)} Realcorp workspace. Figures are as recorded at the time of preparation.</p>
</div>
${node.innerHTML}
<div class="report-foot">Generated with Realcorp Ask AI. AI-assisted analysis: verify material figures in the source modules before relying on them.</div>
</body></html>`);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let figure = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim().toLowerCase();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      if (i < lines.length) i++;
      if (lang === "chart") {
        const spec = parseChartSpec(body.join("\n"));
        if (spec) {
          figure += 1;
          blocks.push(<AssistantChart key={key} spec={spec} index={figure} />);
          continue;
        }
      }
      if (lang === "kpis") {
        const items = parseKpis(body.join("\n"));
        if (items) {
          blocks.push(<KpiStrip key={key} items={items} />);
          continue;
        }
      }
      blocks.push(
        <pre key={key} className="my-2 overflow-x-auto rounded-md border border-foreground/10 bg-foreground/[0.03] p-3 text-xs">
          {body.join("\n")}
        </pre>,
      );
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++]);
      const body = rows.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r));
      const [head, ...rest] = body.map(tableCells);
      blocks.push(
        <div key={key} className="my-2 overflow-x-auto rounded-md border border-foreground/10">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-foreground/[0.03] text-[11px] uppercase tracking-wide text-muted">
              <tr>
                {head?.map((c, j) => (
                  <th key={j} className="px-3 py-2 font-medium">
                    {inline(c, `${key}h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rest.map((r, ri) => (
                <tr key={ri} className="border-t border-foreground/[0.06]">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-2 tabular-nums">
                      {inline(c, `${key}r${ri}c${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key} className={`my-1.5 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item, j) => (
            <li key={j}>{inline(item, `${key}${j}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <h3
          key={key}
          className="mt-5 mb-1.5 border-b border-foreground/10 pb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground first:mt-0"
        >
          {inline(heading[2], key)}
        </h3>,
      );
      i++;
      continue;
    }
    blocks.push(
      <p key={key} className="my-1.5">
        {inline(line, key)}
      </p>,
    );
    i++;
  }
  return <div className="text-sm leading-relaxed">{blocks}</div>;
}

function AnswerToolbar({
  text,
  index,
  tenantSlug,
  orgName,
  question,
}: {
  text: string;
  index: number;
  tenantSlug: string;
  orgName: string;
  question: string;
}) {
  const csv = messageToCsv(text);
  const rich = Boolean(csv) || text.length > 400;
  if (!rich) return null;
  const stamp = new Date().toISOString().slice(0, 10);
  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-1.5 text-[11px] font-medium text-muted hover:bg-foreground/[0.06] hover:text-foreground";
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        className={btn}
        onClick={() => {
          const node = document.getElementById(`ask-ai-answer-${index}`);
          if (node) printReport(node, { orgName, question });
        }}
      >
        <FileText className="h-3 w-3" />
        Download PDF report
      </button>
      {csv ? (
        <button type="button" className={btn} onClick={() => downloadCsv(`ask-ai-${tenantSlug}-${stamp}.csv`, csv)}>
          <Download className="h-3 w-3" />
          Export data (CSV)
        </button>
      ) : null}
    </div>
  );
}

export function OrgAssistantChat({
  tenantSlug,
  orgName,
  userName,
  suggestions,
}: {
  tenantSlug: string;
  orgName: string;
  userName: string | null;
  suggestions: string[];
}) {
  const storageKey = `realcorp-ask-ai:${tenantSlug}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, storageKey]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    const next: Message[] = [...messages, { role: "user", text }];
    setMessages(next);
    setDraft("");
    setPending(true);
    try {
      const res = await fetch("/api/org-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          messages: next.filter((m) => !m.error).map(({ role, text: t }) => ({ role, text: t })),
        }),
      });
      const data = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
      setMessages((prev) => [
        ...prev,
        res.ok && data?.text
          ? { role: "assistant", text: data.text }
          : { role: "assistant", text: data?.error || "Ask AI could not answer right now.", error: true },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Network error. Please try again.", error: true }]);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(draft);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex min-h-full w-full flex-col px-4 sm:px-6">
      <div className="flex items-center justify-between gap-3 border-b border-foreground/10 py-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 bg-foreground/[0.04]">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">Ask AI</h1>
            <p className="text-xs text-muted">Reports, trends and analysis from {orgName}. Read only.</p>
          </div>
        </div>
        {!empty ? (
          <button
            type="button"
            onClick={() => setMessages([])}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-3 py-2 text-xs font-medium text-muted hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New chat
          </button>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 py-6">
        {empty ? (
          <div className="pt-10">
            <p className="text-xl font-semibold tracking-tight">
              {userName ? `Hi ${userName}, what would you like to know?` : "What would you like to know?"}
            </p>
            <p className="mt-1 text-sm text-muted">
              Ask for trends, charts, rankings or a period comparison. Export any table or chart as CSV.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3.5 py-3 text-left text-sm hover:bg-foreground/[0.05]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-foreground/15 bg-foreground/[0.04]">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <div className={`min-w-0 flex-1 ${m.error ? "text-red-600 dark:text-red-400" : ""}`}>
                    <div id={`ask-ai-answer-${i}`}>
                      <Markdown text={m.text} />
                    </div>
                    {!m.error ? (
                      <AnswerToolbar
                        text={m.text}
                        index={i}
                        tenantSlug={tenantSlug}
                        orgName={orgName}
                        question={[...messages.slice(0, i)].reverse().find((x) => x.role === "user")?.text ?? "Ask AI"}
                      />
                    ) : null}
                  </div>
                </div>
              ),
            )}
            {pending ? (
              <div className="flex items-center gap-2 pl-10 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Pulling figures and preparing your report. This takes 10–20 seconds…
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-foreground/10 bg-[var(--surface)] px-4 py-3 sm:-mx-6 sm:px-6">
        <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-3xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask about trends, revenue, leads, payroll, occupancy…"
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-lg border border-foreground/15 bg-[var(--elevated)] px-3.5 py-2.5 text-sm outline-none focus:border-foreground/40"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            aria-label="Send"
            className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-lg border border-foreground bg-foreground text-background disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </form>
        <p className="mx-auto mt-1.5 max-w-3xl text-[11px] text-muted">
          AI can make mistakes. Check key figures in the module before acting.
        </p>
      </div>
    </div>
  );
}
