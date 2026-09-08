/**
 * Generates Realcorp SaaS + Shortlets unit economics workbook.
 * Run: npx tsx scripts/generate-unit-economics-xlsx.ts
 */
import ExcelJS from "exceljs";
import path from "path";

const OUT = path.join(
  process.cwd(),
  "docs",
  "Realcorp-Unit-Economics.xlsx",
);

const NGN = '"₦"#,##0';
const NGN2 = '"₦"#,##0.00';
const PCT = "0.0%";
const NUM = "#,##0.00";

type Cell = string | number | boolean | Date | null;

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Realcorp";
  wb.created = new Date();

  addReadMe(wb);
  addAssumptions(wb);
  addPlanEconomics(wb);
  addShortlets(wb);
  addCustomerLtv(wb);
  addScenarioMix(wb);
  addSensitivity(wb);
  addCashflow(wb);
  addClaudePrompt(wb);

  await wb.xlsx.writeFile(OUT);
  console.log(`Wrote ${OUT}`);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.alignment = { vertical: "middle", wrapText: true };
}

function autosize(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function addInputLabel(ws: ExcelJS.Worksheet, r: number, label: string, value: Cell, note?: string) {
  ws.getCell(r, 1).value = label;
  ws.getCell(r, 2).value = value;
  if (note) ws.getCell(r, 3).value = note;
  ws.getCell(r, 2).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF7ED" },
  };
}

function addReadMe(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("00_ReadMe", { views: [{ showGridLines: false }] });
  autosize(ws, [28, 80]);
  const lines: Array<[string, string]> = [
    ["Realcorp Unit Economics", "SaaS + Shortlets + WhatsApp booking take-rate model"],
    ["Currency", "All figures in Nigerian Naira (₦) unless noted"],
    ["How to use", "1) Edit yellow/orange INPUT cells on Assumptions. 2) Review Plan_Economics, Shortlets, LTV. 3) Change Scenario_Mix for portfolio view."],
    ["Do not edit", "Blue/formula columns — they recalculate from Assumptions"],
    ["Pricing thesis", "Base SaaS (org) + seats + per shortlet LOCATION + % take-rate only when Realcorp/WhatsApp books or collects payment"],
    ["Plans", "STARTER / GROWTH / ENTERPRISE (matches TenantPlan in product)"],
    ["Shortlets meter", "Bill ShortletProperty (location), not every unit/room"],
    ["Offline cash", "0% take-rate by default — do not tax walk-in cash outside your rails"],
    ["Version", new Date().toISOString().slice(0, 10)],
  ];
  lines.forEach(([a, b], i) => {
    ws.getCell(i + 1, 1).value = a;
    ws.getCell(i + 1, 2).value = b;
    ws.getCell(i + 1, 1).font = { bold: true };
  });
  ws.getCell(1, 1).font = { bold: true, size: 16 };
}

