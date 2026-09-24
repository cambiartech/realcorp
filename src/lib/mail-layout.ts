export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const MAIL_SERIF = "'Fraunces', 'Iowan Old Style', Palatino, 'Palatino Linotype', Georgia, serif";
export const MAIL_SANS = "'Source Sans 3', 'Avenir Next', system-ui, -apple-system, Segoe UI, sans-serif";

const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
`;

export function mailDocument(inner: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${FONT_LINKS}
</head>
<body style="margin:0;padding:0;background:#fafaf9">
  ${inner}
</body>
</html>`;
}

export function mailParagraph(text: string, first = false) {
  return `<p style="margin:${first ? "0" : "14px"} 0 0;font-family:${MAIL_SANS};font-size:16px;line-height:1.6;color:#3f3d38">${text}</p>`;
}

export function mailButton(href: string, label: string) {
  const url = escapeHtml(href);
  return `<p style="margin:22px 0 0">
    <a href="${url}" style="display:inline-block;background:#16150f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-family:${MAIL_SANS};font-size:14px;font-weight:600;">${escapeHtml(label)}</a>
  </p>`;
}

export function mailNote(text: string) {
  return `<p style="margin:14px 0 0;font-family:${MAIL_SANS};font-size:13px;line-height:1.5;color:#6b6862">${text}</p>`;
}

export function mailLinkFallback(href: string) {
  const url = escapeHtml(href);
  return `${mailNote("Or paste this link into your browser.")}
    <p style="margin:8px 0 0;font-family:${MAIL_SANS};font-size:13px;line-height:1.5;word-break:break-all;color:#6b6862">${url}</p>`;
}

export function mailCard(input: {
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  ornament?: string;
  ornamentBleed?: boolean;
  headingSize?: number;
}) {
  const headingSize = input.headingSize ?? 28;
  const ornamentCell = input.ornament
    ? input.ornamentBleed
      ? `<tr><td style="padding:0;line-height:0;font-size:0;border-radius:16px 16px 0 0">${input.ornament}</td></tr>`
      : `<tr><td align="center" style="padding:28px 32px 0">${input.ornament}</td></tr>`
    : "";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9">
    <tr>
      <td align="center" style="padding:36px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid rgba(22,21,15,0.08);border-radius:16px">
          ${ornamentCell}
          <tr>
            <td style="padding:${input.ornament ? "18px" : "32px"} 36px 0;font-family:${MAIL_SANS};font-size:13px;font-weight:600;letter-spacing:0.04em;color:#a8663c">${escapeHtml(input.eyebrow)}</td>
          </tr>
          <tr>
            <td style="padding:10px 36px 0;font-family:${MAIL_SERIF};font-size:${headingSize}px;line-height:1.15;font-weight:500;letter-spacing:-0.02em;color:#16150f">${escapeHtml(input.heading)}</td>
          </tr>
          <tr>
            <td style="padding:16px 36px 32px">${input.bodyHtml}</td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:${MAIL_SANS};font-size:12px;line-height:1.4;color:#9c988f">Sent from Realcorp</p>
      </td>
    </tr>
  </table>`;
}
