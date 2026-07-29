import { APPRAISAL_SECTION_LABELS } from "@/lib/appraisal-competencies";

export type AppraisalActionRow = {
  id: string;
  title: string;
  description: string;
  sortOrder?: number;
};

export type AppraisalActionSection = "core" | "competency" | "summary";

export function actionSection(sortOrder?: number): AppraisalActionSection {
  if (sortOrder == null) return "competency";
  if (sortOrder < 30) return "core";
  if (sortOrder < 130) return "competency";
  return "summary";
}

export function groupAppraisalActionsBySection(actions: AppraisalActionRow[]): Array<{
  section: AppraisalActionSection;
  label: string;
  actions: AppraisalActionRow[];
}> {
  const order: AppraisalActionSection[] = ["core", "competency", "summary"];
  const buckets = new Map<AppraisalActionSection, AppraisalActionRow[]>();
  for (const section of order) buckets.set(section, []);
  for (const action of actions) {
    const section = actionSection(action.sortOrder);
    buckets.get(section)!.push(action);
  }
  return order
    .map((section) => ({
      section,
      label: APPRAISAL_SECTION_LABELS[section] ?? section,
      actions: buckets.get(section) ?? [],
    }))
    .filter((g) => g.actions.length > 0);
}

export function parseSelfAppraisalFormData(
  fd: FormData,
  actionIds: string[],
): {
  selfNotes: string;
  actionResponses: Array<{ actionId: string; selfRating?: number; selfNotes?: string }>;
} {
  const actionResponses: Array<{ actionId: string; selfRating?: number; selfNotes?: string }> = [];
  for (const actionId of actionIds) {
    const ratingRaw = fd.get(`action_self_rating_${actionId}`);
    const rating = ratingRaw != null && String(ratingRaw) !== "" ? Number(ratingRaw) : undefined;
    const notes = String(fd.get(`action_self_notes_${actionId}`) || "");
    if ((rating != null && rating >= 0 && rating <= 5) || notes.trim()) {
      actionResponses.push({
        actionId,
        ...(rating != null && rating >= 0 && rating <= 5 ? { selfRating: rating } : {}),
        ...(notes.trim() ? { selfNotes: notes } : {}),
      });
    }
  }
  return {
    selfNotes: String(fd.get("selfNotes") || ""),
    actionResponses,
  };
}

export function parseManagerAppraisalFormData(
  fd: FormData,
  actionIds: string[],
): {
  managerNotes: string;
  overallRating?: number;
  actionResponses: Array<{ actionId: string; managerRating?: number; managerNotes?: string }>;
} {
  const actionResponses: Array<{ actionId: string; managerRating?: number; managerNotes?: string }> = [];
  for (const actionId of actionIds) {
    const ratingRaw = fd.get(`mgr_rating_${actionId}`);
    const rating = ratingRaw != null && String(ratingRaw) !== "" ? Number(ratingRaw) : undefined;
    const notes = String(fd.get(`mgr_notes_${actionId}`) || "");
    if ((rating != null && rating >= 0 && rating <= 5) || notes.trim()) {
      actionResponses.push({
        actionId,
        ...(rating != null && rating >= 0 && rating <= 5 ? { managerRating: rating } : {}),
        ...(notes.trim() ? { managerNotes: notes } : {}),
      });
    }
  }
  const overallRaw = fd.get("overallRating");
  const overallRating = overallRaw != null && String(overallRaw) !== "" ? Number(overallRaw) : undefined;
  return {
    managerNotes: String(fd.get("managerNotes") || ""),
    overallRating:
      overallRating != null && overallRating >= 0 && overallRating <= 5 ? overallRating : undefined,
    actionResponses,
  };
}
