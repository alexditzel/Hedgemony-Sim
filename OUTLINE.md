Outline

Introduction

We designed a digital war game simulator based on Hedgemony.
It uses LLMs to generate any scenario based on up-to-date information and to adjudicate the results of player actions during the simulation.
Tech stack
What we used: 
Hedgemony rulebook 
Open source intelligence data about current events, we scraped ourselves because the existing APIs arent fully up-to-date we wanted to do a simulation of the Iran War based on the most up-to-date information, in order to demonstrate how quickly extensible our system is to novel scenarios
https://www.reuters.com/graphics/IRAN-CRISIS/MAPS/znpnmelervl/
https://www.inss.org.il/publication/lions-roar-data/
https://www.congress.gov/crs-product/R45281
What we built from scratch:
Digital Hedgemony rules engine
Autonomous agents the play white cell and red cell roles in simulation
The White Cell agent adjudicates free play actions from the Blue Cell and Red Cell players.
Novelty
We adopted a professional wargaming simulator rule set to automatic rules processing and even allowing for fuzzy adjudication.
We designed a pipeline for generating new scenarios based on the most up-to-date information.
This has been demonstrated as useful, for example, with the work on extending Hedgemony to the Ukraine War scenario. (https://filipejdus.com/)
One critical aspect of our work is that it translates a commander's intent when they do the free play actions into a structured representation that the game can process with the formalized rules of resources and systems and scores that cards interact with and persist to the state over time. That it can be intelligently integrated into future AI-assisted decisions.
National impact
Using advanced machine learning technology allows for rapid exploration of various strategies and rapid feedback loops that help commanders develop their intuitions on their own more rigorously. It can aid with higher cost and finer-grained simulations.
We think that easy-to-set-up and responsive simulations like this will be helpful to strategic decision makers to organize their intuitions by running quick simulations based on how they view a scenario, without necessarily having to wait for long feedback from domain experts. 
We also think that this could be especially useful as a teaching tool. Rather than only being able to do one long simulation as a teaching exercise or evaluation in a pedagogical context, instead many simulations can be run many times. Students could learn over time how many different kinds of decisions lead to various outcomes, even in the same or different scenarios. This allows for much more open-ended exploration and refinement of strategic experiments, which was not previously possible at a fine-grained level because of the upfront cost of designing and running war gaming simulations.
Scalability and meaningfulness
It only took us less than a day to add a new scenario for recent events based on journalistic data and seconds for each adjudication
This is much more feasible than the hours/days of adjudication and months of planning that are required for pen and paper war simulations.
Additionally, our models record all of their reasoning, which can be analyzed after the fact to understand how decisions were made explicitly.
Technical difficulty
Wargaming systems like Hedgemony are extremely complex and require much manual adjudication.
We encoded the exhaustive rule set of the entire Hedgemony system along with structured representations of the queries that need to be done for adjudication by either a human or automated system.
There isn't much open source implementation of official wargaming simulations, so we had to work off of a purely text-based description of the rules for a wargaming simulation system. We only had access to a very small sample of the cards that were designed for that simulation. We had to find the patterns and encode the rules from this information in order to extrapolate a system for autonomously designing new scenarios and new cards.
We implemented several agents.
An agent for doing research and integrating journalistic data into designing novel scenarios, including statistics for the players, the initial world state, and the card designs that follow specific rule formats.
An agent for simulating the decisions of red cell agents according to the rules and the directives of their respective countries.
An agent for processing white cell adjudications, which decide how free play actions are interpreted into the rules and how events resolve, including both random and analytical judgments.

