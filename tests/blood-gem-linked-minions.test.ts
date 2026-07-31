import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  gameTransition,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V30,
  normalizePersistedGameState,
} from "../lib/game/save.ts";
import {
  deriveRecruitPresentation,
  recruitPresentationAnnouncement,
} from "../lib/game/recruit-presentation.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function definitionMinion(
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
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
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
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
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

function goldenMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return definitionMinion(definitionId, instanceId, {
    golden: true,
    cardId: definition.goldenCardId ?? definition.cardId,
    description:
      definition.goldenDescription ?? definition.description,
    attack: definition.attack * 2,
    health: definition.health * 2,
    ...overrides,
  });
}

function bloodGem(
  instanceId: string,
  bonusKeyword?: BloodGemSpellInstance["bonusKeyword"],
): BloodGemSpellInstance {
  return {
    kind: "bloodGem",
    instanceId,
    definitionId: "blood-gem",
    cardId: "BG20_GEM",
    name: "鲜血宝石",
    description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem",
    ...(bonusKeyword ? { bonusKeyword } : {}),
  };
}

function bloodGems(player: PlayerState): BloodGemSpellInstance[] {
  return player.hand.filter(
    (card): card is BloodGemSpellInstance => card.kind === "bloodGem",
  );
}

function keepOnlyOneOpponent(
  state: GameState,
  enemyBoard: BoardMinionInstance[],
): PlayerState {
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (index > 1) {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.eliminatedRound = undefined;
    }
  }
  const enemy = state.players[1];
  enemy.alive = true;
  enemy.health = 100;
  enemy.board = enemyBoard;
  return enemy;
}

test("the three fixed-build Blood Gem cards expose exact normal and Golden rules", () => {
  const foodie = getMinionDefinition("BG30_123");
  assert.equal(foodie.name, "无畏的食客");
  assert.equal(foodie.effectSupport, "complete");
  assert.equal(foodie.goldenCardId, "BG30_123_G");
  assert.deepEqual(foodie.onPlayChoice, {
    kind: "bloodGemImproveOrGain",
    attack: 1,
    health: 1,
    count: 4,
    goldenMode: "doubleValues",
  });

  const surveyor = getMinionDefinition("BG30_121");
  assert.equal(surveyor.name, "热气球测绘员");
  assert.equal(surveyor.effectSupport, "complete");
  assert.equal(surveyor.goldenCardId, "BG30_121_G");
  assert.deepEqual(surveyor.bloodGemFromHandAura, {
    extraCasts: 1,
    goldenMode: "doubleCount",
  });

  const roogug = getMinionDefinition("BG28_583");
  assert.equal(roogug.name, "地卜大师鲁古格");
  assert.equal(roogug.effectSupport, "complete");
  assert.equal(roogug.divineShield, true);
  assert.equal(roogug.goldenCardId, "BG28_583_G");
  assert.deepEqual(roogug.afterBloodGemCastOnSelf, {
    kind: "playBloodGemsOnRandomOther",
    count: 1,
    goldenMode: "doubleCount",
  });
});

test("Fearless Foodie opens a resumable non-Battlecry choice and Brann does not repeat it", () => {
  let state = createGame(0xb310);
  const human = humanPlayer(state);
  human.board = [
    definitionMinion("BG_LOE_077", "foodie-brann"),
  ];
  human.hand = [
    definitionMinion("BG30_123", "foodie-normal"),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "foodie-normal",
  });
  assert.equal(state.pendingInteraction?.kind, "minionChoice");
  assert.deepEqual(
    state.pendingInteraction?.kind === "minionChoice"
      ? state.pendingInteraction.optionIds
      : [],
    ["BG30_123t", "BG30_123t2"],
  );
  assert.deepEqual(
    [
      humanPlayer(state).bloodGemAttack,
      humanPlayer(state).bloodGemHealth,
    ],
    [1, 1],
  );

  const invalid = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction?.interactionId ?? "",
    optionInstanceId: "BG30_123_Gt",
  });
  assert.equal(invalid, state);

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction?.interactionId ?? "",
    optionInstanceId: "BG30_123t",
  });
  assert.equal(state.pendingInteraction, null);
  assert.deepEqual(
    [
      humanPlayer(state).bloodGemAttack,
      humanPlayer(state).bloodGemHealth,
    ],
    [2, 2],
  );
  assert.equal(humanPlayer(state).cardsPlayedThisTurn, 1);
});

