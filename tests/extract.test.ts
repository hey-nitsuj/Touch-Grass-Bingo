import { extractStringArray } from "../src/engine";

const numbered = Array.from({ length: 24 }, (_, i) => `${i + 1}. thing number ${i + 1}`).join("\n");

const cases: [string, boolean][] = [
  ['Here you go: ["dog on a leash","cat in a window"] hope that helps!', true],
  ['```json\n["moss on a rock","creek crossing"]\n```', true],
  [numbered, true],
  ["no items here at all", false],
  [`Here are your 24 squares:\n${numbered}`, true],
];

let pass = 0;
for (const [input, shouldFind] of cases) {
  const got = extractStringArray(input);
  const ok = (got !== null) === shouldFind;
  pass += ok ? 1 : 0;
  console.log(ok ? "PASS" : "FAIL", "->", got ? `${got.length} items, first: ${got[0]}` : "null");
}
console.log(`${pass}/${cases.length} passed`);
if (pass !== cases.length) process.exit(1);