function addAssumptions(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("01_Assumptions");
  autosize(ws, [42, 18, 55]);

  ws.getCell(1, 1).value = "ASSUMPTIONS — edit yellow cells";
  ws.getCell(1, 1).font = { bold: true, size: 14 };

  // Section: Company / COGS
  let r = 3;
  ws.getCell(r, 1).value = "A. Platform & delivery cost (monthly, allocated)";
  ws.getCell(r, 1).font = { bold: true };
  r = 4;
  const costRows: Array<[string, number, string, string]> = [
    ["Infra_Netlify_DB_CDN", 120_000, "Hosting, Postgres, CDN, email", "B4"],
    ["AI_base_Gemini", 40_000, "Base AI API budget before overage", "B5"],
    ["Support_ops_salary_alloc", 350_000, "CS / onboarding slice (1 FTE partial)", "B6"],
    ["Payment_rail_fixed", 15_000, "Paystack/tools fixed monthly", "B7"],
    ["Other_tools", 50_000, "Monitoring, analytics, design tools", "B8"],
  ];
  // We'll place at fixed rows 4-8
  addInputLabel(ws, 4, "Infra (Netlify/DB/CDN)", 120_000, "Hosting, Postgres, CDN, email");
  addInputLabel(ws, 5, "AI base (Gemini budget)", 40_000, "Before metered overage");
  addInputLabel(ws, 6, "Support / CS allocation", 350_000, "Partial FTE + WhatsApp support");
  addInputLabel(ws, 7, "Payment tools fixed", 15_000, "Paystack dashboard etc.");
  addInputLabel(ws, 8, "Other SaaS tools", 50_000, "Sentry, analytics, design");
  ws.getCell(9, 1).value = "Total fixed monthly OpEx (platform)";
  ws.getCell(9, 2).value = { formula: "B4+B5+B6+B7+B8" };
  ws.getCell(9, 1).font = { bold: true };
  [4, 5, 6, 7, 8, 9].forEach((row) => {
    ws.getCell(row, 2).numFmt = NGN;
  });

  ws.getCell(11, 1).value = "B. Variable cost per active org / month";
  ws.getCell(11, 1).font = { bold: true };
  addInputLabel(ws, 12, "COGS_per_org_base", 8_000, "DB/storage/support load per tenant");
  addInputLabel(ws, 13, "COGS_per_extra_seat", 500, "Marginal cost per seat");
  addInputLabel(ws, 14, "COGS_per_shortlet_location", 2_500, "Hosting/ops per active location");
  addInputLabel(ws, 15, "COGS_AI_per_doc_extract", 80, "Gemini cost per successful extract");
  addInputLabel(ws, 16, "Paystack_percent", 0.015, "Payment processor % (illustrative)");
  addInputLabel(ws, 17, "Paystack_flat", 100, "Flat fee per txn if any");
  [12, 13, 14, 15, 17].forEach((row) => (ws.getCell(row, 2).numFmt = NGN));
  ws.getCell(16, 2).numFmt = PCT;

  ws.getCell(19, 1).value = "C. SaaS list prices (monthly)";
  ws.getCell(19, 1).font = { bold: true };
  addInputLabel(ws, 20, "Starter_price", 90_000, "5 seats included");
  addInputLabel(ws, 21, "Growth_price", 225_000, "15 seats — recommended default");
  addInputLabel(ws, 22, "Enterprise_price", 500_000, "40 seats");
  addInputLabel(ws, 23, "Extra_seat_Starter", 8_000, "");
  addInputLabel(ws, 24, "Extra_seat_Growth", 7_000, "");
  addInputLabel(ws, 25, "Extra_seat_Enterprise", 5_000, "");
  addInputLabel(ws, 26, "Seats_incl_Starter", 5, "");
  addInputLabel(ws, 27, "Seats_incl_Growth", 15, "");
  addInputLabel(ws, 28, "Seats_incl_Enterprise", 40, "");
  [20, 21, 22, 23, 24, 25].forEach((row) => (ws.getCell(row, 2).numFmt = NGN));

  ws.getCell(30, 1).value = "D. Shortlets pricing";
  ws.getCell(30, 1).font = { bold: true };
  addInputLabel(ws, 31, "Shortlets_addon_monthly", 70_000, "Module access; includes N locations");
  addInputLabel(ws, 32, "Locations_included", 2, "In shortlets add-on");
  addInputLabel(ws, 33, "Extra_location_monthly", 20_000, "Per ShortletProperty beyond included");
  addInputLabel(ws, 34, "Take_rate_checkout", 0.03, "% when paid via Realcorp checkout");
  addInputLabel(ws, 35, "Take_rate_whatsapp", 0.04, "% when booked via WhatsApp agent then paid");
  addInputLabel(ws, 36, "Take_rate_offline", 0, "% walk-in cash outside rails");
  addInputLabel(ws, 37, "Pass_through_paystack", 1, "1=subtract processor from your take, 0=customer pays processor");
  [31, 33].forEach((row) => (ws.getCell(row, 2).numFmt = NGN));
  [34, 35, 36].forEach((row) => (ws.getCell(row, 2).numFmt = PCT));

  ws.getCell(39, 1).value = "E. Sales & retention assumptions";
  ws.getCell(39, 1).font = { bold: true };
  addInputLabel(ws, 40, "CAC_blended", 180_000, "Sales+ads+founder time per won logo");
  addInputLabel(ws, 41, "Setup_fee_avg", 250_000, "One-time implementation (avg)");
  addInputLabel(ws, 42, "Setup_delivery_cost", 80_000, "Your cost to onboard (hours)");
  addInputLabel(ws, 43, "Gross_margin_target", 0.75, "Target contribution margin");
  addInputLabel(ws, 44, "Monthly_churn_Starter", 0.05, "5% MoM");
  addInputLabel(ws, 45, "Monthly_churn_Growth", 0.03, "");
  addInputLabel(ws, 46, "Monthly_churn_Enterprise", 0.015, "");
  addInputLabel(ws, 47, "Annual_discount", 0.1667, "~2 months free if paid annually");
  addInputLabel(ws, 48, "Collection_rate", 0.95, "% invoices actually collected");
  [40, 41, 42].forEach((row) => (ws.getCell(row, 2).numFmt = NGN));
  [43, 44, 45, 46, 47, 48].forEach((row) => (ws.getCell(row, 2).numFmt = PCT));

  ws.getCell(50, 1).value = "F. Typical customer usage profiles (for LTV sheets)";
  ws.getCell(50, 1).font = { bold: true };
  addInputLabel(ws, 51, "Avg_seats_Starter", 5, "");
  addInputLabel(ws, 52, "Avg_seats_Growth", 12, "");
  addInputLabel(ws, 53, "Avg_seats_Enterprise", 35, "");
  addInputLabel(ws, 54, "Shortlet_locations_typ", 3, "Typical Growth shortlet customer");
  addInputLabel(ws, 55, "GMV_monthly_typ", 4_500_000, "Gross booking value / mo via PMS");
  addInputLabel(ws, 56, "Pct_GMV_via_checkout", 0.35, "Paid on Realcorp link");
  addInputLabel(ws, 57, "Pct_GMV_via_whatsapp", 0.25, "WhatsApp-originated");
  addInputLabel(ws, 58, "Pct_GMV_offline", 0.4, "Cash/transfer offline");
  addInputLabel(ws, 59, "AI_docs_per_mo_Growth", 20, "Doc extracts / month");
  ws.getCell(55, 2).numFmt = NGN;
  [56, 57, 58].forEach((row) => (ws.getCell(row, 2).numFmt = PCT));

  ws.getCell(61, 1).value = "Named ranges reference (for formulas on other sheets)";
  ws.getCell(61, 3).value = "Yellow cells = INPUTS. Change these to stress-test.";
  ws.getCell(61, 3).font = { italic: true, color: { argb: "FFB45309" } };
}

