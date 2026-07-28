import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MINION_DEFINITIONS } from "../lib/game/content.ts";
import { createGame } from "../lib/game/engine.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STARTUP = process.argv.includes("--startup");
const TIMEOUT_MS = STARTUP ? 7_000 : 20_000;
const MAX_BYTES = 2_000_000;
const CARD_ID_PATTERN = /^[A-Za-z0-9_]+$/;
const RENDER_CARD_ID_FALLBACKS = {
  BG_CFM_315t: "CFM_315t",
  BG_CFM_316t: "CFM_316t",
  BG_CS2_065: "CS2_065",
  BG_EX1_534t: "EX1_534t",
  BG_EX1_556t: "skele21",
  BG_LOE_077: "LOE_077",
};
const RENDER_UNAVAILABLE = new Set(["BGS_034", "BG31_803"]);
const CORE_SPELL_CARD_IDS = ["BG20_GEM", "TB_BaconShop_Triples_01"];

const allCardIds = [
  ...new Set([
    ...MINION_DEFINITIONS.map((definition) => definition.cardId),
    ...CORE_SPELL_CARD_IDS,
  ]),
].sort();
const startupCardIds = STARTUP
  ? new Set(
      [
        ...CORE_SPELL_CARD_IDS,
        ...(createGame(0x53544152)
          .players.find((player) => player.isHuman)
          ?.shop.map((minion) => minion.cardId) ?? []),
      ],
    )
  : null;
const cardIds = startupCardIds
  ? allCardIds.filter((cardId) => startupCardIds.has(cardId))
  : allCardIds;

for (const cardId of cardIds) {
  if (!CARD_ID_PATTERN.test(cardId)) {
    throw new Error(`Unsafe Hearthstone CardID: ${cardId}`);
  }
}

const jobs = cardIds.flatMap((cardId) => {
  const renderCardId = RENDER_CARD_ID_FALLBACKS[cardId] ?? cardId;
  const portraitJob = {
    kind: "webp",
    cardId,
    required: true,
    url: `https://art.hearthstonejson.com/v1/256x/${cardId}.webp`,
    target: path.join(
      ROOT,
      "public",
      "card-art",
      "portraits",
      `${cardId}.webp`,
    ),
  };
  const renderJob = {
      kind: "png",
      cardId,
      required: false,
      url: `https://art.hearthstonejson.com/v1/render/latest/zhCN/512x/${renderCardId}.png`,
      target: path.join(
        ROOT,
        "public",
        "card-art",
        "renders",
        "zhCN",
        `${cardId}.png`,
      ),
  };
  return RENDER_UNAVAILABLE.has(cardId)
    ? [portraitJob]
    : [portraitJob, renderJob];
});

async function hasCachedFile(target) {
  try {
    return (await stat(target)).size > 256;
  } catch {
    return false;
  }
}

function validateBytes(bytes, kind, contentType) {
  if (bytes.length <= 256 || bytes.length > MAX_BYTES) {
    throw new Error(`unexpected file size ${bytes.length}`);
  }
  if (kind === "png") {
    const signature = "89504e470d0a1a0a";
    if (bytes.subarray(0, 8).toString("hex") !== signature) {
      throw new Error(`invalid PNG response (${contentType || "unknown"})`);
    }
    return;
  }
  if (
    bytes.subarray(0, 4).toString("ascii") !== "RIFF" ||
    bytes.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw new Error(`invalid WebP response (${contentType || "unknown"})`);
  }
}

async function download(job) {
  if (await hasCachedFile(job.target)) {
    return "cached";
  }
  await mkdir(path.dirname(job.target), { recursive: true });
  const partial = `${job.target}.partial`;
  const response = await fetch(job.url, {
    headers: { "User-Agent": "hstone-local-fan-game/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  validateBytes(bytes, job.kind, response.headers.get("content-type"));
  await writeFile(partial, bytes);
  await rename(partial, job.target);
  return "downloaded";
}

let cursor = 0;
let downloaded = 0;
let cached = 0;
const failures = [];
const optionalFailures = [];

async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor];
    cursor += 1;
    try {
      const result = await download(job);
      if (result === "downloaded") downloaded += 1;
      else cached += 1;
    } catch (error) {
      const issue =
        `${job.cardId}.${job.kind}: ${
          error instanceof Error ? error.message : String(error)
        }`;
      (job.required ? failures : optionalFailures).push(issue);
      try {
        await unlink(`${job.target}.partial`);
      } catch {
        // No partial file to clean up.
      }
      if (STARTUP && downloaded === 0 && cached === 0) {
        cursor = jobs.length;
      }
    }
  }
}

await Promise.all(Array.from({ length: 4 }, () => worker()));

console.log(`Card art: ${downloaded} downloaded, ${cached} cached.`);
if (failures.length > 0) {
  console.error(`Card art sync failed for ${failures.length} file(s).`);
  for (const failure of failures.slice(0, 8)) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}
if (optionalFailures.length > 0) {
  console.warn(
    `Full-card render unavailable for ${optionalFailures.length} card(s); portrait fallback remains available.`,
  );
  for (const failure of optionalFailures.slice(0, 8)) {
    console.warn(`- ${failure}`);
  }
}
