import { useEffect, useState } from "react";
import { useRuntime } from "./RuntimeContext";

/**
 * Vale Stone balance and map progress.
 *
 * Both numbers are pushed by domain events rather than polled: the balance
 * comes straight off the `stones:awarded` payload, which src/core computes
 * from the ledger, so it always equals `store.balance()` without this
 * component ever deriving a reward itself.
 */
export function ValeStonesHud() {
  const runtime = useRuntime();
  const [balance, setBalance] = useState(() => runtime.store.getState().balance());
  const [revealed, setRevealed] = useState(
    () => runtime.store.getState().revealedRegionIds().length,
  );
  const totalRegions = runtime.content.manifest.scenes.length;

  useEffect(() => {
    return runtime.bus.on("stones:awarded", (payload) => setBalance(payload.balance));
  }, [runtime]);

  useEffect(() => {
    return runtime.bus.on("region:revealed", () =>
      setRevealed(runtime.store.getState().revealedRegionIds().length),
    );
  }, [runtime]);

  return (
    <div className="vv-hud" data-testid="vale-stones">
      <span className="vv-hud__label">Vale Stones</span>
      <span className="vv-hud__value" data-testid="vale-stones-balance">
        {balance}
      </span>
      <span className="vv-hud__divider" aria-hidden="true" />
      <span className="vv-hud__label">Regions revealed</span>
      <span className="vv-hud__value">
        <span data-testid="regions-revealed">{revealed}</span> / {totalRegions}
      </span>
    </div>
  );
}
