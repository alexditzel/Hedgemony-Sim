import fs from "fs";

function fixFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf-8");
  for (const [regex, replacement] of replacements) {
    content = content.replace(regex, replacement);
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

fixFile("src/components/CardModal.tsx", [
  [/outcome=\{outcome\}/g, 'outcome={outcome ?? undefined}']
]);

fixFile("src/components/EventLog.tsx", [
  [/PlayerId=\{item\.player_id\}/g, 'PlayerId={item.player_id ?? undefined}'],
  [/CardId=\{item\.card_id\}/g, 'CardId={item.card_id ?? undefined}'],
]);

fixFile("src/components/GameView.tsx", [
  [/activation_intent=\{\n\s*state\.red_signals\[player\.id\]\?.activation_intent\n\s*\}/g, 'activation_intent={state.red_signals[player.id]?.activation_intent ?? undefined}'],
  [/subphase=\{state\.blue_subphase\}/g, 'subphase={state.blue_subphase ?? undefined}'],
]);

fixFile("src/components/TheaterMap.tsx", [
  [/const aorPolygon = state\.scenario_flags\?\.\[flagKey\]/g, 'const aorPolygon = state.scenario_flags?.[flagKey] ?? null']
]);

fixFile("src/components/TopBar.tsx", [
  [/subphase=\{state\.blue_subphase\}/g, 'subphase={state.blue_subphase ?? undefined}']
]);

fixFile("src/engine/rules.ts", [
  [/player_id\?: string \| null \| undefined/g, 'player_id?: string | null'],
  [/card_id\?: string \| null \| undefined/g, 'card_id?: string | null'],
  [/roll_id\?: string \| null \| undefined/g, 'roll_id?: string | null'],
  [/player_id:\s*requestedBy/g, 'player_id: requestedBy ?? null'],
  [/card_id:\s*cardId/g, 'card_id: cardId ?? null'],
  [/roll_id:\s*rollId/g, 'roll_id: rollId ?? null'],
  [/reset_required: false,\n\s*procured_turn: null,/g, 'reset_required: false,\n        reset_available_turn: null,\n        procured_turn: null,'],
  [/row\.roll_min/g, '(row.roll_min ?? 0)'],
  [/row\.roll_max/g, '(row.roll_max ?? 0)'],
  [/trigger_turn,\n\s*expiration_turn,\n\s*trigger_condition/g, 'trigger_turn: item.trigger_turn ?? null,\n    expiration_turn: item.expiration_turn ?? null,\n    trigger_condition: item.trigger_condition ?? null'],
  [/responding_to_action_id\?: string;/g, 'responding_to_action_id?: string | null;'],
  [/responding_to_action_id/g, 'responding_to_action_id: null'], // catch any that need initialization
  [/readiness_level\?: ReadinessLevel;/g, 'readiness_level?: ReadinessLevel | null;'],
  [/readinessLevel\?: ReadinessLevel/g, 'readinessLevel: ReadinessLevel | null'],
  [/readiness_level: force\.readiness_level,/g, 'readiness_level: force.readiness_level ?? null,'],
  [/force\.reset_available_turn/g, '(force.reset_available_turn ?? 0)'],
  [/item\.trigger_turn/g, '(item.trigger_turn ?? 0)'],
  [/item\.expiration_turn/g, '(item.expiration_turn ?? 0)'],
  [/area_of_interest_id\?: LocationId/g, 'area_of_interest_id?: LocationId | null'],
]);

fixFile("tests/engine.test.ts", [
  [/activation_intent: undefined/g, 'activation_intent: null'],
  [/status: "pending",\n\s*payload:/g, 'status: "pending",\n        requested_by: null,\n        card_id: null,\n        resolution_note: null,\n        payload:'],
  [/procured_turn: 1/g, 'reset_available_turn: null,\n          procured_turn: 1'],
  [/label: "Fail",\n\s*effects:/g, 'label: "Fail",\n            outcome: null,\n            narrative: null,\n            effects:'],
  [/label: "Success",\n\s*effects:/g, 'label: "Success",\n            outcome: null,\n            narrative: null,\n            effects:'],
  [/label: "Escalate",\n\s*effects:/g, 'label: "Escalate",\n            outcome: null,\n            narrative: null,\n            effects:'],
]);

console.log("Fixed part 2");
