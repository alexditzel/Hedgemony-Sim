import type {
  ProbabilityOutcome,
  ReadinessLevel,
  ReliabilityLevel,
  RuleIssue,
  RuleValue,
  TableExtension
} from "./types";

export type CtrAColumn =
  | "Red >=4:1"
  | "Red 3:1"
  | "Red 2:1"
  | "1:1"
  | "Blue 2:1"
  | "Blue 3:1"
  | "Blue >=4:1";

export type RtBColumn = "Red Advantage" | "Parity" | "Blue Advantage";
export type DeploymentMode = "proactive" | "reactive";
export type ReadinessLocation = "CONUS" | "OCONUS";

function issue(table: string, row: string | number, column?: string | number): RuleIssue {
  return {
    id: `table:${table}:${row}:${column ?? "-"}`,
    severity: "adjudication",
    message: `${table} has no printed value for row ${row}${column === undefined ? "" : `, column ${column}`}.`,
    rule_refs: [table],
    tags: ["WHITE_CELL_ADJUDICATION"]
  };
}

function extensionValue<T>(
  extensions: TableExtension[] | undefined,
  table: string,
  row: string | number,
  column?: string | number
): RuleValue<T> | undefined {
  const rowKey = String(row);
  const columnKey = column === undefined ? undefined : String(column);
  const found = extensions?.find(
    (extension) =>
      extension.table === table &&
      extension.row === rowKey &&
      (extension.column === undefined || extension.column === columnKey)
  );
  if (!found) {
    return undefined;
  }
  return { ok: true, value: found.value as T };
}

function lookupNested<T>(
  tableName: string,
  table: Record<number, Partial<Record<string | number, T>>>,
  row: number,
  column: string,
  extensions?: TableExtension[]
): RuleValue<T> {
  const extended = extensionValue<T>(extensions, tableName, row, column);
  if (extended) {
    return extended;
  }
  const rowValues = table[row];
  if (!rowValues || !(column in rowValues)) {
    return { ok: false, issue: issue(tableName, row, column) };
  }
  return { ok: true, value: rowValues[column] as T };
}

function lookupReadinessSustainmentCost(
  tableName: string,
  table: Record<number, Record<ReadinessLevel, number>>,
  ffs: number,
  readiness: ReadinessLevel,
  extensions?: TableExtension[]
): RuleValue<number> {
  const exactExtension = extensionValue<number>(extensions, tableName, ffs, readiness);
  if (exactExtension) {
    return exactExtension;
  }
  if (table[ffs]?.[readiness] !== undefined) {
    return { ok: true, value: table[ffs][readiness] };
  }
  const printedRows = Object.keys(table)
    .map(Number)
    .sort((left, right) => right - left);
  let remaining = ffs;
  let total = 0;
  while (remaining > 0) {
    const row = printedRows.find((printedRow) => printedRow <= remaining);
    if (!row || table[row]?.[readiness] === undefined) {
      return { ok: false, issue: issue(tableName, remaining, readiness) };
    }
    total += table[row][readiness];
    remaining -= row;
  }
  return { ok: true, value: total };
}

const conusDeploymentCost: Record<number, Record<DeploymentMode, number>> = {
  1: { proactive: 1, reactive: 2 },
  2: { proactive: 1, reactive: 2 },
  3: { proactive: 2, reactive: 3 },
  4: { proactive: 2, reactive: 3 },
  5: { proactive: 3, reactive: 5 },
  6: { proactive: 3, reactive: 5 },
  7: { proactive: 4, reactive: 6 },
  8: { proactive: 4, reactive: 6 },
  9: { proactive: 5, reactive: 8 },
  10: { proactive: 5, reactive: 8 },
  11: { proactive: 6, reactive: 9 },
  12: { proactive: 6, reactive: 9 },
  13: { proactive: 7, reactive: 11 },
  14: { proactive: 7, reactive: 11 },
  15: { proactive: 8, reactive: 12 }
};

