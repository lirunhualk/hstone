import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import { aiCompositionValue } from "../lib/game/ai-composition.ts";
import {
  createGame,
  gameTransition,
  scoreMinionForAi,
  type BoardMinionInstance,
  type BloodGemSpellInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

function minion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    kind: "minion",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [...(definition.tribes ?? [])],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack,
    health: definition.health,
    golden: false,
    taunt: definition.taunt === true,
    divineShield: definition.divineShield === true,
    reborn: definition.reborn === true,
    stealth: definition.stealth === true,
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack: definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    effectCounters: {},
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryVenomous: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    crabDeathrattles: 0,
    goldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function playerById(state: GameState, playerId = "player-1"): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(player);
  return player;
}

function lateRecruit(seed = 0xac100): { state: GameState; player: PlayerState } {
  const state = createGame(seed);
  state.round = 12;
  state.lobbySystemsEnabled = false;
  state.systemEventId = null;
  state.pendingInteraction = null;
  for (const player of state.players) {
    player.alive = player.isHuman || player.id === "player-1";
    player.health = player.alive ? 40 : 0;
    player.armor = 0;
    player.gold = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.frozen = false;
    player.lastOpponentId = undefined;
  }
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  const player = playerById(state);
  player.gold = 3;
  player.tavernTier = 6;
  return { state, player };
}

// Already-played Battlecries do not provide repeatable scaling. These distinct
// live cards avoid accidentally awarding pair/triple value to a fixture.
function sturdyBodies(count: number): BoardMinionInstance[] {
  return ["BG24_009", "BG25_013", "BG26_135", "BG31_815", "BG35_801"]
    .slice(0, count)
    .map((definitionId, index) =>
      minion(definitionId, `sturdy-${index}`, { attack: 18, health: 18 }),
    );
}

function spentEarlyFiller(): BoardMinionInstance {
  return minion("BG20_100", "spent-tier-one-filler", { attack: 8, health: 8 });
}

function recruited(state: GameState): GameState {
  const transition = gameTransition(state, { type: "END_TURN" });
  assert.equal(transition.accepted, true);
  assert.ok(transition.state.lastRoundBattles.length > 0);
  return transition.state;
}

test("late AI replaces a buffed early filler with Earthsong Shaman and retains Drakkari", () => {
  const { state, player } = lateRecruit();
  const filler = spentEarlyFiller();
  const drakkari = minion("BG26_ICC_901", "owned-drakkari");
  const shaman = minion("BG35_431", "offered-shaman");
  player.bloodGemAttack = 3;
  player.bloodGemHealth = 4;
  player.board = [drakkari, filler, ...sturdyBodies(5)];
  player.shop = [shaman];
  const before = structuredClone(state);

  const after = recruited(state);
  const ai = playerById(after);
  assert.equal(ai.board.length, 7);
  assert.ok(ai.board.some((card) => card.instanceId === shaman.instanceId));
  assert.ok(ai.board.some((card) => card.instanceId === drakkari.instanceId));
  assert.equal(ai.board.some((card) => card.instanceId === filler.instanceId), false);
  const grownShaman = ai.board.find((card) => card.instanceId === shaman.instanceId);
  assert.ok(grownShaman);
  assert.deepEqual([grownShaman.attack, grownShaman.health], [16, 21]);
  assert.deepEqual(state, before, "the end-turn transition must not mutate its input");
  assert.deepEqual(recruited(state), after, "the same recruit choice and combat seed repeat");
});

test("late AI buys low-stat Drakkari for an existing keyword-enhanced Shaman", () => {
  const { state, player } = lateRecruit(0xac101);
  const shaman = minion("BG35_431", "owned-shaman", { taunt: true });
  const filler = spentEarlyFiller();
  const drakkari = minion("BG26_ICC_901", "offered-drakkari");
  player.bloodGemAttack = 3;
  player.bloodGemHealth = 4;
  player.board = [shaman, filler, ...sturdyBodies(5)];
  player.shop = [drakkari];

  const ai = playerById(recruited(state));
  assert.equal(ai.board.length, 7);
  assert.ok(ai.board.some((card) => card.instanceId === shaman.instanceId));
  assert.ok(ai.board.some((card) => card.instanceId === drakkari.instanceId));
  assert.equal(ai.board.some((card) => card.instanceId === filler.instanceId), false);
  const grownShaman = ai.board.find((card) => card.instanceId === shaman.instanceId);
  assert.ok(grownShaman);
  assert.deepEqual([grownShaman.attack, grownShaman.health], [22, 29]);
});