function addPlanEconomics(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("02_Plan_Economics");
  autosize(ws, [28, 16, 16, 16, 18]);

  ws.getCell(1, 1).value = "Monthly unit economics by plan (typical seat counts)";
  ws.getCell(1, 1).font = { bold: true, size: 13 };

  const headers = ["Metric", "Starter", "Growth", "Enterprise", "Notes"];
  headers.forEach((h, i) => {
    ws.getCell(3, i + 1).value = h;
  });
  styleHeader(ws.getRow(3));

  // Row helpers referencing Assumptions sheet
  const A = "01_Assumptions";
  const rows: Array<[string, string, string, string, string]> = [
    [
      "List price (base)",
      `=${A}!B20`,
      `=${A}!B21`,
      `=${A}!B22`,
      "Monthly SaaS",
    ],
    [
      "Seats used (typical)",
      `=${A}!B51`,
      `=${A}!B52`,
      `=${A}!B53`,
      "",
    ],
    [
      "Seats included",
      `=${A}!B26`,
      `=${A}!B27`,
      `=${A}!B28`,
      "",
    ],
    [
      "Extra seats",
      "=MAX(0,B5-B6)",
      "=MAX(0,C5-C6)",
      "=MAX(0,D5-D6)",
      "",
    ],
    [
      "Extra seat revenue",
      `=B7*${A}!B23`,
      `=C7*${A}!B24`,
      `=D7*${A}!B25`,
      "",
    ],
    [
      "SaaS revenue (mo)",
      "=B4+B8",
      "=C4+C8",
      "=D4+D8",
      "Before shortlets",
    ],
    [
      "Collected SaaS (mo)",
      `=B9*${A}!B48`,
      `=C9*${A}!B48`,
      `=D9*${A}!B48`,
      "After collection rate",
    ],
    [
      "COGS: base org",
      `=${A}!B12`,
      `=${A}!B12`,
      `=${A}!B12`,
      "",
    ],
    [
      "COGS: seats",
      `=B5*${A}!B13`,
      `=C5*${A}!B13`,
      `=D5*${A}!B13`,
      "",
    ],
    [
      "COGS: AI (Growth+)",
      "0",
      `=${A}!B59*${A}!B15`,
      `=${A}!B59*${A}!B15*1.5`,
      "Enterprise uses more AI",
    ],
    [
      "Total variable COGS",
      "=B11+B12+B13",
      "=C11+C12+C13",
      "=D11+D12+D13",
      "",
    ],
    [
      "Contribution (₦)",
      "=B10-B14",
      "=C10-C14",
      "=D10-D14",
      "Before fixed OpEx allocation",
    ],
    [
      "Contribution margin %",
      "=IF(B10=0,0,B15/B10)",
      "=IF(C10=0,0,C15/C10)",
      "=IF(D10=0,0,D15/D10)",
      "Target ~75%",
    ],
    [
      "vs margin target",
      `=B16-${A}!B43`,
      `=C16-${A}!B43`,
      `=D16-${A}!B43`,
      "Positive = beating target",
    ],
  ];

  rows.forEach((row, idx) => {
    const r = 4 + idx;
    row.forEach((val, c) => {
      const cell = ws.getCell(r, c + 1);
      if (typeof val === "string" && val.startsWith("=")) cell.value = { formula: val.slice(1) };
      else cell.value = val;
    });
  });

  // number formats
  for (const r of [4, 8, 9, 10, 11, 12, 13, 14, 15]) {
    for (const c of [2, 3, 4]) ws.getCell(r, c).numFmt = NGN;
  }
  for (const r of [16, 17]) {
    for (const c of [2, 3, 4]) ws.getCell(r, c).numFmt = PCT;
  }

  ws.getCell(20, 1).value = "Interpretation";
  ws.getCell(20, 1).font = { bold: true };
  ws.getCell(21, 1).value =
    "Growth should be your volume plan: high contribution, seats under included limit, HR/AI attached. Starter is acquisition; Enterprise is margin + expansion.";
  ws.mergeCells(21, 1, 21, 5);
}

