import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulationClock } from '../dist/assets/simulation-clock.js';

test('clock accumulates full elapsed time, preserves phase on pause, and steps exactly', () => {
  const callbacks = new Map(); let id = 0;
  const clock = createSimulationClock({ onFrame() {}, requestFrame: (cb) => { callbacks.set(++id, cb); return id; }, cancelFrame: (key) => callbacks.delete(key) });
  const tick = (time) => { const [key, cb] = callbacks.entries().next().value; callbacks.delete(key); cb(time); };
  clock.play(); tick(1000); tick(1250); assert.equal(clock.time, 0.25);
  clock.pause(); clock.step(0.5); assert.equal(clock.time, 0.75);
  clock.setSpeed(2); clock.play(); tick(3000); tick(3250); assert.equal(clock.time, 1.25);
  clock.destroy(); assert.equal(callbacks.size, 0);
});

test('hidden page pauses without catch-up and requires explicit resume', () => {
  const callbacks = new Map(); let id = 0; let hidden = false; let visibility;
  const clock = createSimulationClock({ onFrame() {}, requestFrame: (cb) => { callbacks.set(++id, cb); return id; }, cancelFrame: (key) => callbacks.delete(key), visibility: { get hidden() { return hidden; }, addEventListener: (_, cb) => { visibility = cb; }, removeEventListener() {} } });
  const tick = (time) => { const [key, cb] = callbacks.entries().next().value; callbacks.delete(key); cb(time); };
  clock.play(); tick(0); tick(100); hidden = true; visibility(); hidden = false; visibility();
  assert.equal(clock.time, 0.1); assert.equal(clock.playing, false);
  clock.destroy();
});
