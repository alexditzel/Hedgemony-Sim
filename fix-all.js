import fs from "fs";

function fixFile(filePath, regex, replacement) {
  let content = fs.readFileSync(filePath, "utf-8");
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, "utf-8");
}

// components
fixFile("src/components/CardModal.tsx", /modifiers:\s*\[\],\s*critical_capabilities:\s*\[\],/g, 'modifiers: [], critical_capabilities: [], die: null, table_reference: null, outcome_map: [], pinning: null, ');
fixFile("src/components/CardModal.tsx", /aor:\s*undefined,\s*subtype:\s*undefined,/g, 'aor: null, subtype: null, notes: null, ');

// rules
fixFile("src/engine/rules.ts", /function signalRedCards\([\s\S]*?activationIntent\s*:\s*Record<CardId, "Yes" \| "No" \| "Undeclared"> = \{\},?/g, 
  `function signalRedCards(
  state: GameState,
  playerId: PlayerId,
  cardIds: CardId[],
  briefSummary: string | null = null,
  activationIntent: Record<CardId, "Yes" | "No" | "Undeclared"> | null = null,`);

// etc.