export function getConusDeploymentCost(
  ffs: number,
  mode: DeploymentMode,
  extensions?: TableExtension[]
): RuleValue<number> {
  return lookupNested("US_CONUS_DEPLOYMENT_COST", conusDeploymentCost, ffs, mode, extensions);
}

const inTheaterCombatFactors: Record<number, Record<string, number>> = {
  1: { M1: 1, M2: 2, M3: 3, M4: 4, M5: 5, M6: 6, M7: 7 },
  2: { M1: 2, M2: 4, M3: 5, M4: 7, M5: 8, M6: 9, M7: 10 },
  3: { M1: 3, M2: 5, M3: 7, M4: 9, M5: 11, M6: 12, M7: 14 },
  4: { M1: 4, M2: 7, M3: 9, M4: 12, M5: 14, M6: 16, M7: 18 },
  5: { M1: 5, M2: 8, M3: 11, M4: 14, M5: 17, M6: 19, M7: 22 },
  6: { M1: 6, M2: 10, M3: 13, M4: 17, M5: 20, M6: 23, M7: 26 },
  7: { M1: 7, M2: 11, M3: 15, M4: 19, M5: 23, M6: 26, M7: 30 },
  8: { M1: 8, M2: 13, M3: 17, M4: 22, M5: 26, M6: 30, M7: 34 },
  9: { M1: 9, M2: 14, M3: 19, M4: 24, M5: 29, M6: 33, M7: 38 },
  10: { M1: 10, M2: 16, M3: 21, M4: 27, M5: 32, M6: 37, M7: 42 },
  11: { M1: 11, M2: 17, M3: 23, M4: 29, M5: 35, M6: 40, M7: 46 },
  12: { M1: 12, M2: 19, M3: 25, M4: 32, M5: 38, M6: 44, M7: 50 },
  13: { M1: 13, M2: 20, M3: 27, M4: 34, M5: 41, M6: 47, M7: 54 },
  14: { M1: 14, M2: 22, M3: 29, M4: 37, M5: 44, M6: 51, M7: 58 },
  15: { M1: 15, M2: 23, M3: 31, M4: 39, M5: 47, M6: 54, M7: 62 }
};

const conusReactiveCombatFactors: Record<number, Record<string, number>> = {
  1: { M1: 0, M2: 1, M3: 2, M4: 3, M5: 4, M6: 5, M7: 6 },
  2: { M1: 1, M2: 2, M3: 3, M4: 4, M5: 5, M6: 6, M7: 7 },
  3: { M1: 2, M2: 3, M3: 5, M4: 6, M5: 8, M6: 9, M7: 11 },
  4: { M1: 3, M2: 5, M3: 6, M4: 9, M5: 11, M6: 12, M7: 14 },
  5: { M1: 3, M2: 6, M3: 8, M4: 10, M5: 13, M6: 15, M7: 17 },
  6: { M1: 4, M2: 7, M3: 9, M4: 12, M5: 16, M6: 18, M7: 20 },
  7: { M1: 5, M2: 8, M3: 11, M4: 14, M5: 18, M6: 20, M7: 24 },
  8: { M1: 6, M2: 9, M3: 12, M4: 16, M5: 20, M6: 24, M7: 27 },
  9: { M1: 6, M2: 10, M3: 14, M4: 18, M5: 23, M6: 26, M7: 30 },
  10: { M1: 7, M2: 12, M3: 15, M4: 20, M5: 25, M6: 29, M7: 33 },
  11: { M1: 8, M2: 12, M3: 17, M4: 21, M5: 28, M6: 32, M7: 36 },
  12: { M1: 9, M2: 14, M3: 18, M4: 24, M5: 30, M6: 35, M7: 40 },
  13: { M1: 9, M2: 15, M3: 20, M4: 25, M5: 32, M6: 37, M7: 43 },
  14: { M1: 10, M2: 16, M3: 21, M4: 27, M5: 35, M6: 40, M7: 46 },
  15: { M1: 11, M2: 17, M3: 23, M4: 29, M5: 37, M6: 43, M7: 49 }
};

