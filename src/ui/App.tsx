import { useEffect, useState } from "react";
import { eventBus } from "@/core/eventBus";

/**
 * Placeholder overlay component. Real narrative UI (DialogueBox,
 * ScriptureCard, GuideChat, ValeStones — see ADR-0002) replaces this in
 * later PRDs. This scaffold only proves the sibling-overlay wiring: React
 * renders discrete state read off the event bus, never per-frame state.
 */
export function App() {
  const [sceneKey, setSceneKey] = useState<string | null>(null);

  useEffect(() => {
    return eventBus.on("scene:ready", ({ sceneKey }) => {
      setSceneKey(sceneKey);
    });
  }, []);

  return (
    <div
      style={{
        pointerEvents: "auto",
        position: "absolute",
        top: 0,
        left: 0,
        padding: "0.5rem 0.75rem",
        color: "#f2f2f2",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.875rem",
      }}
    >
      {sceneKey ? `Scene ready: ${sceneKey}` : "Loading…"}
    </div>
  );
}
