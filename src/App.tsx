import defaultScenario from "./data/defaultScenario.json";
import { GameView } from "./components/GameView";
import type { Scenario } from "./engine";

export default function App() {
  return <GameView scenario={defaultScenario as unknown as Scenario} />;
}
