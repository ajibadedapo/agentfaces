import { describe, expect, it, vi } from "vitest";
import { createReducedMotionStore } from "./reducedMotionStore";

function manualSchedule() {
  const queue: Array<{ run: () => void; ms: number }> = [];
  return {
    schedule: (run: () => void, ms: number) => queue.push({ run, ms }),
    queue,
    flush: async () => {
      const next = queue.shift();
      next?.run();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe("native reduced motion store", () => {
  it("keeps the setting unknown after a failed read instead of caching a guess", async () => {
    const timers = manualSchedule();
    const read = vi.fn().mockRejectedValue(new Error("bridge not ready"));
    const store = createReducedMotionStore(read, timers.schedule, [100]);
    const result = store.refresh();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.get()).toBeNull();
    expect(timers.queue).toHaveLength(1);
    await timers.flush();
    expect(await result).toBeNull();
    expect(store.get()).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("retries a failed read and only settles on a value the OS actually returned", async () => {
    const timers = manualSchedule();
    const read = vi.fn().mockRejectedValueOnce(new Error("first read fails")).mockResolvedValueOnce(false);
    const store = createReducedMotionStore(read, timers.schedule, [100, 400]);
    const seen: boolean[] = [];
    store.subscribe((value) => seen.push(value));
    const result = store.refresh();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.get()).toBeNull();
    expect(seen).toEqual([]);
    await timers.flush();
    expect(await result).toBe(false);
    expect(store.get()).toBe(false);
    expect(seen).toEqual([false]);
  });

  it("stops retrying once a change event has supplied the real value", async () => {
    const timers = manualSchedule();
    const read = vi.fn().mockRejectedValue(new Error("offline"));
    const store = createReducedMotionStore(read, timers.schedule, [100, 400]);
    const result = store.refresh();
    await Promise.resolve();
    await Promise.resolve();
    store.set(true);
    await timers.flush();
    expect(await result).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
    expect(timers.queue).toHaveLength(0);
  });

  it("shares one read between concurrent callers", async () => {
    const read = vi.fn().mockResolvedValue(true);
    const store = createReducedMotionStore(read);
    const [a, b] = await Promise.all([store.refresh(), store.refresh()]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
