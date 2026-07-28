import Phaser from "phaser";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createAppRuntime } from "./app/runtime";
import { createGameConfig } from "./game/gameConfig";
import "./styles.css";
import { App } from "./ui/App";
import { FatalError } from "./ui/FatalError";

const gameContainer = document.getElementById("game-container");
const uiLayer = document.getElementById("ui-layer");

if (!gameContainer) {
  throw new Error("#game-container is missing from index.html");
}
if (!uiLayer) {
  throw new Error("#ui-layer is missing from index.html");
}

const root = createRoot(uiLayer);
const boot = createAppRuntime();

if (!boot.ok) {
  // Content failed validation. Render the reason instead of booting a game on
  // a manifest we do not trust.
  root.render(
    <StrictMode>
      <FatalError reason={boot.reason} />
    </StrictMode>,
  );
} else {
  new Phaser.Game(createGameConfig(gameContainer, boot.value));

  root.render(
    <StrictMode>
      <App runtime={boot.value} />
    </StrictMode>,
  );
}