test("unsupported high-tier Drakkari does not displace a useful stronger board", () => {
  const { state, player } = lateRecruit(0xac102);
  const filler = spentEarlyFiller();
  const drakkari = minion("BG26_ICC_901", "unsupported-drakkari");
  player.board = [
    filler,
    ...sturdyBodies(5),
    minion("BG32_330", "sturdy-extra", { attack: 18, health: 18 }),
  ];
  player.shop = [drakkari];
  const originalIds = new Set(player.board.map((card) => card.instanceId));
  const unsupportedScore = scoreMinionForAi(player, drakkari);
  const supportedPlayer = structuredClone(player);
  supportedPlayer.bloodGemAttack = 3;
  supportedPlayer.bloodGemHealth = 4;
  supportedPlayer.board[6] = minion("BG35_431", "actual-growth-core");

  assert.ok(scoreMinionForAi(supportedPlayer, drakkari) > unsupportedScore);
  const ai = playerById(recruited(state));
  assert.equal(ai.board.length, 7);
  assert.ok(ai.board.every((card) => originalIds.has(card.instanceId)));
});

test("a supported tier-two Tarecgosa survives replacement by an isolated higher-tier body", () => {
  const { state, player } = lateRecruit(0xac103);
  const tarecgosa = minion("BG21_015", "active-tarecgosa", { attack: 6, health: 6 });
  player.board = [
    tarecgosa,
    minion("BG29_816", "active-rallier"),
    ...sturdyBodies(5),
  ];
  player.shop = [minion("BG26_175", "isolated-tier-six", { attack: 8, health: 8 })];

  const ai = playerById(recruited(state));
  assert.equal(ai.board.length, 7);
  assert.ok(ai.board.some((card) => card.instanceId === tarecgosa.instanceId));
});

test("magnetic purchases develop the existing host and Beatboxer without selling a board slot", () => {
  const { state, player } = lateRecruit(0xac104);
  const host = minion("BG29_611", "early-magnetic-host", { attack: 12, health: 12 });
  const beatboxer = minion("BG26_149", "generated-beatboxer");
  const resource = minion("BG31_171", "magnetic-resource-core");
  const magneticModule = minion("BG_BOT_911", "offered-annoy-o-module");
  player.board = [host, beatboxer, resource, ...sturdyBodies(4)];
  player.shop = [magneticModule];
  const originalIds = new Set(player.board.map((card) => card.instanceId));
  const withoutBeatboxer = structuredClone(player);
  withoutBeatboxer.board = withoutBeatboxer.board.filter(
    (card) => card.instanceId !== beatboxer.instanceId,
  );

  assert.ok(
    scoreMinionForAi(player, magneticModule, "magneticAttachment") >
      scoreMinionForAi(withoutBeatboxer, magneticModule, "magneticAttachment"),
    "a real extra Magnetic recipient increases the resource value",
  );
  const ai = playerById(recruited(state));
  assert.equal(ai.board.length, 7);
  assert.ok(ai.board.every((card) => originalIds.has(card.instanceId)));
  const copied = ai.board.find((card) => card.instanceId === beatboxer.instanceId);
  assert.ok(copied);
  assert.ok(copied.attachments.some((attachment) => attachment.definitionId === magneticModule.definitionId));
  assert.ok(
    ai.board.some(
      (card) =>
        card.instanceId !== beatboxer.instanceId &&
        card.attachments.some((attachment) => attachment.definitionId === magneticModule.definitionId),
    ),
  );
});

