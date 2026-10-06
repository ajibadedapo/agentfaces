export type TickCommit = () => void;
export type TickHandler = (now: number, dt: number) => TickCommit | void;

export interface TickerDriver {
  start(frame: (now: number) => void): void;
  stop(): void;
}

export interface Ticker {
  subscribe(handler: TickHandler): () => void;
  readonly size: number;
  readonly running: boolean;
}

const MAX_DT = 100;

export function createTicker(driver: TickerDriver): Ticker {
  const handlers = new Set<TickHandler>();
  let running = false;
  let last = 0;
  const frame = (now: number) => {
    const dt = last === 0 ? 16 : Math.min(MAX_DT, Math.max(0, now - last));
    last = now;
    const commits: TickCommit[] = [];
    for (const handler of Array.from(handlers)) {
      const commit = handler(now, dt);
      if (typeof commit === "function") commits.push(commit);
    }
    for (const commit of commits) commit();
  };
  return {
    subscribe(handler) {
      handlers.add(handler);
      if (!running) {
        running = true;
        last = 0;
        driver.start(frame);
      }
      return () => {
        handlers.delete(handler);
        if (handlers.size === 0 && running) {
          running = false;
          driver.stop();
        }
      };
    },
    get size() {
      return handlers.size;
    },
    get running() {
      return running;
    },
  };
}

export function animationFrameDriver(): TickerDriver {
  let handle = 0;
  let active = false;
  return {
    start(frame) {
      active = true;
      const loop = (now: number) => {
        if (!active) return;
        frame(now);
        handle = requestAnimationFrame(loop);
      };
      handle = requestAnimationFrame(loop);
    },
    stop() {
      active = false;
      cancelAnimationFrame(handle);
    },
  };
}

export function intervalDriver(ms: number, clock: () => number = () => Date.now()): TickerDriver {
  let handle: ReturnType<typeof setInterval> | null = null;
  return {
    start(frame) {
      handle = setInterval(() => frame(clock()), ms);
    },
    stop() {
      if (handle !== null) clearInterval(handle);
      handle = null;
    },
  };
}
