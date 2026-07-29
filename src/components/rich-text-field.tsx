"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { plainTextToRichHtml, sanitizeRichTextHtml } from "@/lib/rich-text-sanitize";

type RichTextFieldProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
  className?: string;
  label?: string;
  hint?: string;
};

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function RichTextField({
  name,
  defaultValue = "",
  placeholder,
  readOnly = false,
  minHeight = "6rem",
  className = "",
  label,
  hint,
}: RichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initialHtml = plainTextToRichHtml(defaultValue);
  const [html, setHtml] = useState(initialHtml);

  const syncFromEditor = useCallback(() => {
    const raw = editorRef.current?.innerHTML ?? "";
    setHtml(sanitizeRichTextHtml(raw));
  }, []);

  useEffect(() => {
    if (readOnly || !editorRef.current) return;
    if (!editorRef.current.innerHTML && initialHtml) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [initialHtml, readOnly]);

  return (
    <div className={className}>
      {label ? <span className="mb-1 block text-xs font-medium text-muted">{label}</span> : null}
      {hint ? <p className="mb-1.5 text-xs text-muted">{hint}</p> : null}
      {!readOnly ? (
        <div className="mb-1 flex flex-wrap gap-0.5 rounded-t-md border border-b-0 border-foreground/15 bg-foreground/[0.03] p-1">
          {(
            [
              ["bold", "B", "font-bold"],
              ["italic", "I", "italic"],
              ["underline", "U", "underline"],
            ] as const
          ).map(([cmd, labelText, cls]) => (
            <button
              key={cmd}
              type="button"
              className={`min-w-[1.75rem] rounded px-1.5 py-0.5 text-xs hover:bg-foreground/10 ${cls}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editorRef.current?.focus();
                exec(cmd);
                syncFromEditor();
              }}
            >
              {labelText}
            </button>
          ))}
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-xs hover:bg-foreground/10"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editorRef.current?.focus();
              exec("insertUnorderedList");
              syncFromEditor();
            }}
          >
            • List
          </button>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-xs hover:bg-foreground/10"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editorRef.current?.focus();
              exec("insertOrderedList");
              syncFromEditor();
            }}
          >
            1. List
          </button>
        </div>
      ) : null}
      {readOnly ? (
        <RichTextDisplay
          html={html}
          className="rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={syncFromEditor}
          onBlur={syncFromEditor}
          className="rich-text-field w-full rounded-b-md rounded-t-none border border-foreground/15 bg-field px-3 py-2 text-sm outline-none focus:border-foreground/30"
          style={{ minHeight }}
        />
      )}
      <input type="hidden" name={name} value={html} readOnly />
    </div>
  );
}

export function RichTextDisplay({ html, className = "" }: { html: string; className?: string }) {
  if (!html?.trim()) return <p className={`text-sm text-muted ${className}`}>—</p>;
  return (
    <div
      className={`prose prose-sm max-w-none text-sm text-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}
    />
  );
}
