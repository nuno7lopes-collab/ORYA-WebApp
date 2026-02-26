import { DEFAULT_PADEL_SCORE_RULES, type PadelDeuceMode, type PadelScoreRules } from "@/domain/padel/score";

export type PadelScoreRulesPresetId = "STANDARD" | "STANDARD_SUPER" | "SINGLE_SET";

type ScoreRulesPreset = {
  id: PadelScoreRulesPresetId;
  label: string;
  description: string;
  rules: PadelScoreRules;
};

const withScoreOverrides = (overrides: Partial<PadelScoreRules>) => ({
  ...DEFAULT_PADEL_SCORE_RULES,
  ...overrides,
});

export const PADEL_SCORE_RULE_PRESETS: ScoreRulesPreset[] = [
  {
    id: "STANDARD",
    label: "Standard",
    description: "Melhor de 3 · 6 jogos · TB 6-6",
    rules: withScoreOverrides({ allowSuperTieBreak: false }),
  },
  {
    id: "STANDARD_SUPER",
    label: "Standard + Super TB",
    description: "Melhor de 3 · 3º set em super tie-break (10)",
    rules: withScoreOverrides({ allowSuperTieBreak: true }),
  },
  {
    id: "SINGLE_SET",
    label: "Jogo único",
    description: "1 set a 6 · TB 6-6",
    rules: withScoreOverrides({ setsToWin: 1, maxSets: 1, allowSuperTieBreak: false }),
  },
];

export const PADEL_DEUCE_MODE_OPTIONS: Array<{ value: PadelDeuceMode; label: string }> = [
  { value: "ADVANTAGE", label: "Vantagens (deuce normal)" },
  { value: "GOLDEN_POINT", label: "Ponto de ouro (no-ad)" },
];

const SCORE_RULE_KEYS: Array<keyof PadelScoreRules> = [
  "scoreMode",
  "setsToWin",
  "maxSets",
  "gamesToWinSet",
  "tieBreakAt",
  "tieBreakTo",
  "allowSuperTieBreak",
  "superTieBreakTo",
  "superTieBreakWinBy",
  "superTieBreakOnlyDecider",
  "allowExtendedGames",
  "allowTimedDraw",
];

export function scoreRulesEqual(a: PadelScoreRules, b: PadelScoreRules) {
  return SCORE_RULE_KEYS.every((key) => a[key] === b[key]);
}

export function resolveScoreRulesPresetId(rules: PadelScoreRules): PadelScoreRulesPresetId | "CUSTOM" {
  const match = PADEL_SCORE_RULE_PRESETS.find((preset) => scoreRulesEqual(preset.rules, rules));
  return match?.id ?? "CUSTOM";
}

export function buildScoreRulesFromPreset(
  presetId: PadelScoreRulesPresetId | "CUSTOM",
  currentRules: PadelScoreRules,
  deuceMode?: PadelDeuceMode,
): PadelScoreRules {
  if (presetId === "CUSTOM") {
    return {
      ...currentRules,
      ...(deuceMode ? { deuceMode } : {}),
    };
  }
  const preset = PADEL_SCORE_RULE_PRESETS.find((item) => item.id === presetId) ?? PADEL_SCORE_RULE_PRESETS[0]!;
  return {
    ...preset.rules,
    deuceMode: deuceMode ?? preset.rules.deuceMode,
  };
}
