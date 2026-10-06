import { describe, expect, it, vi } from "vitest";
import { createTicker, intervalDriver, type TickerDriver } from "./ticker";

function fakeDriver() {
  let frame: ((now: number) => void) | null = null;
  const driver: TickerDriver & { starts: number; stops: number; fire(now: number): void } = {
    starts: 0,
    stops: 0,
    start(fn) {
      this.starts++;
      frame = fn;
    },
    stop() {
      this.stops++;
      frame = null;
    },
    fire(now) {
      frame?.(now);
    },
  };
  return driver;
}

describe("createTicker", () => {
  it("starts the driver once for many subscribers and stops when the last one leaves", () => {
    const driver = fakeDriver();
    const ticker = createTicker(driver);
    const seen: number[] = [];
    const offs = Array.from({ length: 12 }, (_, i) =>
      ticker.subscribe(() => {
        seen.push(i);
      }),
    );
    expect(driver.starts).toBe(1);
    expect(ticker.size).toBe(12);
    driver.fire(1000);
    expect(seen).toHaveLength(12);
    offs.slice(0, 11).forEach((off) => off());
    expect(driver.stops).toBe(0);
    offs[11]();
    expect(driver.stops).toBe(1);
    expect(ticker.running).toBe(false);
  });

  it("runs every handler before any commit so writes are batched per frame", () => {
    const driver = fakeDriver();
    const ticker = createTicker(driver);
    const order: string[] = [];
    const offs = [0, 1, 2].map((i) => ticker.subscribe(() => {
      order.push(`compute-${i}`);
      return () => order.push(`commit-${i}`);
    }));
    driver.fire(500);
    expect(order).toEqual(["compute-0", "compute-1", "compute-2", "commit-0", "commit-1", "commit-2"]);
    offs.forEach((off) => off());
  });

  it("caps dt after a long pause and passes the frame time through", () => {
    const driver = fakeDriver();
    const ticker = createTicker(driver);
    const dts: number[] = [];
    const off = ticker.subscribe((_now, dt) => {
      dts.push(dt);
    });
    driver.fire(1000);
    driver.fire(1016);
    driver.fire(9000);
    expect(dts).toEqual([16, 16, 100]);
    off();
  });

  it("interval driver stops its timer", () => {
    vi.useFakeTimers();
    const frame = vi.fn();
    const driver = intervalDriver(50, () => 123);
    driver.start(frame);
    vi.advanceTimersByTime(160);
    expect(frame).toHaveBeenCalledTimes(3);
    expect(frame).toHaveBeenLastCalledWith(123);
    driver.stop();
    vi.advanceTimersByTime(500);
    expect(frame).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
