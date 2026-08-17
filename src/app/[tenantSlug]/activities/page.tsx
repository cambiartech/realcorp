import { auth } from "@/auth";
import { ActivityStatus, ActivityType, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ActivityRowActions, WhatsAppReplyBox } from "./activity-item-actions";

export const dynamic = "force-dynamic";

const TYPE_ICONS: Record<ActivityType, string> = {
  NOTE: "📝",
  CALL: "📞",
  EMAIL: "✉️",
  WHATSAPP: "💬",
  MEETING: "🤝",
  TASK: "✅",
};

const STATUS_STYLE: Record<ActivityStatus, string> = {
  DONE: "bg-[var(--success-wash)] text-[var(--success)] border border-[var(--success-line)]",
  PENDING: "bg-[var(--warn-wash)] text-[var(--warn)] border border-[var(--warn-line)]",
  OVERDUE: "bg-[var(--danger-wash)] text-[var(--danger)] border border-[var(--danger-line)]",
};

export default async function ActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ assignee?: string; type?: string; status?: string; channel?: string }>;
}) {
  const { tenantSlug } = await params;
  const { assignee, type: typeParam, status: statusParam, channel: channelParam } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: MEMBERSHIP_FOR_NAV_SELECT,
  });
  assertTenantNavAccess(session, membership, tenant.settings, "activities");

  const validType = Object.values(ActivityType).includes(typeParam as ActivityType)
    ? (typeParam as ActivityType)
    : undefined;
  const validStatus = Object.values(ActivityStatus).includes(statusParam as ActivityStatus)
    ? (statusParam as ActivityStatus)
    : undefined;
  const validChannel = channelParam === "WHATSAPP" || channelParam === "ACTIVITY" ? channelParam : "ALL";

  const [activities, users, whatsappMessages] = await Promise.all([
    prisma.activity.findMany({
      where: {
        tenantId: tenant.id,
        ...(assignee ? { assignedUserId: assignee } : {}),
        ...(validType ? { type: validType } : {}),
        ...(validStatus ? { status: validStatus } : {}),
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.membership.findMany({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.whatsAppMessage.findMany({
      where: {
        tenantId: tenant.id,
      },
      orderBy: { timestamp: "desc" },
      take: 300,
    }),
  ]);

  const userMap = new Map(users.map((m) => [m.userId, m.user]));

  const buildHref = (next: { assignee?: string; type?: string; status?: string; channel?: string }) => {
    const qp = new URLSearchParams();
    if (next.assignee) qp.set("assignee", next.assignee);
    if (next.type) qp.set("type", next.type);
    if (next.status) qp.set("status", next.status);
    if (next.channel && next.channel !== "ALL") qp.set("channel", next.channel);
    return `/${tenantSlug}/activities${qp.toString() ? `?${qp}` : ""}`;
  };

  const pendingCount = activities.filter(
    (a) => a.status === ActivityStatus.PENDING || a.status === ActivityStatus.OVERDUE,
  ).length;
  const whatsappCount = whatsappMessages.length;

  const combinedItems = [
    ...(validChannel !== "WHATSAPP"
      ? activities.map((activity) => ({ kind: "ACTIVITY" as const, ts: activity.createdAt, activity }))
      : []),
    ...(validChannel !== "ACTIVITY"
      ? whatsappMessages.map((message) => ({ kind: "WHATSAPP" as const, ts: message.timestamp, message }))
      : []),
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime());

  return (
    <div className="w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Sales</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Activities</h1>
          <p className="mt-0.5 text-sm text-muted">
            Team inbox — {pendingCount} open task{pendingCount !== 1 ? "s" : ""} · {whatsappCount} WhatsApp
            message{whatsappCount !== 1 ? "s" : ""}.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={buildHref({ type: validType, status: validStatus, channel: validChannel })}
          className={`rounded-md border px-2.5 py-1.5 font-medium ${!assignee ? "border-foreground bg-foreground text-background" : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"}`}
        >
          All owners
        </Link>
        <Link
          href={buildHref({
            assignee: session.user.id,
            type: validType,
            status: validStatus,
            channel: validChannel,
          })}
          className={`rounded-md border px-2.5 py-1.5 font-medium ${assignee === session.user.id ? "border-foreground bg-foreground text-background" : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"}`}
        >
          Mine
        </Link>
        <span className="mx-1 text-foreground/20">|</span>
        <Link
          href={buildHref({ assignee, status: "PENDING", channel: validChannel })}
          className={`rounded-md border px-2.5 py-1.5 font-medium ${validStatus === "PENDING" ? "border-[var(--warn-line)] bg-[var(--warn-wash)] text-[var(--warn)]" : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"}`}
        >
          Pending
        </Link>
        <Link
          href={buildHref({ assignee, status: "OVERDUE", channel: validChannel })}
          className={`rounded-md border px-2.5 py-1.5 font-medium ${validStatus === "OVERDUE" ? "border-[var(--danger-line)] bg-[var(--danger-wash)] text-[var(--danger)]" : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"}`}
        >
          Overdue
        </Link>
        <Link
          href={buildHref({ assignee, status: "DONE", channel: validChannel })}
          className={`rounded-md border px-2.5 py-1.5 font-medium ${validStatus === "DONE" ? "border-[var(--success-line)] bg-[var(--success-wash)] text-[var(--success)]" : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"}`}
        >
          Done
        </Link>
        <span className="mx-1 text-foreground/20">|</span>
        <Link
          href={buildHref({ assignee, type: validType, status: validStatus, channel: "ALL" })}
          className={`rounded-md border px-2.5 py-1.5 font-medium ${validChannel === "ALL" ? "border-foreground bg-foreground text-background" : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"}`}
        >
          All channels
        </Link>
        <Link
          href={buildHref({ assignee, type: validType, status: validStatus, channel: "ACTIVITY" })}
          className={`rounded-md border px-2.5 py-1.5 font-medium ${validChannel === "ACTIVITY" ? "border-foreground bg-foreground text-background" : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"}`}
        >
          Activities
        </Link>
        <Link
          href={buildHref({ assignee, type: validType, status: validStatus, channel: "WHATSAPP" })}
          className={`rounded-md border px-2.5 py-1.5 font-medium ${validChannel === "WHATSAPP" ? "border-[var(--success-line)] bg-[var(--success-wash)] text-[var(--success)]" : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"}`}
        >
          WhatsApp
        </Link>
        {assignee || validType || validStatus || validChannel !== "ALL" ? (
          <>
            <span className="mx-1 text-foreground/20">|</span>
            <Link
              href={`/${tenantSlug}/activities`}
              className="font-semibold text-foreground underline decoration-foreground/30 underline-offset-2"
            >
              Clear filters
            </Link>
          </>
        ) : null}
      </div>

      {combinedItems.length === 0 ? (
        <EmptyState
          title="No inbox items match these filters"
          hint="Activities you log on leads and deals, plus WhatsApp messages, show up here."
        />
      ) : (
        <div className="space-y-2">
          {combinedItems.map((item) => {
            if (item.kind === "WHATSAPP") {
              const m = item.message;
              const inbound = m.direction === "INBOUND";
              const leadHref = m.leadId ? `/${tenantSlug}/leads/${m.leadId}` : null;
              return (
                <div
                  key={`wa-${m.id}`}
                  className="rounded-lg border border-[var(--success-line)] bg-[var(--success)]/[0.04] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-base">💬</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            WhatsApp {inbound ? "inbound" : "outbound"}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${inbound ? "bg-[var(--success-wash)] text-[var(--success)]" : "bg-[var(--info-wash)] text-[var(--info)]"}`}
                          >
                            {m.direction}
                          </span>
                          {!inbound && m.status ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                m.status === "failed"
                                  ? "bg-[var(--danger-wash)] text-[var(--danger)]"
                                  : m.status === "read"
                                    ? "bg-[var(--info-wash)] text-[var(--info)]"
                                    : "bg-foreground/[0.08] text-muted"
                              }`}
                            >
                              {m.status}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-foreground/90">{m.body}</p>
                        <p className="mt-1 text-xs text-muted">
                          {m.fromPhone ? `From ${m.fromPhone}` : "From business"}
                          {m.toPhone ? ` → ${m.toPhone}` : ""}
                          {" · "}
                          {new Date(m.timestamp).toLocaleString()}
                          {leadHref ? (
                            <>
                              {" · "}
                              <Link
                                href={leadHref}
                                className="underline decoration-foreground/20 hover:text-foreground"
                              >
                                Lead
                              </Link>
                            </>
                          ) : (
                            " · Unmatched lead"
                          )}
                        </p>
                        {m.leadId && m.toPhone ? (
                          <WhatsAppReplyBox
                            tenantSlug={tenantSlug}
                            leadId={m.leadId}
                            toPhone={m.direction === "INBOUND" ? (m.fromPhone ?? m.toPhone) : m.toPhone}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const activity = item.activity;
            const actor = userMap.get(activity.createdByUserId);
            const assigned = activity.assignedUserId ? userMap.get(activity.assignedUserId) : null;
            const isTask = activity.type === ActivityType.TASK;
            const isPending =
              activity.status === ActivityStatus.PENDING || activity.status === ActivityStatus.OVERDUE;
            const entityHref =
              activity.entityType === "LEAD"
                ? `/${tenantSlug}/leads/${activity.entityId}`
                : `/${tenantSlug}/deals/${activity.entityId}`;
            const entityLabel = activity.entityType === "LEAD" ? "Lead" : "Deal";

            return (
              <div
                key={activity.id}
                className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 text-base">{TYPE_ICONS[activity.type]}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{activity.title}</p>
                        {isTask ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[activity.status]}`}
                          >
                            {activity.status}
                          </span>
                        ) : null}
                      </div>
                      {activity.body ? <p className="mt-0.5 text-xs text-muted">{activity.body}</p> : null}
                      <p className="mt-1 text-xs text-muted">
                        {actor?.name ?? actor?.email ?? "Unknown"}
                        {assigned && assigned.id !== actor?.id
                          ? ` → ${assigned.name ?? assigned.email}`
                          : null}
                        {activity.dueAt ? ` · Due ${new Date(activity.dueAt).toLocaleDateString()}` : null}
                        {" · "}
                        <Link
                          href={entityHref}
                          className="underline decoration-foreground/20 hover:text-foreground"
                        >
                          {entityLabel}
                        </Link>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[11px]">
                    <ActivityRowActions
                      tenantSlug={tenantSlug}
                      activityId={activity.id}
                      showComplete={isTask && isPending}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
