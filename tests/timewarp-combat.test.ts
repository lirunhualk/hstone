import assert from "node:assert/strict";
import test from "node:test";

import {
  LIVE_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  getScheduledPairings,
  getTavernSpellDefinition,
  type BattleSummary,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";

const SABOTEUR = "BG34_Giant_304";
const JAZZER = "BG34_Giant_306";
const SPOREBAT = "BG34_Giant_582";
const HAG = "BG34_Giant_034";
const LIL_BOAR = "BG34_Giant_608";
const GYROCOPTER = "BG34_Giant_302";
const GEOMANCER = "BG34_Giant_305";
const TWILIGHT_DRAKE = "BG34_PreMadeChamp_020";
const RECYCLER = "BG34_Giant_082";
const HOOKTAIL = "BG34_Giant_015";

function minion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const golden = overrides.golden === true;
  return {
    kind: "minion",
    instanceId,
    definitionId,
    cardId: golden
      ? definition.goldenCardId ?? definition.cardId
      : definition.cardId,
    name: definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [...(definition.tribes ??
      (definition.tribe === "neutral" ? [] : [definition.tribe]))],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack * (golden ? 2 : 1),
    health: definition.health * (golden ? 2 : 1),
    golden,
    taunt: definition.taunt === true,
    divineShield: definition.divineShield === true,
    reborn: definition.reborn === true,
    stealth: definition.stealth === true,
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack: definition.alwaysAttacksLowestAttack === true,
    description: golden
      ? definition.goldenDescription ?? definition.description
      : definition.description,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    ...overrides,
  };
}

