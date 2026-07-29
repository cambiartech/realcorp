const fs = require("fs");
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun,
  LevelFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table,
  TableCell, TableRow, TextRun, VerticalAlign, WidthType, TableOfContents,
} = require("docx");
const C = require("./content");

/* ── Brand ─────────────────────────────────────────────────────── */
const INK = "16150F";
const COPPER = "A8663C";
const MUTED = "56524A";
const FAINT = "8B857B";
const LINE = "E3E0D9";
const WASH = "F7F1EA";
const CANVAS = "FAF9F6";

const SANS = "Calibri";          // ships with Word everywhere; Carlito is the metric-identical Linux substitute
const CONTENT_W = 9360;          // Letter, 1" margins

/* ── Helpers ───────────────────────────────────────────────────── */
const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
const cellBorders = (opts = {}) => ({
  top: opts.top || noBorder,
  bottom: opts.bottom || { style: BorderStyle.SINGLE, size: 2, color: LINE },
  left: noBorder,
  right: noBorder,
});

function t(text, o = {}) {
  return new TextRun({
    text,
    font: SANS,
    size: o.size || 20,           // half-points → 10pt
    bold: o.bold,
    italics: o.italics,
    color: o.color || INK,
    allCaps: o.caps,
    characterSpacing: o.spacing,
  });
}

function p(text, o = {}) {
  return new Paragraph({
    children: Array.isArray(text) ? text : [t(text, o)],
    spacing: { before: o.before ?? 0, after: o.after ?? 100, line: o.line ?? 264 },
    alignment: o.align,
    indent: o.indent,
    border: o.border,
    shading: o.shading,
  });
}

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [t(text, { size: 40, bold: true, color: INK })],
  spacing: { before: 120, after: 60 },
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [t(text, { size: 28, bold: true, color: INK })],
  spacing: { before: 280, after: 90 },
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [t(text, { size: 22, bold: true, color: COPPER })],
  spacing: { before: 200, after: 70 },
});

const eyebrow = (text) => new Paragraph({
  children: [t(text, { size: 15, bold: true, color: COPPER, caps: true, spacing: 40 })],
  spacing: { before: 0, after: 60 },
});

const lede = (text) => p(text, { size: 22, color: MUTED, after: 160, line: 288 });

const rule = () => new Paragraph({
  text: "",
  spacing: { before: 60, after: 160 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
});

const bullet = (text) => new Paragraph({
  children: [t(text, { color: MUTED })],
  numbering: { reference: "rc-bullets", level: 0 },
  spacing: { after: 70, line: 264 },
});

const numbered = (text, instance = 0) => new Paragraph({
  children: [t(text, { color: MUTED })],
  numbering: { reference: "rc-numbers", level: 0, instance },
  spacing: { after: 70, line: 264 },
});

/** Callout box — copper wash, used sparingly. */
function callout(label, text) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: COPPER },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COPPER },
      left: { style: BorderStyle.SINGLE, size: 12, color: COPPER },
      right: { style: BorderStyle.SINGLE, size: 2, color: COPPER },
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: WASH, color: "auto" },
        margins: { top: 140, bottom: 140, left: 200, right: 200 },
        children: [
          new Paragraph({ children: [t(label, { size: 15, bold: true, color: COPPER, caps: true, spacing: 40 })], spacing: { after: 60 } }),
          p(text, { color: MUTED, after: 0 }),
        ],
      })],
    })],
  });
}

/** Standard data table with a tinted header row. */
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cols = widths.map((w) => Math.round((w / total) * CONTENT_W));

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((htext, i) => new TableCell({
      width: { size: cols[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: CANVAS, color: "auto" },
      margins: { top: 95, bottom: 95, left: 130, right: 130 },
      borders: cellBorders({ bottom: { style: BorderStyle.SINGLE, size: 6, color: INK } }),
      children: [new Paragraph({
        children: [t(htext, { size: 15, bold: true, color: FAINT, caps: true, spacing: 30 })],
        spacing: { after: 0 },
      })],
    })),
  });

  const bodyRows = rows.map((r) => new TableRow({
    children: r.map((cell, i) => new TableCell({
      width: { size: cols[i], type: WidthType.DXA },
      margins: { top: 100, bottom: 100, left: 130, right: 130 },
      borders: cellBorders(),
      verticalAlign: VerticalAlign.TOP,
      children: [new Paragraph({
        children: [t(String(cell), { size: 18, color: i === 0 ? INK : MUTED, bold: i === 0 })],
        spacing: { after: 0, line: 260 },
      })],
    })),
  }));

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    borders: {
      top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: [headerRow, ...bodyRows],
  });
}