export function getInTheaterCombatFactors(
  ffs: number,
  modLevel: number,
  extensions?: TableExtension[]
): RuleValue<number> {
  return lookupNested("IN_THEATER_COMBAT_FACTORS", inTheaterCombatFactors, ffs, `M${modLevel}`, extensions);
}

export function getConusReactiveCombatFactors(
  ffs: number,
  modLevel: number,
  extensions?: TableExtension[]
): RuleValue<number> {
  return lookupNested(
    "US_CONUS_REACTIVE_COMBAT_FACTORS",
    conusReactiveCombatFactors,
    ffs,
    `M${modLevel}`,
    extensions
  );
}

const readinessImpact: Record<number, Record<ReadinessLevel, number>> = {
  1: { 100: 1, 90: 1, 80: 1, 70: 0, 60: 0, 50: 0 },
  2: { 100: 2, 90: 1, 80: 1, 70: 1, 60: 0, 50: 0 },
  3: { 100: 3, 90: 2, 80: 2, 70: 1, 60: 1, 50: 1 },
  4: { 100: 4, 90: 3, 80: 3, 70: 2, 60: 1, 50: 1 },
  5: { 100: 5, 90: 4, 80: 3, 70: 2, 60: 2, 50: 1 },
  6: { 100: 6, 90: 5, 80: 4, 70: 3, 60: 2, 50: 1 },
  7: { 100: 7, 90: 6, 80: 5, 70: 4, 60: 3, 50: 2 },
  8: { 100: 8, 90: 7, 80: 5, 70: 4, 60: 3, 50: 2 },
  9: { 100: 9, 90: 8, 80: 6, 70: 5, 60: 4, 50: 3 },
  10: { 100: 10, 90: 9, 80: 7, 70: 5, 60: 4, 50: 3 },
  15: { 100: 15, 90: 13, 80: 10, 70: 8, 60: 6, 50: 4 },
  20: { 100: 20, 90: 18, 80: 14, 70: 11, 60: 8, 50: 6 },
  25: { 100: 25, 90: 22, 80: 17, 70: 13, 60: 10, 50: 7 },
  30: { 100: 30, 90: 26, 80: 20, 70: 16, 60: 12, 50: 9 },
  35: { 100: 35, 90: 30, 80: 23, 70: 18, 60: 14, 50: 10 },
  40: { 100: 40, 90: 35, 80: 27, 70: 21, 60: 16, 50: 12 },
  45: { 100: 45, 90: 39, 80: 30, 70: 23, 60: 18, 50: 13 },
  50: { 100: 50, 90: 43, 80: 33, 70: 26, 60: 20, 50: 15 }
};

export function applyReadinessImpact(
  baselineCfs: number,
  readiness: ReadinessLevel,
  extensions?: TableExtension[]
): RuleValue<number> {
  if (readiness === 100) {
    return { ok: true, value: baselineCfs };
  }
  return lookupNested("US_READINESS_IMPACT_ON_CFS", readinessImpact, baselineCfs, String(readiness), extensions);
}

