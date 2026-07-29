/**
 * Realcorp — Welcome handbook content.
 *
 * Everything here is grounded in the actual product: nav keys from
 * tenant-nav-access.ts, module toggles and enums from prisma/schema.prisma,
 * routes from src/app. Where a status or stage name is quoted, it is the real
 * one users will see on screen.
 */

const MODULES = [
  // [ module, what it is, who lives in it, default state ]
  ["Dashboard", "The org's daily read: leads and deals today, collections against target, pipeline against target, inventory position, pending finance approvals.", "Everyone", "Always on"],
  ["Projects & Units", "Every development, every unit, its price, purpose and status. The inventory the whole company sells from.", "Sales, Operations", "Always on"],
  ["Leads", "Inbound enquiries from WhatsApp, Meta, your website forms or bulk import. Scored, assigned, and worked.", "Sales, Marketing", "Always on"],
  ["Deals", "The pipeline. Nine stages from first contact to closed, with the unit held against the deal.", "Sales", "Always on"],
  ["Activities", "Calls, notes, emails, WhatsApp, meetings and tasks logged against a lead, deal or client.", "Sales, Managers", "Always on"],
  ["Tasks", "Work assigned across the org, in spaces and projects, with status and priority.", "Everyone", "On by default"],
  ["Clients", "The people who bought. Their units, documents, and relationship to each property.", "Sales, Client relations", "Optional"],
  ["Finance", "Receivables, payables, invoices, payments, expenses, vendor bills, banking, reports and audit logs.", "Finance", "On by default"],
  ["Marketing", "Campaigns, WhatsApp CRM, embeddable lead-capture forms and attribution back to the pipeline.", "Marketing", "On by default"],
  ["Public Listings", "What the world sees: your Explore page, website embeds, and the public API.", "Marketing, Sales", "On by default"],
  ["Stakeholders", "Investors and listing owners attached to a project, with their share and investment.", "Sales, Leadership", "On by default"],
  ["Community", "Resident and owner communications after the sale.", "Community", "On by default"],
  ["Short Lets", "A full property-management system: front desk, room board, reservations, folio, channels, inspections and night audit.", "Operations, Front desk", "Optional"],
  ["People (HR)", "Employee records, onboarding bundles, offer letters, payslips, appraisals and documents.", "HR", "Optional"],
  ["Team", "Who has access, what role they hold, and what each role can reach.", "Admin", "Always on"],
  ["Investor Portal", "A separate, limited workspace where investors and listing owners see only their own projects, shortlets and documents.", "External", "Optional"],
  ["Realtor Portal", "A shareable link that lets an external partner submit leads straight into your pipeline.", "External", "On by default"],
  ["WhatsApp", "Two-way WhatsApp threads attached to the lead record, with delivery status.", "Sales, Marketing", "On by default"],
  ["Settings", "Org profile, modules, currencies, fiscal goals, departments, branding and access.", "Admin", "Always on"],
];

const CHAIN = [
  ["Lead", "An enquiry arrives from WhatsApp, a Meta ad, your Explore page, an embedded form, a realtor link, or a spreadsheet import. It is scored and routed to a rep."],
  ["Deal", "The lead becomes a deal and moves through the pipeline. The rep owns the outcome; every call and message is logged against it."],
  ["Unit", "At reservation the unit is allocated and locked. Nobody else can sell it, because there is only one inventory record and everyone reads it."],
  ["Payment plan", "The contract generates its own milestone schedule. Finance does not retype the numbers Sales agreed."],
  ["Ledger", "Receivables age on their own. Payments match against the bank import. Every change is stamped with who made it and what it was before."],
  ["Commission & payslip", "Commission accrues off the same figure the deal closed on, and reaches payroll without a spreadsheet in between."],
];