test("low-health AI chooses a substantial immediate upgrade over an unprepared growth core", () => {
  const { state, player } = lateRecruit(0xac105);
  player.health = 4;
  player.bloodGemAttack = 1;
  player.bloodGemHealth = 1;
  player.board = [
    spentEarlyFiller(),
    ...sturdyBodies(5),
    minion("BG32_330", "sturdy-extra", { attack: 18, health: 18 }),
  ];
  const shaman = minion("BG35_431", "unprepared-shaman");
  const immediate = minion("BG26_175", "immediate-survival", { attack: 30, health: 30 });
  player.shop = [shaman, immediate];

  assert.ok(scoreMinionForAi(player, immediate) > scoreMinionForAi(player, shaman));
  const ai = playerById(recruited(state));
  assert.ok(ai.board.some((card) => card.instanceId === immediate.instanceId));
  assert.equal(ai.board.some((card) => card.instanceId === shaman.instanceId), false);
});

test("a full locked hand cannot make a late AI sell its core before buying", () => {
  const { state, player } = lateRecruit(0xac106);
  player.bloodGemAttack = 3;
  player.bloodGemHealth = 4;
  player.board = [
    minion("BG26_ICC_901", "locked-hand-drakkari"),
    spentEarlyFiller(),
    ...sturdyBodies(5),
  ];
  player.hand = Array.from({ length: 10 }, (_, index) =>
    minion("BG20_100", `locked-hand-${index}`, { playableFromRound: state.round + 1 }),
  );
  player.shop = [minion("BG35_431", "blocked-shaman")];
  const originalIds = new Set(player.board.map((card) => card.instanceId));

  const ai = playerById(recruited(state));
  assert.equal(ai.board.length, 7);
  assert.ok(ai.board.every((card) => originalIds.has(card.instanceId)));
  assert.equal(ai.hand.length, 10);
  assert.deepEqual(ai.shop.map((card) => card.instanceId), ["blocked-shaman"]);
  assert.equal(ai.frozen, true);
});

function generatedKeywordGem(
  bonusKeyword: "divineShieldForQuilboar" | "rebornForQuilboar",
): BloodGemSpellInstance {
  const { state, player } = lateRecruit(0xac107);
  player.gold = 0;
  const human = playerById(state, state.humanPlayerId);
  let generated: GameState;
  if (bonusKeyword === "divineShieldForQuilboar") {
    human.hand = [minion("BG33_888", "real-shield-gem-generator")];
    const transition = gameTransition(state, { type: "PLAY_MINION", handIndex: 0 });
    assert.equal(transition.accepted, true);
    generated = transition.state;
  } else {
    human.board = [minion("BG35_433", "real-reborn-gem-generator")];
    generated = recruited(state);
  }
  const gem = playerById(generated, generated.humanPlayerId).hand.find(
    (card) => card.kind === "bloodGem" && card.bonusKeyword === bonusKeyword,
  );
  assert.ok(gem);
  assert.equal(gem.kind, "bloodGem");
  return { ...gem, instanceId: `real-keyword-gem-${bonusKeyword}` };
}

test("AI gives a missing Blood Gem keyword to its Shaman instead of a larger body or Roogug", () => {
  for (const bonusKeyword of ["divineShieldForQuilboar", "rebornForQuilboar"] as const) {
    const { state, player } = lateRecruit(0xac108);
    player.gold = 0;
    player.bloodGemAttack = 3;
    player.bloodGemHealth = 4;
    const shaman = minion("BG35_431", "keyword-growth-shaman");
    const gem = generatedKeywordGem(bonusKeyword);
    player.board = [
      shaman,
      minion("BG28_583", "keyword-roogug", { attack: 20, health: 20 }),
      minion("BG20_301", "larger-quilboar", { attack: 30, health: 30 }),
      minion("BG26_ICC_901", "keyword-drakkari"),
      ...sturdyBodies(3),
    ];
    player.hand = [gem];
    const before = structuredClone(state);

    const transition = gameTransition(state, { type: "END_TURN" });
    assert.equal(transition.accepted, true);
    const ai = playerById(transition.state);
    assert.equal(ai.hand.some((card) => card.instanceId === gem.instanceId), false);
    // Roogug's copied Gems and Shaman's end-turn Gems have no bonus keyword,
    // so retaining this keyword proves the real hand card targeted Shaman.
    const grown = ai.board.find(
      (card) => card.instanceId === shaman.instanceId,
    );
    assert.ok(grown);
    assert.equal(
      bonusKeyword === "divineShieldForQuilboar" ? grown.divineShield : grown.reborn,
      true,
      bonusKeyword,
    );
    assert.deepEqual(state, before, "projecting the keyword's growth value is pure");
  }
});