test("Golden Fearless Foodie reserves its Triple Reward before the eight-Gem branch", () => {
  let state = createGame(0xb311);
  const human = humanPlayer(state);
  human.hand = [
    ...Array.from({ length: 9 }, (_, index) =>
      definitionMinion(
        "BG25_001",
        `foodie-filler-${index}`,
        { golden: true },
      ),
    ),
    goldenMinion("BG30_123", "foodie-golden", {
      grantsTripleReward: true,
    }),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "foodie-golden",
  });
  assert.equal(state.pendingInteraction?.kind, "minionChoice");
  assert.equal(
    humanPlayer(state).hand.filter(
      (card) => card.kind === "tripleReward",
    ).length,
    1,
  );
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction?.interactionId ?? "",
    optionInstanceId: "BG30_123_Gt2",
  });
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.equal(bloodGems(humanPlayer(state)).length, 0);
});

test("Surveyor pulses and Roogug redirects every Blood Gem separately", () => {
  let state = createGame(0xb320);
  const human = humanPlayer(state);
  const roogug = goldenMinion("BG28_583", "pulse-roogug");
  const target = definitionMinion("BG25_001", "pulse-target");
  human.board = [
    goldenMinion("BG30_121", "pulse-surveyor"),
    roogug,
    target,
  ];
  human.hand = [
    bloodGem("pulse-gem", "divineShieldForQuilboar"),
  ];

  const before = structuredClone(state);
  const action = {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "pulse-gem",
    targetInstanceId: roogug.instanceId,
  } as const;
  const transition = gameTransition(state, action);
  assert.deepEqual(transition.state, gameReducer(state, action));
  state = transition.state;
  const next = humanPlayer(state);
  const nextRoogug = next.board.find(
    (minion) => minion.instanceId === roogug.instanceId,
  );
  const nextTarget = next.board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  const nextSurveyor = next.board.find(
    (minion) => minion.instanceId === "pulse-surveyor",
  );
  assert.ok(nextRoogug);
  assert.ok(nextTarget);
  assert.ok(nextSurveyor);
  assert.deepEqual(
    [nextRoogug.bloodGemAttack, nextRoogug.bloodGemHealth],
    [3, 3],
  );
  assert.equal(
    nextTarget.bloodGemAttack + nextSurveyor.bloodGemAttack,
    6,
  );
  assert.equal(
    nextTarget.bloodGemHealth + nextSurveyor.bloodGemHealth,
    6,
  );
  assert.equal(nextRoogug.divineShield, true);
  assert.equal(nextTarget.divineShield, false);
  assert.equal(bloodGems(next).length, 0);
  assert.equal(next.cardsPlayedThisTurn, 1);

  const presentation = deriveRecruitPresentation(
    before,
    state,
    action,
    transition.trace,
  );
  const pulses = presentation.filter(
    (event) => event.kind === "bloodGemPulse",
  );
  assert.equal(pulses.length, 9);
  assert.deepEqual(
    pulses.map((event) => event.origin),
    [
      "hand",
      "roogug",
      "roogug",
      "hand",
      "roogug",
      "roogug",
      "hand",
      "roogug",
      "roogug",
    ],
  );
  for (let group = 0; group < 3; group += 1) {
    const handPulse = pulses[group * 3];
    const firstRedirect = pulses[group * 3 + 1];
    const secondRedirect = pulses[group * 3 + 2];
    assert.equal(handPulse.targetInstanceId, roogug.instanceId);
    assert.equal(
      firstRedirect.targetInstanceId,
      secondRedirect.targetInstanceId,
    );
  }
  for (const [index, pulse] of pulses.entries()) {
    assert.equal(pulse.pulseIndex, index);
    assert.equal(pulse.pulseCount, pulses.length);
    const stagedTarget = pulse.boardAfterPulse.find(
      (minion) => minion.instanceId === pulse.targetInstanceId,
    );
    assert.ok(stagedTarget);
    const tracedTarget =
      transition.trace.recruitBloodGemPulses[index].targetAfter;
    assert.deepEqual(stagedTarget, tracedTarget);
  }
  const visibleStats = (board: readonly BoardMinionInstance[]) =>
    board.map((minion) => ({
      instanceId: minion.instanceId,
      attack: minion.attack,
      health: minion.health,
      bloodGemAttack: minion.bloodGemAttack,
      bloodGemHealth: minion.bloodGemHealth,
      divineShield: minion.divineShield,
      reborn: minion.reborn,
    }));
  assert.deepEqual(
    visibleStats(pulses[0]?.boardBeforePulse ?? []),
    visibleStats(humanPlayer(before).board),
  );
  for (let index = 1; index < pulses.length; index += 1) {
    assert.deepEqual(
      visibleStats(pulses[index].boardBeforePulse),
      visibleStats(pulses[index - 1].boardAfterPulse),
    );
  }
  assert.deepEqual(
    visibleStats(pulses.at(-1)?.boardAfterPulse ?? []),
    visibleStats(humanPlayer(state).board),
  );
  assert.doesNotMatch(
    JSON.stringify(state),
    /recruitBloodGemPulses|targetAfter/,
  );
  assert.match(
    recruitPresentationAnnouncement([pulses[0]]),
    /第1\/9颗/,
  );
});