const DEPARTMENTS = [
  {
    id: "sales",
    name: "Sales",
    roles: "Sales Manager · Sales Executive",
    lede: "Your job in Realcorp is to move deals and hold inventory. Everything else in the platform is downstream of what you record here.",
    uses: [
      ["Leads", "Everything that came in, who owns it, and how warm it is."],
      ["Deals", "Your pipeline, stage by stage."],
      ["Projects & Units", "What is actually available to sell, right now."],
      ["Clients", "The buyers you have already closed."],
      ["Activities", "Your call log, notes and follow-ups."],
      ["Tasks", "Work assigned to you or by you."],
    ],
    stages: ["New lead", "Contacted", "Qualified", "Inspection booked", "Inspection completed", "Negotiation", "Reservation made", "Closed won", "Closed lost"],
    week: [
      "Sign in and set your profile. Check your name is how you want it to appear on contracts.",
      "Open Projects and walk the unit list for the developments you sell. Confirm prices, purposes and availability match reality.",
      "Import your existing lead list from Excel or CSV. Column mapping and a dry run let you see exactly what will land before anything is written.",
      "Move three live deals into the correct stage. This is the fastest way to learn the pipeline.",
      "Log one activity against each — a call, a note, a WhatsApp. The activity feed is what your manager reads.",
      "Reserve one unit against a deal and watch the status change everywhere at once.",
    ],
    owns: [
      "Lead quality and response time.",
      "That the deal stage reflects reality — a stale pipeline is worse than no pipeline.",
      "Unit status: if it is reserved, reserve it in the system the same day.",
      "The activity trail. If it is not logged, it did not happen.",
    ],
    note: "A unit is AVAILABLE, RESERVED, SOLD or UNDER CONSTRUCTION. Only one of those can be true at a time, and finance reads the same value you do.",
  },
  {
    id: "finance",
    name: "Finance",
    roles: "Finance Manager",
    lede: "You inherit the numbers Sales agreed rather than re-keying them. Month-end becomes a review instead of a rebuild.",
    uses: [
      ["Overview", "Cash position, collections against target, what needs attention."],
      ["Receivables", "What is owed, by whom, and how overdue."],
      ["Payables & Vendor bills", "What you owe, including recurring bills."],
      ["Invoices", "Draft, sent, partially paid, paid or void."],
      ["Payments & Sales receipts", "Money in, matched to the deal."],
      ["Expenses", "Operational spend and reimbursements, by category and vendor."],
      ["Banking", "Statement import with auto-match and an exceptions queue."],
      ["Reports", "Profit, cash flow and balance by project and fiscal period."],
      ["Documents", "Contracts and supporting files against the transaction."],
      ["Audit logs", "Who changed what, when, and what it was before."],
    ],
    week: [
      "Set your fiscal goals and periods in Finance settings. The dashboard's collections-against-target reads from this.",
      "Confirm your currencies and default. Realcorp defaults to NGN and Africa/Lagos; change it if that is not you.",
      "Bring in your chart of accounts and expense categories.",
      "Import one bank statement and work the exceptions queue. Unmatched rows are the ones that need a human.",
      "Review the receivables ageing against your own records. Differences here are the ones worth chasing on day one.",
      "Post one milestone payment and follow it through to the receipt.",
    ],
    owns: [
      "The chart of accounts and expense categories staying meaningful — a vendor filed under the wrong category is invisible in reports.",
      "The exceptions queue. Anything unmatched is a question nobody has answered yet.",
      "Approving pending finance items so deals do not stall at the last step.",
      "Fiscal periods and targets, so the dashboard means something.",
    ],
    note: "Bank statement rows are UNMATCHED, MATCHED or EXCEPTION. Realcorp will match what it can; the queue is deliberately small and deliberately yours.",
  },
  {
    id: "operations",
    name: "Operations & Short Lets",
    roles: "Housekeeping Manager · F&B Staff · Operations",
    lede: "If you run serviced apartments or short lets, this is a complete property-management system — not a bolt-on.",
    optional: true,
    uses: [
      ["Front desk", "Today: arrivals, departures, in-house."],
      ["Room board", "Every room, its housekeeping state and its guest."],
      ["Reservations", "Bookings from any source, with status."],
      ["Guest bill (Folio)", "Charges by department: room, F&B, laundry, lounge, gym, other."],
      ["Guests", "Individual and corporate guest records."],
      ["Locations & Apartments", "Your physical estate."],
      ["Inspections", "Checkout condition, recorded and attributable."],
      ["Channels", "Where bookings come from."],
      ["Reports & Night audit", "The day closed out and reconciled."],
    ],
    week: [
      "Set up locations, then apartments, then rooms. The hierarchy matters — everything hangs off it.",
      "Configure rates and your check-in and check-out times in Short Lets settings.",
      "Load current in-house guests so the room board reflects the building tonight.",
      "Run one full arrival: reservation, check-in, folio charge, check-out, inspection.",
      "Run a night audit and read the report. This is the number Finance will see.",
      "Connect your booking channels.",
    ],
    owns: [
      "The room board being true at all times. Finance and Sales both read it.",
      "Folio charges going on the right department — it is what makes revenue reporting useful.",
      "Night audit actually being run. A skipped night is a hole in the ledger.",
      "Checkout inspections, with condition recorded.",
    ],
    note: "A reservation is PENDING, CONFIRMED, CHECKED IN, CHECKED OUT, CANCELLED, NO SHOW or RESERVED. Night audit closes the business day and is what Finance reconciles against.",
  },
  {
    id: "people",
    name: "People (HR)",
    roles: "HR Manager",
    lede: "From offer letter to payslip in one thread, with the right forms attached to the right role automatically.",
    optional: true,
    uses: [
      ["People", "Employee records and profiles."],
      ["Payslips", "Payroll runs, deductions and payment status."],
      ["Appraisals", "Cycles, goals and reviews."],
      ["Documents", "Contracts, IDs and everything filed against the person."],
      ["Insights", "Headcount, structure and trends."],
      ["My dashboard", "What each employee sees about themselves."],
    ],
    week: [
      "Set up departments and reporting lines. Access and appraisals both hang off this.",
      "Load your employee list and confirm roles and reporting lines.",
      "Build one onboarding bundle: biodata, bank details, guarantor, health. Choose whether each is filled online, printed and uploaded, or both.",
      "Send that bundle to one new hire and watch it come back completed.",
      "Draft one offer letter through the system rather than in Word.",
      "Run a payslip in draft, check the deductions, then finalise.",
    ],
    owns: [
      "Reporting lines being current. Half of the platform's access logic reads from them.",
      "Onboarding bundles going out complete, so nobody starts without a bank form on file.",
      "Payslip runs moving from draft to finalised deliberately, not by accident.",
      "Document retention — what is on file and what is missing.",
    ],
    note: "Payslip runs are DRAFT or FINALIZED. Draft is safe to correct; finalised is a record. New hires complete forms through a private link — they do not need a Realcorp account.",
  },
  {
    id: "marketing",
    name: "Marketing",
    roles: "Marketing Manager",
    lede: "Campaigns that close the loop. You will see which campaign produced which deal, not just which produced clicks.",
    uses: [
      ["Campaigns", "Email and WhatsApp broadcasts, with status."],
      ["WhatsApp CRM", "Conversations attached to the lead record."],
      ["Lead capture forms", "Built here, embedded on your own site, landing straight in the pipeline."],
      ["Public Listings", "What is live on your Explore page and embeds."],
      ["Leads", "Everything you generated, and what happened next."],
    ],
    week: [
      "Publish your first project listings and open the Explore page as a buyer would see it.",
      "Build one lead-capture form and embed it on your website.",
      "Connect WhatsApp so inbound messages attach themselves to leads.",
      "Run one small broadcast to a segment and watch attribution flow back.",
      "Check that leads from each source are tagged correctly — attribution is only as good as the tagging.",
      "Share a realtor link with one external partner and confirm their submission lands in your pipeline.",
    ],
    owns: [
      "Listing quality. A project with no cover image and no description will not sell itself.",
      "Source tagging, which is what makes attribution real.",
      "That published listings reflect actual availability.",
      "Form conversion — the sessions and events are recorded, so this is measurable rather than felt.",
    ],
    note: "Your Explore page is public and needs no login. Embeds put the same listings on your own site. Both read from the same inventory Sales works.",
  },
  {
    id: "leadership",
    name: "Leadership & Administration",
    roles: "Org Admin",
    lede: "You decide what the organisation can see and do. Most of the setup that makes everyone else's first week work happens here.",
    uses: [
      ["Settings", "Modules on or off, branding, currencies, departments, fiscal goals."],
      ["Team", "Who has access and at what role."],
      ["Dashboard", "Customisable to the metrics you actually run on."],
      ["Stakeholders", "Investors and listing owners per project."],
      ["Audit logs", "The record of record."],
    ],
    week: [
      "Turn on only the modules you will use. You can enable the rest later; an empty module is worse than a hidden one.",
      "Upload your logo and set your default currency and timezone.",
      "Create departments before you invite people, so roles land in the right structure.",
      "Invite your team and assign roles deliberately — role determines what each person can even see.",
      "Set fiscal goals so the dashboard has something to measure against.",
      "Walk one full deal end to end yourself before your team does.",
    ],
    owns: [
      "Module scope. Turning everything on at once is the most common onboarding mistake.",
      "Role assignment, which is your access control.",
      "Fiscal goals and periods.",
      "Deciding who, if anyone, gets an investor portal login.",
    ],
    note: "Every organisation on Realcorp gets an isolated workspace. Your data is not co-mingled with any other organisation's, and isolation is enforced at the query layer rather than in the interface.",
  },
];

