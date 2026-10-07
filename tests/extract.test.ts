import { extractStringArray } from "../src/engine";

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
if (pass !== checks) process.exit(1);