const spacer = (after = 140) => new Paragraph({ text: "", spacing: { after } });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

/* ── Cover ─────────────────────────────────────────────────────── */
const logo = fs.readFileSync("mark.png");

const cover = [
  new Paragraph({ text: "", spacing: { after: 1400 } }),
  new Paragraph({
    children: [new ImageRun({ data: logo, type: "png", transformation: { width: 78, height: 78 } })],
    spacing: { after: 320 },
  }),
  new Paragraph({
    children: [t("Welcome to", { size: 30, color: MUTED })],
    spacing: { after: 40 },
  }),
  new Paragraph({
    children: [t("Realcorp", { size: 88, bold: true, color: INK })],
    spacing: { after: 200 },
  }),
  new Paragraph({
    children: [t("Everything a real corporation runs on.", { size: 30, color: COPPER })],
    spacing: { after: 560 },
  }),
  rule(),
  p("A guide to the platform, the modules, and how each department gets started.", { size: 22, color: MUTED, after: 120 }),
  p("Sales · Finance · Operations · People · Marketing · Leadership", { size: 18, color: FAINT, after: 1600 }),
  new Paragraph({
    children: [
      t("PREPARED FOR", { size: 15, bold: true, color: FAINT, caps: true, spacing: 40 }),
    ],
    spacing: { after: 60 },
  }),
  new Paragraph({
    children: [t("__________________________________________", { size: 22, color: LINE })],
    spacing: { after: 320 },
  }),
  p("realcoerp.com · hello@realcoerp.com · Lagos · New York · Dubai", { size: 16, color: FAINT, after: 0 }),
  pageBreak(),
];

/* ── Contents ──────────────────────────────────────────────────── */
const contents = [
  eyebrow("Contents"),
  new Paragraph({ children: [t("What is in this guide", { size: 36, bold: true })], spacing: { after: 240 } }),
  table(
    ["Section", "What it covers"],
    [
      ["One · The idea", "Why one ledger instead of eleven tools, and how a lead becomes a payslip"],
      ["Two · The platform", "All nineteen modules, what each does, and which are optional"],
      ["Three · Your team", "Department-by-department onboarding: Sales, Finance, Operations, People, Marketing, Leadership"],
      ["Four · Access", "The eleven roles and what each can reach; the portals your buyers, partners and investors use"],
      ["Five · Onboarding", "Your first week, what data to bring, security and the audit trail, and common questions"],
    ],
    [26, 74],
  ),
  spacer(180),
  callout("How to use this guide", "Part one and part two are for whoever is deciding. Part three is written for the people who will actually use the platform — hand each department its own section. Nothing here assumes prior knowledge of Realcorp."),
  pageBreak(),
];