test("menagerie growth counts physical targets correctly for dual tribes and multiple wildcards", () => {
  const { player } = lateRecruit(0xac107);
  const lightfang = minion("lightfang-enforcer", "legacy-lightfang");
  const body = (id: string, tribes: BoardMinionInstance["tribes"]) =>
    minion("dragonspawn-lieutenant", id, { tribes });
  player.board = [lightfang, body("dual", ["demon", "quilboar"]),
    ...Array.from({ length: 5 }, (_, index) => body(`neutral-${index}`, []))];
  assert.equal(aiCompositionValue(player), 10, "one dual-tribe body is buffed once");
  player.board = [lightfang, body("wildcard-a", ["all"]), body("wildcard-b", ["all"])];
  assert.equal(aiCompositionValue(player), 20, "two wildcard bodies can use two distinct tribes");
});

test("Drakkari cannot create extra demon consumption when visible Tavern food runs out", () => {
  const { player } = lateRecruit(0xac108);
  player.board = [minion("BG21_005", "felbat"), minion("BG26_ICC_901", "drakkari")];
  assert.equal(aiCompositionValue(player), 0, "empty Tavern has no projected food");
  player.shop = [minion("dragonspawn-lieutenant", "food", { attack: 5, health: 5 })];
  const before = structuredClone(player);
  assert.equal(aiCompositionValue(player), 12.5, "one offer is consumed at most once");
  assert.deepEqual(player, before, "visible-shop estimation cannot consume real offers");
});

test("AI buys a keyword-gem Battlecry support for its active Shaman", () => {
  const { state, player } = lateRecruit(0xac109);
  const shaman = minion("BG35_431", "keyword-hungry-shaman");
  const drakkari = minion("BG26_ICC_901", "keyword-drakkari");
  const support = minion("BG33_888", "offered-hog-watcher");
  const filler = spentEarlyFiller();
  player.bloodGemAttack = 3;
  player.bloodGemHealth = 4;
  player.board = [shaman, drakkari, filler, ...sturdyBodies(4)];
  player.shop = [support];

  const ai = playerById(recruited(state));
  assert.ok(ai.board.some((card) => card.instanceId === support.instanceId));
  assert.ok(ai.board.some((card) => card.instanceId === drakkari.instanceId));
  assert.equal(ai.board.some((card) => card.instanceId === filler.instanceId), false);
  assert.equal(ai.board.find((card) => card.instanceId === shaman.instanceId)?.divineShield, true);
});

test("an owned Battlecry with a real adjacent retrigger is still an active engine", () => {
  const { state, player } = lateRecruit(0xac110);
  const mama = minion("BG35_140", "retrigger-mama");
  const rylak = minion("BG26_801", "retrigger-rylak", { attack: 70, health: 70 });
  player.mrrgltonsPlayed = 30;
  player.board = [mama, rylak, minion("BG35_141", "retrigger-papa"),
    minion("brann-bronzebeard", "retrigger-brann", { attack: 70, health: 70 }),
    ...sturdyBodies(3)];
  const withoutRetrigger = { ...player, board: player.board.filter((card) => card !== rylak) };
  assert.ok(scoreMinionForAi(player, mama) > scoreMinionForAi(withoutRetrigger, mama));
  player.shop = [minion("dragonspawn-lieutenant", "generic-body", { attack: 15, health: 15 })];
  const ai = playerById(recruited(state));
  assert.ok(ai.board.some((card) => card.instanceId === mama.instanceId));
});
