import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createHeroChoicePresentation,
  heroChoicePresentationDuration,
  transitionHeroChoicePresentation,
  type HeroChoicePresentationState,
} from "../lib/game/hero-choice-presentation.ts";

const OPTION_IDS = ["hero-a", "hero-b", "hero-c", "hero-d"] as const;
const GAME_CLIENT_SOURCE = readFileSync(
  new URL("../app/GameClient.tsx", import.meta.url),
  "utf8",
).replace(/\s+/gu, " ");
const GAME_CSS_SOURCE = readFileSync(
  new URL("../app/game.css", import.meta.url),
  "utf8",
);

function presentationFixture(): HeroChoicePresentationState {
  const presentation = createHeroChoicePresentation({
    interactionId: "hero-choice-17",
    optionIds: OPTION_IDS,
    selectedHeroId: "hero-c",
  });
  assert.ok(presentation);
  return presentation;
}

test("a valid four-Hero choice creates an immutable focus snapshot", () => {
  const optionIds: string[] = [...OPTION_IDS];
  const presentation = createHeroChoicePresentation({
    interactionId: "hero-choice-1",
    optionIds,
    selectedHeroId: "hero-b",
  });

  assert.deepEqual(presentation, {
    interactionId: "hero-choice-1",
    optionIds: OPTION_IDS,
    selectedHeroId: "hero-b",
    stage: "focus",
    revision: 0,
  });
  optionIds[0] = "mutated-after-create";
  assert.deepEqual(presentation?.optionIds, OPTION_IDS);
});

test("creation rejects malformed candidate sets and missing selections", () => {
  const create = (
    optionIds: readonly string[],
    selectedHeroId = "hero-a",
    interactionId = "hero-choice-invalid",
  ) =>
    createHeroChoicePresentation({
      interactionId,
      optionIds,
      selectedHeroId,
    });

  assert.equal(create(OPTION_IDS.slice(0, 3)), null);
  assert.equal(create([...OPTION_IDS, "hero-e"]), null);
  assert.equal(create(["hero-a", "hero-a", "hero-c", "hero-d"]), null);
  assert.equal(create(OPTION_IDS, "hero-not-offered"), null);
  assert.equal(create(["hero-a", "", "hero-c", "hero-d"]), null);
  assert.equal(create(OPTION_IDS, ""), null);
  assert.equal(create(OPTION_IDS, "hero-a", ""), null);
});

test("advance moves focus to lobby reveal and then completes", () => {
  const focus = presentationFixture();
  const lobbyReveal = transitionHeroChoicePresentation(focus, {
    type: "advance",
    expectedInteractionId: focus.interactionId,
    expectedStage: focus.stage,
    expectedRevision: focus.revision,
  });

  assert.ok(lobbyReveal);
  assert.equal(lobbyReveal.stage, "lobbyReveal");
  assert.equal(lobbyReveal.revision, 1);
  assert.equal(lobbyReveal.selectedHeroId, focus.selectedHeroId);
  assert.deepEqual(lobbyReveal.optionIds, focus.optionIds);
  assert.equal(
    transitionHeroChoicePresentation(lobbyReveal, {
      type: "advance",
      expectedInteractionId: lobbyReveal.interactionId,
      expectedStage: lobbyReveal.stage,
      expectedRevision: lobbyReveal.revision,
    }),
    null,
  );
});

test("interaction, stage, and revision guards make stale timers harmless", () => {
  const focus = presentationFixture();
  assert.equal(
    transitionHeroChoicePresentation(focus, {
      type: "advance",
      expectedInteractionId: "older-interaction",
      expectedStage: "focus",
      expectedRevision: 0,
    }),
    focus,
  );
  assert.equal(
    transitionHeroChoicePresentation(focus, {
      type: "advance",
      expectedInteractionId: focus.interactionId,
      expectedStage: "lobbyReveal",
      expectedRevision: 0,
    }),
    focus,
  );
  assert.equal(
    transitionHeroChoicePresentation(focus, {
      type: "advance",
      expectedInteractionId: focus.interactionId,
      expectedStage: "focus",
      expectedRevision: 1,
    }),
    focus,
  );

  const lobbyReveal = transitionHeroChoicePresentation(focus, {
    type: "advance",
    expectedInteractionId: focus.interactionId,
    expectedStage: "focus",
    expectedRevision: 0,
  });
  assert.ok(lobbyReveal);
  assert.equal(
    transitionHeroChoicePresentation(lobbyReveal, {
      type: "advance",
      expectedInteractionId: focus.interactionId,
      expectedStage: "focus",
      expectedRevision: 0,
    }),
    lobbyReveal,
  );
  assert.equal(
    transitionHeroChoicePresentation(null, {
      type: "advance",
      expectedInteractionId: focus.interactionId,
      expectedStage: "focus",
      expectedRevision: 0,
    }),
    null,
  );
});

test("skip completes the matching presentation immediately", () => {
  const presentation = presentationFixture();
  assert.equal(
    transitionHeroChoicePresentation(presentation, {
      type: "skip",
      expectedInteractionId: "older-interaction",
    }),
    presentation,
  );
  assert.equal(
    transitionHeroChoicePresentation(presentation, {
      type: "skip",
      expectedInteractionId: presentation.interactionId,
    }),
    null,
  );
  assert.equal(
    transitionHeroChoicePresentation(null, {
      type: "skip",
      expectedInteractionId: presentation.interactionId,
    }),
    null,
  );
});

test("normal and reduced-motion durations are exact for both stages", () => {
  assert.equal(heroChoicePresentationDuration("focus"), 800);
  assert.equal(heroChoicePresentationDuration("lobbyReveal"), 1_500);
  assert.equal(heroChoicePresentationDuration("focus", true), 80);
  assert.equal(heroChoicePresentationDuration("lobbyReveal", true), 80);
});

test("lobby reveal keeps the tribe summary out of the centered hero grid", () => {
  assert.match(
    GAME_CLIENT_SOURCE,
    /className="hero-choice-tribes" data-testid="hero-choice-confirmation-tribes"/u,
  );

  const confirmationTribes = GAME_CSS_SOURCE.match(
    /\.hero-choice-confirmation\s*>\s*\.hero-choice-tribes\s*\{([^}]*)\}/u,
  );
  const confirmationTribeRules = confirmationTribes?.[1];
  assert.ok(confirmationTribeRules);
  assert.match(confirmationTribeRules, /position:\s*absolute;/u);
  assert.match(confirmationTribeRules, /bottom:\s*clamp\(/u);
  assert.match(confirmationTribeRules, /left:\s*50%;/u);
  assert.match(confirmationTribeRules, /width:\s*min\(/u);
  assert.match(confirmationTribeRules, /margin:\s*0;/u);
  assert.match(
    confirmationTribeRules,
    /transform:\s*translateX\(-50%\);/u,
  );
});
