import { config } from "dotenv";
import * as fs from "node:fs/promises";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import z from "zod";
import { ScenarioSchema, type Scenario } from "./src/engine/types";
config()

const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY, });

// const medium_model = "gpt-5.4-mini";
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
    events: { name: string, description: string }[],
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
    const printedPrompt = `
# Scenario Prompt

## Learning Objectives

${prompt.learning_objectives.map((s) => `- ${s}`).join("\n")}

## Players

${prompt.players.map((p) => `- ${p.name} [${p.label}]: side ${p.side}`)}

## Events

The following events must be used as inspiration for various game elements.

${prompt.events.map((e, i) => `### ${e.name}\n\n${e.description}`).join("\n\n")}

## Requirements

The simulation will be played for ${prompt.max_turns} turns.

`.trim();
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
                content: printedPrompt,
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
        events: [
            {
                name: `Israeli Airstrike on the Iranian Consulate in Damascus`, description: `
                    Main countries involved: Israel, Iran, Syria.
                        One - paragraph summary of the event: On April 1, 2024, at approximately 17:00 local time, the Israeli Air Force launched a highly targeted and unprecedented airstrike that completely destroyed the consular section of the Iranian Embassy in Damascus, Syria.The precision attack utilized advanced munitions to level the multi- story diplomatic building, resulting in the deaths of 16 individuals, including seven high - ranking Islamic Revolutionary Guard Corps(IRGC) officers, five Iran - backed militiamen, a Hezbollah member, an Iranian advisor, and two Syrian civilians.Among the dead was Brigadier General Mohammad Reza Zahedi, the supreme commander of the IRGC’s Quds Force for Syria and Lebanon, marking the most senior Iranian military figure to be assassinated since the United States targeted Qasem Soleimani in 2020.2 The adjacent unused Canadian embassy building was also damaged by the blast radius.
                            One - paragraph review of the main immediate outcomes of the event: The immediate outcome of the strike was the radical alteration of the unwritten rules of engagement between Israel and Iran, fundamentally shifting the conflict from a proxy war to a direct state- on - state confrontation.By eliminating top Iranian leadership within a sovereign diplomatic compound, Israel demonstrated a newfound willingness to prioritize the immediate disruption of proxy logistics over the preservation of regional diplomatic norms.This unprecedented breach of diplomatic convention cornered Tehran into an aggressive retaliatory posture; the Iranian regime was forced to abandon its long - standing doctrine of strategic patience to maintain domestic credibility and project strength to its proxy network, making a direct military strike on Israeli soil inevitable.
