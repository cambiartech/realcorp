# Phase 3.1 QA Checklist

## Migration + Build
- [ ] Run `npx prisma migrate deploy`
- [ ] Run `npx prisma generate`
- [ ] Run `npm run dev` and confirm app boots

## Marketing
- [ ] Open `/{tenantSlug}/marketing`
- [ ] Confirm KPI cards show totals and attribution rate
- [ ] Create a new campaign
- [ ] Verify campaign row appears with correct status and code
- [ ] Confirm non-marketing role sees read-only guard message

## Community
- [ ] Open `/{tenantSlug}/community`
- [ ] Confirm KPI cards show partner and monthly lead counts
- [ ] Add a realtor partner
- [ ] Generate portal link and copy it
- [ ] Deactivate + reactivate partner

## Realtor Portal
- [ ] Open generated `/realtor/{tenantSlug}/{partnerId}?a=<token>` URL in incognito
- [ ] Submit lead with and without `utm_campaign`
- [ ] Confirm recent submissions table updates

## Lead Attribution
- [ ] Open `/{tenantSlug}/leads`
- [ ] Filter by campaign and verify chip + rows
- [ ] Create lead from internal form with linked campaign
- [ ] Confirm attribution column shows campaign / partner data

## Regression Sanity
- [ ] Dashboard page loads and widgets still work
- [ ] Projects, deals, finance routes still load
- [ ] No console errors on marketing/community/portal routes
