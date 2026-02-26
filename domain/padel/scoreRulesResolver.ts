import {
  DEFAULT_PADEL_SCORE_RULES,
  normalizePadelScoreRules,
  type PadelDeuceMode,
  type PadelScoreMode,
  type PadelScoreRules,
} from "@/domain/padel/score";

export type EffectiveScoreRuleSource = "CATEGORY" | "GLOBAL" | "DEFAULT";

export type PadelScoreRuleSummary = {
  source: EffectiveScoreRuleSource;
  categoryId: number | null;
  scoreMode: PadelScoreMode;
  deuceMode: PadelDeuceMode;
  deuceLabel: string;
  shortLabel: string;
  label: string;
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function toCategoryKey(categoryId: number | null | undefined): string | null {
  if (!Number.isInteger(categoryId) || Number(categoryId) <= 0) return null;
  return String(Math.floor(Number(categoryId)));
}

export function sanitizeScoreRulesByCategory(raw: unknown): Record<string, PadelScoreRules> {
  const payload = asRecord(raw);
  if (!payload) return {};
  return Object.entries(payload).reduce<Record<string, PadelScoreRules>>((acc, [key, value]) => {
    const numericKey = Number(key);
    if (!Number.isInteger(numericKey) || numericKey <= 0) return acc;
    const normalized = normalizePadelScoreRules(value);
    if (!normalized) return acc;
    acc[String(Math.floor(numericKey))] = normalized;
    return acc;
  }, {});
}

export function resolveEffectiveScoreRules(
  advancedSettings: unknown,
  categoryId?: number | null,
): {
  rules: PadelScoreRules;
  source: EffectiveScoreRuleSource;
  categoryId: number | null;
} {
  const advanced = asRecord(advancedSettings);
  const categoryKey = toCategoryKey(categoryId);
  const byCategory = sanitizeScoreRulesByCategory(advanced?.scoreRulesByCategory);
  if (categoryKey) {
    const categoryRules = byCategory[categoryKey];
    if (categoryRules) {
      return {
        rules: categoryRules,
        source: "CATEGORY",
        categoryId: Number(categoryKey),
      };
    }
  }

  const globalRules = normalizePadelScoreRules(advanced?.scoreRules);
  if (globalRules) {
    return {
      rules: globalRules,
      source: "GLOBAL",
      categoryId: null,
    };
  }

  return {
    rules: DEFAULT_PADEL_SCORE_RULES,
    source: "DEFAULT",
    categoryId: null,
  };
}

export function buildScoreRuleSummary(params: {
  rules: PadelScoreRules;
  source: EffectiveScoreRuleSource;
  categoryId?: number | null;
}): PadelScoreRuleSummary {
  const deuceLabel = params.rules.deuceMode === "GOLDEN_POINT" ? "Ponto de ouro" : "Vantagens";
  const modeLabel =
    params.rules.scoreMode === "TIMED_GAMES"
      ? "Tempo"
      : `${params.rules.setsToWin} set(s) · ${params.rules.gamesToWinSet} jogos`;
  return {
    source: params.source,
    categoryId: params.source === "CATEGORY" ? params.categoryId ?? null : null,
    scoreMode: params.rules.scoreMode,
    deuceMode: params.rules.deuceMode,
    deuceLabel,
    shortLabel: deuceLabel,
    label: `${modeLabel} · ${deuceLabel}`,
  };
}