Strategic Analysis of the Damascus Consulate Strike
The Damascus strike represented a critical inflection point in the operational logic of the Israeli defense establishment.Historically, Israel’s transnational approach to its conflict with Iran focused predominantly on interdicting the cross - border flow of Iranian weapons to Hezbollah through Syrian territory.During this "campaign between the wars," Israel appeared to meticulously avoid, whenever feasible, the direct assassination of senior Iranian operatives or the targeting of sovereign Iranian soil to prevent a broader, uncontrollable conflagration.However, the intelligence gathered in the wake of the October 2023 Gaza conflict highlighted the unacceptable existential risk posed by the IRGC's deep and increasingly sophisticated entrenchment in the Levant. By decapitating the Quds Force leadership responsible for the Syrian and Lebanese theaters, Israel effectively blinded the logistical bridge connecting Tehran to Hezbollah, prioritizing immediate tactical disruption over long-term strategic stability.
The second - order effect of this strike was the profound psychological and operational impact on the Axis of Resistance.For decades, the perceived inviolability of sovereign diplomatic spaces had provided a safe haven for operational planning and coordination between the IRGC and its regional proxies.The total destruction of the consulate forced Iranian commanders deeper underground, significantly complicating command - and - control operations during a highly volatile period in the Middle East.Furthermore, the diplomatic fallout was immediate; while international norms regarding the protection of diplomatic facilities were debated, the United States administration's immediate assurance of "ironclad" support for Israel in the event of an Iranian reprisal attack inadvertently provided Israel with a broader security umbrella. This guarantee from Washington encouraged further risk-taking by the Israeli military apparatus, setting a dangerous precedent that the United States would underwrite Israeli escalation against Iranian assets.
The loss of Brigadier General Mohammad Reza Zahedi cannot be overstated in the context of Iranian power projection.Zahedi was the architectural linchpin integrating Syrian logistics with Hezbollah's tactical deployments. His removal required Iran to rapidly restructure its Levant command structure during a period of intense Israeli surveillance, leading to severe operational inefficiencies that Israel would later exploit during its Lebanon campaigns. Ultimately, the Damascus strike forced Iran into a binary strategic choice: absorb the humiliation and risk losing the allegiance of its proxies, or retaliate directly and risk an open war with a technologically superior adversary backed by a global superpower.`}
            ,
            {
                name: `Operation True Promise (First Iranian Direct Attack on Israel)`, description: `
Main countries involved: Iran, Israel, United States, United Kingdom, France, Jordan, Syria.
One-paragraph summary of the event: In direct retaliation for the Damascus consulate strike, the Iranian Islamic Revolutionary Guard Corps Aerospace Force launched "Operation True Promise" spanning the night of April 13 to April 14, 2024, executing an unprecedented direct military assault from Iranian sovereign territory against the State of Israel. The complex operation involved a massive swarm of hundreds of suicide drones, land-attack cruise missiles, and ballistic missiles, supported by simultaneous diversionary launches from Hezbollah in Lebanon, the Houthis in Yemen, and the Islamic Resistance in Iraq. A highly coordinated multi-national defense coalition, heavily reliant on United States Central Command, the United Kingdom, France, and neighboring Jordan, assisted Israel's integrated air defense network in tracking and intercepting the overwhelming majority of the incoming projectiles.
One-paragraph review of the main immediate outcomes of the event: The attack resulted in minimal structural damage and no direct fatalities inside Israeli territory, as the defense coalition and Israel's multi-layered air defense architecture successfully intercepted 99% of the munitions. A few ballistic missiles penetrated the defense shield, causing minor damage to the Nevatim and Ramon airbases—including a C-130 transport aircraft and empty storage facilities—while a seven-year-old Israeli Bedouin girl was critically injured by falling shrapnel. While Iran heralded the attack domestically as a massive psychological and strategic victory, utilizing intense propaganda efforts to project power, the successful interception demonstrated the overwhelming efficacy of Israel's defense systems, particularly the Arrow system, which executed complex exoatmospheric interceptions.
Strategic Analysis of Operation True Promise
Operation True Promise fundamentally redefined the parameters of deterrence and military engagement in the Middle East. For Iran, the necessity of a direct, visible response was inextricably tied to regime survival and the preservation of its leadership role within the broader Axis of Resistance. Failure to respond proportionally to the Damascus consulate strike would have signaled fatal weakness to both its domestic constituency and its network of proxies across the region. The Iranian psychological propaganda effort worked tirelessly to propagate the notion that the attack was highly effective, even utilizing deceptive tactics such as broadcasting footage of wildfires in Chile as supposed evidence of destruction in Israel. A massive poster was erected in Tehran's Palestine Square to warn Israel against retaliation, cementing the narrative of a decisive Iranian triumph.
However, the operational execution revealed severe limitations in Iran's offensive capabilities when confronted with a sophisticated, integrated, multinational air defense network. The successful defense of Israeli airspace was not merely a tactical technological victory; it was a profound diplomatic and geopolitical achievement. The active, visible participation of Jordan in shooting down Iranian projectiles, coupled with the tacit intelligence cooperation of other Arab Gulf states, underscored a nascent regional security alignment united against Iranian hegemony. This ad-hoc coalition demonstrated that the regional fear of Iranian ballistic capabilities could foster unprecedented security cooperation between Israel and its Arab neighbors, a development deeply deeply alarming to Tehran.
Furthermore, the minimal damage inflicted by the massive Iranian barrage exposed the profound vulnerability of Tehran’s conventional missile forces. This exposure proved critical in shaping Israel's subsequent strategic calculus. Recognizing that Iran’s primary conventional retaliatory mechanism was highly mitigatable, Israeli war planners gained the necessary confidence to escalate their kinetic campaigns against Iran’s proxy network without the paralyzing fear of catastrophic conventional retaliation. The failure of the missile swarm effectively green-lit Israel's shift toward the total dismantling of Hezbollah later in the year, as the perceived threat of the Iranian missile umbrella had been empirically tested and found wanting.`}
            ,
            {
                name: `The Decapitation of Hezbollah and Operation Northern Arrows`, description: `
Main countries involved: Israel, Lebanon, Iran.
One-paragraph summary of the event: Between September and November 2024, Israel executed a comprehensive, multi-domain intelligence and military campaign that effectively decapitated Hezbollah, Iran's most capable and heavily armed regional proxy. The campaign commenced on September 18 with a highly sophisticated joint Mossad-IDF operation that simultaneously detonated thousands of pagers and communication devices belonging to Hezbollah operatives across Lebanon, causing widespread casualties and mass confusion. This intelligence masterstroke was rapidly followed by a series of devastating, precision airstrikes in the southern suburbs of Beirut that successfully assassinated Hezbollah's long-standing Secretary-General, Hassan Nasrallah, alongside Abbas Nilforoushan, the IRGC Quds Force commander in Lebanon who had replaced Zahedi. Israel subsequently launched a localized ground offensive into southern Lebanon to systematically dismantle Hezbollah's border infrastructure.
One-paragraph review of the main immediate outcomes of the event: The decapitation campaign plunged Hezbollah into unprecedented operational disarray, stripping the organization of its iconic leader and significant portions of its mid-to-high-level command structure overnight. The mass incapacitation of thousands of fighters via explosive pagers severely disrupted the organization's secure communications network and immediate troop readiness. While the remnants of Hezbollah launched localized rocket attacks into Israel, the group was fundamentally weakened, marking the destruction of Iran’s primary regional deterrence asset and leaving Tehran strategically exposed and heavily incentivized to accelerate its nuclear weaponization program as an alternative deterrent.
Strategic Analysis of the Decapitation of Hezbollah
The systematic dismantling of Hezbollah was arguably the most consequential geopolitical event of 2024, eclipsing even the direct missile exchanges between Israel and Iran. Hezbollah was not merely a proxy; it was the foundational cornerstone of Iran’s entire "forward defense" doctrine. Armed with an estimated arsenal of over 150,000 rockets, missiles, and precision-guided munitions, Hezbollah served as the ultimate guarantor of Iran’s sovereign nuclear program—a Damoclean sword hanging over Tel Aviv designed to ensure that any preemptive Israeli strike on facilities like Natanz or Fordow would trigger catastrophic, unacceptable destruction in Israel's densely populated civilian centers.
By preemptively degrading this capability, Israel fundamentally altered the strategic balance of power in the Middle East. The assassination of Hassan Nasrallah presented Supreme Leader Ayatollah Ali Khamenei with an impossible and paralyzing dilemma: intervene directly to save Hezbollah and risk a devastating regional war that could threaten his regime's survival, or stand down and risk the total unraveling of the Axis of Resistance. Iran's relative paralysis during Hezbollah's systematic destruction signaled to both allies and adversaries that Tehran's security guarantees were largely hollow. The ripple effects across the network were profound. Deprived of its Lebanese shield, Iran’s nuclear facilities were suddenly acutely vulnerable, a reality that sent nuclear shockwaves through the region.
Furthermore, the intelligence penetration required to execute the pager operation and locate Nasrallah within a fortified bunker indicated a catastrophic compromise within the IRGC and Hezbollah's counter-intelligence apparatus. This level of penetration eroded trust within the network, causing severe paranoia. Following Hezbollah's military defeat, Israel and the United States utilized similar human intelligence penetration and surveillance to target Houthi structures in Yemen, leading to the killing of several senior Houthi commanders and forcing their leader, Abdul Malik al-Houthi, to withdraw from public visibility for two months in late 2025.16 The decapitation of Hezbollah proved that decapitation operations, while historically insufficient to win the peace, were incredibly effective at inducing systemic shock across Iran's decentralized proxy architecture.`}
            ,
            {
                name: `Operation Days of Repentance`, description: `
Main countries involved: Israel, Iran, Iraq, Syria, United States.
One-paragraph summary of the event: On October 26, 2024, acting in delayed but calculated response to an October 1 Iranian ballistic missile barrage, the Israeli Air Force launched a massive, complex aerial assault codenamed "Operation Days of Repentance".17 The operation involved approximately 100 aircraft, heavily featuring advanced F-35I stealth fighters and F-15/F-16 platforms, executing three distinct waves of precise and targeted strikes across 20 locations in Iran, as well as enabling targets in Syria and Iraq. Launching air-to-surface ballistic missiles from outside Iranian airspace—primarily over Syrian and Iraqi territory—the IDF systematically dismantled all of Iran's advanced long-range surface-to-air missile batteries (including nearly all S-300 systems), destroyed long-range detection radars, and heavily damaged an active nuclear weapons research facility in Parchin.
One-paragraph review of the main immediate outcomes of the event: The strikes critically crippled Iran’s domestic missile production capabilities, with United States intelligence estimating it would take Tehran at least a full year to rebuild the destroyed solid-fuel mixing components necessary to resume ballistic missile production. The operation resulted in five fatalities, including four Iranian Army officers and one security guard, while inflicting minor damage to Israeli forces. Most significantly, the systematic destruction of Iran's air defense network stripped the country of its strategic early-warning and interception capabilities, rendering Iranian airspace utterly defenseless and paving the way for unimpeded Israeli military action in the future. Concurrently, the United States and the United Kingdom significantly expanded economic sanctions against Iran's petroleum, petrochemical, and military sectors.
Strategic Analysis of Operation Days of Repentance
Operation Days of Repentance was a masterclass in shaping the battlespace for future, decisive conflict. While the operation was officially framed to the international community as a proportional response to prior Iranian aggression, its true strategic utility lay in the systematic dismantling of Iran's anti-access/area denial (A2/AD) capabilities. By intentionally targeting and blinding Iran's early warning radar systems and destroying its most capable Russian-supplied surface-to-air missiles, Israel achieved total escalation dominance. The operation ensured that any future Israeli strikes, particularly against buried nuclear sites, would not face meaningful resistance from Iranian ground-based air defenses.
The operational execution highlighted a severe, unbridgeable asymmetry in technological capabilities and interoperability between the two nations. Israeli aircraft operated with near impunity, utilizing Syrian and Iraqi airspace to launch standoff munitions that Iran could neither detect nor intercept effectively. Video footage from Tehran showing air defenses firing blindly into the night sky underscored the vulnerability of the capital. The destruction of the active nuclear weapons research facility at Parchin also served as a highly visible, tacit warning regarding the vulnerability of Iran's broader nuclear infrastructure.
The psychological impact on the Iranian leadership was profound; the realization that the Israeli Air Force could operate seamlessly over Tehran exposed the ultimate fragility of the regime's military posture. Following the attack, Iran imposed strict military censorship over its damaged sites to manage domestic panic. This vulnerability forced Iran into a corner, heavily restricting its conventional military options and inadvertently accelerating internal regime debates regarding the absolute necessity of a nuclear breakout as the only remaining guarantor of regime survival. In tandem with the military strikes, the economic noose was tightened; the UK applied 423 distinct sanctions against Iran, and the US expanded sanctions on the petrochemical sector, restricting the government revenue needed to rebuild the destroyed missile infrastructure.`}
            ,
            {
                name: `The Collapse of the Assad Regime in Syria`, description: `
Main countries involved: Syria, Iran, Russia, Israel, Turkey.
One-paragraph summary of the event: In early December 2024, taking immediate advantage of the severe weakening of Iranian and Russian proxy support, Syrian opposition forces led by the militant coalition Hayat Tahrir al-Sham (HTS) under the command of Abu Mohammed al Jolani launched a highly successful lightning offensive. Following the rapid capture of Aleppo, opposition forces secured complete control of the strategic city of Homs on December 7, 2024, after approximately twenty-four hours of concentrated combat, prompting the sudden and historic collapse of Bashar al-Assad's government. Assad-allied Hezbollah forces, already severely degraded by the Israeli campaigns in Lebanon, were forced to abruptly abandon their positions, evacuating approximately 150 armored vehicles and hundreds of fighters from strategic locations like al-Qusayr and withdrawing rapidly across the border into Lebanon.
One-paragraph review of the main immediate outcomes of the event: The sudden and complete fall of the Assad regime severed the critical geographical and logistical land bridge connecting Tehran to the Levant, effectively suffocating Iran's ability to resupply its proxies. The withdrawal of Iranian advisors and Hezbollah forces from Syria ended over a decade of hard-fought Iranian strategic depth in the country. Regionally, the collapse prompted widespread public celebrations in Syria, while Israel immediately mobilized the IDF to heavily fortify its defenses on the Golan Heights to prevent the spillover of sectarian chaos. Israel also issued stern back-channel warnings to HTS to adhere to existing separation of forces agreements or face devastating kinetic responses.
Strategic Analysis of the Syrian Regime Collapse
The collapse of the Assad regime was a fatal geopolitical blow to the Axis of Resistance, exponentially compounding the strategic disasters Iran faced in Lebanon. Syria had served as the indispensable, irreplaceable conduit for the transfer of advanced weaponry, financial support, and personnel from Iran to Hezbollah on the Mediterranean coast. Without the permissive, state-sponsored environment provided by Bashar al-Assad, Iran's ability to reconstitute Hezbollah's decimated arsenal was permanently crippled.
The timing of the Syrian collapse was a direct, third-order consequence of the broader regional conflict. The IDF’s systemic targeting of IRGC logistics, combined with the military decapitation of Hezbollah, left Assad's forces without their most capable shock troops. Concurrently, the Russian military—Assad's other primary patron—was entirely consumed by the ongoing war in Ukraine, leaving Moscow unable to provide the decisive air support that had saved the regime in 2015.20 This massive power vacuum was rapidly and effectively exploited by HTS. For Iran, the loss of Syria represented the agonizing end of a multi-billion dollar, decade-long investment in regional hegemony. It forced the remnants of Iranian influence to operate in a highly hostile, fragmented environment where severe sectarian violence against Alawites and Iranian-aligned networks was highly probable.
From an Israeli perspective, the fall of Assad was a profound dual-edged sword. On one hand, it eliminated a heavily armed state sponsor of its primary adversaries and decisively broke the Resistance Front. On the other hand, it introduced profound volatility and the presence of radical, well-armed Sunni militias directly on Israel's northeastern border. The Israeli intelligence community, still reeling from the failures of October 7, viewed the sudden collapse of Syria with deep concern, questioning whether their analytical models had once again failed to predict a massive regional shift. Meanwhile, inside Iran, the shock of the collapse contributed to a deepening domestic crisis; the Iranian currency (the rial) plummeted to its lowest level in history, and the regime responded to internal paranoia by executing at least 883 people in 2024, the highest number in a decade.`}
            ,
            {
                name: `The Twelve-Day War`, description: `
Main countries involved: Israel, United States, Iran, Qatar.
One-paragraph summary of the event: From June 13 to June 24, 2025, Israel and the United States waged an intensive, unprecedented military campaign against Iran, universally known as the Twelve-Day War. Preempting an imminent nuclear breakout following the collapse of diplomatic negotiations, Israel launched over 360 strikes across 27 Iranian provinces, destroying military infrastructure, air defense remnants, and assassinating top military commanders, including IRGC Head Hossein Salami and Armed Forces Chief of Staff Mohammed Bagheri. Iran retaliated forcefully, launching over 500 ballistic missiles at Israeli civilian and military centers. The conflict escalated dramatically on June 22 when the United States directly intervened, deploying B-2 Spirit stealth bombers equipped with massive bunker-buster munitions to obliterate Iran's deeply buried, heavily fortified nuclear facilities at Natanz, Fordow, and Isfahan.
One-paragraph review of the main immediate outcomes of the event: The joint campaign decisively destroyed Iran’s nuclear weaponization infrastructure—delivering a substantial setback to any potential future weaponization effort—and annihilated approximately 1,000 Iranian ballistic missiles and 250 mobile launchers. The intense conflict resulted in the deaths of at least 610 Iranians and 28 Israelis, with significant damage to residential areas in both nations. A highly fragile ceasefire was brokered under heavy US pressure on June 24, which required two distinct 12-hour cessation cycles to take hold amid initial violations. While the strikes successfully neutralized the immediate nuclear threat, they deeply radicalized the surviving Iranian leadership, who had retreated to bunkers in Lavizan, and set the stage for further regional destabilization.
Strategic Analysis of the Twelve-Day War
The Twelve-Day War was the kinetic culmination of over two decades of intense intelligence gathering, operational planning, and diplomatic maneuvering by the United States and Israel. The initial phase of the war relied heavily on a brilliant campaign of strategic and operational deception by joint US and Israeli forces. To circumvent whatever early warning systems Iran had managed to reconstruct, the IDF faked satellite imagery of planes and facilities; top IDF officials, including Chief of Staff Eyal Zamir, visibly took their official cars home from headquarters to suggest the base was not on high alert. This deception led Iranian officials to believe strikes were not imminent, resulting in several senior leaders, including Salami and Bagheri, gathering in person where they were successfully targeted and eliminated.
The direct, kinetic involvement of the United States on June 22 marked a historic and irreversible threshold in global geopolitics: the first time a US president explicitly joined Israel in a preemptive strike against an adversary's sovereign nuclear infrastructure. The use of American B-2 Spirit bombers and specialized bunker-buster munitions was an operational necessity to penetrate the subterranean Fordow and Natanz facilities, a deep-strike capability the Israeli Air Force fundamentally lacked. The destruction of the enriched uranium metal processing facility in Isfahan and the heavy water plant at Khondab dismantled the core mechanisms of both the uranium and plutonium pathways to a nuclear device.
For Iran, the war was a catastrophic, humiliating defeat that showcased the absolute failure of its strategic deterrents. Despite launching hundreds of ballistic missiles, Iran failed to inflict systemic, state-ending damage on Israel, though strikes on the Soroka Medical Center and various residential areas proved lethal and disruptive. Iran's desperate retaliation included firing missiles at the US Al Udeid base in Qatar, expanding the conflict's footprint. While Nour News claimed Iranian forces shot down an F-35 over Tabriz, the overwhelming narrative was one of complete Israeli air superiority. The survival of Supreme Leader Khamenei—who was moved to a fortified bunker in Lavizan—and the failure to induce an immediate regime collapse meant that the underlying ideological confrontation remained unresolved, festering into an even more explosive domestic and regional crisis over the next six months.`}
            ,
            {
                name: `The 2026 Iranian Protests and Internet Blackout`, description: `
Main countries involved: Iran.
One-paragraph summary of the event: In January and February 2026, the Islamic Republic of Iran was engulfed by the largest, most intense, and widespread anti-government protests since the 1979 revolution. Driven to the brink by a collapsing economy, widespread infrastructure failure, hyperinflation, and deep-seated frustration over the regime’s disastrous geopolitical misadventures and military defeats, millions of Iranians mobilized in the streets demanding regime change. The government responded with an absolute nationwide internet blackout and a ruthless, highly militarized crackdown, resulting in the massacre of thousands of unarmed civilians by state security forces and IRGC paramilitaries.
One-paragraph review of the main immediate outcomes of the event: The brutal suppression of the protests further alienated the Iranian populace, stripping the regime of any remaining vestige of domestic legitimacy and demonstrating its reliance on raw violence for survival. The massacres drew severe international condemnation and provided the incoming Trump administration in the United States with the moral and political pretext to openly advocate for regime change in Tehran. Recognizing the extreme fragility of the Iranian state, US and Israeli defense planners calculated that a final, decisive military push could trigger the total collapse of the Islamic Republic, leading the US to initiate the largest military buildup in the region since the 2003 invasion of Iraq.
Strategic Analysis of the 2026 Protests
The 2026 protests were the violent domestic manifestation of Iran's catastrophic external geopolitical failures. The economic strangulation caused by years of tightening US sanctions, combined with the massive, unsustainable expenditure required to rebuild the military infrastructure destroyed by Israel in 2024 and 2025, left the state completely unable to provide basic services or stabilize the currency. Internal intelligence indicated deep, paralyzing factional rifts within the regime's political elite. A faction of pragmatists—including figures like Ghalibaf, Pezeshkian, Araghchi, and Pourmohammadi—secretly petitioned Mojtaba Khamenei via letter, warning that the economic crisis was unsustainable and that serious negotiations with the US were unavoidable.
However, this pragmatist camp was thoroughly sidelined by hardliners led by figures such as Vahidi, who demanded uncompromising ideological adherence and a high-risk posture, viewing any concessions as incompatible with the principles of the Islamic Revolution. Vahidi’s dominance meant the regime doubled down on domestic repression. By deploying the IRGC against its own civilians, the regime exhausted its coercive apparatus internally, severely degrading troop morale and leaving its borders and strategic military sites vulnerable to external attack.
Furthermore, the massacres fundamentally altered the strategic calculus in Washington. President Trump, seizing upon the extreme vulnerability exposed by the protests, shifted US policy from containment and nuclear deterrence to active rollback. The intelligence assessment shared between Jerusalem and Washington was clear: the Iranian regime was a hollow structure, structurally compromised from within, and a sustained decapitation strike campaign could precipitate a total system failure. The failure of indirect negotiations in Oman in February 2026, which Trump noted he was "not thrilled" with, served as the final diplomatic nail in the coffin, green-lighting the massive offensive that would follow days later.`}
            ,
            {
                name: `Operation Epic Fury and Roaring Lion`, description: `Main countries involved: United States, Israel, Iran, United Kingdom.
One-paragraph summary of the event: On February 28, 2026, following an executive order given by US President Donald Trump at 20:38 UTC on February 27, the United States ("Operation Epic Fury") and Israel ("Operation Roaring Lion") launched a massive, coordinated military assault on Iran with the explicitly stated objectives of inducing regime change, dismantling the Iranian navy, and permanently ending its ballistic missile programs. Over a grueling 40-day campaign, the US executed approximately 13,000 strikes while Israel conducted over 10,800 strikes, dropping a combined 18,000 bombs on military assets, air defenses, and leadership compounds. The initial wave of strikes specifically targeted the supreme leadership in Tehran, resulting in the successful assassination of Supreme Leader Ayatollah Ali Khamenei and other top officials, including Ali Larijani and Minister of Defense Aziz Nasirzadeh.
One-paragraph review of the main immediate outcomes of the event: The death of Ali Khamenei threw the Iranian regime into chaos, forcing the Assembly of Experts to rapidly elevate his son, Mojtaba Khamenei, to Supreme Leader on March 8 in a desperate bid to maintain continuity of government. The strikes caused catastrophic damage to Iran's remaining military architecture, destroying major naval vessels like the IRIS Shahid Soleimani, while inflicting severe civilian casualties, including 170 people killed when a US missile tragically struck a girls' school near a naval base in Minab. Iran retaliated by launching ballistic missiles at US and allied bases across the region, including two missiles fired at the remote UK/US base in Diego Garcia, while the UK provided defensive support from bases in Cyprus, Bahrain, and RAF Fairford.

Strategic Analysis of Epic Fury and Roaring Lion. Operation Epic Fury represented the total abandonment of diplomatic containment in favor of active, kinetic regime rollback. President Trump’s rhetoric, broadcasting an early morning video directly to the Iranian public declaring that the country "will be yours to take," explicitly confirmed the regime-change nature of the war. The assassination of Ayatollah Ali Khamenei was a monumental event in the history of the modern Middle East. For nearly 37 years, Khamenei had been the ideological and strategic anchor of the Islamic Republic, cultivating the Axis of Resistance and driving the nuclear program through decades of sanctions. His sudden violent death created a massive power vacuum. However, the deeply entrenched networks of the IRGC rapidly coalesced around his son, Mojtaba, ensuring the immediate survival of the state apparatus, albeit in a highly degraded and paranoid form.
The scale of the bombardment was unprecedented in modern warfare. By delivering nearly 25,000 combined strikes over 40 days, the US and Israel sought to systematically deconstruct the Iranian state's monopoly on force. Yet, the campaign demonstrated the limits of airpower in achieving absolute political objectives. Despite the decapitation of leadership and the destruction of the navy, the IRGC retained enough asymmetric, decentralized capability to launch retaliatory strikes against US bases, Israel, and energy infrastructure in the Gulf Arab states. The strikes on UK bases, including the attempt on Diego Garcia 2,500 miles away, proved the remaining reach of Iran's missile forces.
The campaign also triggered a fierce debate regarding international law and domestic war powers. Legal scholars and State Department memos highlighted that the Trump administration failed to establish that the use of military force was strictly necessary under the jus ad bellum requirements of necessity and proportionality, as there was no immediate predicate armed attack against the US. Furthermore, critics argued the offensive violated the 1973 War Powers Resolution, as it lacked congressional authorization and exceeded the 60-day clock for hostilities. Compounding the political fallout were the tragic civilian casualties; Iran’s ambassador to the UN reported 1,500 civilians killed, heavily amplifying anti-American sentiment globally due to incidents like the Minab school strike.`}
            ,
            {
                name: `The Blockade of the Strait of Hormuz`, description: `
Main countries involved: Iran, United States, Global Maritime Actors, Qatar.
One-paragraph summary of the event: In a desperate, scorched-earth retaliation for the regime-change operations, the Iranian government weaponized global geography by announcing the total closure of the Strait of Hormuz in March 2026, effectively choking off one of the world's most critical energy and global trade chokepoints. Utilizing surviving asymmetrical naval assets, coastal anti-ship missile batteries, and extensive mine-laying capabilities, the IRGC established a maritime "toll booth" system, boarding and vetting vessels, and blocking any traffic deemed hostile to Tehran. In direct response, the United States military initiated a stringent naval blockade of Iranian ports to completely cut off the regime's residual revenue streams, a move Tehran furiously decried as "amounting to piracy".2
One-paragraph review of the main immediate outcomes of the event: The implementation of this "double blockade" triggered a catastrophic global economic shock and energy crisis. Commercial shipping through the strait plummeted to approximately 5% of pre-conflict levels, causing a massive, immediate spike in global oil and gas prices. Several Middle Eastern states were forced to suspend energy production entirely, and QatarEnergy reported that Iranian retaliatory strikes on a major gas field would take three to five years to repair. To mitigate the spiraling crisis, the International Energy Agency (IEA) released 400 million barrels of oil from strategic reserves, while the US administration temporarily lifted sanctions on Russian oil in transit to stabilize the market.
Strategic Analysis of the Hormuz Blockade
The closure of the Strait of Hormuz was Iran’s ultimate strategic trump card, a highly disruptive tactic designed to force the international community to pressure the US and Israel into a cessation of hostilities. By actively expanding the theater of war from a localized regional military conflict into a global economic crisis, Iran sought to make the financial cost of continuing the war completely unsustainable for Western economies. This maneuver highlighted the immense vulnerability of the globalized economy to regional kinetic conflicts.
The implementation of the IRGC "toll booth" demonstrated a high degree of tactical adaptability by the Iranian navy, even in its degraded state. By allowing vessels from non-aligned or friendly nations like China and Pakistan to pass unhindered while targeting Western shipping, Iran attempted to divide the international community and weaponize energy access specifically against Europe and the United States. The economic ramifications were profound, leading to immediate fuel shortages in parts of Asia and threatening severe aviation fuel shortages across Europe.
The US naval blockade further complicated the maritime environment, creating a "double blockade" that essentially paralyzed the Persian Gulf. The willingness of the US administration to relax sanctions on Russian energy—despite the ongoing geopolitical tensions with Moscow—to offset the Iranian shock underscores the desperate, zero-sum nature of global energy security during the crisis. Iran's ability to hold the global energy market hostage, despite having its conventional military decimated, proved that economic deterrence and military deterrence are inextricably linked in modern conflict.`}
            ,
            {
                name: `Resumption of the Israel-Hezbollah Conflict in Lebanon`, description: `
Main countries involved: Israel, Lebanon (Hezbollah).
One-paragraph summary of the event: Coinciding with the massive US-Israeli strikes on Iran, the fragile framework of the November 2024 Lebanese ceasefire completely collapsed in early March 2026.36 On March 2, 2026, Hezbollah—acting on orders from the surviving IRGC command to alleviate military pressure on Tehran—broke the truce by launching rockets and explosive drones at cities across northern Israel, marking the first notable clash in over a year. Concurrently, Hezbollah forces engaged Israeli units directly in the symbolically significant Bint Jbeil district in southeastern Lebanon, launching localized rocket, mortar, and anti-tank guided missile attacks against IDF infrastructure.
One-paragraph review of the main immediate outcomes of the event: The IDF met the provocation with an immediate, overwhelming, and disproportionate response, initiating over 500 heavy aerial bombardments across Lebanon, particularly targeting the southern suburbs of Beirut and the city of Tyre. Israel subsequently issued mass evacuation orders for all civilians north of the Zahrani River and launched expansive new ground operations. The renewed conflict exacerbated an already severe humanitarian crisis, displacing over one-sixth of the country’s population and resulting in severe operational constraints for the United Nations Interim Force in Lebanon (UNIFIL), whose peacekeepers faced direct interference and warning shots from IDF forces.
Strategic Analysis of the Resumption of the Lebanon Conflict
The March 2026 resumption of hostilities in Lebanon illustrated the enduring, albeit severely degraded, interconnectedness of the Axis of Resistance. Hezbollah’s decision to open a northern front against Israel was not a localized tactical decision but a strategic imperative directed by Tehran to stretch Israeli air defenses, political resolve, and munitions stockpiles. The clashes at Bint Jbeil were highly symbolic; former Hezbollah leader Hassan Nasrallah had famously proclaimed "victory" there in 2000, and the group sought to use the location to project a facade of enduring strength.
However, unlike the conflicts of the early 2000s or even 2024, Hezbollah entered this phase of the war fundamentally broken. Having already lost its top leadership and massive weapons caches, the group's ability to sustain high-intensity combat was drastically reduced. Conversely, the IDF, unburdened by the threat of an Iranian nuclear umbrella, operated with unprecedented aggressiveness in Lebanese territory. The humanitarian toll was catastrophic, deepening the socio-economic collapse of the Lebanese state.
Furthermore, the operational environment for UNIFIL became entirely untenable. The mission faced a pattern of direct interference, culminating in IDF forces firing warning shots at peacekeepers. This signaled the complete breakdown of international peacekeeping frameworks in the Levant. The UN Security Council resolution 2790 had already set December 2026 as the terminal date for UNIFIL, but the March escalation effectively ended their operational relevance. The destruction in Lebanon served as a grim warning to other regional actors of the absolute devastation Israel was willing to inflict to secure its borders.`}
            ,
            {
                name: `The April 2026 Temporary Ceasefire and Global Crisis`, description: `
Main countries involved: United States, Israel, Iran.
One-paragraph summary of the event: After 40 days of sustained, high-intensity combat that reshaped the Middle East and triggered a severe global economic crisis, the United States, Israel, and Iran agreed to a temporary, highly fragile two-week ceasefire that took effect on April 7–8, 2026.8 The truce paused the massive bombing campaigns, instituted halts to ballistic missile exchanges, and mandated a temporary stand-down of the maritime blockades in the Persian Gulf. The agreement was brokered following immense pressure from the international community, which was buckling under the strain of the energy shock and the humanitarian catastrophes unfolding across multiple nations.
One-paragraph review of the main immediate outcomes of the event: The ceasefire provided a much-needed operational pause, allowing for the assessment of catastrophic damages and the initiation of minimal humanitarian relief to the 3.2 million displaced civilians across the region. However, indirect diplomatic negotiations quickly stalled over irreconcilable demands; President Trump issued a strict ultimatum threatening to completely annihilate Iran's remaining energy sites if the Strait of Hormuz was not permanently reopened by April 6, while Tehran demanded extensive war reparations and maintained rigid conditions regarding control over the strait. As of late April, the truce was largely holding, but the underlying geopolitical gridlock remained entirely unresolved.
Strategic Analysis of the April Ceasefire
The April 2026 ceasefire did not represent a resolution to the conflict but rather a necessary, exhausted operational pause for all belligerents. The United States and Israel had largely achieved their primary military objectives: the elimination of the Supreme Leader, the total destruction of the nuclear weaponization program, and the crippling of Iran’s conventional military architecture and regional proxies. However, they failed to achieve the ultimate political objective of prompting a total collapse of the Islamic Republic's governing apparatus. The survival of the IRGC command structure under Mojtaba Khamenei ensured that the state, though severely degraded, remained a hostile entity.
For the Iranian regime, the ceasefire was a desperate mechanism for regime survival. The economic toll of the war, compounded by the domestic unrest of early 2026, placed the state on the brink of total disintegration. Yet, the hardline faction's insistence on reparations and continued control over the Strait of Hormuz demonstrated that the ideological core of the IRGC remained intact and defiant. The global community was left navigating an immensely volatile interregnum. The threat of renewed US strikes on Iranian energy infrastructure loomed large, carrying the potential to permanently fracture global energy markets.
`}

        ]
    })

    await fs.writeFile(
        `src/data/${name}.json`,
        JSON.stringify(scenario, null, 4),
        { encoding: "utf-8" }
    )
}

main()