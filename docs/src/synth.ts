const VOWELS: Array<[number, number]> = [
  [760, 1180],
  [520, 1840],
  [330, 2280],
  [490, 880],
  [360, 760],
];

export interface SynthVoice {
  output: AudioNode;
  setAudible(audible: boolean): void;
  stop(): void;
}

export function startSynthVoice(context: AudioContext, audible: boolean): SynthVoice {
  const source = context.createOscillator();
  source.type = "sawtooth";
  source.frequency.value = 132;
  const lowFormant = context.createBiquadFilter();
  lowFormant.type = "bandpass";
  lowFormant.Q.value = 7;
  const highFormant = context.createBiquadFilter();
  highFormant.type = "bandpass";
  highFormant.Q.value = 9;
  const envelope = context.createGain();
  envelope.gain.value = 0;
  const speaker = context.createGain();
  speaker.gain.value = audible ? 0.5 : 0;
  source.connect(lowFormant);
  source.connect(highFormant);
  lowFormant.connect(envelope);
  highFormant.connect(envelope);
  envelope.connect(speaker);
  speaker.connect(context.destination);
  source.start();

  let cursor = context.currentTime + 0.1;
  let wordsLeft = 0;
  const schedule = () => {
    while (cursor < context.currentTime + 0.6) {
      if (wordsLeft <= 0) {
        cursor += 0.35 + Math.random() * 0.5;
        wordsLeft = 4 + Math.floor(Math.random() * 8);
      }
      const length = 0.13 + Math.random() * 0.12;
      const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
      const peak = 0.5 + Math.random() * 0.5;
      lowFormant.frequency.setTargetAtTime(f1, cursor, 0.02);
      highFormant.frequency.setTargetAtTime(f2, cursor, 0.02);
      source.frequency.setTargetAtTime(118 + Math.random() * 34, cursor, 0.05);
      envelope.gain.setTargetAtTime(peak, cursor, 0.018);
      envelope.gain.setTargetAtTime(0.02, cursor + length * 0.6, 0.035);
      cursor += length + (Math.random() < 0.25 ? 0.08 : 0.02);
      wordsLeft--;
    }
  };
  schedule();
  const timer = setInterval(schedule, 150);
  return {
    output: envelope,
    setAudible(next) {
      speaker.gain.setTargetAtTime(next ? 0.5 : 0, context.currentTime, 0.02);
    },
    stop() {
      clearInterval(timer);
      source.stop();
      source.disconnect();
      speaker.disconnect();
    },
  };
}
