import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "./eventBus";

describe("createEventBus", () => {
  it("calls a subscribed listener with the emitted payload", () => {
    const bus = createEventBus();
    const listener = vi.fn();

    bus.on("scene:ready", listener);
    bus.emit("scene:ready", { sceneKey: "placeholder" });

    expect(listener).toHaveBeenCalledExactlyOnceWith({ sceneKey: "placeholder" });
  });

  it("supports multiple listeners for the same event", () => {
    const bus = createEventBus();
    const first = vi.fn();
    const second = vi.fn();

    bus.on("scene:ready", first);
    bus.on("scene:ready", second);
    bus.emit("scene:ready", { sceneKey: "placeholder" });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops calling a listener after unsubscribe", () => {
    const bus = createEventBus();
    const listener = vi.fn();

    const unsubscribe = bus.on("scene:ready", listener);
    unsubscribe();
    bus.emit("scene:ready", { sceneKey: "placeholder" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not throw when emitting an event with no listeners", () => {
    const bus = createEventBus();

    expect(() => bus.emit("scene:ready", { sceneKey: "placeholder" })).not.toThrow();
  });
});