function tavernSpell(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

function wall(instanceId: string): BoardMinionInstance {
  return minion("BG_LOE_077", instanceId, {
    attack: 1_000,
    health: 1_000_000,
    taunt: true,
  });
}

function victim(instanceId: string): BoardMinionInstance {
  return minion("BG_LOE_077", instanceId, {
    attack: 0,
    health: 1,
    taunt: true,
  });
}

function combatState(seed: number, ownerIndex = 0): GameState {
  const state = createGame(seed);
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  state.activeTribes = ["mech", "dragon", "quilboar", "beast", "naga"];
  for (const [index, player] of state.players.entries()) {
    player.alive = index < 2;
    player.health = player.alive ? 1_000 : 0;
    player.armor = 0;
    player.gold = 0;
    player.tavernTier = 1;
    player.hand = [];
    player.ghostHand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.eliminatedRound = undefined;
  }
  state.players[1 - ownerIndex].board = [wall("timewarp-enemy")];
  assert.equal(getScheduledPairings(state).length, 1);
  return state;
}

function ownerAfter(state: GameState, owner: PlayerState): PlayerState {
  const result = state.players.find((player) => player.id === owner.id);
  assert.ok(result);
  return result;
}

function battleFor(state: GameState, owner: PlayerState): BattleSummary {
  const battle = state.lastRoundBattles.find((candidate) =>
    candidate.playerAId === owner.id || candidate.playerBId === owner.id);
  assert.ok(battle);
  return battle;
}

function avengeBoard(
  definitionId: string,
  golden: boolean,
  deaths: number,
): BoardMinionInstance[] {
  return [
    minion(definitionId, "timewarp-source", {
      golden,
      attack: 0,
      health: 10_000,
    }),
    ...Array.from({ length: deaths }, (_, index) =>
      victim(`timewarp-victim-${index}`)),
  ];
}

function ghostState(board: BoardMinionInstance[]): {
  state: GameState;
  ghost: PlayerState;
} {
  const state = combatState(0x7400);
  for (const [index, player] of state.players.entries()) {
    player.alive = index < 3;
    player.health = player.alive ? 1_000 : 0;
    player.board = player.alive ? [wall(`ghost-enemy-${index}`)] : [];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.board = board;
  const pairing = getScheduledPairings(state).find((candidate) => candidate.isGhost);
  assert.equal(pairing?.playerBId, ghost.id);
  return { state, ghost };
}

test("Timewarp Saboteur death grants one/two Slimy Seafood to either combat owner", () => {
  for (const ownerIndex of [0, 1]) {
    for (const golden of [false, true]) {
      const state = combatState(0x7300 + ownerIndex * 2 + Number(golden), ownerIndex);
      const owner = state.players[ownerIndex];
      owner.board = [minion(SABOTEUR, "saboteur", { golden, attack: 0, health: 1 })];
      const poolBefore = structuredClone(state.spellPool);
      const combat = gameReducer(state, { type: "END_TURN" });
      const gained = ownerAfter(combat, owner).hand.filter((card) =>
        card.kind === "tavernSpell" && card.definitionId === "tavern-spell-slimy-seafood");
      assert.equal(gained.length, golden ? 2 : 1);
      assert.deepEqual(combat.spellPool, poolBefore);
      assert.equal(battleFor(combat, owner).events.filter((event) =>
        event.type === "cardGain" && event.actorInstanceId === "saboteur" &&
        event.cardGainResult === "added").length, golden ? 2 : 1);
    }
  }
});

test("Timewarp Jazzer death permanently upgrades Gem Health with ordinary/golden Titus scaling", () => {
  for (const ownerIndex of [0, 1]) {
    for (const golden of [false, true]) {
      for (const titusGolden of [null, false, true]) {
        const state = combatState(0x7310 + ownerIndex * 10 + Number(golden), ownerIndex);
        const owner = state.players[ownerIndex];
        owner.bloodGemAttack = 3;
        owner.bloodGemHealth = 5;
        owner.board = [minion(JAZZER, "jazzer", {
          golden, attack: 0, health: 1, taunt: true,
        })];
        if (titusGolden !== null) {
          owner.board.push(minion("BG25_354", "jazzer-titus", {
            golden: titusGolden, attack: 0, health: 10_000,
          }));
        }
        const combat = gameReducer(state, { type: "END_TURN" });
        const repetitions = titusGolden === null ? 1 : titusGolden ? 3 : 2;
        const saved = ownerAfter(combat, owner);
        assert.equal(saved.bloodGemAttack, 3);
        assert.equal(saved.bloodGemHealth, 5 + (golden ? 4 : 2) * repetitions);
      }
    }
  }
});

test("Timewarp Sporebat generates one/two cost-at-least-two Tavern Spells above the owner's tier", () => {
  for (const ownerIndex of [0, 1]) {
    for (const golden of [false, true]) {
      const tiers = new Set<number>();
      for (let seed = 0; seed < 12; seed += 1) {
        const state = combatState(0x7350 + seed, ownerIndex);
        const owner = state.players[ownerIndex];
        owner.board = [minion(SPOREBAT, "sporebat", { golden, attack: 0, health: 1 })];
        const poolBefore = structuredClone(state.spellPool);
        const combat = gameReducer(state, { type: "END_TURN" });
        const gained = ownerAfter(combat, owner).hand;
        assert.equal(gained.length, golden ? 2 : 1);
        for (const card of gained) {
          assert.equal(card.kind, "tavernSpell");
          if (card.kind !== "tavernSpell") continue;
          assert.ok(getTavernSpellDefinition(card.definitionId).cost >= 2);
          tiers.add(card.tier);
        }
        assert.deepEqual(combat.spellPool, poolBefore);
      }
      assert.ok([...tiers].some((tier) => tier > 1), "generation ignores the owner's Tavern Tier");
    }
  }
});

test("Timewarp Saboteur and Sporebat honor the ten-card hand limit including Titus repetitions", () => {
  for (const definitionId of [SABOTEUR, SPOREBAT]) {
    const state = combatState(0x7360);
    const owner = state.players[0];
    owner.board = [
      minion(definitionId, "full-hand-source", { golden: true, attack: 0, health: 1, taunt: true }),
      minion("BG25_354", "full-hand-titus", { attack: 0, health: 10_000 }),
    ];
    owner.hand = Array.from({ length: 9 }, (_, index) =>
      tavernSpell("tavern-spell-tavern-coin", `filler-${index}`));
    const combat = gameReducer(state, { type: "END_TURN" });
    assert.equal(ownerAfter(combat, owner).hand.length, 10);
    assert.deepEqual(battleFor(combat, owner).events.filter((event) =>
      event.type === "cardGain" && event.actorInstanceId === "full-hand-source")
      .map((event) => event.cardGainResult), ["added", "handFull", "handFull", "handFull"]);
  }
});

test("Timewarp Hag death permanently grants Tavern Spell +2/+2 or +4/+4 on either board", () => {
  for (const ownerIndex of [0, 1]) {
    for (const golden of [false, true]) {
      const state = combatState(0x7370 + Number(golden), ownerIndex);
      const owner = state.players[ownerIndex];
      owner.tavernSpellAttackBonus = 3;
      owner.tavernSpellHealthBonus = 5;
      owner.board = [minion(HAG, "hag", { golden, attack: 0, health: 1, taunt: true })];
      const combat = gameReducer(state, { type: "END_TURN" });
      const saved = ownerAfter(combat, owner);
      assert.deepEqual([saved.tavernSpellAttackBonus, saved.tavernSpellHealthBonus],
        golden ? [7, 9] : [5, 7]);
    }
  }
});

test("Timewarp Lil Boar uses three/six individual combat Gems on every Quilboar, then does so again after Reborn", () => {
  for (const golden of [false, true]) {
    const state = combatState(0x7380 + Number(golden));
    const owner = state.players[0];
    owner.bloodGemAttack = 2;
    owner.bloodGemHealth = 3;
    owner.board = [
      minion(LIL_BOAR, "lil-boar", { golden, attack: 1, health: 1, taunt: true }),
      minion("BG_LOE_077", "quilboar-a", { tribe: "quilboar", tribes: ["quilboar"], attack: 0, health: 10_000 }),
      minion("BG_LOE_077", "quilboar-b", { tribe: "neutral", tribes: ["mech", "quilboar"], attack: 0, health: 10_000 }),
      minion("BG_LOE_077", "non-quilboar", { attack: 0, health: 10_000 }),
    ];
    const before = structuredClone(owner.board);
    const combat = gameReducer(state, { type: "END_TURN" });
    const battle = battleFor(combat, owner);
    const reborn = battle.events.find((event) =>
      event.type === "summon" && event.summonReason === "reborn" &&
      event.minion?.definitionId === LIL_BOAR);
    assert.ok(reborn?.targetInstanceId);
    const actorIds = new Set(["lil-boar", reborn.targetInstanceId]);
    for (const target of ["quilboar-a", "quilboar-b"]) {
      const buffs = battle.events.filter((event) =>
        event.type === "buff" && actorIds.has(event.actorInstanceId ?? "") &&
        event.targetInstanceId === target && event.message.includes("鲜血宝石"));
      assert.equal(buffs.length, golden ? 12 : 6);
      assert.ok(buffs.every((event) => event.attackDelta === 2 && event.healthDelta === 3));
    }
    assert.equal(battle.events.some((event) => event.type === "buff" &&
      actorIds.has(event.actorInstanceId ?? "") && event.targetInstanceId === "non-quilboar"), false);
    assert.deepEqual(ownerAfter(combat, owner).board, before);
  }
});

test("Timewarp Gyrocopter Avenge (3) generates ordinary current-pool Mechs without spending pool copies", () => {
  const mechIds = new Set(LIVE_MINION_DEFINITIONS.filter((definition) =>
    (definition.tribes ?? [definition.tribe]).some((tribe) => tribe === "mech" || tribe === "all")).map((definition) => definition.id));
  for (const ownerIndex of [0, 1]) {
    for (const golden of [false, true]) {
      const state = combatState(0x7390 + Number(golden), ownerIndex);
      const owner = state.players[ownerIndex];
      owner.board = avengeBoard(GYROCOPTER, golden, 3);
      const poolBefore = structuredClone(state.pool);
      const combat = gameReducer(state, { type: "END_TURN" });
      const gained = ownerAfter(combat, owner).hand;
      assert.equal(gained.length, golden ? 2 : 1);
      for (const card of gained) {
        assert.equal(card.kind, "minion");
        if (card.kind !== "minion") continue;
        assert.ok(mechIds.has(card.definitionId));
        assert.equal(card.golden, false);
        assert.equal(card.poolCopies, 0);
      }
      assert.deepEqual(combat.pool, poolBefore);
      assert.equal(battleFor(combat, owner).events.filter((event) =>
        event.type === "avenge" && event.actorInstanceId === "timewarp-source").length, 1);
    }
  }
});

test("Timewarp Gyrocopter combat acquisition defers its triple until the next Recruit phase", () => {
  const setup = () => {
    const state = combatState(0x7398);
    state.players[0].board = avengeBoard(GYROCOPTER, false, 3);
    return state;
  };
  const scout = gameReducer(setup(), { type: "END_TURN" });
  const reward = scout.players[0].hand.find((card) => card.kind === "minion");
  assert.ok(reward?.kind === "minion");
  const state = setup();
  state.players[0].hand = [
    minion(reward.definitionId, "existing-mech-a"),
    minion(reward.definitionId, "existing-mech-b"),
  ];
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.players[0].hand.filter((card) =>
    card.kind === "minion" && card.definitionId === reward.definitionId && !card.golden).length, 3);
  assert.ok(combat.deferredTriplePlayerIds.includes(state.players[0].id));
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  const triple = recruit.players[0].hand.find((card) =>
    card.kind === "minion" && card.definitionId === reward.definitionId && card.golden);
  assert.ok(triple?.kind === "minion");
  assert.equal(triple.poolCopies, 0);
  assert.equal(triple.grantsTripleReward, true);
});

test("Timewarp Geomancer Avenge (5) grants exactly one Gem and permanently grows Gems +1/+1 or +2/+2", () => {
  for (const ownerIndex of [0, 1]) {
    for (const golden of [false, true]) {
      const state = combatState(0x73a0 + Number(golden), ownerIndex);
      const owner = state.players[ownerIndex];
      owner.bloodGemAttack = 3;
      owner.bloodGemHealth = 5;
      owner.board = avengeBoard(GEOMANCER, golden, 5);
      const combat = gameReducer(state, { type: "END_TURN" });
      const saved = ownerAfter(combat, owner);
      assert.equal(saved.hand.filter((card) => card.kind === "bloodGem").length, 1);
      assert.deepEqual([saved.bloodGemAttack, saved.bloodGemHealth],
        golden ? [5, 7] : [4, 6]);
      assert.equal(battleFor(combat, owner).events.filter((event) =>
        event.type === "avenge" && event.actorInstanceId === "timewarp-source").length, 1);
    }
  }
});

test("Timewarp Twilight Drake Avenge (1) buffs all friendly Dragons +6/+4 or +12/+8 only for combat", () => {
  for (const golden of [false, true]) {
    const state = combatState(0x73b0 + Number(golden));
    const owner = state.players[0];
    const source = minion(TWILIGHT_DRAKE, "twilight-drake", { golden, attack: 0, health: 1_000_000 });
    const dragon = minion("BG_LOE_077", "friendly-dragon", { tribe: "dragon", tribes: ["dragon"], attack: 0, health: 1_000_000 });
    const neutral = minion("BG_LOE_077", "friendly-neutral", { attack: 0, health: 1_000_000 });
    owner.board = [source, dragon, neutral, victim("drake-victim")];
    const before = structuredClone(owner.board);
    const combat = gameReducer(state, { type: "END_TURN" });
    const buffs = battleFor(combat, owner).events.filter((event) =>
      event.type === "buff" && event.actorInstanceId === source.instanceId);
    assert.deepEqual(buffs.map((event) => event.targetInstanceId).sort(),
      [source.instanceId, dragon.instanceId].sort());
    assert.ok(buffs.every((event) => event.attackDelta === (golden ? 12 : 6) &&
      event.healthDelta === (golden ? 8 : 4)));
    assert.deepEqual(ownerAfter(combat, owner).board, before);
  }
});

test("Timewarp Recycler Avenge (4) permanently increases maximum Gold without awarding spendable Gold", () => {
  for (const ownerIndex of [0, 1]) {
    for (const golden of [false, true]) {
      const state = combatState(0x73c0 + Number(golden), ownerIndex);
      const owner = state.players[ownerIndex];
      owner.maxGold = 12;
      owner.board = avengeBoard(RECYCLER, golden, 4);
      const combat = gameReducer(state, { type: "END_TURN" });
      const saved = ownerAfter(combat, owner);
      assert.equal(saved.maxGold, golden ? 14 : 13);
      assert.equal(saved.gold, 0);
    }
  }
});

test("Timewarp ghost Deathrattle and Avenge cannot write permanent stats, Gold, or hand rewards", () => {
  for (const definitionId of [SABOTEUR, JAZZER, SPOREBAT, HAG, GYROCOPTER, GEOMANCER, RECYCLER]) {
    for (const golden of [false, true]) {
      const deaths = definitionId === GYROCOPTER ? 3 : definitionId === GEOMANCER ? 5 : definitionId === RECYCLER ? 4 : 0;
      const board = deaths > 0
        ? avengeBoard(definitionId, golden, deaths)
        : [minion(definitionId, "ghost-death-source", { golden, attack: 0, health: 1, taunt: true })];
      const { state, ghost } = ghostState(board);
      ghost.bloodGemAttack = 3;
      ghost.bloodGemHealth = 5;
      ghost.tavernSpellAttackBonus = 7;
      ghost.tavernSpellHealthBonus = 9;
      ghost.maxGold = 12;
      const before = structuredClone(ghost);
      const poolBefore = structuredClone(state.pool);
      const spellPoolBefore = structuredClone(state.spellPool);
      const combat = gameReducer(state, { type: "END_TURN" });
      const saved = ownerAfter(combat, ghost);
      assert.deepEqual(saved.hand, before.hand);
      assert.deepEqual(saved.board, before.board);
      assert.deepEqual([saved.bloodGemAttack, saved.bloodGemHealth, saved.tavernSpellAttackBonus,
        saved.tavernSpellHealthBonus, saved.maxGold], [3, 5, 7, 9, 12]);
      assert.deepEqual(combat.pool, poolBefore);
      assert.deepEqual(combat.spellPool, spellPoolBefore);
      const battle = battleFor(combat, ghost);
      assert.equal(battle.isGhost, true);
      assert.ok(battle.events.some((event) => event.type === "death" &&
        event.actorPlayerId === ghost.id));
      if (deaths > 0) {
        assert.ok(battle.events.some((event) => event.type === "avenge" &&
          event.actorInstanceId === "timewarp-source"), definitionId);
      }
      assert.equal(battle.events.some((event) => event.type === "cardGain" &&
        event.actorPlayerId === ghost.id), false);
    }
  }
});

test("Timewarp Hooktail reacts to an actual Tavern Spell cast in Recruit", () => {
  for (const golden of [false, true]) {
    const state = combatState(0x73d0 + Number(golden));
    const owner = state.players[0];
    owner.board = [
      minion(HOOKTAIL, "hooktail", { golden }),
      minion("BG_LOE_077", "hooktail-friendly"),
      minion("BG21_018", "hooktail-shipwright"),
    ];
    const before = owner.board.map((card) => [card.attack, card.health]);
    owner.hand = [tavernSpell("tavern-spell-tavern-coin", "hooktail-coin")];
    const after = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "hooktail-coin" });
    assert.equal(after.players[0].hand.length, 0);
    after.players[0].board.forEach((card, index) => {
      assert.deepEqual([card.attack, card.health],
        [before[index][0] + (golden ? 4 : 2),
          before[index][1] + (golden ? 4 : 2) +
          (card.instanceId === "hooktail-shipwright" ? (golden ? 2 : 1) : 0)]);
    });
  }
});