const ROLES = [
  ["Org Admin", "Everything, including settings and team", "Founders, GMs, operations directors"],
  ["Sales Manager", "Dashboard, projects, leads, deals, activities, clients, short lets, tasks, listings, stakeholders", "Heads of sales"],
  ["Sales Executive", "Dashboard, projects, leads, deals, activities, clients, short lets, tasks", "Reps and agents"],
  ["Finance Manager", "The sales stack plus the full finance module", "Financial controllers, accountants"],
  ["HR Manager", "Dashboard, tasks, people, team", "HR leads"],
  ["Marketing Manager", "Dashboard, projects, leads, activities, tasks, marketing, listings", "Marketing leads"],
  ["Community Manager", "Dashboard, tasks, community", "Resident and owner relations"],
  ["Housekeeping Manager", "Dashboard, short lets", "Housekeeping supervisors"],
  ["F&B Staff", "Dashboard, short lets", "Restaurant and bar staff"],
  ["Investor", "Investor portal only — their own projects, shortlets and documents", "External investors"],
  ["Listing Owner", "Investor portal only — their own listings", "External property owners"],
];

const PORTALS = [
  ["Explore page", "Public, no login", "Anyone", "Your published projects, searchable and filterable, with an enquiry button that creates a lead."],
  ["Website embeds", "Public, no login", "Your website visitors", "The same listings, embedded in your own site."],
  ["Lead capture forms", "Public link or embed", "Prospects", "Forms you design, submitting straight into the pipeline."],
  ["Realtor link", "Private link", "External partners", "A partner submits leads on your behalf without an account."],
  ["Investor portal", "Login required", "Investors, listing owners", "Only their own projects, shortlet performance and documents."],
  ["HR forms & offers", "Private token link", "Candidates, new hires", "Complete biodata, bank, guarantor and health forms, or accept an offer, without a Realcorp account."],
  ["Invitation link", "Private token link", "New team members", "Accept an invite and set a password to join the workspace."],
];

