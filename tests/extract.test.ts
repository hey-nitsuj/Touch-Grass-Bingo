import { extractStringArray, looksDegenerate } from "../src/engine";

const numbered = Array.from({ length: 24 }, (_, i) => `${i + 1}. thing number ${i + 1}`).join("\n");

// The exact failure from the field: Gemma emitted a JSON array with trailing
// commas, JSON.parse threw, and the old fallback leaked fragments like
// `["smooth",` into grid cells.
const trailingComma = Array.from(
  { length: 24 },
  (_, i) => `"smooth item ${i + 1}",`,
).join("\n");

const cases: [string, boolean][] = [
  ['Here you go: ["dog on a leash","cat in a window"] hope that helps!', true],
  ['```json\n["moss on a rock","creek crossing"]\n```', true],
  [numbered, true],
  ["no items here at all", false],
  [`Here are your 24 squares:\n${numbered}`, true],
  [`[\n${trailingComma}\n]`, true], // trailing commas must be salvaged, not leaked
  // Duplicates (small models repeat) must collapse, not fill the card twice.
  ['["repeat","Repeat","repeat","other",\n]', true],
];

let pass = 0;
let checks = 0;
for (const [input, shouldFind] of cases) {
  const got = extractStringArray(input);
  checks += 1;
  const ok = (got !== null) === shouldFind;
  pass += ok ? 1 : 0;
  console.log(ok ? "PASS" : "FAIL", "->", got ? `${got.length} items, first: ${got[0]}` : "null");
  if (got) {
    // No JSON fragments, stray quotes, brackets, or commas may reach the grid.
    checks += 1;
    const clean = got.every((s) => /^[a-z][a-z0-9 .'&–—-]*$/.test(s));
    pass += clean ? 1 : 0;
    console.log(clean ? "PASS" : "FAIL", "-> items clean (no JSON fragments)");
  }
}
console.log(`${pass}/${checks} passed`);

// The recap loop-guard must flag Gemma 1B's garbled repetition output and
// accept coherent recaps.
const brokenRecap = `Here's a warm, slightly wry field recap of a Park Walk: The afternoon sun warmed my skin, a gentle breeze rustled through the leaves, and I noticed a peculiar sight – a maple seed helicopter landed softly on the grass. It was a small, unexpected surprise, a maple seed, and then a squirrel scampering into a small, nutty treat. Then, a squirrel with a snack. I spotted a flash of a helicopter, a brief moment of movement. The dog was playfully fetching a ball. I noticed a dog, a little bit of a landing, a shiny, and a dog was playing fetch. The world suddenly became a snapshot of a dog, a moment of a bandana. The dog was swiftly moving, a whole bit of a landing. I saw a playful dog, and then a moment of a landing.`;
const goodRecaps = [
  "The crow judging you absolutely charmed, the dog in a bandana delivered, and you turned a shortcut by the playgrounds. BINGO just past the picnic benches.",
  "Quiet walk: the heron held its pose, a paddleboarder wobbled once, and you found a skip-able stone at your feet. No bingo, but the pier made up for it.",
  "A maple seed helicopter spun down onto the path minutes into your walk, and the squirrel with a snack you'd guessed wrong about finally showed. One full line — BINGO by the fountain.",
];
checks += 2 + goodRecaps.length;
const degenOk = looksDegenerate(brokenRecap) === true && goodRecaps.every((r) => looksDegenerate(r) === false);
pass += degenOk ? 2 + goodRecaps.length : 0;
console.log(degenOk ? "PASS" : "FAIL", "-> recap loop-guard flags broken text, accepts clean recaps");
console.log(`${pass}/${checks} passed`);
if (pass !== checks) process.exit(1);