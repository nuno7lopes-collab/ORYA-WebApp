import { PadelResultValidationMode, padel_match_status } from "@prisma/client";
import { normalizePadelMatchStatus } from "@/domain/padel/liveStatus";

export type ResultWorkflowAction =
  | "submit_result"
  | "confirm_result"
  | "expire_pending_result"
  | "reject_result"
  | "reset_pending_result"
  | "override_result"
  | "dispute_result"
  | "walkover"
  | "retired"
  | "cancel_match";

export type ResultWorkflowActorKind = "STAFF" | "PLAYER";

export type ResultWorkflowConfig = {
  resultValidationMode: PadelResultValidationMode;
  pendingConfirmationWindowMinutes: number;
  playerResultSubmissionEnabled: boolean;
};

type LiveWorkflowIdempotencyRecord = {
  action: ResultWorkflowAction;
  actorId: string;
  scopeKey: string;
  status: string;
  at: string;
};

type LiveWorkflowEnvelope = {
  resultSubmittedAt?: string;
  submittedByUserId?: string;
  submittedByActorKind?: ResultWorkflowActorKind;
  pendingConfirmationExpiresAt?: string | null;
  pendingReviewExpiredAt?: string | null;
  pendingResetAt?: string | null;
  pendingResetByUserId?: string | null;
  pendingResetTargetState?: "IN_PROGRESS" | "RESULT_SUBMITTED" | null;
  resolutionType?: "CONFIRM" | "OVERRIDE" | null;
  idempotency?: Record<string, LiveWorkflowIdempotencyRecord>;
  transitionLog?: Array<{
    at: string;
    action: ResultWorkflowAction;
    fromStatus: string | null;
    toStatus: string;
    actorId: string;
    actorKind: ResultWorkflowActorKind;
  }>;
};

export function asScoreObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function normalizeResultWorkflowConfig(input: {
  resultValidationMode?: PadelResultValidationMode | null;
  pendingConfirmationWindowMinutes?: number | null;
  playerResultSubmissionEnabled?: boolean | null;
}): ResultWorkflowConfig {
  return {
    resultValidationMode: input.resultValidationMode ?? PadelResultValidationMode.IMMEDIATE_OFFICIAL,
    pendingConfirmationWindowMinutes:
      typeof input.pendingConfirmationWindowMinutes === "number" &&
      Number.isFinite(input.pendingConfirmationWindowMinutes) &&
      input.pendingConfirmationWindowMinutes > 0
        ? Math.floor(input.pendingConfirmationWindowMinutes)
        : 15,
    playerResultSubmissionEnabled: input.playerResultSubmissionEnabled === true,
  };
}

export function resolveFinalStatusFromScore(score: Record<string, unknown>): padel_match_status {
  const resultType = typeof score.resultType === "string" ? score.resultType.trim().toUpperCase() : null;
  if (resultType === "WALKOVER" || score.walkover === true) return padel_match_status.WALKOVER;
  if (resultType === "RETIREMENT" || resultType === "INJURY") return padel_match_status.RETIRED;
  return padel_match_status.OFFICIAL;
}

function getLiveWorkflow(score: Record<string, unknown>): LiveWorkflowEnvelope {
  const raw = score.liveWorkflow;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as LiveWorkflowEnvelope;
}