function addShortlets(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("03_Shortlets");
  autosize(ws, [40, 18, 50]);
  const A = "01_Assumptions";

  ws.getCell(1, 1).value = "Shortlets: location fee + take-rate unit economics";
  ws.getCell(1, 1).font = { bold: true, size: 13 };

  ws.getCell(3, 1).value = "Revenue build (typical shortlet customer on Growth)";
  ws.getCell(3, 1).font = { bold: true };

  const lines: Array<[string, string, string]> = [
    ["Shortlets add-on", `=${A}!B31`, "Module fee"],
    ["Locations typical", `=${A}!B54`, ""],
    ["Locations included", `=${A}!B32`, ""],
    ["Billable extra locations", "=MAX(0,B5-B6)", ""],
    ["Location revenue", `=B7*${A}!B33`, ""],
    ["Subscription shortlets total", "=B4+B8", "Add-on + locations"],
    ["GMV monthly", `=${A}!B55`, "Gross booking value"],
    ["GMV via checkout", `=B10*${A}!B56`, ""],
    ["GMV via WhatsApp", `=B10*${A}!B57`, ""],
    ["GMV offline", `=B10*${A}!B58`, "0% take by default"],
    ["Take-rate revenue checkout", `=B11*${A}!B34`, ""],
    ["Take-rate revenue WhatsApp", `=B12*${A}!B35`, ""],
    ["Take-rate revenue offline", `=B13*${A}!B36`, ""],
    ["Gross take-rate revenue", "=B14+B15+B16", ""],
    [
      "Processor cost on in-rail GMV",
      `=(B11+B12)*${A}!B16+((B11+B12)/50000)*${A}!B17`,
      "Rough: % + flat per ~₦50k txn chunks",
    ],
    [
      "Net take-rate (if pass-through on)",
      `=IF(${A}!B37=1,B17-B18,B17)`,
      "If pass_through=1, subtract Paystack from your cut",
    ],
    ["Total shortlets revenue (mo)", "=B9+B19", "Sub + net take"],
    ["COGS locations", `=B5*${A}!B14`, ""],
    ["Contribution shortlets", "=B20-B21", ""],
    ["Shortlets contribution margin", "=IF(B20=0,0,B22/B20)", ""],
  ];

  // Place starting row 4 — but formulas reference B4 etc so need careful row mapping
  // Recalculate: row 4 = first metric
  const metrics: Array<[string, string, string]> = [
    ["Shortlets add-on", `=${A}!B31`, "Module fee"], // B4
    ["Locations typical", `=${A}!B54`, ""], // B5
    ["Locations included", `=${A}!B32`, ""], // B6
    ["Billable extra locations", "=MAX(0,B5-B6)", ""], // B7
    ["Location revenue", `=B7*${A}!B33`, ""], // B8
    ["Subscription shortlets total", "=B4+B8", "Add-on + locations"], // B9
    ["GMV monthly", `=${A}!B55`, "Gross booking value"], // B10
    ["GMV via checkout", `=B10*${A}!B56`, ""], // B11
    ["GMV via WhatsApp", `=B10*${A}!B57`, ""], // B12
    ["GMV offline", `=B10*${A}!B58`, "0% take"], // B13
    ["Take revenue checkout", `=B11*${A}!B34`, ""], // B14
    ["Take revenue WhatsApp", `=B12*${A}!B35`, ""], // B15
    ["Take revenue offline", `=B13*${A}!B36`, ""], // B16
    ["Gross take-rate revenue", "=B14+B15+B16", ""], // B17
    [
      "Processor cost (in-rail)",
      `=(B11+B12)*${A}!B16`,
      "Paystack % on checkout+WA GMV (simplify flat)",
    ], // B18
    [
      "Net take-rate",
      `=IF(${A}!B37=1,MAX(0,B17-B18),B17)`,
      "",
    ], // B19
    ["Total shortlets revenue", "=B9+B19", ""], // B20
    ["COGS locations", `=B5*${A}!B14`, ""], // B21
    ["Contribution ₦", "=B20-B21", ""], // B22
    ["Contribution margin %", "=IF(B20=0,0,B22/B20)", ""], // B23
  ];

  ws.getCell(3, 1).value = "Metric";
  ws.getCell(3, 2).value = "Value";
  ws.getCell(3, 3).value = "Notes";
  styleHeader(ws.getRow(3));

  metrics.forEach((m, i) => {
    const r = 4 + i;
    ws.getCell(r, 1).value = m[0];
    ws.getCell(r, 2).value = { formula: m[1].slice(1) };
    ws.getCell(r, 3).value = m[2];
  });

  for (let r = 4; r <= 22; r++) {
    if (![5, 6, 7].includes(r)) ws.getCell(r, 2).numFmt = NGN;
  }
  ws.getCell(5, 2).numFmt = NUM;
  ws.getCell(6, 2).numFmt = NUM;
  ws.getCell(7, 2).numFmt = NUM;
  ws.getCell(23, 2).numFmt = PCT;

  ws.getCell(26, 1).value = "Blended take-rate on total GMV";
  ws.getCell(26, 2).value = { formula: "IF(B10=0,0,B17/B10)" };
  ws.getCell(26, 2).numFmt = PCT;
  ws.getCell(26, 3).value = "Should land ~1.5–2.5% of all GMV if mix is 35/25/40";

  ws.getCell(28, 1).value = "Effective platform fee on in-rail only";
  ws.getCell(28, 2).value = { formula: "IF((B11+B12)=0,0,B17/(B11+B12))" };
  ws.getCell(28, 2).numFmt = PCT;

  ws.getCell(30, 1).value = "Decision checks";
  ws.getCell(30, 1).font = { bold: true };
  ws.getCell(31, 1).value =
    "If contribution margin on shortlets < 60%, raise location fee or take-rate — or cut included locations.";
  ws.getCell(32, 1).value =
    "If blended take on total GMV > 4%, operators will push bookings offline — rebalance mix incentives.";
  ws.mergeCells(31, 1, 31, 3);
  ws.mergeCells(32, 1, 32, 3);
}