const crtARows: Array<[number | "-inf" | "inf", Record<CtrAColumn, ProbabilityOutcome>]> = [
  ["-inf", { "Red >=4:1": "RMG", "Red 3:1": "RMG", "Red 2:1": "RMG", "1:1": "RMG", "Blue 2:1": "RMG", "Blue 3:1": "RMG", "Blue >=4:1": "SQ" }],
  [-5, { "Red >=4:1": "RMG", "Red 3:1": "RMG", "Red 2:1": "RMG", "1:1": "RMG", "Blue 2:1": "RMG", "Blue 3:1": "RmG", "Blue >=4:1": "SQ" }],
  [-4, { "Red >=4:1": "RMG", "Red 3:1": "RMG", "Red 2:1": "RMG", "1:1": "RMG", "Blue 2:1": "RMG", "Blue 3:1": "RmG", "Blue >=4:1": "SQ" }],
  [-3, { "Red >=4:1": "RMG", "Red 3:1": "RMG", "Red 2:1": "RMG", "1:1": "RMG", "Blue 2:1": "RMG", "Blue 3:1": "RmG", "Blue >=4:1": "BmG" }],
  [-2, { "Red >=4:1": "RMG", "Red 3:1": "RMG", "Red 2:1": "RMG", "1:1": "RMG", "Blue 2:1": "RmG", "Blue 3:1": "SQ", "Blue >=4:1": "BmG" }],
  [-1, { "Red >=4:1": "RMG", "Red 3:1": "RMG", "Red 2:1": "RMG", "1:1": "RMG", "Blue 2:1": "RmG", "Blue 3:1": "SQ", "Blue >=4:1": "BmG" }],
  [0, { "Red >=4:1": "RMG", "Red 3:1": "RMG", "Red 2:1": "RMG", "1:1": "RMG", "Blue 2:1": "RmG", "Blue 3:1": "SQ", "Blue >=4:1": "BmG" }],
  [1, { "Red >=4:1": "RMG", "Red 3:1": "RMG", "Red 2:1": "RMG", "1:1": "RmG", "Blue 2:1": "SQ", "Blue 3:1": "BmG", "Blue >=4:1": "BmG" }],
  [2, { "Red >=4:1": "RMG", "Red 3:1": "RMG", "Red 2:1": "RmG", "1:1": "RmG", "Blue 2:1": "SQ", "Blue 3:1": "BmG", "Blue >=4:1": "BmG" }],
  [3, { "Red >=4:1": "RMG", "Red 3:1": "RMG", "Red 2:1": "RmG", "1:1": "SQ", "Blue 2:1": "SQ", "Blue 3:1": "BmG", "Blue >=4:1": "BMG" }],
  [4, { "Red >=4:1": "RMG", "Red 3:1": "RmG", "Red 2:1": "RmG", "1:1": "SQ", "Blue 2:1": "BmG", "Blue 3:1": "BmG", "Blue >=4:1": "BMG" }],
  [5, { "Red >=4:1": "RMG", "Red 3:1": "RmG", "Red 2:1": "RmG", "1:1": "SQ", "Blue 2:1": "BmG", "Blue 3:1": "BmG", "Blue >=4:1": "BMG" }],
  [6, { "Red >=4:1": "RMG", "Red 3:1": "RmG", "Red 2:1": "SQ", "1:1": "SQ", "Blue 2:1": "BmG", "Blue 3:1": "BMG", "Blue >=4:1": "BMG" }],
  [7, { "Red >=4:1": "RmG", "Red 3:1": "RmG", "Red 2:1": "SQ", "1:1": "BmG", "Blue 2:1": "BmG", "Blue 3:1": "BMG", "Blue >=4:1": "BMG" }],
  [8, { "Red >=4:1": "RmG", "Red 3:1": "RmG", "Red 2:1": "SQ", "1:1": "BmG", "Blue 2:1": "BMG", "Blue 3:1": "BMG", "Blue >=4:1": "BMG" }],
  [9, { "Red >=4:1": "RmG", "Red 3:1": "SQ", "Red 2:1": "BmG", "1:1": "BMG", "Blue 2:1": "BMG", "Blue 3:1": "BMG", "Blue >=4:1": "BMG" }],
  [10, { "Red >=4:1": "RmG", "Red 3:1": "SQ", "Red 2:1": "BmG", "1:1": "BMG", "Blue 2:1": "BMG", "Blue 3:1": "BMG", "Blue >=4:1": "BMG" }],
  [11, { "Red >=4:1": "RmG", "Red 3:1": "SQ", "Red 2:1": "BmG", "1:1": "BMG", "Blue 2:1": "BMG", "Blue 3:1": "BMG", "Blue >=4:1": "BMG" }],
  [12, { "Red >=4:1": "RmG", "Red 3:1": "BmG", "Red 2:1": "BMG", "1:1": "BMG", "Blue 2:1": "BMG", "Blue 3:1": "BMG", "Blue >=4:1": "BMG" }],
  [13, { "Red >=4:1": "SQ", "Red 3:1": "BmG", "Red 2:1": "BMG", "1:1": "BMG", "Blue 2:1": "BMG", "Blue 3:1": "BMG", "Blue >=4:1": "BMG" }],
  [14, { "Red >=4:1": "SQ", "Red 3:1": "BmG", "Red 2:1": "BMG", "1:1": "BMG", "Blue 2:1": "BMG", "Blue 3:1": "BMG", "Blue >=4:1": "BMG" }],
  ["inf", { "Red >=4:1": "SQ", "Red 3:1": "BMG", "Red 2:1": "BMG", "1:1": "BMG", "Blue 2:1": "BMG", "Blue 3:1": "BMG", "Blue >=4:1": "BMG" }]
];

