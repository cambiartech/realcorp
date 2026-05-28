import { ShortletReservationStatus, ShortletUnitStatus } from "../../src/generated/prisma";
import { daysAgo, daysFromNow } from "./helpers";
import type { DemoSeedContext, SalesSeedRefs } from "./types";

export async function seedShortlets(ctx: DemoSeedContext, sales: SalesSeedRefs) {
  const { prisma, tenantId, users } = ctx;
  console.log("  [shortlets] units, reservations, payments…");

  await prisma.tenantSettings.update({
    where: { tenantId },
    data: { moduleShortLets: true },
  });

  const unitSpecs = [
    { key: "azure-studio", name: "Azure Studio — Lekki", location: "Lekki Phase 1", rate: "95000", projectUnitIdx: 0 },
    { key: "palm-suite", name: "Palm Suite — Abuja", location: "Maitama", rate: "78000", projectUnitIdx: null },
    { key: "marina-loft", name: "Marina Loft — VI", location: "Victoria Island", rate: "120000", projectUnitIdx: null },
    { key: "ikeja-1bed", name: "Ikeja 1-Bed — GRA", location: "Ikeja GRA", rate: "65000", projectUnitIdx: 3 },
  ];

  const units = [];
  for (const spec of unitSpecs) {
    const id = `${tenantId}-shortlet-${spec.key}`;
    const projectUnitId =
      spec.projectUnitIdx != null ? sales.unitsAzure[spec.projectUnitIdx]?.id : undefined;
    const unit = await prisma.shortletUnit.upsert({
      where: { id },
      create: {
        id,
        tenantId,
        projectUnitId: projectUnitId ?? null,
        name: spec.name,
        location: spec.location,
        nightlyRate: spec.rate,
        cleaningFee: "15000",
        currency: "NGN",
        status: ShortletUnitStatus.AVAILABLE,
      },
      update: { nightlyRate: spec.rate },
    });
    units.push(unit);
  }

  const reservations = [
    {
      key: "past",
      unitIdx: 0,
      guest: "Sarah Okon",
      email: "sarah.okon@demo.guest",
      checkIn: daysAgo(20),
      checkOut: daysAgo(17),
      nights: 3,
      total: "300000",
      paid: "300000",
      status: ShortletReservationStatus.CHECKED_OUT,
    },
    {
      key: "active",
      unitIdx: 1,
      guest: "Michael Chen",
      email: "m.chen@demo.guest",
      checkIn: daysAgo(1),
      checkOut: daysFromNow(2),
      nights: 3,
      total: "249000",
      paid: "150000",
      status: ShortletReservationStatus.CHECKED_IN,
    },
    {
      key: "upcoming",
      unitIdx: 2,
      guest: "Amina Hassan",
      email: "a.hassan@demo.guest",
      checkIn: daysFromNow(5),
      checkOut: daysFromNow(8),
      nights: 3,
      total: "375000",
      paid: "100000",
      status: ShortletReservationStatus.RESERVED,
    },
    {
      key: "upcoming2",
      unitIdx: 3,
      guest: "David Wilson",
      email: "d.wilson@demo.guest",
      checkIn: daysFromNow(12),
      checkOut: daysFromNow(15),
      nights: 3,
      total: "210000",
      paid: "0",
      status: ShortletReservationStatus.RESERVED,
    },
    {
      key: "cancelled",
      unitIdx: 0,
      guest: "Cancelled Guest",
      email: "cancel@demo.guest",
      checkIn: daysFromNow(20),
      checkOut: daysFromNow(22),
      nights: 2,
      total: "190000",
      paid: "0",
      status: ShortletReservationStatus.CANCELLED,
    },
  ];

  for (const row of reservations) {
    const id = `${tenantId}-shortlet-res-${row.key}`;
    const unit = units[row.unitIdx];
    const balance = String(Number(row.total) - Number(row.paid));
    const res = await prisma.shortletReservation.upsert({
      where: { id },
      create: {
        id,
        tenantId,
        unitId: unit.id,
        guestName: row.guest,
        guestEmail: row.email,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        nights: row.nights,
        totalAmount: row.total,
        amountPaid: row.paid,
        balanceDue: balance,
        currency: "NGN",
        status: row.status,
        createdByUserId: users.orgAdmin.id,
        createdByLabel: users.orgAdmin.name,
      },
      update: { status: row.status, amountPaid: row.paid, balanceDue: balance },
    });

    if (Number(row.paid) > 0) {
      const payId = `${id}-pay-1`;
      const payExists = await prisma.shortletPayment.findFirst({ where: { id: payId } });
      if (!payExists) {
        await prisma.shortletPayment.create({
          data: {
            id: payId,
            tenantId,
            reservationId: res.id,
            amount: row.paid,
            currency: "NGN",
            paidAt: daysAgo(2),
            method: "Bank transfer",
            reference: `SL-${row.key.toUpperCase()}`,
            recordedByUserId: users.financeUser.id,
            recordedByLabel: users.financeUser.name,
          },
        });
      }
    }

    if (row.status === ShortletReservationStatus.CHECKED_IN) {
      await prisma.shortletUnit.update({
        where: { id: unit.id },
        data: { status: ShortletUnitStatus.OCCUPIED, activeReservationId: res.id },
      });
    }
  }
}