function addCustomerLtv(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("04_Customer_LTV");
  autosize(ws, [32, 16, 16, 16, 40]);
  const A = "01_Assumptions";

  ws.getCell(1, 1).value = "Customer LTV / CAC (SaaS only, then with Shortlets)";
  ws.getCell(1, 1).font = { bold: true, size: 13 };

  const headers = ["Metric", "Starter", "Growth", "Growth+Shortlets", "Notes"];
  headers.forEach((h, i) => (ws.getCell(3, i + 1).value = h));
  styleHeader(ws.getRow(3));

  // Pull contribution from plan sheet and shortlets
  const rows: Array<[string, string, string, string, string]> = [
    [
      "Monthly contribution",
      "='02_Plan_Economics'!B15",
      "='02_Plan_Economics'!C15",
      "='02_Plan_Economics'!C15+'03_Shortlets'!B22",
      "After variable COGS",
    ],
    [
      "Monthly churn",
      `=${A}!B44`,
      `=${A}!B45`,
      `=${A}!B45`,
      "Shortlets assumed same churn as Growth",
    ],
    [
      "Expected lifetime (months)",
      "=IF(B5=0,0,1/B5)",
      "=IF(C5=0,0,1/C5)",
      "=IF(D5=0,0,1/D5)",
      "1/churn",
    ],
    [
      "LTV (contribution)",
      "=B4*B6",
      "=C4*C6",
      "=D4*D6",
      "Simple undiscounted",
    ],
    [
      "Setup fee contribution",
      `=${A}!B41-${A}!B42`,
      `=${A}!B41-${A}!B42`,
      `=${A}!B41-${A}!B42`,
      "One-time",
    ],
    ["LTV + setup", "=B7+B8", "=C7+C8", "=D7+D8", ""],
    ["CAC", `=${A}!B40`, `=${A}!B40`, `=${A}!B40`, "Blended"],
    ["LTV:CAC", "=IF(B10=0,0,B9/B10)", "=IF(C10=0,0,C9/C10)", "=IF(D10=0,0,D9/D10)", "Target ≥ 3x"],
    [
      "Months to recover CAC",
      "=IF(B4=0,0,B10/B4)",
      "=IF(C4=0,0,C10/C4)",
      "=IF(D4=0,0,D10/D4)",
      "Payback (months)",
    ],
    [
      "Healthy?",
      '=IF(AND(B11>=3,B12<=6),"YES","REVIEW")',
      '=IF(AND(C11>=3,C12<=6),"YES","REVIEW")',
      '=IF(AND(D11>=3,D12<=6),"YES","REVIEW")',
      "LTV:CAC≥3 and payback≤6",
    ],
  ];

  rows.forEach((row, idx) => {
    const r = 4 + idx;
    row.forEach((val, c) => {
      const cell = ws.getCell(r, c + 1);
      if (typeof val === "string" && val.startsWith("=")) cell.value = { formula: val.slice(1) };
      else cell.value = val;
    });
  });

  for (const r of [4, 7, 8, 9, 10]) {
    for (const c of [2, 3, 4]) ws.getCell(r, c).numFmt = NGN;
  }
  ws.getCell(5, 2).numFmt = PCT;
  ws.getCell(5, 3).numFmt = PCT;
  ws.getCell(5, 4).numFmt = PCT;
  for (const c of [2, 3, 4]) {
    ws.getCell(6, c).numFmt = NUM;
    ws.getCell(11, c).numFmt = NUM;
    ws.getCell(12, c).numFmt = NUM;
  }

  ws.getCell(16, 1).value = "Rule of thumb";
  ws.getCell(16, 1).font = { bold: true };
  ws.getCell(17, 1).value =
    "If Growth LTV:CAC < 3x, raise price or cut CAC (founder-led sales) before scaling ads. Shortlets take-rate is what makes Growth+Shortlets clearly >3x.";
  ws.mergeCells(17, 1, 17, 5);
}