export function getCrtAOutcome(modifiedRoll: number, column: CtrAColumn): ProbabilityOutcome {
  if (modifiedRoll < -5) {
    return crtARows[0][1][column];
  }
  if (modifiedRoll > 14) {
    return crtARows[crtARows.length - 1][1][column];
  }
  const row = crtARows.find(([key]) => key === modifiedRoll);
  if (!row) {
    throw new Error(`Missing CRT A row ${modifiedRoll}`);
  }
  return row[1][column];
}

const rtBRows: Array<[number | "-inf" | "inf", Record<RtBColumn, ProbabilityOutcome>]> = [
  ["-inf", { "Red Advantage": "RMG", Parity: "RMG", "Blue Advantage": "RmG" }],
  [-4, { "Red Advantage": "RMG", Parity: "RMG", "Blue Advantage": "RmG" }],
  [-3, { "Red Advantage": "RMG", Parity: "RMG", "Blue Advantage": "RmG" }],
  [-2, { "Red Advantage": "RMG", Parity: "RmG", "Blue Advantage": "RmG" }],
  [-1, { "Red Advantage": "RMG", Parity: "RmG", "Blue Advantage": "RmG" }],
  [0, { "Red Advantage": "RMG", Parity: "RmG", "Blue Advantage": "RmG" }],
  [1, { "Red Advantage": "RmG", Parity: "RmG", "Blue Advantage": "SQ" }],
  [2, { "Red Advantage": "RmG", Parity: "RmG", "Blue Advantage": "SQ" }],
  [3, { "Red Advantage": "RmG", Parity: "SQ", "Blue Advantage": "SQ" }],
  [4, { "Red Advantage": "RmG", Parity: "SQ", "Blue Advantage": "SQ" }],
  [5, { "Red Advantage": "SQ", Parity: "SQ", "Blue Advantage": "BmG" }],
  [6, { "Red Advantage": "SQ", Parity: "SQ", "Blue Advantage": "BmG" }],
  [7, { "Red Advantage": "SQ", Parity: "BmG", "Blue Advantage": "BmG" }],
  [8, { "Red Advantage": "SQ", Parity: "BmG", "Blue Advantage": "BmG" }],
  [9, { "Red Advantage": "BmG", Parity: "BmG", "Blue Advantage": "BMG" }],
  [10, { "Red Advantage": "BmG", Parity: "BmG", "Blue Advantage": "BMG" }],
  [11, { "Red Advantage": "BmG", Parity: "BmG", "Blue Advantage": "BMG" }],
  [12, { "Red Advantage": "BmG", Parity: "BMG", "Blue Advantage": "BMG" }],
  [13, { "Red Advantage": "BmG", Parity: "BMG", "Blue Advantage": "BMG" }],
  ["inf", { "Red Advantage": "BmG", Parity: "BMG", "Blue Advantage": "BMG" }]
];

