import fs from "fs";
import { execSync } from "child_process";

function fixFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf-8");
  for (const [regex, replacement] of replacements) {
    content = content.replace(regex, replacement);
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

fixFile("src/engine/rules.ts", [
  [/active_player_id:\s*undefined/g, 'active_player_id: null'],
  [/blue_subphase:\s*undefined/g, 'blue_subphase: null'],
  [/procured_turn:\s*undefined/g, 'procured_turn: null'],
  [/remaining_turns:\s*null\s*,?\s*}/g, 'remaining_turns: null, area_of_interest_id: null }'],
  [/state_of_world:\s*\{\}/g, 'state_of_world: {}, game_start: null'],
  [/active_player_id\s*=\s*undefined/g, 'active_player_id = null'],
  [/blue_subphase\s*=\s*undefined/g, 'blue_subphase = null'],
]);

console.log("Fixed rules.ts");