function addScenarioMix(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("05_Portfolio_Mix");
  autosize(ws, [28, 14, 16, 16, 16, 18]);
  const A = "01_Assumptions";

  ws.getCell(1, 1).value = "Portfolio mix — edit customer counts (yellow)";
  ws.getCell(1, 1).font = { bold: true, size: 13 };

  ["Segment", "Count", "ARPU contrib/mo", "Segment contrib", "% of logos", "Notes"].forEach(
    (h, i) => (ws.getCell(3, i + 1).value = h),
  );
  styleHeader(ws.getRow(3));

  // Inputs for counts
  ws.getCell(4, 1).value = "Starter";
  ws.getCell(4, 2).value = 8;
  ws.getCell(4, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
  ws.getCell(4, 3).value = { formula: "'02_Plan_Economics'!B15" };
  ws.getCell(4, 4).value = { formula: "B4*C4" };
  ws.getCell(4, 5).value = { formula: "IF(SUM($B$4:$B$7)=0,0,B4/SUM($B$4:$B$7))" };
  ws.getCell(4, 6).value = "Acquisition wedge";

  ws.getCell(5, 1).value = "Growth (no shortlets)";
  ws.getCell(5, 2).value = 12;
  ws.getCell(5, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
  ws.getCell(5, 3).value = { formula: "'02_Plan_Economics'!C15" };
  ws.getCell(5, 4).value = { formula: "B5*C5" };
  ws.getCell(5, 5).value = { formula: "IF(SUM($B$4:$B$7)=0,0,B5/SUM($B$4:$B$7))" };
  ws.getCell(5, 6).value = "Core CRM/ERP";

  ws.getCell(6, 1).value = "Growth + Shortlets";
  ws.getCell(6, 2).value = 6;
  ws.getCell(6, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
  ws.getCell(6, 3).value = { formula: "'02_Plan_Economics'!C15+'03_Shortlets'!B22" };
  ws.getCell(6, 4).value = { formula: "B6*C6" };
  ws.getCell(6, 5).value = { formula: "IF(SUM($B$4:$B$7)=0,0,B6/SUM($B$4:$B$7))" };
  ws.getCell(6, 6).value = "Highest ARPU";

  ws.getCell(7, 1).value = "Enterprise";
  ws.getCell(7, 2).value = 2;
  ws.getCell(7, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
  ws.getCell(7, 3).value = { formula: "'02_Plan_Economics'!D15" };
  ws.getCell(7, 4).value = { formula: "B7*C7" };
  ws.getCell(7, 5).value = { formula: "IF(SUM($B$4:$B$7)=0,0,B7/SUM($B$4:$B$7))" };
  ws.getCell(7, 6).value = "Anchor accounts";

  ws.getCell(9, 1).value = "Total logos";
  ws.getCell(9, 2).value = { formula: "SUM(B4:B7)" };
  ws.getCell(9, 1).font = { bold: true };

  ws.getCell(10, 1).value = "Total monthly contribution";
  ws.getCell(10, 2).value = { formula: "SUM(D4:D7)" };
  ws.getCell(10, 2).numFmt = NGN;
  ws.getCell(10, 1).font = { bold: true };

  ws.getCell(11, 1).value = "Blended contrib / logo";
  ws.getCell(11, 2).value = { formula: "IF(B9=0,0,B10/B9)" };
  ws.getCell(11, 2).numFmt = NGN;

  ws.getCell(12, 1).value = "Fixed platform OpEx";
  ws.getCell(12, 2).value = { formula: `'${A}'!B9` };
  ws.getCell(12, 2).numFmt = NGN;

  ws.getCell(13, 1).value = "Portfolio profit after fixed";
  ws.getCell(13, 2).value = { formula: "B10-B12" };
  ws.getCell(13, 2).numFmt = NGN;
  ws.getCell(13, 1).font = { bold: true };

  ws.getCell(14, 1).value = "Logos needed to cover fixed OpEx";
  ws.getCell(14, 2).value = { formula: "IF(B11=0,0,ROUNDUP(B12/B11,0))" };
  ws.getCell(14, 3).value = "Break-even logo count at this mix";

  for (const r of [4, 5, 6, 7]) {
    ws.getCell(r, 3).numFmt = NGN;
    ws.getCell(r, 4).numFmt = NGN;
    ws.getCell(r, 5).numFmt = PCT;
  }
}

function addSensitivity(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("06_Sensitivity");
  autosize(ws, [22, 14, 14, 14, 14, 14]);

  ws.getCell(1, 1).value = "Sensitivity — Growth+Shortlets monthly contribution vs take-rate × location fee";
  ws.getCell(1, 1).font = { bold: true, size: 12 };
  ws.getCell(2, 1).value =
    "Static snapshot using Assumptions defaults (recalculate mentally or duplicate sheet after changing inputs). Values below are computed from current assumption cells via formulas tied to base case.";
  ws.mergeCells(2, 1, 2, 6);

  // Simple one-way tables
  ws.getCell(4, 1).value = "One-way: Checkout take-rate";
  ws.getCell(4, 1).font = { bold: true };
  ["Take %", "Illustrative net take on 35% of ₦4.5m GMV", "Delta vs 3%"].forEach(
    (h, i) => (ws.getCell(5, i + 1).value = h),
  );
  styleHeader(ws.getRow(5));

  const rates = [0.02, 0.025, 0.03, 0.035, 0.04, 0.05];
  rates.forEach((rate, i) => {
    const r = 6 + i;
    ws.getCell(r, 1).value = rate;
    ws.getCell(r, 1).numFmt = PCT;
    // 4.5m * 0.35 * rate
    ws.getCell(r, 2).value = 4_500_000 * 0.35 * rate;
    ws.getCell(r, 2).numFmt = NGN;
    ws.getCell(r, 3).value = 4_500_000 * 0.35 * rate - 4_500_000 * 0.35 * 0.03;
    ws.getCell(r, 3).numFmt = NGN;
  });

  ws.getCell(14, 1).value = "One-way: Extra location fee";
  ws.getCell(14, 1).font = { bold: true };
  ["Fee / location", "Rev if 1 extra loc", "Rev if 3 extra loc"].forEach(
    (h, i) => (ws.getCell(15, i + 1).value = h),
  );
  styleHeader(ws.getRow(15));
  [10_000, 15_000, 20_000, 25_000, 30_000].forEach((fee, i) => {
    const r = 16 + i;
    ws.getCell(r, 1).value = fee;
    ws.getCell(r, 1).numFmt = NGN;
    ws.getCell(r, 2).value = fee;
    ws.getCell(r, 2).numFmt = NGN;
    ws.getCell(r, 3).value = fee * 3;
    ws.getCell(r, 3).numFmt = NGN;
  });

  ws.getCell(23, 1).value = "One-way: Growth list price";
  ws.getCell(23, 1).font = { bold: true };
  ["Price", "Approx contrib*"].forEach((h, i) => (ws.getCell(24, i + 1).value = h));
  styleHeader(ws.getRow(24));
  ws.getCell(24, 3).value = "*Assumes ~₦15k variable COGS; edit if needed";
  [150_000, 180_000, 200_000, 225_000, 250_000, 300_000].forEach((price, i) => {
    const r = 25 + i;
    ws.getCell(r, 1).value = price;
    ws.getCell(r, 1).numFmt = NGN;
    ws.getCell(r, 2).value = price * 0.95 - 15_000; // collection * rough cogs
    ws.getCell(r, 2).numFmt = NGN;
  });
}

function addCashflow(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("07_12Mo_Path");
  autosize(ws, [18, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 14]);

  ws.getCell(1, 1).value = "12-month path (edit yellow new logos / mo)";
  ws.getCell(1, 1).font = { bold: true, size: 13 };

  ws.getCell(3, 1).value = "New Growth logos / month";
  for (let m = 1; m <= 12; m++) {
    ws.getCell(3, m + 1).value = m <= 3 ? 2 : m <= 8 ? 3 : 4;
    ws.getCell(3, m + 1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF7ED" },
    };
  }
  ws.getCell(3, 14).value = "INPUT";

  ws.getCell(4, 1).value = "New Shortlet attach rate";
  for (let m = 1; m <= 12; m++) {
    ws.getCell(4, m + 1).value = 0.4;
    ws.getCell(4, m + 1).numFmt = PCT;
    ws.getCell(4, m + 1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF7ED" },
    };
  }

  ws.getCell(5, 1).value = "Churn (Growth)";
  for (let m = 1; m <= 12; m++) {
    ws.getCell(5, m + 1).value = { formula: "'01_Assumptions'!B45" };
    ws.getCell(5, m + 1).numFmt = PCT;
  }

  // Month headers
  ws.getCell(7, 1).value = "Month";
  for (let m = 1; m <= 12; m++) ws.getCell(7, m + 1).value = m;
  ws.getCell(7, 14).value = "Total / End";
  styleHeader(ws.getRow(7));

  ws.getCell(8, 1).value = "Ending Growth logos";
  // M1: start 5 + new - churn approx on start
  ws.getCell(8, 2).value = {
    formula: "5+B3-5*B5",
  };
  for (let m = 2; m <= 12; m++) {
    const col = m + 1;
    const prev = m;
    const colLetter = (n: number) => String.fromCharCode(64 + n); // only works to 12 -> L ok, M=13
    // Better use ExcelJS column encoding - columns 2..13 are B..M
  }
  // Use R1C1 style via explicit letters
  const cols = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
  ws.getCell(8, 2).value = { formula: `ROUND(5+B3-5*B5,0)` };
  for (let i = 1; i < 12; i++) {
    const c = cols[i];
    const p = cols[i - 1];
    ws.getCell(8, i + 2).value = {
      formula: `ROUND(${p}8+${c}3-${p}8*${c}5,0)`,
    };
  }
  ws.getCell(8, 14).value = { formula: "M8" };

  ws.getCell(9, 1).value = "Shortlet logos (end)";
  ws.getCell(9, 2).value = { formula: "ROUND(B8*B4,0)" };
  for (let i = 1; i < 12; i++) {
    const c = cols[i];
    ws.getCell(9, i + 2).value = { formula: `ROUND(${c}8*${c}4,0)` };
  }

  ws.getCell(10, 1).value = "Growth contrib ₦";
  // use plan growth contribution * logos + shortlet contrib * shortlet logos
  ws.getCell(10, 2).value = {
    formula: "B8*'02_Plan_Economics'!C15+(B9*'03_Shortlets'!B22)",
  };
  for (let i = 1; i < 12; i++) {
    const c = cols[i];
    ws.getCell(10, i + 2).value = {
      formula: `${c}8*'02_Plan_Economics'!C15+(${c}9*'03_Shortlets'!B22)`,
    };
    ws.getCell(10, i + 2).numFmt = NGN;
  }
  ws.getCell(10, 2).numFmt = NGN;
  ws.getCell(10, 14).value = { formula: "SUM(B10:M10)" };
  ws.getCell(10, 14).numFmt = NGN;

  ws.getCell(11, 1).value = "Fixed OpEx";
  for (let i = 0; i < 12; i++) {
    ws.getCell(11, i + 2).value = { formula: "'01_Assumptions'!B9" };
    ws.getCell(11, i + 2).numFmt = NGN;
  }

  ws.getCell(12, 1).value = "Net after fixed";
  for (let i = 0; i < 12; i++) {
    const c = cols[i];
    ws.getCell(12, i + 2).value = { formula: `${c}10-${c}11` };
    ws.getCell(12, i + 2).numFmt = NGN;
  }
  ws.getCell(12, 14).value = { formula: "SUM(B12:M12)" };
  ws.getCell(12, 14).numFmt = NGN;
  ws.getCell(12, 1).font = { bold: true };

  ws.getCell(14, 1).value =
    "Starts from 5 Growth logos in month 0. This is a planning sketch — not accounting.";
  ws.mergeCells(14, 1, 14, 8);
}

function addClaudePrompt(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("08_Claude_Prompt");
  autosize(ws, [100]);
  ws.getCell(1, 1).value = "Copy-paste prompt (if you want Claude to extend this model)";
  ws.getCell(1, 1).font = { bold: true, size: 13 };
  ws.getCell(3, 1).value = PROMPT;
  ws.getCell(3, 1).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(3).height = 420;
}

const PROMPT = `You are a SaaS CFO advisor for Realcorp, a Nigerian multi-tenant PropTech CRM/ERP (Next.js). Plans: STARTER / GROWTH / ENTERPRISE. Modules include Sales, Finance, Marketing, Clients, HR/Payslips, Shortlets PMS, WhatsApp agent, AI document reader, Facility, Investor portal.

Build / refine a unit economics model in Naira with:

1) Assumptions tab (editable): fixed OpEx, COGS per org/seat/shortlet location, Paystack fees, list prices, seat includes, shortlets add-on, per-location fee, take-rates (checkout 3%, WhatsApp 4%, offline 0%), CAC, setup fee, churn by plan, collection rate, typical GMV and channel mix.

2) Plan economics: monthly revenue, variable COGS, contribution ₦ and % for Starter / Growth / Enterprise.

3) Shortlets: add-on + billable locations (beyond included) + take-rate only on Realcorp checkout and WhatsApp-originated paid bookings. Show blended take on total GMV vs in-rail GMV. Net of Paystack if pass-through.

4) LTV/CAC: lifetime months = 1/monthly churn; LTV = monthly contribution × lifetime + setup contribution; LTV:CAC and payback months. Flag healthy if LTV:CAC ≥ 3 and payback ≤ 6.

5) Portfolio mix: counts of Starter / Growth / Growth+Shortlets / Enterprise → total contribution vs fixed OpEx and break-even logos.

6) Sensitivity tables for take-rate, location fee, Growth price.

7) 12-month logo ramp sketch.

Defaults to use unless I override:
- Starter ₦90k (5 seats), Growth ₦225k (15), Enterprise ₦500k (40)
- Extra seats ₦8k / ₦7k / ₦5k
- Shortlets add-on ₦70k incl 2 locations; extra location ₦20k
- Typical shortlet GMV ₦4.5m/mo; mix 35% checkout / 25% WhatsApp / 40% offline
- CAC ₦180k; setup fee ₦250k (delivery cost ₦80k)
- Churn 5% / 3% / 1.5% monthly
- Target contribution margin 75%

Output: Excel-ready tables OR CSV sheets I can paste. Explain which levers move contribution most for Nigerian developer/shortlet operators. Do not invent US-dollar SaaS pricing.`;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
