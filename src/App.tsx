// import scenario from "./data/defaultScenario.json";
// import scenario from "./data/iran-war-v1.json";
import scenario from "./data/iran-war-v2.json";
import { GameView } from "./components/GameView";
import type { Scenario } from "./engine";

export default function App() {
  return <GameView scenario={scenario as unknown as Scenario} />;
}
