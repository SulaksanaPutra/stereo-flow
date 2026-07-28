const test = require('node:test');
const assert = require('node:assert');

// Audio Graph Logic Unit Tests

function calculateEffectivePan(pan, isMono) {
  if (isMono) return 0.0;
  return Math.min(1.0, Math.max(-1.0, pan));
}

function calculateTargetGain(volume, isMuted) {
  if (isMuted) return 0.0;
  return Math.max(0.0, volume);
}

function getCompressorThreshold(limiterMode) {
  return limiterMode === 'aggressive' ? -3.0 : -1.0;
}

test('calculateEffectivePan - clamps pan values and handles mono mode', () => {
  assert.strictEqual(calculateEffectivePan(0, false), 0.0);
  assert.strictEqual(calculateEffectivePan(-0.75, false), -0.75);
  assert.strictEqual(calculateEffectivePan(0.5, false), 0.5);
  
  // Clamping extreme values
  assert.strictEqual(calculateEffectivePan(-1.5, false), -1.0);
  assert.strictEqual(calculateEffectivePan(2.0, false), 1.0);

  // Mono override forces 0.0 center balance
  assert.strictEqual(calculateEffectivePan(-1.0, true), 0.0);
  assert.strictEqual(calculateEffectivePan(1.0, true), 0.0);
});

test('calculateTargetGain - calculates gain and respects mute state', () => {
  assert.strictEqual(calculateTargetGain(1.0, false), 1.0);
  assert.strictEqual(calculateTargetGain(2.5, false), 2.5);
  
  // Mute forces 0.0 gain
  assert.strictEqual(calculateTargetGain(1.0, true), 0.0);
  assert.strictEqual(calculateTargetGain(3.0, true), 0.0);
  
  // Negative volume clamp
  assert.strictEqual(calculateTargetGain(-0.5, false), 0.0);
});

test('getCompressorThreshold - maps limiter modes correctly', () => {
  assert.strictEqual(getCompressorThreshold('balanced'), -1.0);
  assert.strictEqual(getCompressorThreshold('aggressive'), -3.0);
  assert.strictEqual(getCompressorThreshold('unknown'), -1.0);
});
