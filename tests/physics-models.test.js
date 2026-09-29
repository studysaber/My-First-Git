import test from 'node:test';
import assert from 'node:assert/strict';
import { pendulumState, waveSample, maxwellDensity, carnotCycle, doubleSlitIntensity } from '../dist/assets/physics-models.js';
import { waveSample as publicWaveSample } from '../dist/assets/simulations.js';

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`);

test('pendulum quarter cycle crosses equilibrium and bob stays one length from pivot', () => {
  const input = { length: 1, gravity: 9.8, amplitudeRad: Math.PI / 18 };
  const start = pendulumState({ ...input, time: 0 });
  near(start.period, 2.007089923154493, 1e-5);
  near(pendulumState({ ...input, time: start.period / 4 }).angle, 0, 1e-10);
  near(pendulumState({ ...input, time: start.period / 2 }).angle, -input.amplitudeRad);
  near(pendulumState({ ...input, length: 4, time: 0 }).period / start.period, 2);
  for (const time of [0, 0.3, 0.8]) {
    const state = pendulumState({ ...input, time });
    near(Math.hypot(state.x, state.y), 1);
  }
});

test('wave A is incident amplitude and standing antinode reaches twice A', () => {
  assert.equal(publicWaveSample, waveSample);
  near(waveSample({ x: 0.25, time: 0, amplitude: 0.003, wavelength: 1, period: 2, mode: 'standing' }), 0.006);
  near(waveSample({ x: 0.5, time: 0.3, amplitude: 0.003, wavelength: 1, period: 2, mode: 'standing' }), 0);
});

test('Maxwell density integrates to one and 900 K peak shifts and lowers', () => {
  const molarMass = 0.028;
  const density = (speed, temperature) => maxwellDensity({ speed, temperature, molarMass });
  const step = 4; let integral = 0;
  for (let speed = 0; speed < 8000; speed += step) integral += (density(speed, 300) + density(speed + step, 300)) * step / 2;
  near(integral, 1, 1e-4);
  const p300 = Math.sqrt(2 * 8.31446261815324 * 300 / molarMass);
  const p900 = p300 * Math.sqrt(3);
  near(density(p900, 900) / density(p300, 300), 1 / Math.sqrt(3), 1e-9);
  assert.ok(p900 > p300);
});

test('Carnot has four joined thermodynamic paths and equal reservoirs yield zero work', () => {
  const cycle = carnotCycle({ hotK: 600, coldK: 300 });
  near(cycle.efficiency, 0.5);
  near(cycle.work, cycle.heatIn - cycle.heatOut, 1e-8);
  assert.equal(cycle.segments.length, 4);
  for (let index = 0; index < 4; index += 1) {
    const end = cycle.segments[index].points.at(-1);
    const next = cycle.segments[(index + 1) % 4].points[0];
    near(end.volume, next.volume, 1e-9); near(end.pressure, next.pressure, 1e-6);
  }
  near(carnotCycle({ hotK: 300, coldK: 300 }).work, 0);
  for (const index of [0, 2]) {
    const products = cycle.segments[index].points.map(({ volume, pressure }) => volume * pressure);
    products.forEach((product) => near(product / products[0], 1));
  }
  for (const index of [1, 3]) {
    const products = cycle.segments[index].points.map(({ volume, pressure }) => pressure * volume ** 1.4);
    products.forEach((product) => near(product / products[0], 1));
  }
});

test('ideal equal slit fringe spacing is 12 and 14 mm on the same screen', () => {
  const input = { slitSeparation: 0.1e-3, screenDistance: 2 };
  near(doubleSlitIntensity({ ...input, wavelength: 600e-9, y: 0.012 }), 1);
  near(doubleSlitIntensity({ ...input, wavelength: 700e-9, y: 0.014 }), 1);
  near(doubleSlitIntensity({ ...input, wavelength: 600e-9, y: 0.006 }), 0, 1e-12);
});

test('models reject invalid physical domains', () => {
  assert.throws(() => pendulumState({ length: 0, gravity: 9.8, amplitudeRad: 0.1, time: 0 }), RangeError);
  assert.throws(() => pendulumState({ length: 1, gravity: 9.8, amplitudeRad: Math.PI / 360, time: 0 }), RangeError);
  assert.throws(() => maxwellDensity({ speed: -1, temperature: 300, molarMass: 0.028 }), RangeError);
  assert.throws(() => carnotCycle({ hotK: 300, coldK: 600 }), RangeError);
  assert.throws(() => doubleSlitIntensity({ y: 0, wavelength: 0, slitSeparation: 1e-4, screenDistance: 2 }), RangeError);
});
