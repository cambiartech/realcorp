import { escapeHtml, mailCard, mailDocument, mailParagraph } from "@/lib/mail-layout";

/** A small bunch in the Realcorp palette: sand, ink, copper. Inline so the preview does not depend on a host. */
const BALLOONS = `
<svg width="240" height="128" viewBox="0 0 240 128" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Balloons">
  <g fill="none" stroke="#c9c2b6" stroke-width="1.15" stroke-linecap="round">
    <path d="M78 96c6 8 22 18 42 24"/>
    <path d="M120 104v18"/>
    <path d="M162 96c-6 8-22 18-42 24"/>
  </g>
  <g transform="translate(46 14) rotate(-16 32 42)">
    <path fill="#c4a484" d="M32 2C14 4 2 26 6 52c3 18 14 28 26 36 12-8 24-18 28-36C66 24 50 0 32 2z"/>
    <ellipse fill="#ffffff" opacity="0.34" cx="18" cy="24" rx="7" ry="11" transform="rotate(-18 18 24)"/>
    <path fill="#a8663c" d="M27 86h10l-5 7z"/>
  </g>
  <g transform="translate(146 16) rotate(14 32 42)">
    <path fill="#16150f" stroke="#efe8df" stroke-width="2.2" d="M32 0C14 2 2 24 6 50c3 18 14 28 26 36 12-8 24-18 28-36C66 22 50-2 32 0z"/>
    <ellipse fill="#ffffff" opacity="0.16" cx="18" cy="22" rx="6" ry="10" transform="rotate(-16 18 22)"/>
    <path fill="#16150f" stroke="#efe8df" stroke-width="1.2" d="M27 84h10l-5 7z"/>
  </g>
  <g transform="translate(88 0)">
    <path fill="#a8663c" d="M32 0C12 2-2 28 4 58c4 20 16 30 28 40 12-10 26-20 30-40C70 26 52-2 32 0z"/>
    <ellipse fill="#ffffff" opacity="0.26" cx="18" cy="26" rx="8" ry="13" transform="rotate(-20 18 26)"/>
    <path fill="#7a4a2c" d="M26 96h12l-6 8z"/>
  </g>
</svg>
`;

export function birthdayCampaignHtml(input: {
  companyName: string;
  firstName: string;
  department?: string | null;
}) {
  const company = escapeHtml(input.companyName);
  const name = escapeHtml(input.firstName);
  const team = input.department?.trim();
  const care = team
    ? `Thank you for the care you give ${escapeHtml(team)}. It is the kind of work the rest of us rely on.`
    : `Thank you for the care you give this place. It is the kind of work the rest of us rely on.`;
  return mailDocument(
    mailCard({
      eyebrow: input.companyName,
      heading: `Happy birthday, ${input.firstName}`,
      headingSize: 36,
      ornament: BALLOONS,
      bodyHtml: [
        mailParagraph(care, true),
        mailParagraph(`We are glad you are at ${company}, ${name}. Enjoy your day.`),
      ].join(""),
    }),
  );
}

export function anniversaryCampaignHtml(input: { companyName: string; firstName: string; years: number }) {
  const company = escapeHtml(input.companyName);
  const name = escapeHtml(input.firstName);
  const yearsLabel = input.years === 1 ? "one year" : `${input.years} years`;
  const lead = `${yearsLabel.charAt(0).toUpperCase()}${yearsLabel.slice(1)}`;
  return mailDocument(
    mailCard({
      eyebrow: input.companyName,
      heading: `Happy anniversary, ${input.firstName}`,
      headingSize: 36,
      ornament: BALLOONS,
      bodyHtml: [
        mailParagraph(`${lead} with ${company}. That is worth celebrating.`, true),
        mailParagraph(`Thank you for the work you have put in, and for staying, ${name}.`),
      ].join(""),
    }),
  );
}
