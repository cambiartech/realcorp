# The AI layer — what we have, what's missing

Written against the schema at 64 models, 1,990 lines.

## First, a correction worth making early

You asked whether we have what's needed to **train a proper model**. Almost certainly you don't
want to train one, and that's good news.

Training — or even fine-tuning — a model on tenant data is the wrong shape for this problem. It is
expensive, it goes stale the moment a deal moves, and it is a compliance disaster: a model trained
on Kingsway's data has Kingsway's numbers baked into its weights, and you cannot un-bake them when
they churn or when a regulator asks. Fine-tuning also teaches *format and tone*, not facts — people
consistently expect it to teach facts, and it doesn't.

What you actually want is **retrieval plus tool-calling against live data**:

- The model reads the ledger at question time, so it is never stale.
- Tenant isolation is enforced by the same query layer that already enforces it for the UI.
- A customer leaving means deleting rows, not retraining.
- Every answer can cite the record it came from — which, for a system of record, is the whole point.

Fine-tuning becomes interesting much later, and only for narrow things: classifying inbound
WhatsApp intent, or matching bank statement rows to invoices. Both need labelled examples you will
accumulate naturally.

## What the schema already gives you

This is a stronger starting position than most products at this stage.

**Every model is tenant-scoped.** `tenantId` on all business tables with compound indexes like
`@@index([tenantId, createdAt])`. Retrieval can be tenant-filtered at the query, which is the single
hardest thing to retrofit later.

**`AuditLog` is close to an event stream.** It has `module`, `entityType`, `entityId`, `action`,
`actorUserId`, `summary`, and a `Json metadata` field. That is most of what you need to answer
"what changed, when, and who did it" — the questions an operations AI is actually asked.

**`Activity` is a genuine timeline.** Typed, statused, assignable, due-dated, indexed by
`(tenantId, entityType, entityId)`. An agent can reconstruct the story of a deal from it.

**`WhatsAppMessage` is a labelled conversation corpus.** Direction, timestamp, lead linkage. This
is the highest-value unstructured data in the product and it is already structured enough to use.

**The relational spine is intact.** Lead → Deal → Unit → Invoice → PaymentRecord →
HrPayslip. An agent can traverse it. Most ERPs cannot answer "which commission came from which
unit" without a join nobody wrote; you can.

## The four real gaps

### 1. No vector storage

There is no `pgvector` extension and no embedding column anywhere. Semantic search over documents,
WhatsApp threads and project descriptions needs one.

```prisma
// Requires: CREATE EXTENSION IF NOT EXISTS vector;
model Embedding {
  id         String   @id @default(cuid())
  tenantId   String
  entityType String   // "Deal" | "Lead" | "FinanceDocument" | "WhatsAppMessage" …
  entityId   String
  chunkIndex Int      @default(0)
  content    String   @db.Text
  embedding  Unsupported("vector(1536)")?
  model      String   // which embedding model produced this
  createdAt  DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, entityType, entityId, chunkIndex])
  @@index([tenantId, entityType])
}
```

Prisma cannot query `Unsupported` columns directly — you use `$queryRaw` for the similarity search
and Prisma for everything else. That is normal and fine.

### 2. `AuditLog.metadata` is untyped `Json`

An agent reasoning over history needs to know what changed, not just that something did. Right now
`metadata` is free-form, so its usefulness depends entirely on what each call site happened to
write. Before the AI layer, standardise on a shape and enforce it in one helper:

```ts
type AuditMetadata = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changedFields?: string[];
  amount?: { value: number; currency: string };
};
```

This is the highest-leverage change on the list and it costs almost nothing today. It gets
expensive once you have a year of inconsistent audit rows.

### 3. Nothing captures *why*

The schema records state and transitions but not intent. Why was this unit discounted? Why did the
deal stall? Today that lives in someone's head or a WhatsApp message. `Activity.body` is the
natural home — the gap is that nothing requires it on the transitions that matter (price override,
stage regression, payment plan restructure).

An AI that can say "this stalled because the buyer asked for a payment plan change on 12 March" is
a different product from one that can only say "this stalled".

### 4. No agent action surface

When the AI moves from answering to doing, it needs a tool layer that is *not* the HTTP route
handlers — separate functions with typed inputs, tenant + permission checks, and an audit entry
per call. Design them so every agent action is attributable to both the agent and the user who
authorised it. Retrofitting attribution after an agent has been writing to production is painful.

## Suggested order

1. **Standardise `AuditLog.metadata`.** Cheap now, expensive later. Do this before the demo cycle
   if you can.
2. **Add `pgvector` and the `Embedding` model.** Backfill from `FinanceDocument`, `Activity`,
   `WhatsAppMessage`, project descriptions.
3. **Build read-only retrieval first.** "Ask your ledger" — natural language in, cited answer out,
   no writes. This is demo-able in a week and carries most of the perceived value.
4. **Then the tool layer**, starting with low-blast-radius actions: draft a follow-up, propose a
   payment plan, flag anomalous expenses. Human approves.
5. **Then autonomy**, narrowly and per-tenant opt-in.

## One thing to be careful about

You said the AI would have context because the product runs the whole operation. That is exactly
right, and it is also the risk. An agent with read access to every deal, salary and bank
reconciliation in a tenant is the highest-value target in the system.

Two commitments worth making now, while they are free:

- **The agent's data access is scoped to the requesting user's permissions**, not to the tenant.
  A sales rep asking a question must not be able to retrieve payroll through the AI when they
  cannot retrieve it through the UI. The `membership.modulePermissions` machinery already exists —
  the retrieval layer has to honour it from day one.
- **Every agent read and write lands in `AuditLog`.** When a customer asks what the AI saw, you
  need an answer.