test("a keyword Blood Gem reports only a keyword that the target really gained", () => {
  const state = createGame(0xb322);
  const human = humanPlayer(state);
  const nonQuilboar = definitionMinion(
    "BG25_001",
    "keyword-non-quilboar",
  );
  human.board = [nonQuilboar];
  human.hand = [
    bloodGem("keyword-gem", "divineShieldForQuilboar"),
  ];
  const action = {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "keyword-gem",
    targetInstanceId: nonQuilboar.instanceId,
  } as const;
  const transition = gameTransition(state, action);
  assert.deepEqual(
    transition.trace.recruitBloodGemPulses[0].gainedKeywords,
    [],
  );
  const presentation = deriveRecruitPresentation(
    state,
    transition.state,
    action,
    transition.trace,
  );
  assert.equal(presentation[0]?.kind, "bloodGemPulse");
  assert.equal(
    presentation[0]?.kind === "bloodGemPulse"
      ? presentation[0].bonusKeyword
      : undefined,
    undefined,
  );
});

test("Roogugs never redirect Blood Gems into another normal or Golden Roogug", () => {
  let state = createGame(0xb321);
  const human = humanPlayer(state);
  const first = definitionMinion("BG28_583", "exclude-roogug-1");
  const second = goldenMinion("BG28_583", "exclude-roogug-2");
  human.board = [first, second];
  human.hand = [bloodGem("exclude-gem")];

  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "exclude-gem",
    targetInstanceId: first.instanceId,
  });
  const next = humanPlayer(state);
  assert.deepEqual(
    [
      next.board[0].bloodGemAttack,
      next.board[1].bloodGemAttack,
    ],
    [1, 0],
  );
});

