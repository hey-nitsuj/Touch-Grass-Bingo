import {
  CreateWebWorkerMLCEngine,
  hasModelInCache,
  type ChatOptions,
  type MLCEngineConfig,
  type WebWorkerMLCEngine,
} from "@mlc-ai/web-llm";

export const MODEL_ID = "gemma3-1b-it-q4f16_1-MLC";

export interface LoadProgress {
  progress: number;
  text: string;
}

type ProgressListener = (p: LoadProgress) => void;

let engine: WebWorkerMLCEngine | null = null;
let loading: Promise<WebWorkerMLCEngine> | null = null;

export function webGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function isModelCached(): Promise<boolean> {
  return hasModelInCache(MODEL_ID).catch(() => false);
}

/**
 * Load gemma3-1b into a Web Worker. Safe to call repeatedly — the same engine
 * promise is reused, so the model lives in memory exactly once.
 */
export function loadModel(onProgress: ProgressListener): Promise<WebWorkerMLCEngine> {
  if (loading) return loading;
  if (!webGpuAvailable()) {
    return Promise.reject(new Error("WebGPU is not available in this browser."));
  }
  const config: MLCEngineConfig = {
    initProgressCallback: (r) => onProgress({ progress: r.progress, text: r.text }),
  };
  // Gemma 3 ships with BOTH context_window_size (8192) and sliding_window_size
  // (512) positive in its mlc-chat-config.json; WebLLM refuses that combination
  // (WindowSizeConfigurationError) unless one is -1. The prebuilt override already
  // clamps context to 4096, so we disable the sliding window here — full attention
  // is fine for short card/recap generations.
  const chatOpts: ChatOptions = { sliding_window_size: -1 };
  const worker = new Worker(new URL("./mlc.worker.ts", import.meta.url), { type: "module" });
  loading = CreateWebWorkerMLCEngine(worker, MODEL_ID, config, chatOpts)
    .then((e) => {
      engine = e;
      return e;
    })
    .catch((err) => {
      loading = null;
      worker.terminate();
      throw err;
    });
  return loading;
}

export function engineReady(): boolean {
  return engine !== null;
}

/**
 * Normalize one item: trim, drop stray quotes/commas/periods, lowercase the
 * first letter (the prompt demands lowercase items).
 */
