import type { BrewRecipe, BrewType } from "./types";

export function getRecipe(type: BrewType): BrewRecipe {
  // v1: hardcoded “Pour-over” flow (Supabase senere)
  if (type === "tea") {
    return {
      type: "tea",
      method: "Tea Brew",
      ratioText: "1:50",
      coffeeG: undefined,
      waterG: 250,
      grindText: "—",
      tempText: "90–95°C",
      totalSeconds: 180,
      why: "Stabil infusion med fokus på klarhed og balance.",
      steps: [
        {
          id: "prep",
          label: "Prep",
          instruction: "Varm kop. Hæld vand på og start timer.",
          kind: "prep",
          seconds: 20,
        },
        {
          id: "steep",
          label: "Steep",
          instruction: "Lad trække. Rør evt. let efter 1 min.",
          kind: "wait",
          seconds: 140,
        },
        {
          id: "finish",
          label: "Finish",
          instruction: "Fjern te. Smag og log.",
          kind: "finish",
          seconds: 20,
        },
      ],
    };
  }

  return {
    type: "coffee",
    method: "Pour-over (Anbefalet)",
    ratioText: "1:16",
    coffeeG: 18,
    waterG: 300,
    grindText: "Medium",
    tempText: "92–94°C",
    totalSeconds: 175, // 2:55
    why: "Balancerer krop og sødme til den her kaffe, uden at gøre den bitter.",
    steps: [
      {
        id: "prep",
        label: "Prep",
        instruction: "Skyl filter + varm server/kop. Nulstil vægt.",
        kind: "prep",
        seconds: 20,
      },
      {
        id: "bloom",
        label: "Bloom",
        instruction: "Hæld til alle grunde er mættede. Vent til bloom er færdig.",
        kind: "pour",
        targetG: 50,
        seconds: 35,
      },
      {
        id: "pour1",
        label: "Pour 1",
        instruction: "Hæld stabilt i cirkler. Hold flowet roligt.",
        kind: "pour",
        targetG: 150,
        seconds: 40,
      },
      {
        id: "pour2",
        label: "Pour 2",
        instruction: "Top op til slutvægt. Stop og lad dræne færdigt.",
        kind: "pour",
        targetG: 300,
        seconds: 55,
      },
      {
        id: "finish",
        label: "Finish",
        instruction: "Ryst let / swirl. Smag og log resultat.",
        kind: "finish",
        seconds: 25,
      },
    ],
  };
}
