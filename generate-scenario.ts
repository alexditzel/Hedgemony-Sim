import { config } from "dotenv";
import * as fs from "node:fs/promises";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import z from "zod";
import { ScenarioSchema, type Scenario } from "./src/engine/types";
config()

const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY, });

// const high_model = "gpt-5.5";
// const reasoning_effort = "high"

const high_model = "gpt-5.4-mini";
const reasoning_effort = "low"

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
    events: { name: string, description: string }[],
}

export type ScenarioDesign = z.infer<typeof ScenarioDesignSchema>
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
    const printedPrompt = `
# Scenario Prompt

## Learning Objectives

${prompt.learning_objectives.map((s) => `- ${s}`).join("\n")}

## Players

${prompt.players.map((p) => `- ${p.name} [${p.label}]: side ${p.side}`)}

## Events

The following events must be used as inspiration for various game elements.

${prompt.events.map((e) => `### ${e.name}\n\n${e.description}`).join("\n\n")}

## Requirements

The simulation will be played for ${prompt.max_turns} turns.

`.trim();

    const design = await ((async () => {
        if (process.env.CACHE === "false") {
            const designResponse = await openai.responses.parse({
                model: high_model,
                reasoning: { effort: reasoning_effort },
                input: [
                    {
                        role: "system",
                        content:
                            "You are an expert wargame designer. Design a scenario outline based on the user's prompt. To make the scenario interesting, make sure to first design a few different major arcs that the simulation could follow. To make sure that each player has important roles, use a points system that allocates number of cards and importance of cards to different players. To make sure cards are balanced and demonstrate interesting trade-offs for players to consider, describe a points budget for how much a card supports or harms the player who plays it, and how much it supports or harms other players.",
                    },
                    {
                        role: "user",
                        content: printedPrompt,
                    },
                ],
                text: {
                    format: zodTextFormat(ScenarioDesignSchema, "scenario_design"),
                },
            });

            const design = designResponse.output_parsed!;

            await fs.writeFile("design.json", JSON.stringify(design, null, 4), { encoding: "utf-8" })
            return design
        } else {
            const design = JSON.parse(await fs.readFile("design.json", { encoding: "utf-8" })) as ScenarioDesign
            return design
        }
    }))()

    const scenarioResponse = await openai.responses.parse({
        model: high_model,
        reasoning: { effort: reasoning_effort },
        input: [
            {
                role: "system",
                content:
                    "You are an expert wargame designer. Based on the user's prompt and your generated design outline, generate the full Scenario object following the exact Zod schema requirements. Ensure the scenario, forces, maps, rules, and cards are all populated and logically consistent.",
            },
            {
                role: "user",
                content: `
${printedPrompt}
                
## Design Outline

### Major Arcs

${design.major_arcs}

### Points System

${design.points_system.description}

Players:
${design.points_system.players.map((p) => `- Player ${p.player_id}: importance is ${p.role_importance}, card budget is ${p.card_budget}`).join("\n")}

### Card Design Guidelines

${design.card_design_guidelines}

`.trim(),
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

    const events = JSON.parse(await fs.readFile("./cached-data/iran-war-events.json", { encoding: "utf-8" }))

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
        max_turns: 5,
        events
    })

    await fs.writeFile(
        `src/data/${name}.json`,
        JSON.stringify(scenario, null, 4),
        { encoding: "utf-8" }
    )
}

main()