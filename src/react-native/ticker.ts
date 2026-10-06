import { createTicker, intervalDriver } from "agentfaces";

export const NATIVE_TICK_MS = 80;

export const nativeTicker = createTicker(intervalDriver(NATIVE_TICK_MS));
