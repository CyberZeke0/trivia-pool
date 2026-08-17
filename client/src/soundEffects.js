let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone({ frequency, duration, type = "sine", volume = 0.2, delay = 0 }) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const startTime = ctx.currentTime + delay;
  osc.start(startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.stop(startTime + duration);
}

export function playTick() {
  playTone({ frequency: 880, duration: 0.08, type: "square", volume: 0.15 });
}

export function playCorrect() {
  playTone({ frequency: 523, duration: 0.12, delay: 0 });
  playTone({ frequency: 659, duration: 0.12, delay: 0.1 });
  playTone({ frequency: 784, duration: 0.2, delay: 0.2 });
}

export function playWrong() {
  playTone({ frequency: 200, duration: 0.3, type: "sawtooth", volume: 0.15 });
}

export function playGameStart() {
  playTone({ frequency: 440, duration: 0.15, delay: 0 });
  playTone({ frequency: 554, duration: 0.15, delay: 0.15 });
  playTone({ frequency: 659, duration: 0.3, delay: 0.3 });
}

export function playWinnerFanfare() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((freq, i) => playTone({ frequency: freq, duration: 0.25, delay: i * 0.15, volume: 0.2 }));
}