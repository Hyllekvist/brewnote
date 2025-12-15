export type BrewType = "coffee" | "tea";

export type StepKind = "prep" | "pour" | "wait" | "finish";

export type BrewStep = {
  id: string;
  label: string;
  instruction: string;

  kind: StepKind;

  /** Optional target grams for pour steps */
  targetG?: number;

  /** Length of the step in seconds (for wait/prep/finish and also pour pacing) */
  seconds?: number;
};

export type BrewRecipe = {
  type: BrewType;
  method: string;

  ratioText: string; // e.g. "1:16"
  coffeeG?: number; // coffee dose
  waterG?: number; // target water
  grindText: string; // e.g. "Medium"
  tempText: string;  // e.g. "92–94°C"
  totalSeconds: number;

  why: string; // “why this recipe fits this coffee”
  steps: BrewStep[];
};
