import { ClientUnitLinkRole, PropertyClientStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import {
  groupUnitsByExtractedClient,
  nameLooksGeneric,
  normalizeClientNameKey,
  reservedOwnerNote,
  suggestedClientStatus,
  type UnitNamePatternPresetId,
} from "@/lib/unit-label-client-import";

export function wantsImportAsClient(formData: FormData) {
  const raw = formData.get("importAsClient");
  return raw === "1" || raw === "on" || raw === "true";
}

export async function ensureClientsFromUnitLabels(input: {
  tenantId: string;
  projectName?: string;
  units: Array<{
    id: string;
    label: string;
    purpose: string;
    status: string;
    pricingPlanId: string | null;
  }>;
  preset?: UnitNamePatternPresetId;
  pattern?: string;
}): Promise<{ created: number; reused: number; unitsLinked: number }> {
  if (!input.units.length) return { created: 0, reused: 0, unitsLinked: 0 };

  const grouped = groupUnitsByExtractedClient(
    input.units.map((unit) => ({
      id: unit.id,
      label: unit.label,
      projectId: "",
      projectName: input.projectName || "",
      purpose: unit.purpose,
      status: unit.status,
      alreadyLinked: false,
    })),
    { preset: input.preset, pattern: input.pattern },
  );

  const existing = await prisma.propertyClient.findMany({
    where: { tenantId: input.tenantId },
    select: { id: true, fullName: true },
  });
  const existingByKey = new Map(
    existing.map((client) => [normalizeClientNameKey(client.fullName), client.id] as const),
  );

  const unitIds = input.units.map((unit) => unit.id);
  const alreadyLinked = new Set(
    (
      await prisma.clientUnitLink.findMany({
        where: { tenantId: input.tenantId, unitId: { in: unitIds } },
        select: { unitId: true },
      })
    ).map((link) => link.unitId),
  );
  const unitById = new Map(input.units.map((unit) => [unit.id, unit]));

  let created = 0;
  let reused = 0;
  let unitsLinked = 0;

  for (const group of grouped.groups) {
    if (nameLooksGeneric(group.fullName, input.projectName) && !existingByKey.has(group.key)) {
      continue;
    }
    let clientId = existingByKey.get(group.key) ?? null;
    if (!clientId) {
      const status =
        suggestedClientStatus(
          group.units.map((unit) => unit.status),
          group.units.map((unit) => unit.purpose),
        ) === "ACTIVE"
          ? PropertyClientStatus.ACTIVE
          : PropertyClientStatus.PROSPECT;
      const client = await prisma.propertyClient.create({
        data: {
          tenantId: input.tenantId,
          fullName: group.fullName,
          status,
          notes: `Imported from unit names (${group.units.map((unit) => unit.label).join(", ")}).`,
        },
      });
      clientId = client.id;
      existingByKey.set(group.key, clientId);
      created += 1;
    } else {
      reused += 1;
      if (suggestedClientStatus(
        group.units.map((unit) => unit.status),
        group.units.map((unit) => unit.purpose),
      ) === "ACTIVE") {
        await prisma.propertyClient.updateMany({
          where: {
            id: clientId,
            tenantId: input.tenantId,
            status: PropertyClientStatus.PROSPECT,
          },
          data: { status: PropertyClientStatus.ACTIVE },
        });
      }
    }

    for (const unitRef of group.units) {
      const unit = unitById.get(unitRef.id);
      if (!unit || alreadyLinked.has(unit.id)) continue;
      try {
        await prisma.clientUnitLink.create({
          data: {
            tenantId: input.tenantId,
            clientId,
            unitId: unit.id,
            pricingPlanId: unit.pricingPlanId,
            role: ClientUnitLinkRole.OWNER,
            notes: reservedOwnerNote(unit.status),
          },
        });
        alreadyLinked.add(unit.id);
        unitsLinked += 1;
      } catch {
        /* unique link already exists */
      }
    }
  }

  return { created, reused, unitsLinked };
}
