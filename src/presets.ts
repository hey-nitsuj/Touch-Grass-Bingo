import type { Habitat } from "./types";

/** Hand-written 24-item decks used when the model is unavailable or rejects JSON. */
const DECKS: Record<Habitat, string[]> = {
  neighborhood: [
    "dog on a leash",
    "cat in a window",
    "someone jogging",
    "stroller going uphill",
    "free little library",
    "kid on a bike",
    "leaf pile at the curb",
    "garage door wide open",
    "person pacing a call",
    "Halloween decoration",
    "watering can in use",
    "mural you've never seen",
    "dog that wants pets",
    "steam from a vent",
    "recycling bins out",
    "basketball bouncing",
    "pizza by the slice",
    "pumpkin on a step",
    "parked food truck",
    "yellow leaf on blacktop",
    "open car window with a dog",
    "someone stretching on a lawn",
    "wind chimes you can hear",
    "neighbor waving back",
  ],
  park: [
    "squirrel with a snack",
    "crow judging you",
    "dog playing fetch",
    "bench with carved initials",
    "person reading outside",
    "frisbee mid-air",
    "picnic blanket",
    "playground squeal",
    "butterfly at knee height",
    "someone doing yoga",
    "duck in a row",
    "fallen acorn underfoot",
    "dog in a bandana",
    "napping dog",
    "maple seed helicopter",
    "birthday party cluster",
    "person sketching the scene",
    "ball game in progress",
    "ice cream wrapper on a bench",
    "red leaf still on the branch",
    "old dog moving slowly",
    "jogger with a hydration vest",
    "someone throwing bread to birds",
    "sunset silhouette photo",
  ],
  trail: [
    "trekking poles clicking",
    "bird of prey circling",
    "mud on your own shoes",
    "lizard sunning a rock",
    "trail marker post",
    "creek you can hear first",
    "spider web catching light",
    "pinecone in the path",
    "moss on the north side",
    "daypack snack break",
    "someone layering up",
    "switchback below you",
    "wildflower off-trail",
    "deer track in dirt",
    "hiker yielding right of way",
    "running vest zooming past",
    "log bridging a gap",
    "hawk on a dead branch",
    "view that earns the climb",
    "person photographing the same view",
    "sunbeam through the canopy",
    "snack wrapper in a pocket, hopefully",
    "another dog, off leash (friendly)",
    "your own breath in the air",
  ],
  waterfront: [
    "duck paddling in place",
    "heron standing perfectly still",
    "seagull with a plan",
    "person fishing off the pier",
    "paddleboarder wobbling",
    "kid with a net",
    "skip-able stone at your feet",
    "rowers in a line",
    "dog in a life vest",
    "crab scuttling sideways",
    "sandpiper doing sprints",
    "sun glint on the ripples",
    "someone dipping their toes",
    "kayaker waving",
    "shells along the tide line",
    "boat horn in the distance",
    "drone overhead, of course",
    "pier piling covered in barnacles",
    "fish jumping once",
    "picnic on the seawall",
    "rope swing in a tree",
    "foam line at the shore",
    "someone skipping stones better than you",
    "gull stealing a chip",
  ],
};

const PAD_POOL: string[] = [
  "cloud shaped like something",
  "someone laughing out loud",
  "wind picking up",
  "a good smell from a kitchen",
  "socks on the wrong feet",
  "car alarm nobody addresses",
  "one dramatic tree",
  "person lost in thought",
  "shoe on a power line",
  "heart drawn in sidewalk chalk",
];

export function presetDeck(habitat: Habitat): string[] {
  const deck = [...DECKS[habitat]];
  // Light shuffle so a regenerated preset card is never identical.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function padDeck(partial: string[]): string[] {
  const out = partial.slice(0, 24);
  const pool = [...PAD_POOL].sort(() => Math.random() - 0.5);
  while (out.length < 24) out.push(pool[out.length % pool.length]);
  return out;
}
