import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { bingoSquares, bingos, loadCard, newCard, saveCard, toggleSquare, usedItems } from "./game";
import { padDeck, presetDeck } from "./presets";
import { HABITATS, TIMES, FREE_INDEX, type Card, type CardParams, type Habitat, type TimeOfDay } from "./types";

registerSW({ immediate: true });

/* ---------- lazy WebLLM loader (keeps the 6 MB engine out of the initial bundle) ---------- */
type EngineModule = typeof import("./engine");
let engineModule: EngineModule | null = null;
let engineLoading: Promise<EngineModule> | null = null;

function loadEngineModule(): Promise<EngineModule> {
  if (engineModule) return Promise.resolve(engineModule);
  if (!engineLoading) {
    engineLoading = import("./engine").then((m) => {
      engineModule = m;
      return m;
    });
  }
  return engineLoading;
}

function webGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

/* ---------- element handles ---------- */
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const modelDot = $<HTMLElement>("model-dot");
const modelChipText = $("model-chip-text");
const generateBtn = $<HTMLButtonElement>("generate-btn");
const presetBtn = $<HTMLButtonElement>("preset-btn");
const focusInput = $<HTMLInputElement>("focus-input");
const engineStatus = $("engine-status");
const engineStatusText = $("engine-status-text");
const engineStatusPct = $("engine-status-pct");
const engineProgressBar = $("engine-progress-bar");
const setupSection = $("setup");
const cardArea = $("card-area");
const emptyState = $("empty-state");
const cardTitle = $("card-title");
const cardMeta = $("card-meta");
const bingoGrid = $("bingo-grid");
const bingoBanner = $("bingo-banner");
const shareBtn = $<HTMLButtonElement>("share-btn");
const newCardBtn = $<HTMLButtonElement>("new-card-btn");
const recapBtn = $<HTMLButtonElement>("recap-btn");
const recapHint = $("recap-hint");
const recapBox = $("recap-box");
const recapText = $("recap-text");

/* ---------- setup controls ---------- */
const params: CardParams = {
  habitat: "park",
  time: (["morning", "afternoon", "evening"] as TimeOfDay[])[
    [5, 11, 17].indexOf([5, 11, 17].find((h) => new Date().getHours() < h) ?? 17)
  ],
  focus: "",
};

function renderChips<T extends Habitat | TimeOfDay>(
  mount: HTMLElement,
  options: { id: T; label: string; emoji: string }[],
  selected: T,
  onPick: (id: T) => void,
): void {
  mount.innerHTML = "";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (opt.id === selected ? " chip-on" : "");
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(opt.id === selected));
    btn.textContent = `${opt.emoji} ${opt.label}`;
    btn.addEventListener("click", () => onPick(opt.id));
    mount.appendChild(btn);
  }
}

function paintSetup(): void {
  renderChips($("habitat-chips"), HABITATS, params.habitat, (id) => {
    params.habitat = id;
    paintSetup();
  });
  renderChips($("time-chips"), TIMES, params.time, (id) => {
    params.time = id;
    paintSetup();
  });
}

focusInput.addEventListener("input", () => {
  params.focus = focusInput.value.trim();
});

/* ---------- model status ---------- */
function setChip(state: "idle" | "loading" | "ready" | "offline" | "error", text: string): void {
  modelDot.dataset.state = state;
  modelChipText.textContent = text;
}

function showProgress(text: string, pct?: number): void {
  engineStatus.hidden = false;
  engineStatusText.textContent = text;
  engineStatusPct.textContent = pct !== undefined ? `${Math.round(pct * 100)}%` : "";
  engineProgressBar.style.width = pct !== undefined ? `${Math.round(pct * 100)}%` : "8%";
}

function hideProgress(): void {
  engineStatus.hidden = true;
}