export function getRtBOutcome(modifiedRoll: number, column: RtBColumn): ProbabilityOutcome {
  if (modifiedRoll < -4) {
    return rtBRows[0][1][column];
  }
  if (modifiedRoll > 13) {
    return rtBRows[rtBRows.length - 1][1][column];
  }
  const row = rtBRows.find(([key]) => key === modifiedRoll);
  if (!row) {
    throw new Error(`Missing RT B row ${modifiedRoll}`);
  }
  return row[1][column];
}

const procurementCost: Record<number, Record<string, number>> = {
  1: { M1: 2, M2: 3, M3: 4, M4: 5, M5: 6, M6: 7, M7: 8 },
  2: { M1: 4, M2: 6, M3: 8, M4: 10, M5: 12, M6: 14, M7: 16 },
  3: { M1: 6, M2: 8, M3: 10, M4: 12, M5: 14, M6: 16, M7: 18 },
  4: { M1: 8, M2: 11, M3: 14, M4: 17, M5: 20, M6: 23, M7: 26 },
  5: { M1: 10, M2: 13, M3: 16, M4: 19, M5: 22, M6: 25, M7: 28 },
  6: { M1: 12, M2: 16, M3: 20, M4: 24, M5: 28, M6: 32, M7: 36 },
  7: { M1: 14, M2: 18, M3: 22, M4: 26, M5: 30, M6: 34, M7: 38 },
  8: { M1: 16, M2: 21, M3: 26, M4: 31, M5: 36, M6: 41, M7: 46 },
  9: { M1: 18, M2: 23, M3: 28, M4: 33, M5: 38, M6: 43, M7: 48 },
  10: { M1: 20, M2: 26, M3: 32, M4: 38, M5: 44, M6: 50, M7: 56 }
};

export function getProcurementCost(ffs: number, modLevel: number, extensions?: TableExtension[]): RuleValue<number> {
  return lookupNested("FORCE_PROCUREMENT_COST", procurementCost, ffs, `M${modLevel}`, extensions);
}

const modernizationCost: Record<number, Record<string, number>> = {
  1: { "+1": 1, "+2": 2, "+3": 3, "+4": 4, "+5": 5, "+6": 6 },
  2: { "+1": 2, "+2": 3, "+3": 4, "+4": 5, "+5": 6, "+6": 7 },
  3: { "+1": 3, "+2": 4, "+3": 5, "+4": 6, "+5": 7, "+6": 8 },
  4: { "+1": 4, "+2": 5, "+3": 6, "+4": 7, "+5": 8, "+6": 9 },
  5: { "+1": 5, "+2": 6, "+3": 7, "+4": 8, "+5": 9, "+6": 10 },
  6: { "+1": 6, "+2": 7, "+3": 8, "+4": 9, "+5": 10, "+6": 11 },
  7: { "+1": 7, "+2": 8, "+3": 9, "+4": 10, "+5": 11, "+6": 12 },
  8: { "+1": 8, "+2": 9, "+3": 10, "+4": 11, "+5": 12, "+6": 13 },
  9: { "+1": 9, "+2": 10, "+3": 11, "+4": 12, "+5": 13, "+6": 14 },
  10: { "+1": 10, "+2": 11, "+3": 12, "+4": 13, "+5": 14, "+6": 15 }
};

export function getModernizationCost(
  ffs: number,
  modIncrease: number,
  extensions?: TableExtension[]
): RuleValue<number> {
  return lookupNested("FORCE_MODERNIZATION_COST", modernizationCost, ffs, `+${modIncrease}`, extensions);
}

