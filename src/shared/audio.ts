import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { createAudioLevel, createSyntheticVoice, isAudioLevel, type AudioLevel, type AudioLevelOptions, type AudioLevelSource, type LevelCallback } from "agentfaces";

const CALLBACK_SOURCE = "callback";

type SourceKey = AudioLevelSource | typeof CALLBACK_SOURCE | null;

function sourceKey(source: AudioLevelSource | null | undefined): SourceKey {
  if (typeof source === "function") return CALLBACK_SOURCE;
  return source ?? null;
}

function useLatestSource(source: AudioLevelSource | null | undefined): [SourceKey, () => AudioLevelSource | null] {
  const latest = useRef(source);
  latest.current = source;
  const key = sourceKey(source);
  const resolve = () => {
    if (key !== CALLBACK_SOURCE) return key;
    const forward: LevelCallback = (now) => {
      const current = latest.current;
      return typeof current === "function" ? current(now) : 0;
    };
    return forward;
  };
  return [key, resolve];
}

/**
 * Creates a smoothed audio level for a MediaStream, AudioNode, HTMLMediaElement, level callback or level stream,
 * and closes it on unmount. Pass the result to AgentFace as audio, or read level.value from your own ticker.
 * Callbacks may change identity between renders without resetting the level. Options are read once per source.
 */
export function useAudioLevel(source: AudioLevelSource | null | undefined, options?: AudioLevelOptions): AudioLevel | null {
  const [level, setLevel] = useState<AudioLevel | null>(null);
  const [key, resolve] = useLatestSource(source);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useEffect(() => {
    const resolved = resolve();
    if (!resolved) {
      setLevel(null);
      return;
    }
    const created = createAudioLevel(resolved, optionsRef.current);
    setLevel(created);
    return () => {
      if (!isAudioLevel(resolved)) created.close();
    };
  }, [key]);
  return level;
}

export function useFaceLevel(active: boolean, speaking: boolean, source: AudioLevelSource | null | undefined, seed: string): MutableRefObject<AudioLevel | null> {
  const ref = useRef<AudioLevel | null>(null);
  const [key, resolve] = useLatestSource(source);
  useEffect(() => {
    if (!active) return;
    const resolved = resolve() ?? (speaking && source === undefined ? createSyntheticVoice(seed) : null);
    if (!resolved) return;
    const level = createAudioLevel(resolved);
    ref.current = level;
    return () => {
      ref.current = null;
      if (!isAudioLevel(resolved)) level.close();
    };
  }, [active, speaking, key, seed, source === undefined]);
  return ref;
}
