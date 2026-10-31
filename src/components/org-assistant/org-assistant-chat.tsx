"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, Loader2, RotateCcw, Sparkles } from "lucide-react";

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

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;
    if (!line.trim()) {
      i++;
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
        <p key={key} className="mt-3 mb-1 font-semibold text-foreground">
          {inline(heading[2], key)}
        </p>,
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
            <p className="text-xs text-muted">Reports and analysis from {orgName} data. Read only.</p>
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
              Ask about sales, money, people, bookings or tasks. Answers use live figures from your workspace.
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
                    <Markdown text={m.text} />
                  </div>
                </div>
              ),
            )}
            {pending ? (
              <div className="flex items-center gap-2 pl-10 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking your data…
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
            placeholder="Ask about revenue, leads, payroll, occupancy…"
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