test("Timewarp Hooktail's Golden combat spell reaction is two separate +2/+2 pulses per target", () => {
  for (const golden of [false, true]) {
    const state = combatState(0x73e0 + Number(golden));
    const owner = state.players[0];
    const warden = minion("BG34_921", "ring-warden", { attack: 1, health: 1 });
    const hooktail = minion(HOOKTAIL, "combat-hooktail", { golden, attack: 0, health: 10_000 });
    owner.board = [warden, hooktail];
    const before = structuredClone(owner.board);
    const combat = gameReducer(state, { type: "END_TURN" });
    const battle = battleFor(combat, owner);
    assert.equal(battle.events.filter((event) => event.type === "tavernSpellCast" &&
      event.actorInstanceId === warden.instanceId).length, 1);
    const buffs = battle.events.filter((event) => event.type === "buff" &&
      event.actorInstanceId === hooktail.instanceId);
    for (const target of [warden.instanceId, hooktail.instanceId]) {
      assert.deepEqual(buffs.filter((event) => event.targetInstanceId === target)
        .map((event) => [event.attackDelta, event.healthDelta]),
      Array.from({ length: golden ? 2 : 1 }, () => [2, 2]));
    }
    assert.deepEqual(ownerAfter(combat, owner).board, before);
  }
});

