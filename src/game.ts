import { FREE_INDEX, type Card } from "./types";

const STORAGE_KEY = "touch-grass-bingo:card-v1";

/** All winning lines on a 5x5 board as index arrays. */
export const LINES: number[][] = (() => {
  const lines: number[][] = [];
  for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  lines.push([0, 6, 12, 18, 24]);
  lines.push([4, 8, 12, 16, 20]);
  return lines;
})();

export function completedLines(card: Card): number[][] {
  return LINES.filter((line) => line.every((i) => card.checked[i]));
}

export function bingos(card: Card): number {
  return completedLines(card).length;
}

/** Squares on any completed line — used for the visual highlight. */
export function bingoSquares(card: Card): Set<number> {
  const set = new Set<number>();
  for (const line of completedLines(card)) for (const i of line) set.add(i);
  return set;
}

export function toggleSquare(card: Card, index: number): void {
  if (index === FREE_INDEX) return;
  card.checked[index] = !card.checked[index];
}

export function newCard(items: string[], params: Card["params"], source: Card["source"]): Card {
  const squares = items.slice(0, 24);
  squares.splice(FREE_INDEX, 0, "Free space —\nyou're already outside");
  return {
    items: squares,
    checked: squares.map((_, i) => i === FREE_INDEX),
    params,
    createdAt: Date.now(),
    source,
  };
}

export function saveCard(card: Card | null): void {
  try {
    if (card) localStorage.setItem(STORAGE_KEY, JSON.stringify(card));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode — the game just won't survive a reload */
  }
}

export function loadCard(): Card | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Card;
    if (!Array.isArray(parsed.items) || parsed.items.length !== 25) return null;
    if (!Array.isArray(parsed.checked) || parsed.checked.length !== 25) return null;
    parsed.checked[FREE_INDEX] = true;
    return parsed;
  } catch {
    return null;
  }
}

/** Prior items from earlier sessions, so regeneration avoids repeats. */
export function usedItems(): string[] {
  const card = loadCard();
  return card ? card.items.filter((_, i) => i !== FREE_INDEX) : [];
}