const sustainmentConus: Record<number, Record<ReadinessLevel, number>> = {
  1: { 100: 1, 90: 1, 80: 1, 70: 1, 60: 1, 50: 1 },
  2: { 100: 2, 90: 2, 80: 2, 70: 2, 60: 2, 50: 1 },
  3: { 100: 3, 90: 3, 80: 3, 70: 2, 60: 2, 50: 2 },
  4: { 100: 4, 90: 4, 80: 3, 70: 3, 60: 3, 50: 2 },
  5: { 100: 5, 90: 5, 80: 4, 70: 4, 60: 3, 50: 3 },
  6: { 100: 6, 90: 5, 80: 5, 70: 4, 60: 4, 50: 3 },
  7: { 100: 7, 90: 6, 80: 5, 70: 5, 60: 4, 50: 4 },
  8: { 100: 8, 90: 7, 80: 6, 70: 5, 60: 5, 50: 4 },
  9: { 100: 9, 90: 8, 80: 7, 70: 6, 60: 5, 50: 5 },
  10: { 100: 10, 90: 9, 80: 8, 70: 7, 60: 6, 50: 5 },
  15: { 100: 15, 90: 13, 80: 11, 70: 10, 60: 9, 50: 8 },
  20: { 100: 20, 90: 17, 80: 15, 70: 13, 60: 12, 50: 10 },
  25: { 100: 25, 90: 21, 80: 18, 70: 16, 60: 14, 50: 13 },
  30: { 100: 30, 90: 25, 80: 22, 70: 19, 60: 17, 50: 15 }
};

const sustainmentOconus: Record<number, Record<ReadinessLevel, number>> = {
  1: { 100: 2, 90: 2, 80: 2, 70: 2, 60: 2, 50: 2 },
  2: { 100: 4, 90: 4, 80: 4, 70: 4, 60: 4, 50: 2 },
  3: { 100: 6, 90: 6, 80: 6, 70: 4, 60: 4, 50: 4 },
  4: { 100: 8, 90: 8, 80: 6, 70: 6, 60: 6, 50: 4 },
  5: { 100: 10, 90: 10, 80: 8, 70: 8, 60: 6, 50: 6 },
  6: { 100: 12, 90: 10, 80: 10, 70: 8, 60: 8, 50: 6 },
  7: { 100: 14, 90: 12, 80: 10, 70: 10, 60: 8, 50: 8 },
  8: { 100: 16, 90: 14, 80: 12, 70: 10, 60: 10, 50: 8 },
  9: { 100: 18, 90: 16, 80: 14, 70: 12, 60: 10, 50: 10 },
  10: { 100: 20, 90: 18, 80: 16, 70: 14, 60: 12, 50: 10 },
  15: { 100: 30, 90: 26, 80: 22, 70: 20, 60: 18, 50: 16 },
  20: { 100: 40, 90: 34, 80: 30, 70: 26, 60: 24, 50: 30 },
  25: { 100: 50, 90: 42, 80: 36, 70: 32, 60: 28, 50: 26 },
  30: { 100: 60, 90: 50, 80: 44, 70: 38, 60: 34, 50: 30 }
};

export function getReadinessSustainmentCost(
  ffs: number,
  readiness: ReadinessLevel,
  location: ReadinessLocation,
  extensions?: TableExtension[]
): RuleValue<number> {
  return lookupReadinessSustainmentCost(
    `US_${location}_READINESS_SUSTAINMENT_COST`,
    location === "CONUS" ? sustainmentConus : sustainmentOconus,
    ffs,
    readiness,
    extensions
  );
}

