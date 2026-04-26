import type { PhaseId, RollRecord, Visibility } from "./types";

export interface DiceRoller {
  d10(): number;
}

export class RandomDiceRoller implements DiceRoller {
  d10(): number {
    return Math.floor(Math.random() * 10);
  }
}

export class SequenceDiceRoller implements DiceRoller {
  private index = 0;

  constructor(private readonly values: number[]) {
    if (values.some((value) => value < 0 || value > 9 || !Number.isInteger(value))) {
      throw new Error("SequenceDiceRoller D10 values must be integers from 0 through 9.");
    }
  }

  d10(): number {
    if (this.values.length === 0) {
      throw new Error("SequenceDiceRoller requires at least one value.");
    }
    const value = this.values[this.index % this.values.length];
    this.index += 1;
    return value;
  }
}

export function rollD10Record(
  roller: DiceRoller,
  args: {
    id: string;
    turn: number;
    phase: PhaseId;
    modifier?: number;
    purpose: string;
    visibility?: Visibility;
  }
): RollRecord {
  const result = roller.d10();
  const modifier = args.modifier ?? 0;
  const total = result + modifier;
  const signed = modifier === 0 ? "" : modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
  return {
    id: args.id,
    turn: args.turn,
    phase: args.phase,
    die: "D10",
    results: [result],
    modifier,
    total,
    formula: `D10(${result})${signed} = ${total}`,
    purpose: args.purpose,
    visibility: args.visibility ?? "public"
  };
}
