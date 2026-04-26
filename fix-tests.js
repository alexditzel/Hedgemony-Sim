import fs from "fs";

function fixFile(filePath, regex, replacement) {
  let content = fs.readFileSync(filePath, "utf-8");
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, "utf-8");
}

fixFile("/Users/henryblanchette/Documents/Hedgemony-Sim/tests/engine.test.ts", /source:\s*"in_theater"\s*}/g, 'source: "in_theater", out_of_area_arrival: null }');
fixFile("/Users/henryblanchette/Documents/Hedgemony-Sim/tests/engine.test.ts", /remaining_turns:\s*null\s*}/g, 'remaining_turns: null, area_of_interest_id: null }');
fixFile("/Users/henryblanchette/Documents/Hedgemony-Sim/tests/engine.test.ts", /requires_adjudication:\s*false,\s*}/g, 'requires_adjudication: false, source_card_id: null }');
