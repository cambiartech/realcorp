-- Demo data for the stakeholder portal (local dev only)
DO $$
DECLARE
  v_tenant TEXT := (SELECT id FROM "Tenant" WHERE slug='bopropertiesng');
  v_project TEXT := 'cmnmwx6nn0004057oahe0usit';
BEGIN
  -- Units: 2 sold, 1 reserved, 1 available
  INSERT INTO "Unit" (id, "tenantId", "projectId", label, purpose, status, "createdAt", "updatedAt") VALUES
    ('seedunit_p3_1', v_tenant, v_project, 'Block A - Unit 1', 'SALE', 'SOLD', now(), now()),
    ('seedunit_p3_2', v_tenant, v_project, 'Block A - Unit 2', 'SALE', 'SOLD', now(), now()),
    ('seedunit_p3_3', v_tenant, v_project, 'Block B - Unit 1', 'SALE', 'RESERVED', now(), now()),
    ('seedunit_p3_4', v_tenant, v_project, 'Block B - Unit 2', 'SALE', 'AVAILABLE', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Closed deal on unit 1
  INSERT INTO "Deal" (id, "tenantId", "unitId", stage, value, "createdAt", "updatedAt")
  VALUES ('seeddeal_p3_1', v_tenant, 'seedunit_p3_1', 'CLOSED_WON', 50000000, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Invoice 50M, 20M paid
  INSERT INTO "Invoice" (id, "tenantId", "dealId", "invoiceNumber", title, status, amount, "balanceDue", currency, "createdAt", "updatedAt")
  VALUES ('seedinv_p3_1', v_tenant, 'seeddeal_p3_1', 'INV-PORTAL-001', 'Block A - Unit 1 purchase', 'PARTIALLY_PAID', 50000000, 30000000, 'NGN', now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO "PaymentRecord" (id, "tenantId", "invoiceId", "payerName", amount, currency, "paidAt", method, "createdAt")
  VALUES ('seedpay_p3_1', v_tenant, 'seedinv_p3_1', 'Chuka Obi', 20000000, 'NGN', now() - interval '6 days', 'Bank transfer', now())
  ON CONFLICT (id) DO NOTHING;

  -- Sales receipt 5M on same deal
  INSERT INTO "SalesReceipt" (id, "tenantId", "dealId", "receiptNumber", title, "customerName", amount, currency, "issuedAt", "createdAt", "updatedAt")
  VALUES ('seedrcpt_p3_1', v_tenant, 'seeddeal_p3_1', 'RCP-PORTAL-001', 'Documentation fee - Block A Unit 1', 'Chuka Obi', 5000000, 'NGN', now() - interval '2 days', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Real investor account (sign-in set up later via invite; membership ready now)
  INSERT INTO "User" (id, name, email, "isPlatformAdmin")
  VALUES ('seeduser_investor1', 'Adaeze Investor', 'investor@bopropertiesng.com', false)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "Membership" (id, "tenantId", "userId", role, status, "createdAt", "updatedAt")
  VALUES ('seedmem_investor1', v_tenant, 'seeduser_investor1', 'INVESTOR', 'ACTIVE', now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO "ProjectStakeholder" (id, "tenantId", "projectId", "userId", type, "sharePercent", "investmentAmount", "createdAt", "updatedAt")
  VALUES ('seedstake_investor1', v_tenant, v_project, 'seeduser_investor1', 'INVESTOR', 25, 50000000, now(), now())
  ON CONFLICT ("projectId", "userId") DO NOTHING;

  -- Stakes for admin accounts so the portal can be previewed in the browser
  INSERT INTO "ProjectStakeholder" (id, "tenantId", "projectId", "userId", type, "sharePercent", "investmentAmount", "createdAt", "updatedAt")
  SELECT 'seedstake_' || u.id, v_tenant, v_project, u.id, 'INVESTOR', 25, 50000000, now(), now()
  FROM "User" u
  WHERE u.email IN ('admin@realcorp.com', 'platform@realcorp.local', 'dev@bopropertiesng.com')
  ON CONFLICT ("projectId", "userId") DO NOTHING;
END $$;
