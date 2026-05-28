import type { PrismaClient } from "../../src/generated/prisma";

export type DemoUsers = {
  orgAdmin: { id: string; name: string | null; email: string };
  salesUser: { id: string; name: string | null; email: string };
  financeUser: { id: string; name: string | null; email: string };
  hrUser: { id: string; name: string | null; email: string };
};

export type DemoSeedContext = {
  prisma: PrismaClient;
  tenantId: string;
  users: DemoUsers;
};

export type SalesSeedRefs = {
  campaignLagos: { id: string };
  campaignAbuja: { id: string };
  projectAzure: { id: string; name: string };
  projectPalm: { id: string; name: string };
  unitsAzure: Array<{ id: string; label: string }>;
  unitPalm: { id: string; label: string };
  leads: Array<{ id: string }>;
  deals: Array<{ id: string }>;
};
