// import scenario from "./data/defaultScenario.json";
import scenario from "./data/iran-war.json";
import { GameView } from "./components/GameView";
import type { Scenario } from "./engine";

export default function App() {
  return <GameView scenario={scenario as unknown as Scenario} />;
}