function normalizeItem(raw: string, stripMarkers = false): string {
  let s = raw.trim();
  if (stripMarkers) s = s.replace(/^[-*•\d]+[.)]\s*/, "");
  s = s.replace(/^["'`]+/, "").replace(/["'`,\s]+$/, "").replace(/[.]+$/, "").trim();
  return s.length > 0 ? s.replace(/^[A-Z]/, (c) => c.toLowerCase()) : s;
}

/** Drop duplicates while preserving order (small models repeat themselves). */
function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extract the first JSON array of strings from a model response.
 * Small models love wrapping JSON in prose or fences AND leaving trailing
 * commas, so we (1) strip fences, (2) try strict JSON.parse, and (3) if that
 * fails, salvage every quoted string inside the bracket slice. Only then do we
 * fall back to plain numbered-list parsing, which now rejects anything that
 * still looks like a JSON fragment (`["smooth",` / `umbrella",`).
 */
export function extractStringArray(text: string): string[] | null {
  const cleaned = text.replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");

  if (start !== -1 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    let raw: unknown = [];
    try {
      raw = JSON.parse(slice);
    } catch {
      // Trailing commas / truncated array: grab every quoted string instead.
      raw = [...slice.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    }
    if (Array.isArray(raw)) {
      const items = dedupe(
        raw
          .filter((x): x is string => typeof x === "string")
          .map((s) => normalizeItem(s))
          .filter((s) => s.length >= 2 && s.length <= 60),
      );
      if (items.length > 0) return items;
    }
  }

  // Fallback: the model answered as a plain list ("1. dog on a leash").
  // Reject lines that still contain JSON punctuation — those are fragments of
  // a broken array, not bingo squares.
  const lines = dedupe(
    cleaned
      .split("\n")
      .map((l) => normalizeItem(l, true))
      .filter(
        (l) =>
          l.length >= 3 &&
          l.length <= 60 &&
          !/[\[\]"{}]/.test(l) &&
          !/^(here|sure|json|output|card|bingo|only)/i.test(l),
      ),
  );
  return lines.length >= 20 ? lines.slice(0, 24) : null;
}

function seasonNow(): string {
  const m = new Date().getMonth();
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

const HABITAT_BRIEF: Record<string, string> = {
  neighborhood: "a residential neighborhood walk: houses, sidewalks, front yards, local shops",
  park: "a city or suburban park: paths, lawns, trees, playgrounds, ponds",
  trail: "a nature trail or greenbelt: dirt path, woods, hills, wildlife",
  waterfront: "a beach, lakefront, riverwalk, or pier: water, boats, shorebirds",
};

const BASE_PROMPT = `You write bingo cards for a game called "Touch Grass Bingo". Each card is a 5x5 grid of things a person can actually spot while walking outside. The center square is always a free space, so you provide exactly 24 items.

Rules for every item:
- 2 to 5 words, lowercase, no ending period
- something observable in the next 15 minutes on foot, never abstract
- specific and vivid over generic: a tiny scene or a small story, not a bare noun
- suit the season and time of day given below

The level of specificity to match (small scenes, not plain labels):
- "crow judging you"
- "dog in a bandana"
- "maple seed helicopter"
- "jogger with a hydration vest"
- "someone skipping stones better than you"
- "parked food truck"`;

/** Ask the local model for 24 bingo squares; retries once with a stricter prompt. */
export async function generateItems(opts: {
  habitat: string;
  time: string;
  focus: string;
  existing?: string[];
}): Promise<string[]> {
  if (!engine) throw new Error("Model not loaded.");
  const focusLine = opts.focus
    ? `\nThe player specifically wants to notice: ${opts.focus}. Work those in where natural.`
    : "";
  const avoidLine =
    opts.existing && opts.existing.length > 0
      ? `\nDo NOT repeat any of these already-used squares: ${opts.existing.join(", ")}.`
      : "";
  const prompt = `${BASE_PROMPT}

Setting: ${HABITAT_BRIEF[opts.habitat] ?? HABITAT_BRIEF.park}
Time of day: ${opts.time}
Season: ${seasonNow()}
${focusLine}${avoidLine}

Reply with ONLY a JSON array of exactly 24 strings. No markdown, no explanation.`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: attempt === 0 ? 0.9 : 0.4,
      max_tokens: 600,
      stream: false,
    });
    const text = res.choices[0]?.message?.content ?? "";
    const items = extractStringArray(text);
    if (items && items.length >= 20) return items.slice(0, 24);
  }
  throw new Error("The model could not format a card this time — try again or use a preset deck.");
}

/** Turn checked squares into a 2–4 sentence field recap. */
export async function generateRecap(opts: {
  habitat: string;
  time: string;
  found: string[];
  missed: string[];
  bingo: boolean;
}): Promise<string> {
  if (!engine) throw new Error("Model not loaded.");
  const prompt = `You are the friendly narrator of "Touch Grass Bingo". Write a warm, slightly wry field recap (2-4 sentences, one paragraph) of someone's ${opts.time} ${opts.habitat} walk.

They spotted: ${opts.found.join("; ")}${opts.bingo ? "\nThey got at least one full line (BINGO)." : ""}
They missed: ${opts.missed.slice(0, 8).join("; ")}

Rules: mention 2-3 specific things they found, keep it light, no emojis, no preamble, no quotation marks around the whole reply.`;
  const res = await engine.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    max_tokens: 220,
    stream: false,
  });
  return (res.choices[0]?.message?.content ?? "").trim();
}
