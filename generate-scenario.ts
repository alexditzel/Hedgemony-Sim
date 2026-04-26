import * as fs from "node:fs/promises";
import z from "zod";
import { ScenarioSchema, Scenario } from "./src/engine";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY, });

const medium_model = "gpt-5.4-mini";
const high_model = "gpt-5.5";

type ScenarioPrompt = {
    /**
     * Learing objects that should be explored by simulating this scenario.
     */
    learning_objectives: string[],
    players: { name: string; label: string, side: "Blue" | "Red" }[],
    max_turns: number,
    /**
     * Important events that should inspire investment and action cards.
     */
    events: string[],
}

const ScenarioDesignSchema = z.object({
    major_arcs: z.array(z.string()).describe("A few different major arcs that the simulation could follow."),
    points_system: z.object({
        description: z.string().describe("Explanation of the points system to allocate cards and importance."),
        players: z.array(z.object({
            player_id: z.string(),
            role_importance: z.number(),
            card_budget: z.number()
        }))
    }),
    card_design_guidelines: z.string().describe("Guidelines for balancing cards with trade-offs (support/harm self vs others).")
});

/**
 * Generate a scenario based on a prompt.
 * 
 * To make the scenario interesting, make sure to first design a few different major arcs that the simulation could follow, and then design cards that make sense for each of those arcs. To make sure that each player has important roles, use a points system that allocated number of cards and importance of cards to different players. To make sure cards are balanced and demonstrate interesting trade-offs for players to consider, each card should have points budget for how much it supports or harms the player who plays the card, and how  uch it suports or harms other players.
 */
export async function generateScenario(prompt: ScenarioPrompt): Promise<Scenario> {
    const designResponse = await openai.responses.parse({
        model: high_model,
        reasoning: { effort: "high" },
        input: [
            {
                role: "system",
                content:
                    "You are an expert wargame designer. Design a scenario outline based on the user's prompt. To make the scenario interesting, make sure to first design a few different major arcs that the simulation could follow. To make sure that each player has important roles, use a points system that allocates number of cards and importance of cards to different players. To make sure cards are balanced and demonstrate interesting trade-offs for players to consider, describe a points budget for how much a card supports or harms the player who plays it, and how much it supports or harms other players.",
            },
            {
                role: "user",
                content: JSON.stringify(prompt, null, 2),
            },
        ],
        text: {
            format: zodTextFormat(ScenarioDesignSchema, "scenario_design"),
        },
    });

    const design = designResponse.output_parsed!;

    const scenarioResponse = await openai.responses.parse({
        model: high_model,
        reasoning: { effort: "high" },
        input: [
            {
                role: "system",
                content:
                    "You are an expert wargame designer. Based on the user's prompt and your generated design outline, generate the full Scenario object following the exact Zod schema requirements. Ensure the scenario, forces, maps, rules, and cards are all populated and logically consistent.",
            },
            {
                role: "user",
                content: `Prompt:\n${JSON.stringify(prompt, null, 2)}\n\nDesign Outline:\n${JSON.stringify(design, null, 2)}`,
            },
        ],
        text: {
            format: zodTextFormat(ScenarioSchema, "scenario"),
        },
    });

    return scenarioResponse.output_parsed!;
}


async function main() {
    const name = "iran-war"

    const scenario = await generateScenario({
        learning_objectives: [],
        players: [
            {
                name: "United State of America",
                label: "US",
                side: "Blue"
            },
            {
                name: "NATO and European Union",
                label: "NATO_EU",
                side: "Blue"
            },
            {
                name: "Israel",
                label: "IS",
                side: "Blue",
            },
            {
                name: "Iran",
                label: "IR",
                side: "Red",
            },
            {
                name: "China",
                label: "PRC",
                side: "Red",
            },
            {
                name: "Russia",
                label: "RU",
                side: "Red"
            }
        ],
        max_turns: 0,
        events: []
    })

    await fs.writeFile(
        `src/data/${name}.json`,
        JSON.stringify(scenario, null, 4),
        { encoding: "utf-8" }
    )
}

main()