test("AI resolves Fearless Foodie immediately and takes tempo Gems while under pressure", () => {
  const state = createGame(0xb330);
  const human = humanPlayer(state);
  human.board = [definitionMinion("BG25_001", "ai-foodie-human")];
  const enemy = keepOnlyOneOpponent(state, []);
  enemy.health = 15;
  enemy.board = [];
  enemy.hand = [
    definitionMinion("BG30_123", "ai-foodie"),
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextEnemy = combat.players.find(
    (player) => player.id === enemy.id,
  );
  assert.ok(nextEnemy);
  assert.equal(
    nextEnemy.board.some(
      (minion) => minion.instanceId === "ai-foodie",
    ),
    true,
  );
  assert.equal(bloodGems(nextEnemy).length, 0);
  const playedFoodie = nextEnemy.board.find(
    (minion) => minion.instanceId === "ai-foodie",
  );
  assert.ok(playedFoodie);
  assert.equal(playedFoodie.bloodGemAttack, 4);
  assert.equal(playedFoodie.bloodGemHealth, 4);
  assert.equal(combat.pendingInteraction, null);
});

test("AI takes Foodie's immediate Gems for a live Surveyor combo even while healthy", () => {
  const state = createGame(0xb331);
  const human = humanPlayer(state);
  human.board = [
    definitionMinion("BG25_001", "surveyor-combo-human"),
  ];
  const enemy = keepOnlyOneOpponent(state, []);
  enemy.health = 40;
  enemy.board = [
    definitionMinion("BG30_121", "surveyor-combo-aura"),
    definitionMinion("BG25_001", "surveyor-combo-filler-1"),
    definitionMinion("BG25_001", "surveyor-combo-filler-2"),
  ];
  enemy.hand = [
    definitionMinion("BG30_123", "surveyor-combo-foodie"),
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextEnemy = combat.players.find(
    (player) => player.id === enemy.id,
  );
  assert.ok(nextEnemy);
  assert.equal(nextEnemy.bloodGemAttack, 1);
  assert.equal(nextEnemy.bloodGemHealth, 1);
  assert.equal(
    nextEnemy.board.reduce(
      (total, minion) => total + minion.bloodGemAttack,
      0,
    ),
    8,
  );
});

test("AI values Composer and Roogug's next-combat applications when choosing Foodie's permanent branch", () => {
  const state = createGame(0xb332);
  const human = humanPlayer(state);
  human.board = [
    definitionMinion("BG25_001", "composer-choice-human"),
  ];
  const enemy = keepOnlyOneOpponent(state, []);
  enemy.health = 40;
  enemy.board = [
    definitionMinion("BG26_157", "composer-choice-engine"),
    definitionMinion("BG28_583", "composer-choice-roogug"),
    definitionMinion("BG20_100", "composer-choice-quilboar-1"),
    definitionMinion("BG20_100", "composer-choice-quilboar-2"),
  ];
  enemy.hand = [
    definitionMinion("BG30_123", "composer-choice-foodie"),
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextEnemy = combat.players.find(
    (player) => player.id === enemy.id,
  );
  assert.ok(nextEnemy);
  assert.deepEqual(
    [nextEnemy.bloodGemAttack, nextEnemy.bloodGemHealth],
    [2, 2],
  );
  assert.equal(bloodGems(nextEnemy).length, 0);
});

test("combat Blood Gem pulses trigger Roogug in event order without changing Recruit stats", () => {
  const state = createGame(0xb340);
  const human = humanPlayer(state);
  human.bloodGemAttack = 2;
  human.bloodGemHealth = 3;
  const composer = definitionMinion(
    "BG26_157",
    "combat-composer",
    { attack: 0, health: 10_000 },
  );
  const roogug = definitionMinion(
    "BG28_583",
    "combat-roogug",
    { attack: 0, health: 10_000 },
  );
  const friend = definitionMinion(
    "BG23_018",
    "combat-friend",
    { attack: 0, health: 10_000 },
  );
  const victims = [1, 2].map((index) =>
    definitionMinion(
      "BG20_100",
      `combat-victim-${index}`,
      {
        attack: 1,
        health: 1,
        taunt: true,
      },
    ),
  );
  human.board = [...victims, composer, roogug, friend];
  const permanentBefore = structuredClone(human.board);
  keepOnlyOneOpponent(state, [
    definitionMinion("BG29_611", "combat-wall", {
      attack: 100,
      health: 1_000_000,
      taunt: true,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const events = combat.lastBattle?.events ?? [];
  const triggers = events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === roogug.instanceId,
  );
  const redirected = events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === roogug.instanceId &&
      event.message.includes("鲜血宝石"),
  );
  assert.equal(triggers.length, 2);
  assert.equal(redirected.length, 2);
  assert.ok(
    redirected.every(
      (event) =>
        event.attackDelta === 2 &&
        event.healthDelta === 3 &&
        event.targetInstanceId !== roogug.instanceId,
    ),
  );
  assert.ok(triggers[0].index < redirected[0].index);
  assert.deepEqual(
    humanPlayer(combat).board.map((minion) => ({
      instanceId: minion.instanceId,
      attack: minion.attack,
      health: minion.health,
      bloodGemAttack: minion.bloodGemAttack,
      bloodGemHealth: minion.bloodGemHealth,
    })),
    permanentBefore.map((minion) => ({
      instanceId: minion.instanceId,
      attack: minion.attack,
      health: minion.health,
      bloodGemAttack: minion.bloodGemAttack,
      bloodGemHealth: minion.bloodGemHealth,
    })),
  );
});

test("v30 saves migrate to v31 and a current pending Foodie choice survives JSON reload", () => {
  const legacy = createGame(0xb350);
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V30;
  humanPlayer(legacy).bloodGemAttack = 4;
  humanPlayer(legacy).bloodGemHealth = 5;
  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(legacy)),
  ) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.deepEqual(
    [
      humanPlayer(migrated).bloodGemAttack,
      humanPlayer(migrated).bloodGemHealth,
    ],
    [4, 5],
  );

  let current = createGame(0xb351);
  humanPlayer(current).hand = [
    definitionMinion("BG30_123", "saved-foodie"),
  ];
  current = gameReducer(current, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "saved-foodie",
  });
  assert.equal(current.pendingInteraction?.kind, "minionChoice");
  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(current)),
  ) as GameState | null;
  assert.ok(restored);
  assert.deepEqual(restored.pendingInteraction, current.pendingInteraction);
});