async function ensureModel(): Promise<boolean> {
  if (engineModule?.engineReady()) return true;
  if (!webGpuAvailable()) {
    setChip("offline", "WebGPU unavailable — presets only");
    return false;
  }
  setChip("loading", "Model: downloading…");
  showProgress("Loading the local AI engine…", 0);
  try {
    const m = await loadEngineModule();
    if (m.engineReady()) {
      setChip("ready", "Model: ready (offline capable)");
      hideProgress();
      return true;
    }
    await m.loadModel((p) => {
      const big = /fetch|download|wasm|weight/i.test(p.text);
      showProgress(big ? "Downloading Gemma 3 1B (~570 MB, one time)…" : "Initializing runtime…", p.progress);
    });
    setChip("ready", "Model: ready (offline capable)");
    hideProgress();
    return true;
  } catch (err) {
    setChip("error", "Model failed to load");
    hideProgress();
    console.error(err);
    return false;
  }
}

/* ---------- card rendering ---------- */
let card: Card | null = null;

function labelForHabitat(h: Habitat): string {
  return HABITATS.find((x) => x.id === h)?.label ?? h;
}

function renderCard(): void {
  if (!card) return;
  const { items, checked, params: p, source, createdAt } = card;
  cardTitle.textContent = `${labelForHabitat(p.habitat)} ${p.time} walk`;
  const date = new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const focusNote = p.focus ? ` · watching for ${p.focus}` : "";
  cardMeta.textContent = `${date} · ${source === "ai" ? "Gemma 3 1B, on-device" : "preset deck"}${focusNote}`;

  const onBingo = bingoSquares(card);
  bingoGrid.innerHTML = "";
  items.forEach((item, i) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    if (i === FREE_INDEX) cell.classList.add("cell-free");
    if (checked[i]) cell.classList.add("cell-checked");
    if (onBingo.has(i)) cell.classList.add("cell-bingo");
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-pressed", String(checked[i]));
    cell.textContent = item;
    cell.addEventListener("click", () => {
      if (!card) return;
      toggleSquare(card, i);
      saveCard(card);
      renderCard();
    });
    bingoGrid.appendChild(cell);
  });

  const lines = bingos(card);
  bingoBanner.hidden = lines === 0;
  if (lines > 0) {
    bingoBanner.textContent =
      lines === 1 ? "🎉 BINGO! Now go get some fresh air." : `🎉 ${lines} BINGOs! Absolute menace.`;
  }
  setupSection.hidden = true;
  emptyState.hidden = true;
  cardArea.hidden = false;
}

function showCard(next: Card): void {
  card = next;
  saveCard(card);
  renderCard();
}

/* ---------- actions ---------- */
function busy(on: boolean): void {
  generateBtn.disabled = on;
  presetBtn.disabled = on;
  generateBtn.textContent = on ? "…" : "✦ Generate with local AI";
}

async function generate(): Promise<void> {
  busy(true);
  try {
    const ensured = await ensureModel();
    const m = engineModule;
    const ok = ensured && !!m?.engineReady();
    if (!ok || !m) {
      recapHint.textContent = "No WebGPU here — using a preset deck instead.";
      showCard(newCard(presetDeck(params.habitat), { ...params }, "preset"));
      return;
    }
    showProgress("Gemma is thinking about your walk…", undefined);
    generateBtn.textContent = "Writing your card…";
    const raw = await m.generateItems({
      habitat: params.habitat,
      time: params.time,
      focus: params.focus,
      existing: usedItems(),
    });
    // Small models sometimes under-deliver; top the card up to a full 24.
    const items = raw.length >= 24 ? raw : padDeck(raw);
    showCard(newCard(items, { ...params }, "ai"));
    hideProgress();
  } catch (err) {
    console.error(err);
    hideProgress();
    setChip("error", "Generation failed — try again");
    showCard(newCard(presetDeck(params.habitat), { ...params }, "preset"));
  } finally {
    busy(false);
  }
}

function usePreset(): void {
  showCard(newCard(presetDeck(params.habitat), { ...params }, "preset"));
}

