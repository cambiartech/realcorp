import { offerLetterBody, type OfferLetterFields } from "@/lib/offer-letter";

/** Plain-text template → simple HTML for contenteditable editing. */
export function offerLetterBodyToHtml(body: string): string {
  const blocks = body.split("\n\n");
  return blocks
    .map((block) => {
      if (block.startsWith("•")) {
        const items = block
          .split("\n")
          .map((line) => `<li>${escapeHtml(line.replace(/^•\s*/, ""))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}

export function defaultOfferLetterHtml(fields: OfferLetterFields, companyName: string): string {
  return offerLetterBodyToHtml(offerLetterBody(fields, companyName));
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Strip scripts; keep basic formatting from contenteditable. */
export function sanitizeOfferLetterHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .trim();
}
