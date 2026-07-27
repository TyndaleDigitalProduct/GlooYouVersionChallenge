import Phaser from "phaser";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createGameConfig } from "./game/gameConfig";
import "./styles.css";
import { App } from "./ui/App";

const gameContainer = document.getElementById("game-container");
const uiLayer = document.getElementById("ui-layer");

if (!gameContainer) {
  throw new Error("#game-container is missing from index.html");
}
if (!uiLayer) {
  throw new Error("#ui-layer is missing from index.html");
}

new Phaser.Game(createGameConfig(gameContainer));

createRoot(uiLayer).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