function setLiveWorkflow(score: Record<string, unknown>, workflow: LiveWorkflowEnvelope) {
  return {
    ...score,
    liveWorkflow: workflow,
  } as Record<string, unknown>;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isPendingConfirmationExpired(score: Record<string, unknown>, now = new Date()): boolean {
  const workflow = getLiveWorkflow(score);
  const expiry = parseIsoDate(workflow.pendingConfirmationExpiresAt);
  if (!expiry) return false;
  return expiry.getTime() <= now.getTime();
}

export function buildSubmitTransition(params: {
  config: ResultWorkflowConfig;
  actorKind: ResultWorkflowActorKind;
  currentStatus: string | null | undefined;
  currentScore: Record<string, unknown>;
  incomingScorePatch: Record<string, unknown>;
  actorId: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const score = {
    ...params.currentScore,
    ...params.incomingScorePatch,
  } as Record<string, unknown>;
  const workflow = getLiveWorkflow(score);

  const fromStatus = normalizePadelMatchStatus(params.currentStatus ?? null);
  if (!fromStatus) {
    throw new Error("INVALID_MATCH_STATUS");
  }

  const supportsPlayerSubmit = params.config.playerResultSubmissionEnabled;
  if (params.actorKind === "PLAYER" && !supportsPlayerSubmit) {
    throw new Error("PLAYER_SUBMISSION_DISABLED");
  }

  const pendingMode =
    params.actorKind === "PLAYER" ||
    params.config.resultValidationMode === PadelResultValidationMode.IMMEDIATE_PENDING_THEN_OFFICIAL;

  const nextStatus = pendingMode ? padel_match_status.PENDING_CONFIRMATION : resolveFinalStatusFromScore(score);
  const transitionAt = now.toISOString();
  const expiresAt = pendingMode
    ? new Date(now.getTime() + params.config.pendingConfirmationWindowMinutes * 60 * 1000).toISOString()
    : null;

  const nextWorkflow: LiveWorkflowEnvelope = {
    ...workflow,
    resultSubmittedAt: transitionAt,
    submittedByUserId: params.actorId,
    submittedByActorKind: params.actorKind,
    pendingConfirmationExpiresAt: expiresAt,
    pendingReviewExpiredAt: null,
    resolutionType: pendingMode ? null : "CONFIRM",
    transitionLog: [
      ...(Array.isArray(workflow.transitionLog) ? workflow.transitionLog : []),
      {
        at: transitionAt,
        action: "submit_result",
        fromStatus: fromStatus,
        toStatus: nextStatus,
        actorId: params.actorId,
        actorKind: params.actorKind,
      },
    ],
  };

  return {
    status: nextStatus,
    score: setLiveWorkflow(score, nextWorkflow),
  };
}

export function buildConfirmTransition(params: {
  currentStatus: string | null | undefined;
  currentScore: Record<string, unknown>;
  actorId: string;
  actorKind: ResultWorkflowActorKind;
  resolutionType?: "CONFIRM" | "OVERRIDE";
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const status = normalizePadelMatchStatus(params.currentStatus ?? null);
  if (!status) throw new Error("INVALID_MATCH_STATUS");

  const allowed = new Set<padel_match_status>([
    padel_match_status.RESULT_SUBMITTED,
    padel_match_status.PENDING_CONFIRMATION,
    padel_match_status.PENDING_REVIEW_EXPIRED,
    padel_match_status.DISPUTED,
  ]);
  if (!allowed.has(status)) {
    if (
      status === padel_match_status.OFFICIAL ||
      status === padel_match_status.WALKOVER ||
      status === padel_match_status.RETIRED
    ) {
      return {
        status,
        score: params.currentScore,
        noop: true,
      };
    }
    throw new Error("INVALID_CONFIRM_TRANSITION");
  }

  const nextStatus =
    params.resolutionType === "OVERRIDE"
      ? padel_match_status.OFFICIAL
      : resolveFinalStatusFromScore(params.currentScore);
  const workflow = getLiveWorkflow(params.currentScore);
  const transitionAt = now.toISOString();
  const nextWorkflow: LiveWorkflowEnvelope = {
    ...workflow,
    pendingConfirmationExpiresAt: null,
    pendingReviewExpiredAt: null,
    resolutionType: params.resolutionType ?? "CONFIRM",
    transitionLog: [
      ...(Array.isArray(workflow.transitionLog) ? workflow.transitionLog : []),
      {
        at: transitionAt,
        action: params.resolutionType === "OVERRIDE" ? "override_result" : "confirm_result",
        fromStatus: status,
        toStatus: nextStatus,
        actorId: params.actorId,
        actorKind: params.actorKind,
      },
    ],
  };

  return {
    status: nextStatus,
    score: setLiveWorkflow(params.currentScore, nextWorkflow),
    noop: false,
  };
}

export function buildRejectTransition(params: {
  currentStatus: string | null | undefined;
  currentScore: Record<string, unknown>;
  actorId: string;
  actorKind: ResultWorkflowActorKind;
  reasonText: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const status = normalizePadelMatchStatus(params.currentStatus ?? null);
  if (!status) throw new Error("INVALID_MATCH_STATUS");

  if (status !== padel_match_status.PENDING_CONFIRMATION && status !== padel_match_status.PENDING_REVIEW_EXPIRED) {
    throw new Error("INVALID_REJECT_TRANSITION");
  }

  const workflow = getLiveWorkflow(params.currentScore);
  const transitionAt = now.toISOString();
  const score = {
    ...params.currentScore,
    rejectReasonText: params.reasonText,
    rejectedAt: transitionAt,
    rejectedBy: params.actorId,
  } as Record<string, unknown>;

  const nextWorkflow: LiveWorkflowEnvelope = {
    ...workflow,
    pendingConfirmationExpiresAt: null,
    transitionLog: [
      ...(Array.isArray(workflow.transitionLog) ? workflow.transitionLog : []),
      {
        at: transitionAt,
        action: "reject_result",
        fromStatus: status,
        toStatus: padel_match_status.RESULT_SUBMITTED,
        actorId: params.actorId,
        actorKind: params.actorKind,
      },
    ],
  };

  return {
    status: padel_match_status.RESULT_SUBMITTED,
    score: setLiveWorkflow(score, nextWorkflow),
  };
}

export function buildResetPendingTransition(params: {
  currentStatus: string | null | undefined;
  currentScore: Record<string, unknown>;
  actorId: string;
  actorKind: ResultWorkflowActorKind;
  reasonCode: string;
  reasonText: string;
  targetState: "IN_PROGRESS" | "RESULT_SUBMITTED";
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const status = normalizePadelMatchStatus(params.currentStatus ?? null);
  if (status !== padel_match_status.PENDING_REVIEW_EXPIRED) {
    throw new Error("INVALID_RESET_PENDING_TRANSITION");
  }

  const workflow = getLiveWorkflow(params.currentScore);
  const transitionAt = now.toISOString();
  const score = {
    ...params.currentScore,
    pendingResetReasonCode: params.reasonCode,
    pendingResetReasonText: params.reasonText,
    pendingResetAt: transitionAt,
    pendingResetBy: params.actorId,
  } as Record<string, unknown>;

  const nextWorkflow: LiveWorkflowEnvelope = {
    ...workflow,
    pendingReviewExpiredAt: null,
    pendingResetAt: transitionAt,
    pendingResetByUserId: params.actorId,
    pendingResetTargetState: params.targetState,
    transitionLog: [
      ...(Array.isArray(workflow.transitionLog) ? workflow.transitionLog : []),
      {
        at: transitionAt,
        action: "reset_pending_result",
        fromStatus: status,
        toStatus: params.targetState,
        actorId: params.actorId,
        actorKind: params.actorKind,
      },
    ],
  };

  return {
    status: params.targetState === "IN_PROGRESS" ? padel_match_status.IN_PROGRESS : padel_match_status.RESULT_SUBMITTED,
    score: setLiveWorkflow(score, nextWorkflow),
  };
}

export function markPendingReviewExpired(params: {
  currentStatus: string | null | undefined;
  currentScore: Record<string, unknown>;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const status = normalizePadelMatchStatus(params.currentStatus ?? null);
  if (status !== padel_match_status.PENDING_CONFIRMATION) {
    return {
      changed: false,
      status: status ?? null,
      score: params.currentScore,
    };
  }

  if (!isPendingConfirmationExpired(params.currentScore, now)) {
    return {
      changed: false,
      status,
      score: params.currentScore,
    };
  }

  const workflow = getLiveWorkflow(params.currentScore);
  const at = now.toISOString();
  const nextWorkflow: LiveWorkflowEnvelope = {
    ...workflow,
    pendingReviewExpiredAt: at,
    transitionLog: [
      ...(Array.isArray(workflow.transitionLog) ? workflow.transitionLog : []),
      {
        at,
        action: "expire_pending_result",
        fromStatus: padel_match_status.PENDING_CONFIRMATION,
        toStatus: padel_match_status.PENDING_REVIEW_EXPIRED,
        actorId: "system",
        actorKind: "STAFF",
      },
    ],
  };

  return {
    changed: true,
    status: padel_match_status.PENDING_REVIEW_EXPIRED,
    score: setLiveWorkflow(params.currentScore, nextWorkflow),
  };
}

export function buildIdempotencyScope(params: {
  tournamentId: number;
  matchId: number;
  action: ResultWorkflowAction;
  actorId: string;
  clientRequestId: string;
}) {
  return `${params.tournamentId}:${params.matchId}:${params.action}:${params.actorId}:${params.clientRequestId}`;
}

export function readIdempotencyReplay(params: {
  score: Record<string, unknown>;
  scopeKey: string;
}): LiveWorkflowIdempotencyRecord | null {
  const workflow = getLiveWorkflow(params.score);
  const idempotency = workflow.idempotency;
  if (!idempotency || typeof idempotency !== "object") return null;
  const record = idempotency[params.scopeKey];
  if (!record || typeof record !== "object") return null;
  return record as LiveWorkflowIdempotencyRecord;
}

export function writeIdempotencyRecord(params: {
  score: Record<string, unknown>;
  scopeKey: string;
  action: ResultWorkflowAction;
  actorId: string;
  status: string;
  now?: Date;
}) {
  const workflow = getLiveWorkflow(params.score);
  const at = (params.now ?? new Date()).toISOString();
  const nextWorkflow: LiveWorkflowEnvelope = {
    ...workflow,
    idempotency: {
      ...(workflow.idempotency ?? {}),
      [params.scopeKey]: {
        action: params.action,
        actorId: params.actorId,
        scopeKey: params.scopeKey,
        status: params.status,
        at,
      },
    },
  };
  return setLiveWorkflow(params.score, nextWorkflow);
}