/* ── Part 1 — what Realcorp is ─────────────────────────────────── */
const part1 = [
  eyebrow("Part one · The idea"),
  h1("One ledger, not eleven tools"),
  lede("Most property businesses do not lack software. They have a CRM, a spreadsheet for unit inventory, an accounting package, a WhatsApp group and a separate HR tool — and each one holds a slightly different version of the same number."),
  p("That is where the work goes. Finance re-keys what Sales agreed. Nobody is certain which unit is actually available. Commission gets argued about after the fact. Month-end becomes four days of reconciliation instead of a review.", { color: MUTED }),
  p("Realcorp replaces that with a single record that every department reads and writes. A contract signed this morning becomes a locked unit, a payment schedule and a commission accrual before lunch — without anybody retyping anything.", { color: MUTED, after: 240 }),
  callout("Why the name", "Realcorp is short for real corporations — companies that build and sell real assets, as distinct from purely digital businesses. The platform is property-first because property is the hardest version of this problem: long-dated milestone payments, unit-level inventory, and commission splits. The same ledger runs any project-based corporation."),
  spacer(180),
  h2("The spine: a lead becomes a payslip"),
  lede("This is the whole product in one line. Each step inherits the previous step's numbers."),
  ...C.CHAIN.flatMap(([step, desc], i) => [
    new Paragraph({
      children: [
        t(String(i + 1).padStart(2, "0"), { size: 18, bold: true, color: COPPER }),
        t("   " + step, { size: 22, bold: true, color: INK }),
      ],
      spacing: { before: 160, after: 40 },
    }),
    p(desc, { color: MUTED, after: 0, indent: { left: 480 } }),
  ]),
  spacer(160),
  callout("What this means in practice", "There is one inventory record, one client record and one figure for what a deal is worth. When Sales reserves a unit, Finance sees it reserved. When Finance posts a payment, Sales sees the balance move. No exports, no reconciliation between systems, and no argument about which spreadsheet is current."),
  pageBreak(),
];

/* ── Part 2 — module map ───────────────────────────────────────── */
const part2 = [
  eyebrow("Part two · The platform"),
  h1("The modules"),
  lede("Nineteen modules, switched on per organisation. Several are off by default — you enable them the week you need them, not before. An empty module is worse than a hidden one."),
  table(
    ["Module", "What it is", "Who lives in it", "Default"],
    C.MODULES,
    [17, 44, 20, 19],
  ),
  spacer(160),
  callout("A note on scope", "Turning everything on at once is the most common onboarding mistake. Start with what your team already does today, get that working, and add modules as the need becomes real. Short Lets, People (HR), Clients and the Investor Portal are all off by default for exactly this reason."),
  pageBreak(),
];

/* ── Part 3 — departments ──────────────────────────────────────── */
const departmentSections = C.DEPARTMENTS.flatMap((d, idx) => {
  const blocks = [];
  if (idx === 0) {
    blocks.push(eyebrow("Part three · Getting your team started"));
    blocks.push(h1("Department by department"));
    blocks.push(lede("Each section below is written for the people who will actually use that part of the platform. Hand the relevant pages to the relevant team."));
    blocks.push(spacer(120));
  }
  blocks.push(h2(d.name + (d.optional ? "  (optional module)" : "")));
  blocks.push(new Paragraph({
    children: [t(d.roles, { size: 17, color: COPPER, bold: true })],
    spacing: { after: 120 },
  }));
  blocks.push(lede(d.lede));

  blocks.push(h3("What you will use"));
  blocks.push(table(["Where", "What it holds"], d.uses, [26, 74]));
  blocks.push(spacer(120));

  if (d.stages) {
    blocks.push(h3("Your pipeline stages"));
    blocks.push(p(d.stages.join("   →   "), { size: 18, color: MUTED, after: 200 }));
  }

  blocks.push(h3("Your first week"));
  blocks.push(...d.week.map((w) => numbered(w, idx)));
  blocks.push(spacer(100));

  blocks.push(h3("What you own"));
  blocks.push(...d.owns.map(bullet));
  blocks.push(spacer(100));

  blocks.push(callout("Worth knowing", d.note));
  blocks.push(pageBreak());
  return blocks;
});

/* ── Part 4 — access ───────────────────────────────────────────── */
const part4 = [
  eyebrow("Part four · Access"),
  h1("Roles, and what each one sees"),
  lede("A person's role decides which modules they can even reach. This is your access control — assign it deliberately."),
  table(["Role", "Reaches", "Typically"], C.ROLES, [22, 50, 28]),
  spacer(160),
  callout("Beyond the defaults", "Access can be granted per module on top of a role, so someone whose job does not fit a single role cleanly can still be handled properly. Investors and Listing Owners are deliberately confined to the investor portal — they never see your workspace."),
  pageBreak(),

  h1("The people outside your team"),
  lede("Realcorp reaches beyond your staff. These are the surfaces your buyers, partners, investors and new hires touch — most of them without needing an account."),
  table(["Surface", "Access", "Who", "What they see"], C.PORTALS, [18, 17, 19, 46]),
  spacer(160),
  callout("Why this matters", "Every one of these feeds the same ledger. A buyer enquiring on your Explore page, a realtor submitting through a partner link, and a rep typing a lead in by hand all produce the same kind of record — which is why attribution actually works."),
  pageBreak(),
];

