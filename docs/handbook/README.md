# Welcome to Realcorp — client handbook

19 pages. Hand `Welcome-to-Realcorp.pdf` to an organisation; edit
`Welcome-to-Realcorp.docx` when you need to tailor it.

## What's in it

| Part | Covers |
|---|---|
| One · The idea | Why one ledger instead of eleven tools; lead → deal → unit → plan → ledger → payslip |
| Two · The platform | All 19 modules, what each does, who lives in it, and which are optional |
| Three · Your team | Sales, Finance, Operations & Short Lets, People (HR), Marketing, Leadership — each with what they'll use, their first week, and what they own |
| Four · Access | The 11 roles and what each reaches; the 7 external surfaces (Explore, embeds, capture forms, realtor links, investor portal, HR token flows, invitations) |
| Five · Onboarding | Day-by-day first week, what data to bring, security and audit, FAQ |

## It's built from the codebase, not from memory

Module list and defaults come from `TenantSettings` in `prisma/schema.prisma`. Role permissions
come from `defaultNavForRole()` in `src/lib/tenant-nav-access.ts`. Every status name quoted — deal
stages, unit statuses, reservation statuses, payslip run states, bank match states — is the real
enum value users see on screen.

That means it will drift as the product changes. When you add a module or a role, update
`content.js` and rebuild.

## Rebuilding

```bash
cd docs/handbook
npm install docx        # first time only
node build.js           # writes Welcome-to-Realcorp.docx
soffice --headless --convert-to pdf Welcome-to-Realcorp.docx
```

`content.js` holds all the words — modules, departments, roles, portals, week one, FAQ. `build.js`
holds only layout. To change copy you should never need to touch `build.js`.

## Tailoring per client

Open the `.docx` and:

- Fill the **Prepared for** line on the cover.
- Delete the department sections they aren't buying. Operations & Short Lets and People (HR) are
  marked *(optional module)* in the heading precisely so this is easy.
- Cut rows from the module table for anything you won't enable for them.

The typeface is Calibri so the document looks the same on any machine that opens it. If you want
it in Instrument Sans to match the website, that font has to be installed locally first — Word
will substitute silently otherwise.

## Worth checking before it goes out

- The cover has a blank **Prepared for** line. Fill it, or delete the block.
- Nothing in here quotes a price. That's deliberate — pricing is per organisation.
- No customer names or metrics are claimed anywhere, unlike the landing page, which still carries
  the numbers inherited from the old site.
