export type AppraisalCriterionScore = {
  /** Employee self-rating (0–5). */
  selfRating?: number;
  /** Manager confirmed final rating (0–5). */
  managerRating?: number;
  /** Legacy alias for managerRating. */
  rating?: number;
  selfNotes?: string;
  managerNotes?: string;
  completed?: boolean;
};

export type AppraisalActionScores = Record<string, AppraisalCriterionScore>;

export function getSelfRating(score: AppraisalCriterionScore | undefined): number | undefined {
  if (!score) return undefined;
  return score.selfRating ?? (score.rating != null && score.managerRating == null ? score.rating : undefined);
}

export function getManagerRating(score: AppraisalCriterionScore | undefined): number | undefined {
  if (!score) return undefined;
  return score.managerRating ?? score.rating;
}

export function parseActionScores(raw: unknown): AppraisalActionScores {
  if (!raw || typeof raw !== "object") return {};
  return raw as AppraisalActionScores;
}

export function averageSelfRatings(scores: AppraisalActionScores, actionIds: string[]): number | undefined {
  const values = actionIds
    .map((id) => getSelfRating(scores[id]))
    .filter((v): v is number => v != null && v >= 0);
  if (!values.length) return undefined;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function averageConfirmedRatings(scores: AppraisalActionScores, actionIds: string[]): number | undefined {
  const values = actionIds
    .map((id) => getManagerRating(scores[id]))
    .filter((v): v is number => v != null && v >= 0);
  if (!values.length) return undefined;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function mergeSelfAppraisalScores(
  prior: AppraisalActionScores,
  responses: Array<{ actionId: string; selfRating?: number; selfNotes?: string }>,
): AppraisalActionScores {
  const next: AppraisalActionScores = { ...prior };
  for (const row of responses) {
    next[row.actionId] = {
      ...next[row.actionId],
      ...(row.selfRating != null ? { selfRating: row.selfRating } : {}),
      ...(row.selfNotes != null ? { selfNotes: row.selfNotes } : {}),
    };
  }
  return next;
}

export function mergeManagerAppraisalScores(
  prior: AppraisalActionScores,
  responses: Array<{ actionId: string; managerRating?: number; managerNotes?: string }>,
): AppraisalActionScores {
  const next: AppraisalActionScores = { ...prior };
  for (const row of responses) {
    const managerRating = row.managerRating;
    next[row.actionId] = {
      ...next[row.actionId],
      ...(managerRating != null ? { managerRating, rating: managerRating } : {}),
      ...(row.managerNotes != null ? { managerNotes: row.managerNotes } : {}),
    };
  }
  return next;
}