/* ── Part 5 — starting ─────────────────────────────────────────── */
const part5 = [
  eyebrow("Part five · Onboarding"),
  h1("Your first week"),
  lede("Most organisations are live inside a week. Your existing project list, unit inventory, open deals and chart of accounts are migrated before the first training session — so day one is your real data, not a sandbox."),
  table(["When", "Who", "What happens"], C.WEEK_ONE, [16, 20, 64]),
  spacer(180),

  h2("What to bring"),
  table(["Data", "How", "Notes"], C.IMPORTS, [22, 24, 54]),
  spacer(160),
  callout("On imports", "Clients, leads and unit lists import from Excel or CSV with column mapping and a dry run — so you see exactly what will land before anything is written. Nothing is committed until you approve the preview."),
  pageBreak(),

  h1("Security and the audit trail"),
  lede("The reason finance teams trust a single ledger is that it can be proven."),
  h3("Tenant isolation"),
  p("Each organisation gets its own workspace and its own data boundary, enforced at the query layer rather than in the interface. Your data is not co-mingled with any other organisation's.", { color: MUTED }),
  h3("Role-scoped access"),
  p("Sign-in through your identity provider, with permissions scoped per module, per project and per desk. A sales executive cannot reach payroll.", { color: MUTED }),
  h3("An immutable audit trail"),
  p("Who changed what, when, and what it was before. Available throughout the product and exportable for any auditor who asks.", { color: MUTED }),
  h3("Your data stays yours"),
  p("Tables export to CSV, Excel and PDF throughout the product, and a full export is available on request. Encryption in transit and at rest.", { color: MUTED, after: 240 }),
  pageBreak(),

  h1("Questions people actually ask"),
  ...C.FAQ.flatMap(([q, a]) => [
    new Paragraph({ children: [t(q, { size: 21, bold: true, color: INK })], spacing: { before: 220, after: 60 } }),
    p(a, { color: MUTED, after: 0 }),
  ]),
  spacer(400),
  rule(),
  p("Realcorp", { size: 24, bold: true, after: 40 }),
  p("realcoerp.com  ·  hello@realcoerp.com", { size: 18, color: MUTED, after: 40 }),
  p("Lagos  ·  New York  ·  Dubai", { size: 16, color: FAINT, after: 0 }),
];

/* ── Document ──────────────────────────────────────────────────── */
const doc = new Document({
  creator: "Realcorp",
  title: "Welcome to Realcorp",
  description: "A guide to the platform, the modules, and how each department gets started.",
  styles: {
    default: {
      document: { run: { font: SANS, size: 20, color: INK } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: SANS, size: 40, bold: true, color: INK } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: SANS, size: 28, bold: true, color: INK } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: SANS, size: 22, bold: true, color: COPPER } },
    ],
  },
  numbering: {
    config: [
      { reference: "rc-bullets", levels: [{
        level: 0, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 340, hanging: 220 } }, run: { color: COPPER } },
      }] },
      { reference: "rc-numbers", levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 240 } }, run: { color: COPPER, bold: true } },
      }] },
    ],
  },
  features: { updateFields: true },
  sections: [
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      children: cover,
    },
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } },
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          children: [t("WELCOME TO REALCORP", { size: 14, color: FAINT, caps: true, spacing: 50 })],
          spacing: { after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: LINE } },
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            t("realcoerp.com", { size: 14, color: FAINT }),
            new TextRun({ text: "          ", font: SANS, size: 14 }),
            new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 14, color: MUTED, bold: true }),
          ],
        })] }),
      },
      children: [...contents, ...part1, ...part2, ...departmentSections, ...part4, ...part5],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("Welcome-to-Realcorp.docx", buf);
  console.log("wrote Welcome-to-Realcorp.docx", buf.length, "bytes");
});
