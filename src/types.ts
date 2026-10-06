export type Habitat = "neighborhood" | "park" | "trail" | "waterfront";
export type TimeOfDay = "morning" | "afternoon" | "evening";

export interface CardParams {
  habitat: Habitat;
  time: TimeOfDay;
  focus: string;
}

export interface Card {
  /** Exactly 25 entries; index 12 (center) is always the free space. */
  items: string[];
  checked: boolean[];
  params: CardParams;
  createdAt: number;
  source: "ai" | "preset";
}

export const FREE_INDEX = 12;

export const HABITATS: { id: Habitat; label: string; emoji: string }[] = [
  { id: "neighborhood", label: "Neighborhood", emoji: "🏘️" },
  { id: "park", label: "Park", emoji: "🌳" },
  { id: "trail", label: "Trail", emoji: "🥾" },
  { id: "waterfront", label: "Waterfront", emoji: "🌊" },
];

export const TIMES: { id: TimeOfDay; label: string; emoji: string }[] = [
  { id: "morning", label: "Morning", emoji: "🌅" },
  { id: "afternoon", label: "Afternoon", emoji: "☀️" },
  { id: "evening", label: "Evening", emoji: "🌆" },
];
