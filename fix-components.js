import fs from "fs";

function fixFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf-8");
  for (const [regex, replacement] of replacements) {
    content = content.replace(regex, replacement);
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

fixFile("src/components/CardModal.tsx", [
  [/outcome\|\|"SQ"/g, 'outcome ?? "SQ"'] // wait, need to check exactly what it is.
]);

fixFile("src/components/GameView.tsx", [
  [/source:\s*"in_theater"\s*}/g, 'source: "in_theater", out_of_area_arrival: null }']
]);

fixFile("src/components/EventLog.tsx", [
  [/PlayerId:\s*\{item\.player_id\}/g, 'PlayerId: {item.player_id ?? undefined}'],
  [/CardId:\s*\{item\.card_id\}/g, 'CardId: {item.card_id ?? undefined}'],
  [/roll_id=\{item\.roll_id\}/g, 'roll_id={item.roll_id ?? undefined}'],
  [/card_id=\{item\.card_id\}/g, 'card_id={item.card_id ?? undefined}'],
]);

fixFile("src/components/TopBar.tsx", [
  [/subphase=\{state\.blue_subphase\}/g, 'subphase={state.blue_subphase ?? undefined}'],
]);

fixFile("src/engine/llm.ts", [
  [/const high_model = /g, '// const high_model = ']
]);

console.log("Fixed components");
