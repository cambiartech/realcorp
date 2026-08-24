function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function birthdayCampaignHtml(input: { companyName: string; firstName: string }) {
  const company = escapeHtml(input.companyName);
  const name = escapeHtml(input.firstName);
  return `
  <div style="margin:0;padding:24px;background:#0f172a;font-family:Georgia,'Times New Roman',serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:linear-gradient(160deg,#fb7185 0%,#f59e0b 55%,#fde68a 100%);border-radius:20px">
      <tr>
        <td style="padding:36px 32px 28px;text-align:center">
          <p style="margin:0;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#7c2d12;font-family:system-ui,sans-serif;font-weight:700">A note from ${company}</p>
          <p style="margin:18px 0 0;font-size:42px;line-height:1">🎂</p>
          <h1 style="margin:12px 0 0;font-size:32px;line-height:1.2;color:#431407">Happy Birthday, ${name}!</h1>
          <p style="margin:16px auto 0;max-width:420px;font-size:16px;line-height:1.55;color:#7c2d12">
            Today we celebrate you — the energy, care, and craft you bring to ${company}. Wishing you a year as bright as this one.
          </p>
          <p style="margin:22px 0 0;font-size:14px;color:#9a3412;font-family:system-ui,sans-serif">With love from all of us</p>
        </td>
      </tr>
    </table>
  </div>`;
}

export function anniversaryCampaignHtml(input: { companyName: string; firstName: string; years: number }) {
  const company = escapeHtml(input.companyName);
  const name = escapeHtml(input.firstName);
  const yearsLabel = input.years === 1 ? "1 year" : `${input.years} years`;
  return `
  <div style="margin:0;padding:24px;background:#0f172a;font-family:Georgia,'Times New Roman',serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:linear-gradient(165deg,#0f766e 0%,#1d4ed8 50%,#c4b5fd 100%);border-radius:20px">
      <tr>
        <td style="padding:36px 32px 28px;text-align:center">
          <p style="margin:0;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#e0e7ff;font-family:system-ui,sans-serif;font-weight:700">${company}</p>
          <p style="margin:18px 0 0;font-size:42px;line-height:1">✨</p>
          <h1 style="margin:12px 0 0;font-size:30px;line-height:1.25;color:#fff">Happy work anniversary, ${name}</h1>
          <p style="margin:14px 0 0;display:inline-block;background:rgba(255,255,255,0.16);color:#fff;font-family:system-ui,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.08em;padding:6px 12px;border-radius:999px">${yearsLabel} with us</p>
          <p style="margin:16px auto 0;max-width:420px;font-size:16px;line-height:1.55;color:#eef2ff">
            Thank you for building with us. Your chapter at ${company} matters — here is to the next one.
          </p>
        </td>
      </tr>
    </table>
  </div>`;
}