async function writeRecap(): Promise<void> {
  if (!card) return;
  recapBtn.disabled = true;
  recapBtn.textContent = "Writing…";
  recapBox.hidden = false;
  recapText.textContent = "";
  try {
    const ensured = await ensureModel();
    const m = engineModule;
    const ok = ensured && !!m?.engineReady();
    if (!ok || !m) throw new Error("Model unavailable");
    const found = card.items.filter((_, i) => i !== FREE_INDEX && card!.checked[i]);
    const missed = card.items.filter((_, i) => i !== FREE_INDEX && !card!.checked[i]);
    const text = await m.generateRecap({
      habitat: labelForHabitat(card.params.habitat),
      time: card.params.time,
      found,
      missed,
      bingo: bingos(card) > 0,
    });
    recapText.textContent = text;
    recapHint.textContent = "Generated by Gemma 3 1B — it never left your device.";
  } catch (err) {
    console.error(err);
    recapText.textContent =
      "The model couldn't write a recap right now. Reload the page (it caches after the first download) and try again.";
  } finally {
    recapBtn.disabled = false;
    recapBtn.textContent = "✍ Write my field recap";
  }
}

/** Render the card to a canvas and download it as a PNG. */
async function shareCard(): Promise<void> {
  if (!card) return;
  const W = 1080;
  const pad = 48;
  const gap = 14;
  const cols = 5;
  const cellSize = (W - pad * 2 - gap * (cols - 1)) / cols;
  const headH = 170;
  const footH = 96;
  const H = headH + cellSize * 5 + gap * 4 + footH + pad;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#f6f1e3";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#1f3d2b";
  ctx.font = "700 54px Fraunces, Georgia, serif";
  ctx.fillText("Touch Grass Bingo", pad, 84);
  ctx.font = "300 30px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillStyle = "#4a5a4e";
  ctx.fillText(
    `${labelForHabitat(card.params.habitat)} · ${card.params.time} walk`,
    pad,
    132,
  );

  const onBingo = bingoSquares(card);
  card.items.forEach((item, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = pad + c * (cellSize + gap);
    const y = headH + r * (cellSize + gap);
    const checked = card!.checked[i];

    ctx.fillStyle = checked ? "#e7efc9" : "#fffdf6";
    ctx.strokeStyle = onBingo.has(i) ? "#c8a02c" : "#c9c2ac";
    ctx.lineWidth = onBingo.has(i) ? 5 : 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cellSize, cellSize, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = i === FREE_INDEX ? "#2f6b45" : checked ? "#3c5a2e" : "#2b3a2f";
    const weight = i === FREE_INDEX ? "700" : checked ? "600" : "400";
    const size = item.length > 26 ? 24 : 28;
    ctx.font = `${weight} ${size}px 'Space Grotesk', system-ui, sans-serif`;
    wrapText(ctx, item, x + 18, y + 40, cellSize - 36, size * 1.3, cellSize - 30);
    if (checked) {
      ctx.font = "700 40px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillText("✓", x + cellSize - 46, y + cellSize - 18);
    }
  });

  ctx.fillStyle = "#4a5a4e";
  ctx.font = "300 26px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillText(
    "Generated on-device by Gemma 3 1B via WebLLM — no servers were involved.",
    pad,
    H - 44,
  );

  const link = document.createElement("a");
  link.download = `touch-grass-bingo-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxHeight: number,
): void {
  const words = text.split(" ");
  let line = "";
  let row = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (row * lineHeight > maxHeight) return;
      ctx.fillText(line, x, y + row * lineHeight);
      line = word;
      row++;
    } else {
      line = test;
    }
  }
  if (row * lineHeight <= maxHeight) ctx.fillText(line, x, y + row * lineHeight);
}

/* ---------- wiring ---------- */
generateBtn.addEventListener("click", () => void generate());
presetBtn.addEventListener("click", usePreset);
recapBtn.addEventListener("click", () => void writeRecap());
shareBtn.addEventListener("click", () => void shareCard());
newCardBtn.addEventListener("click", () => {
  cardArea.hidden = true;
  setupSection.hidden = false;
  bingoBanner.hidden = true;
});

/* ---------- boot ---------- */
paintSetup();

const restored = loadCard();
if (restored) {
  card = restored;
  renderCard();
}

if (!webGpuAvailable()) {
  setChip("offline", "WebGPU unavailable — presets only");
  generateBtn.disabled = true;
} else {
  setChip("idle", "Model: not loaded yet");
}