const buyBackConus: Record<number, Record<string, number>> = {
  1: { "+10": 1, "+20": 2, "+30": 3, "+40": 4, "+50": 5 },
  2: { "+10": 2, "+20": 3, "+30": 4, "+40": 5, "+50": 6 },
  3: { "+10": 3, "+20": 4, "+30": 5, "+40": 6, "+50": 7 },
  4: { "+10": 4, "+20": 5, "+30": 6, "+40": 7, "+50": 8 },
  5: { "+10": 5, "+20": 6, "+30": 7, "+40": 8, "+50": 9 },
  6: { "+10": 6, "+20": 7, "+30": 8, "+40": 9, "+50": 10 },
  7: { "+10": 7, "+20": 8, "+30": 9, "+40": 10, "+50": 11 },
  8: { "+10": 8, "+20": 9, "+30": 10, "+40": 11, "+50": 12 },
  9: { "+10": 9, "+20": 10, "+30": 11, "+40": 12, "+50": 13 },
  10: { "+10": 10, "+20": 11, "+30": 12, "+40": 13, "+50": 14 },
  15: { "+10": 15, "+20": 16, "+30": 17, "+40": 18, "+50": 19 },
  20: { "+10": 20, "+20": 21, "+30": 22, "+40": 23, "+50": 24 },
  25: { "+10": 25, "+20": 26, "+30": 27, "+40": 28, "+50": 29 },
  30: { "+10": 30, "+20": 31, "+30": 32, "+40": 33, "+50": 34 }
};

const buyBackOconus: Record<number, Record<string, number>> = {
  1: { "+10": 2, "+20": 3, "+30": 4, "+40": 6, "+50": 7 },
  2: { "+10": 3, "+20": 4, "+30": 6, "+40": 7, "+50": 8 },
  3: { "+10": 4, "+20": 6, "+30": 7, "+40": 8, "+50": 10 },
  4: { "+10": 6, "+20": 7, "+30": 8, "+40": 10, "+50": 11 },
  5: { "+10": 7, "+20": 8, "+30": 10, "+40": 11, "+50": 12 },
  6: { "+10": 8, "+20": 10, "+30": 11, "+40": 12, "+50": 14 },
  7: { "+10": 10, "+20": 11, "+30": 12, "+40": 14, "+50": 15 },
  8: { "+10": 11, "+20": 12, "+30": 14, "+40": 15, "+50": 16 },
  9: { "+10": 12, "+20": 14, "+30": 15, "+40": 16, "+50": 17 },
  10: { "+10": 14, "+20": 15, "+30": 16, "+40": 17, "+50": 19 },
  15: { "+10": 20, "+20": 21, "+30": 23, "+40": 24, "+50": 25 },
  20: { "+10": 27, "+20": 28, "+30": 29, "+40": 30, "+50": 32 },
  25: { "+10": 33, "+20": 34, "+30": 36, "+40": 37, "+50": 38 },
  30: { "+10": 40, "+20": 41, "+30": 42, "+40": 43, "+50": 45 }
};

export function getReadinessBuyBackCost(
  ffs: number,
  readinessIncrease: number,
  location: ReadinessLocation,
  extensions?: TableExtension[]
): RuleValue<number> {
  return lookupNested(
    `US_${location}_READINESS_BUY_BACK_COST`,
    location === "CONUS" ? buyBackConus : buyBackOconus,
    ffs,
    `+${readinessIncrease}`,
    extensions
  );
}

export function getBudgetVariation(roll: number): number {
  if (roll <= 1) {
    return -2;
  }
  if (roll <= 4) {
    return -1;
  }
  if (roll <= 7) {
    return 0;
  }
  if (roll === 8) {
    return 1;
  }
  return 2;
}

export function getProxyReliabilityResult(roll: number, level: ReliabilityLevel): "Success" | "Fail" {
  if (level === "Certain") {
    return "Success";
  }
  if (level === "High") {
    return roll >= 2 ? "Success" : "Fail";
  }
  if (level === "Medium") {
    return roll >= 4 ? "Success" : "Fail";
  }
  return roll >= 6 ? "Success" : "Fail";
}

export function getProxyReliabilityChance(level: ReliabilityLevel): number {
  if (level === "Certain") {
    return 1;
  }
  if (level === "High") {
    return 0.8;
  }
  if (level === "Medium") {
    return 0.6;
  }
  return 0.4;
}
