export const REDUCED_MOTION_RETRIES = [250, 1000, 4000] as const;

export interface ReducedMotionStore {
  get(): boolean | null;
  set(value: boolean): void;
  refresh(): Promise<boolean | null>;
  subscribe(listener: (value: boolean) => void): () => void;
}

type Schedule = (run: () => void, ms: number) => unknown;

export function createReducedMotionStore(read: () => Promise<boolean>, schedule: Schedule = setTimeout, retries: readonly number[] = REDUCED_MOTION_RETRIES): ReducedMotionStore {
  let known: boolean | null = null;
  let pending: Promise<boolean | null> | null = null;
  const listeners = new Set<(value: boolean) => void>();

  const set = (value: boolean) => {
    known = value;
    for (const listener of listeners) listener(value);
  };

  const attempt = (index: number): Promise<boolean | null> =>
    read().then(
      (value) => {
        set(value);
        return value;
      },
      () => {
        if (known !== null || index >= retries.length) return known;
        return new Promise<boolean | null>((resolve) => {
          schedule(() => resolve(known !== null ? known : attempt(index + 1)), retries[index]);
        });
      },
    );

  const refresh = () => {
    if (!pending) {
      pending = attempt(0).finally(() => {
        pending = null;
      });
    }
    return pending;
  };

  return {
    get: () => known,
    set,
    refresh,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