test("Timewarp Avenge effects wait for their printed threshold on normal and Golden minions", () => {
  for (const [definitionId, threshold] of [[GYROCOPTER, 3], [GEOMANCER, 5], [RECYCLER, 4]] as const) {
    for (const golden of [false, true]) {
      const state = combatState(0x73f0 + Number(golden));
      const owner = state.players[0];
      owner.board = avengeBoard(definitionId, golden, threshold - 1);
      owner.board[0].health = 1_000_000;
      const before = [owner.bloodGemAttack, owner.bloodGemHealth, owner.maxGold];
      const combat = gameReducer(state, { type: "END_TURN" });
      const saved = ownerAfter(combat, owner);
      assert.deepEqual(saved.hand, []);
      assert.deepEqual([saved.bloodGemAttack, saved.bloodGemHealth, saved.maxGold], before);
      assert.equal(battleFor(combat, owner).events.some((event) =>
        event.type === "avenge" && event.actorInstanceId === "timewarp-source"), false);
    }
  }
});

test("Timewarp Gyrocopter counts two independent Avenge cycles and clips rewards at a full hand", () => {
  for (const golden of [false, true]) {
    const state = combatState(0x7401 + Number(golden));
    const owner = state.players[0];
    owner.board = avengeBoard(GYROCOPTER, golden, 6);
    owner.hand = Array.from({ length: 9 }, (_, index) =>
      tavernSpell("tavern-spell-tavern-coin", `gyro-filler-${index}`));
    const combat = gameReducer(state, { type: "END_TURN" });
    const events = battleFor(combat, owner).events;
    assert.equal(ownerAfter(combat, owner).hand.length, 10);
    assert.equal(events.filter((event) => event.type === "avenge" &&
      event.actorInstanceId === "timewarp-source").length, 2);
    assert.deepEqual(events.filter((event) => event.type === "cardGain" &&
      event.actorInstanceId === "timewarp-source").map((event) => event.cardGainResult),
    golden ? ["added", "handFull", "handFull", "handFull"] : ["added", "handFull"]);
  }
});

test("Timewarp Geomancer still improves future Gems when its one hand reward is blocked", () => {
  for (const golden of [false, true]) {
    const state = combatState(0x7405 + Number(golden));
    const owner = state.players[0];
    owner.bloodGemAttack = 3;
    owner.bloodGemHealth = 5;
    owner.board = avengeBoard(GEOMANCER, golden, 5);
    owner.hand = Array.from({ length: 10 }, (_, index) =>
      tavernSpell("tavern-spell-tavern-coin", `geomancer-filler-${index}`));
    const before = structuredClone(owner.hand);
    const combat = gameReducer(state, { type: "END_TURN" });
    const saved = ownerAfter(combat, owner);
    assert.deepEqual(saved.hand, before);
    assert.deepEqual([saved.bloodGemAttack, saved.bloodGemHealth], golden ? [5, 7] : [4, 6]);
    assert.deepEqual(battleFor(combat, owner).events.filter((event) =>
      event.type === "cardGain" && event.actorInstanceId === "timewarp-source")
      .map((event) => event.cardGainResult), ["handFull"]);
  }
});
