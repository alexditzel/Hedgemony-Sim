import fs from "fs";

function fixFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf-8");
  for (const [regex, replacement] of replacements) {
    content = content.replace(regex, replacement);
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

fixFile("src/components/GameView.tsx", [
  [/activePlayerId=\{state\.active_player_id\}/g, 'activePlayerId={state.active_player_id ?? undefined}'],
]);

fixFile("src/components/TopBar.tsx", [
  [/playerTone\(state, state\.active_player_id\)/g, 'playerTone(state, state.active_player_id ?? undefined)'],
]);

fixFile("src/engine/rules.ts", [
  [/card_id: cardId \?\? null \?\? null,/g, 'card_id: cardId ?? null,'],
  [/\(force\.reset_available_turn \?\? 0\) = /g, 'force.reset_available_turn = '],
  [/applied = applyEffects\(draft, effects, request\.requested_by\)/g, 'applied = applyEffects(draft, effects, request.requested_by ?? undefined)'],
  [/effect\.source_card_id,/g, 'effect.source_card_id ?? undefined,'],
  [/area_of_interest_id: isRecord\(effect\.value\)\n\s*\? stringFrom\(effect\.value\.area_of_interest_id, ""\)\n\s*: undefined,/g, 'area_of_interest_id: isRecord(effect.value) ? stringFrom(effect.value.area_of_interest_id, "") : null,'],
  [/readiness_level:\n\s*numberFrom\(effect\.value\) || force\.readiness_level,/g, 'readiness_level: numberFrom(effect.value) || force.readiness_level ?? null,'],
  [/readiness_level:\n\s*numberFrom\(\n\s*effect\.value,\n\s*force\.readiness_level \?\? 100,\n\s*\)/g, 'readiness_level: numberFrom(effect.value, force.readiness_level ?? 100) as ReadinessLevel'],
  [/\.\.\.extras,\n\s*\}/g, 'player_id: null, card_id: null, roll_id: null, ...extras, }'],
]);

fixFile("tests/engine.test.ts", [
  [/decision\.activationIntent,/g, 'decision.activationIntent ?? undefined,'],
  [/timing: "proactive",/g, 'timing: "proactive", responding_to_action_id: null,'],
]);