const WEEK_ONE = [
  ["Before day one", "Realcorp side", "We create your workspace, apply your branding, and load your project list, unit inventory, open deals and chart of accounts."],
  ["Day 1", "Administration", "Modules chosen, departments created, team invited with roles. Currency, timezone and fiscal goals set."],
  ["Day 2", "Sales", "Lead and client lists imported. Reps sign in, walk their inventory, move live deals into the right stages."],
  ["Day 3", "Finance", "Chart of accounts and categories confirmed. First bank statement imported and exceptions worked."],
  ["Day 4", "Operations & People", "Short-let estate configured and one full arrival run end to end. HR departments, employee records and the first onboarding bundle."],
  ["Day 5", "Marketing & review", "Listings published, Explore page live, first capture form embedded. Then a walkthrough with every department together."],
];

const IMPORTS = [
  ["Clients", "Excel or CSV", "Column mapping with a dry run before anything is written."],
  ["Leads", "Excel or CSV", "Same — you see exactly what will land."],
  ["Projects & units", "Handled during onboarding", "We migrate these with you before your first training session."],
  ["Chart of accounts", "Handled during onboarding", "Brought across so day one is your real structure."],
  ["Bank statements", "Ongoing import", "Auto-matched against the ledger, with an exceptions queue for the rest."],
];

const FAQ = [
  ["Do we have to stop using WhatsApp?", "No. Your team keeps selling where buyers already are. Realcorp captures those conversations as leads, attaches them to the deal, and keeps the record straight behind the scenes."],
  ["What if we do not use half of these modules?", "Turn them off. Modules are switched per organisation, and several are off by default. An empty module is worse than a hidden one — you can enable it the week you need it."],
  ["Can one person hold two roles?", "Role determines the default set of modules a person sees, and access can be granted per module on top of that. Speak to us about anyone whose job does not fit a single role cleanly."],
  ["Who can see salaries?", "Only the roles you grant People access to. HR is a separate module and is off by default."],
  ["What happens to our spreadsheets?", "Clients, leads and unit lists import directly. Everything else is migrated with you during onboarding."],
  ["Can we run more than one company on it?", "Yes. Each organisation gets its own isolated workspace with its own branding, users and data. Group operators run all of them from a single console."],
  ["Is our data really separate from other organisations?", "Yes, and it is enforced at the query layer rather than in the interface — meaning isolation is structural, not cosmetic."],
  ["Can we get our data out?", "Yes. Tables export to CSV, Excel and PDF throughout the product, and a full export is available on request."],
];

module.exports = { MODULES, CHAIN, DEPARTMENTS, ROLES, PORTALS, WEEK_ONE, IMPORTS, FAQ };
