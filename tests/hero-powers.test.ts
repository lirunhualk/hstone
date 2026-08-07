import assert from "node:assert/strict";
import test from "node:test";

import {
  HERO_POWER_DEFINITIONS,
  UNSUPPORTED_HERO_POWER_EFFECTS,
  getHeroPowerDefinition,
  heroPowerCanBeManuallyActivated,
  heroPowerIsPlayable,
  heroesAvailableForTribes,
  identityEligibleHeroPowers,
} from "../lib/game/hero-powers.ts";
import {
  createGame,
  gameReducer,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  LIVE_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import type { Tribe } from "../lib/game/types.ts";

const ALL_TRIBES: Tribe[] = [
  "beast",
  "demon",
  "dragon",
  "elemental",
  "mech",
  "murloc",
  "naga",
  "pirate",
  "quilboar",
  "undead",
];

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

test("hero offers and Identity exclude explicitly unsupported powers", () => {
  const offeredHeroes = heroesAvailableForTribes(ALL_TRIBES);
  assert.equal(offeredHeroes.length, 28);
  assert.ok(
    offeredHeroes.every((hero) => heroPowerIsPlayable(hero.heroPowerId)),
  );
  assert.equal(UNSUPPORTED_HERO_POWER_EFFECTS.size, 86);
  assert.equal(
    HERO_POWER_DEFINITIONS.filter((power) =>
      UNSUPPORTED_HERO_POWER_EFFECTS.has(power.effect),
    ).length,
    92,
  );
  assert.equal(
    offeredHeroes.filter(
      (hero) =>
        getHeroPowerDefinition(hero.heroPowerId).activation === "active",
    ).length,
    3,
  );

  const identityIneligibleEffects = new Set([
    "bonusStartingHealth",
    "startWithAmalgam",
    "growingTavernBuff",
    "chooseTrinketAtTurn5",
    "chooseGreaterTrinketAtTurn8",
    "discoverHeroPowerAtTurn4",
  ]);
  assert.equal(identityEligibleHeroPowers(null, ALL_TRIBES).length, 25);
  assert.ok(
    identityEligibleHeroPowers(null, ALL_TRIBES).every(
      (power) =>
        heroPowerIsPlayable(power.id) &&
        !identityIneligibleEffects.has(power.effect),
    ),
  );
});

test("Identity excludes Hero Powers whose minion types are unavailable", () => {
  const activeTribes: Tribe[] = [
    "demon",
    "mech",
    "murloc",
    "naga",
    "quilboar",
  ];
  const eligiblePowerIds = new Set(
    identityEligibleHeroPowers(null, activeTribes).map((power) => power.id),
  );

  assert.equal(eligiblePowerIds.has("hero-power-sprout-it-out"), false);
  assert.equal(eligiblePowerIds.has("hero-power-dream-portal"), false);
  assert.equal(eligiblePowerIds.has("hero-power-avalanche"), false);
  assert.equal(eligiblePowerIds.has("hero-power-yo-ho-ogre"), false);

  assert.ok(
    identityEligibleHeroPowers(null, [...activeTribes, "dragon"]).some(
      (power) => power.id === "hero-power-dream-portal",
    ),
  );
  assert.ok(
    identityEligibleHeroPowers(null, [...activeTribes, "undead"]).some(
      (power) => power.id === "hero-power-sprout-it-out",
    ),
  );
});

test("triggered Blackthorn and Gallywix powers are passive", () => {
  for (const effect of [
    "getBloodGemsPerTurn",
    "goldAfterSellNextTurn",
  ] as const) {
    const power = HERO_POWER_DEFINITIONS.find(
      (candidate) => candidate.effect === effect,
    );
    assert.ok(power);
    assert.equal(power.activation, "passive");
    assert.equal(heroPowerCanBeManuallyActivated(power.id), false);
  }
});

test("Millificent discovers only printed Magnetic Mechs", () => {
  let state = createGame(0xbad5eed);
  let player = humanPlayer(state);
  state.activeTribes = [...ALL_TRIBES];
  player.heroPowerId = "hero-power-tb_baconshop_hp_015";
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.tavernTier = 4;
  player.gold = 10;
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }

  const magneticMechs = LIVE_MINION_DEFINITIONS.filter(
    (definition) =>
      definition.tier <= player.tavernTier &&
      definition.magnetic !== undefined &&
      (definition.tribes ?? [definition.tribe]).includes("mech"),
  ).slice(0, 3);
  const ordinaryMech = LIVE_MINION_DEFINITIONS.find(
    (definition) =>
      definition.tier <= player.tavernTier &&
      definition.magnetic === undefined &&
      (definition.tribes ?? [definition.tribe]).includes("mech"),
  );
  assert.equal(magneticMechs.length, 3);
  assert.ok(ordinaryMech);
  for (const definition of [...magneticMechs, ordinaryMech]) {
    state.pool[definition.id] = 1;
  }

  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  player = humanPlayer(state);
  const discover = state.pendingInteraction;
  assert.ok(discover?.kind === "discover");
  assert.equal(discover.filter.magnetic, true);
  assert.equal(discover.options.length, 3);
  assert.ok(
    discover.options.every(
      (option) =>
        getMinionDefinition(option.definitionId).magnetic !== undefined,
    ),
  );
  assert.ok(
    discover.options.every(
      (option) => option.definitionId !== ordinaryMech.id,
    ),
  );
  assert.equal(player.gold, 9);
});
