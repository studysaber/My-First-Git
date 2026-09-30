import test from 'node:test';
import assert from 'node:assert/strict';
import {
  carnotEfficiency,
  fringeSpacing,
  maxwellSpeeds,
  mountSimulation,
  particleFamilies,
  pendulumPeriod,
  photoelectricResult,
  relativityFactors,
  waveSample,
} from '../dist/assets/simulations.js';
import { nodes } from '../dist/assets/data/physics-data.js';

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(Number.isFinite(actual), `expected finite number, received ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}

function rejectsRangeError(operation) {
  assert.throws(operation, RangeError);
}

function attributesFrom(markup) {
  return Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
}

class FakeControl {
  constructor(attributes = {}, text = '') {
    this.attributes = { ...attributes };
    this.dataset = Object.fromEntries(Object.entries(attributes)
      .filter(([name]) => name.startsWith('data-'))
      .map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    this.value = attributes.value ?? '';
    this.textContent = text;
    this.innerHTML = '';
    this.listeners = new Map();
    this.classes = new Set(String(attributes.class ?? '').split(/\s+/).filter(Boolean));
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, force = !this.classes.has(name)) => {
        if (force) this.classes.add(name);
        else this.classes.delete(name);
        return force;
      },
    };
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    const event = { type, target: this, currentTarget: this, preventDefault() {} };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }

  querySelector(selector) {
    if (!selector.includes('data-wave-path') || !this.innerHTML.includes('data-wave-path="true"')) return null;
    const visual = this;
    return {
      getAttribute(name) {
        if (name !== 'd') return null;
        const tag = visual.innerHTML.match(/<path\b[^>]*\bdata-wave-path="true"[^>]*>/)?.[0];
        return tag?.match(/\bd="([^"]*)"/)?.[1] ?? null;
      },
      setAttribute(name, value) {
        if (name !== 'd') return;
        const tag = visual.innerHTML.match(/<path\b[^>]*\bdata-wave-path="true"[^>]*>/)?.[0];
        if (!tag) return;
        const replacement = tag.replace(/\bd="[^"]*"/, `d="${value}"`);
        visual.innerHTML = visual.innerHTML.replace(tag, replacement);
      },
    };
  }
}

class FakeSimulationContainer {
  constructor() {
    this.markup = '';
    this.parentElement = null;
    this.controls = [];
    this.elements = new Map();
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, force = !this.classes.has(name)) => {
        if (force) this.classes.add(name);
        else this.classes.delete(name);
        return force;
      },
    };
  }

  set innerHTML(markup) {
    this.markup = markup;
    const inputs = [...markup.matchAll(/<input\b([^>]*)>/g)].map(([, attributes]) => new FakeControl(attributesFrom(attributes)));
    const selects = [...markup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)].map(([, attributes, options]) => {
      const parsed = attributesFrom(attributes);
      const selected = options.match(/<option\b[^>]*value="([^"]*)"[^>]*\bselected\b/);
      if (selected) parsed.value = selected[1];
      return new FakeControl(parsed);
    });
    this.controls = [...inputs, ...selects];
    for (const role of ['result', 'validation', 'visual']) {
      this.elements.set(role, new FakeControl({ 'data-role': role }));
    }
    const pauseMarkup = markup.match(/<button\b([^>]*data-action="pause"[^>]*)>([\s\S]*?)<\/button>/);
    this.elements.set('pause', new FakeControl(
      attributesFrom(pauseMarkup?.[1] ?? 'data-action="pause"'),
      pauseMarkup?.[2]?.replace(/<[^>]+>/g, '').trim() ?? '',
    ));
  }

  get innerHTML() { return this.markup; }
  querySelectorAll(selector) { return selector.includes('data-param') ? this.controls : []; }
  querySelector(selector) {
    const role = selector.match(/data-role=["']([^"']+)["']/)?.[1];
    if (role) return this.elements.get(role) ?? null;
    if (selector.includes('data-action') && selector.includes('pause')) return this.elements.get('pause');
    return null;
  }

  closest(selector) {
    if (selector !== '.reduced-motion') return null;
    for (let node = this; node; node = node.parentElement) {
      if (node.classList?.contains('reduced-motion')) return node;
    }
    return null;
  }
}

function withFakeAnimationFrame(run) {
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  const pending = new Map();
  const cancelled = [];
  let nextId = 1;
  let requests = 0;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextId++;
    requests += 1;
    pending.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.push(id);
    pending.delete(id);
  };
  const frames = {
    pending,
    cancelled,
    get requests() { return requests; },
    step(timestamp) {
      const entry = pending.entries().next().value;
      assert.ok(entry, 'an animation frame should be pending');
      pending.delete(entry[0]);
      entry[1](timestamp);
    },
  };
  try {
    return run(frames);
  } finally {
    if (previousRequest === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = previousRequest;
    if (previousCancel === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = previousCancel;
  }
}

function wavePathPoints(path) {
  return [...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
}

test('small-angle pendulum returns a period in seconds for a one-metre length', () => {
  closeTo(pendulumPeriod({ length: 1, gravity: 9.8 }), 2.0071, 0.001);
});

test('pendulum rejects zero, negative, and non-finite physical parameters', () => {
  for (const input of [
    { length: 0, gravity: 9.8 },
    { length: -1, gravity: 9.8 },
    { length: 1, gravity: 0 },
    { length: 1, gravity: -9.8 },
    { length: Number.NaN, gravity: 9.8 },
    { length: 1, gravity: Number.POSITIVE_INFINITY },
  ]) rejectsRangeError(() => pendulumPeriod(input));
});

test('travelling and standing wave samples repeat after one period', () => {
  for (const mode of ['travelling', 'standing']) {
    const input = { x: 0.31, time: 0.12, amplitude: 0.8, wavelength: 1.6, period: 2, mode };
    closeTo(waveSample({ ...input, time: input.time + input.period }), waveSample(input), 1e-12);
  }
});

test('wave samples reject invalid denominators, amplitudes, inputs, and modes', () => {
  const valid = { x: 1, time: 0.5, amplitude: 1, wavelength: 2, period: 1, mode: 'travelling' };
  for (const input of [
    { ...valid, wavelength: 0 },
    { ...valid, wavelength: -2 },
    { ...valid, period: 0 },
    { ...valid, period: -1 },
    { ...valid, amplitude: -1 },
    { ...valid, x: Number.NaN },
    { ...valid, time: Number.NEGATIVE_INFINITY },
    { ...valid, mode: 'unsupported' },
  ]) rejectsRangeError(() => waveSample(input));
});

test('double-slit fringe spacing converts the 500 nm example to two millimetres', () => {
  closeTo(fringeSpacing({ wavelength: 500e-9, slitSeparation: 0.25e-3, screenDistance: 1 }), 0.002, 1e-12);
});

test('double-slit spacing rejects zero denominators and invalid physical parameters', () => {
  for (const input of [
    { wavelength: 0, slitSeparation: 0.25e-3, screenDistance: 1 },
    { wavelength: -500e-9, slitSeparation: 0.25e-3, screenDistance: 1 },
    { wavelength: 500e-9, slitSeparation: 0, screenDistance: 1 },
    { wavelength: 500e-9, slitSeparation: -0.25e-3, screenDistance: 1 },
    { wavelength: 500e-9, slitSeparation: 0.25e-3, screenDistance: 0 },
    { wavelength: 500e-9, slitSeparation: 0.25e-3, screenDistance: Number.POSITIVE_INFINITY },
  ]) rejectsRangeError(() => fringeSpacing(input));
});

test('Maxwell characteristic speeds scale as square-root temperature and inverse square-root molar mass', () => {
  const base = maxwellSpeeds({ temperature: 300, molarMass: 0.028 });
  const hotter = maxwellSpeeds({ temperature: 600, molarMass: 0.028 });
  const heavier = maxwellSpeeds({ temperature: 300, molarMass: 0.112 });

  assert.ok(base.mostProbable >= 420 && base.mostProbable <= 424, 'nitrogen-like most-probable speed should be about 422 m/s');
  closeTo(hotter.mostProbable / base.mostProbable, Math.sqrt(2), 1e-12);
  closeTo(heavier.mostProbable / base.mostProbable, 0.5, 1e-12);
  assert.ok(base.mostProbable < base.mean && base.mean < base.rms, 'the three characteristic speeds should be ordered');
});

test('Maxwell speeds reject non-positive or non-finite temperature and molar mass', () => {
  for (const input of [
    { temperature: 0, molarMass: 0.028 },
    { temperature: -1, molarMass: 0.028 },
    { temperature: 300, molarMass: 0 },
    { temperature: 300, molarMass: -0.028 },
    { temperature: Number.NaN, molarMass: 0.028 },
    { temperature: 300, molarMass: Number.POSITIVE_INFINITY },
  ]) rejectsRangeError(() => maxwellSpeeds(input));
});

test('Maxwell speeds reject the nonrelativistic model outside the conservative 0.1c RMS bound', () => {
  rejectsRangeError(() => maxwellSpeeds({ temperature: 1e14, molarMass: 0.002 }));
  const ordinary = maxwellSpeeds({ temperature: 300, molarMass: 0.028 });
  assert.ok(ordinary.rms < 0.1 * 299792458);

  const container = new FakeSimulationContainer();
  const cleanup = mountSimulation(container, 'maxwell');
  assert.match(container.querySelector('[data-role="result"]').textContent, /0\.1c/);
  cleanup();
});

test('Maxwell speeds reject the exact theoretical critical temperature for common molar masses', () => {
  const rmsLimit = 0.1 * 299792458;
  const gasConstant = 8.31446261815324;
  for (const molarMass of [0.002, 0.028]) {
    const criticalTemperature = (rmsLimit ** 2 / (3 * gasConstant)) * molarMass;
    rejectsRangeError(() => maxwellSpeeds({ temperature: criticalTemperature, molarMass }));
  }
});

test('Maxwell speeds accept temperatures just below the theoretical critical boundary', () => {
  const rmsLimit = 0.1 * 299792458;
  const gasConstant = 8.31446261815324;
  for (const molarMass of [0.002, 0.028]) {
    const criticalTemperature = (rmsLimit ** 2 / (3 * gasConstant)) * molarMass;
    const result = maxwellSpeeds({ temperature: criticalTemperature * (1 - 1e-12), molarMass });
    assert.ok(result.rms < rmsLimit, `M=${molarMass} kg/mol should remain below 0.1c just below critical temperature`);
  }
});

test('Maxwell rejects the exact critical temperature for huge finite molar masses while accepting just below it', () => {
  const rmsLimit = 0.1 * 299792458;
  const gasConstant = 8.31446261815324;
  for (const molarMass of [2.5e293, 5e293]) {
    const criticalTemperature = (rmsLimit ** 2 / (3 * gasConstant)) * molarMass;
    rejectsRangeError(() => maxwellSpeeds({ temperature: criticalTemperature, molarMass }));

    const result = maxwellSpeeds({ temperature: criticalTemperature * (1 - 1e-12), molarMass });
    assert.ok(result.rms < rmsLimit, `M=${molarMass} kg/mol should remain below 0.1c just below critical temperature`);
  }
});

test('Carnot efficiency is bounded and vanishes for equal positive reservoir temperatures', () => {
  const efficiency = carnotEfficiency({ hotK: 500, coldK: 300 });
  assert.ok(efficiency >= 0 && efficiency <= 1);
  closeTo(efficiency, 0.4, 1e-12);
  closeTo(carnotEfficiency({ hotK: 300, coldK: 300 }), 0, 1e-12);
});

test('Carnot efficiency rejects absolute-zero, inverted, negative, and non-finite reservoirs', () => {
  for (const input of [
    { hotK: 0, coldK: 100 },
    { hotK: 300, coldK: 0 },
    { hotK: 300, coldK: 301 },
    { hotK: -1, coldK: 100 },
    { hotK: 500, coldK: Number.NaN },
    { hotK: Number.POSITIVE_INFINITY, coldK: 300 },
  ]) rejectsRangeError(() => carnotEfficiency(input));
});

test('relativistic factors start at one and increase monotonically for subluminal beta', () => {
  const still = relativityFactors(0);
  const moderate = relativityFactors(0.6);
  const fast = relativityFactors(0.8);
  closeTo(still.gamma, 1, 1e-12);
  closeTo(still.lengthContractionFactor, 1, 1e-12);
  assert.ok(moderate.gamma > still.gamma && fast.gamma > moderate.gamma);
  assert.ok(moderate.lengthContractionFactor < still.lengthContractionFactor);
  assert.ok(fast.lengthContractionFactor < moderate.lengthContractionFactor);
  closeTo(fast.gamma, 5 / 3, 1e-12);
  closeTo(fast.lengthContractionFactor, 0.6, 1e-12);
});

test('relativistic factors reject light speed, superluminal speed, and non-finite beta', () => {
  for (const beta of [1, -1, 1.1, -1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    rejectsRangeError(() => relativityFactors(beta));
  }
});

test('photoelectric effect separates threshold, emission, and stopping voltage', () => {
  const workFunctionEv = 2;
  const thresholdFrequencyHz = workFunctionEv / 4.135667696e-15;
  const below = photoelectricResult({ frequencyHz: thresholdFrequencyHz * 0.9, workFunctionEv });
  const atThreshold = photoelectricResult({ frequencyHz: thresholdFrequencyHz, workFunctionEv });
  const above = photoelectricResult({ frequencyHz: 5e14, workFunctionEv });

  assert.equal(below.emitted, false);
  assert.equal(below.maxKineticEnergyEv, null);
  assert.equal(below.maxKineticEnergyJ, null);
  assert.equal(below.stoppingPotentialV, null);
  assert.equal(atThreshold.emitted, true);
  closeTo(atThreshold.maxKineticEnergyEv, 0, 1e-12);
  assert.equal(above.emitted, true);
  assert.ok(above.maxKineticEnergyEv > 0);
  closeTo(above.stoppingPotentialV, above.maxKineticEnergyEv, 1e-12);
  closeTo(above.thresholdFrequencyHz, thresholdFrequencyHz, 1e-3);
  closeTo(above.maxKineticEnergyJ, above.maxKineticEnergyEv * 1.602176634e-19, 1e-30);
});

test('sub-threshold photons do not render a zero-energy photoelectron', () => {
  const container = new FakeSimulationContainer();
  const cleanup = mountSimulation(container, 'photoelectric');
  const work = container.controls.find((item) => item.dataset.param === 'workFunctionEv');
  work.value = '4'; work.dispatch('input');
  assert.match(container.querySelector('[data-role="result"]').textContent, /无光电子逸出.*不适用/);
  assert.doesNotMatch(container.querySelector('[data-role="visual"]').innerHTML, /<circle\b/);
  cleanup();
});

test('photoelectric effect rejects non-positive and non-finite photon parameters', () => {
  for (const input of [
    { frequencyHz: 0, workFunctionEv: 2 },
    { frequencyHz: -1, workFunctionEv: 2 },
    { frequencyHz: 5e14, workFunctionEv: 0 },
    { frequencyHz: 5e14, workFunctionEv: -2 },
    { frequencyHz: Number.POSITIVE_INFINITY, workFunctionEv: 2 },
    { frequencyHz: 5e14, workFunctionEv: Number.NaN },
  ]) rejectsRangeError(() => photoelectricResult(input));
});

test('numerical models reject finite inputs whose derived outputs overflow', () => {
  rejectsRangeError(() => pendulumPeriod({ length: Number.MAX_VALUE, gravity: Number.MIN_VALUE }));
  rejectsRangeError(() => waveSample({ x: Number.MAX_VALUE, time: 0, amplitude: 1, wavelength: Number.MIN_VALUE, period: 1, mode: 'travelling' }));
  rejectsRangeError(() => fringeSpacing({ wavelength: Number.MAX_VALUE, slitSeparation: Number.MIN_VALUE, screenDistance: 1 }));
  rejectsRangeError(() => maxwellSpeeds({ temperature: Number.MAX_VALUE, molarMass: Number.MIN_VALUE }));
  rejectsRangeError(() => photoelectricResult({ frequencyHz: 5e14, workFunctionEv: Number.MAX_VALUE }));
});

test('pendulum rejects positive inputs whose period underflows to zero', () => {
  rejectsRangeError(() => pendulumPeriod({ length: Number.MIN_VALUE, gravity: Number.MAX_VALUE }));
});

test('double-slit model rejects positive inputs whose fringe spacing underflows to zero', () => {
  rejectsRangeError(() => fringeSpacing({ wavelength: Number.MIN_VALUE, slitSeparation: Number.MAX_VALUE, screenDistance: Number.MIN_VALUE }));
});

test('Maxwell model rejects positive inputs whose characteristic speeds underflow to zero', () => {
  rejectsRangeError(() => maxwellSpeeds({ temperature: Number.MIN_VALUE, molarMass: Number.MAX_VALUE }));
});

test('Carnot model rejects distinct positive reservoirs when efficiency rounds to one', () => {
  rejectsRangeError(() => carnotEfficiency({ hotK: Number.MAX_VALUE, coldK: Number.MIN_VALUE }));
});

test('underflow guards preserve valid physical zero results', () => {
  closeTo(waveSample({ x: 0, time: 0, amplitude: 0, wavelength: 1, period: 1, mode: 'standing' }), 0);
  closeTo(carnotEfficiency({ hotK: 300, coldK: 300 }), 0);
  const threshold = 2 / 4.135667696e-15;
  closeTo(photoelectricResult({ frequencyHz: threshold, workFunctionEv: 2 }).maxKineticEnergyEv, 0);
});

test('particle families distinguish Standard Model mediators from gravity', () => {
  assert.ok(particleFamilies.families.some(({ id }) => id === 'quarks'));
  assert.ok(particleFamilies.families.some(({ id }) => id === 'leptons'));
  const interactions = new Map(particleFamilies.interactions.map((interaction) => [interaction.id, interaction]));
  for (const id of ['strong', 'electromagnetic', 'weak']) {
    assert.equal(interactions.get(id)?.withinStandardModel, true);
    assert.ok(interactions.get(id)?.mediators?.length, `${id} should name its Standard Model mediator`);
  }
  const gravity = interactions.get('gravity');
  assert.ok(gravity);
  assert.equal(gravity.withinStandardModel, false);
  assert.equal(gravity.mediators.length, 0, 'gravity must not be assigned a confirmed Standard Model mediator');
  assert.match(gravity.explanation, /标准模型之外/);
  assert.match(gravity.explanation, /假设|尚未证实|未证实/);
});

test('each chapter has a node bound to one of the eight simulation IDs', () => {
  const requiredIds = ['pendulum', 'wave', 'interference', 'maxwell', 'carnot', 'relativity', 'photoelectric', 'particles'];
  const boundIds = new Set(nodes.map(({ simulationId }) => simulationId).filter(Boolean));
  assert.deepEqual([...boundIds].sort(), [...requiredIds].sort());
  for (const id of requiredIds) {
    assert.ok(nodes.some((node) => node.simulationId === id), `${id} should bind to at least one dataset node`);
  }
});

test('all eight simulations mount labeled controls, a result, and an explanatory visual fallback', () => {
  const ids = ['pendulum', 'wave', 'interference', 'maxwell', 'carnot', 'relativity', 'photoelectric', 'particles'];
  for (const id of ids) {
    const container = new FakeSimulationContainer();
    const cleanup = mountSimulation(container, id);
    assert.equal(typeof cleanup, 'function', `${id} should provide cleanup`);
    assert.ok(container.controls.length <= (id === 'wave' ? 4 : 3), `${id} should keep its controls compact`);
    assert.ok(container.controls.every((control) => control.getAttribute('aria-label') || /<label\b/.test(container.markup)), `${id} controls should have accessible labels`);
    assert.ok(container.querySelector('[data-role="result"]').textContent.length > 0, `${id} should show a numerical or explanatory result`);
    assert.match(container.querySelector('[data-role="result"]').textContent, /适用|有效|标准模型/, `${id} output should state its validity or classification condition`);
    assert.match(container.markup, /<svg\b|<canvas\b/, `${id} should include a visual`);
    assert.match(container.markup, /simulation-fallback/, `${id} should retain a static explanatory fallback`);
    cleanup();
  }
});

test('only time-evolving experiments expose pause and single-step controls', () => {
  for (const id of ['wave', 'pendulum']) {
    const container = new FakeSimulationContainer();
    const cleanup = mountSimulation(container, id);
    assert.match(container.markup, /data-action="pause"/, `${id} should pause`);
    assert.match(container.markup, /data-action="step"/, `${id} should step`);
    cleanup();
  }
  for (const id of ['interference', 'maxwell', 'carnot', 'relativity', 'photoelectric', 'particles']) {
    const container = new FakeSimulationContainer();
    const cleanup = mountSimulation(container, id);
    assert.doesNotMatch(container.markup, /data-action="(?:pause|step)"/, `${id} is a parameter diagram, not a time animation`);
    cleanup();
  }
});

test('invalid simulation input produces a clear message without non-finite output, and pause is keyboard-operable', () => {
  const container = new FakeSimulationContainer();
  const cleanup = mountSimulation(container, 'pendulum');
  const lengthControl = container.controls.find((control) => control.dataset.param === 'length');
  assert.ok(lengthControl, 'pendulum length should be an accessible native control');
  lengthControl.value = '0';
  lengthControl.dispatch('input');
  const validation = container.querySelector('[data-role="validation"]').textContent;
  const result = container.querySelector('[data-role="result"]').textContent;
  assert.match(validation, /必须|大于|有效/);
  assert.doesNotMatch(`${validation} ${result}`, /NaN|Infinity/);

  const pause = container.querySelector('[data-action="pause"]');
  assert.ok(pause, 'running visual should expose a native pause button');
  pause.dispatch('click');
  assert.equal(pause.getAttribute('aria-pressed'), 'true');
  cleanup();
});

test('changing pendulum length updates both the period summary and its visual', () => {
  const container = new FakeSimulationContainer();
  const cleanup = mountSimulation(container, 'pendulum');
  const initialVisual = container.querySelector('[data-role="visual"]').innerHTML;
  const lengthControl = container.controls.find((control) => control.dataset.param === 'length');
  lengthControl.value = '2';
  lengthControl.dispatch('input');
  assert.match(container.querySelector('[data-role="result"]').textContent, /周期 T = 2\.84 s/);
  assert.notEqual(container.querySelector('[data-role="visual"]').innerHTML, initialVisual);
  cleanup();
});

test('wave SVG path evolves as a travelling wave and standing-wave nodes stay fixed', () => {
  withFakeAnimationFrame((frames) => {
    const travelling = new FakeSimulationContainer();
    const cleanupTravelling = mountSimulation(travelling, 'wave');
    const travellingPath = travelling.querySelector('[data-role="visual"]').querySelector('[data-wave-path]');
    assert.ok(travellingPath, 'wave visualization should expose an updatable SVG path');
    const travellingStart = travellingPath.getAttribute('d');
    frames.step(0);
    frames.step(500);
    assert.notEqual(travellingPath.getAttribute('d'), travellingStart, 'travelling wave geometry should change with time');
    cleanupTravelling();

    const standing = new FakeSimulationContainer();
    const cleanupStanding = mountSimulation(standing, 'wave');
    const mode = standing.controls.find((control) => control.dataset.param === 'mode');
    mode.value = 'standing';
    mode.dispatch('input');
    const standingPath = standing.querySelector('[data-role="visual"]').querySelector('[data-wave-path]');
    assert.ok(standingPath, 'standing-wave visualization should expose an updatable SVG path');
    const standingStart = wavePathPoints(standingPath.getAttribute('d'));
    frames.step(1000);
    frames.step(1500);
    const standingLater = wavePathPoints(standingPath.getAttribute('d'));
    for (const nodeIndex of [0, 16, 32, 48, 64]) {
      assert.equal(standingLater[nodeIndex].y, standingStart[nodeIndex].y, `standing-wave node ${nodeIndex} should not move`);
    }
    assert.notEqual(standingLater[7].y, standingStart[7].y, 'standing-wave antinodes should oscillate');
    cleanupStanding();
  });
});

test('wave animation pauses, resumes, and cancels its pending frame on cleanup', () => {
  withFakeAnimationFrame((frames) => {
    const container = new FakeSimulationContainer();
    const cleanup = mountSimulation(container, 'wave');
    assert.equal(frames.pending.size, 1);
    const pause = container.querySelector('[data-action="pause"]');
    pause.dispatch('click');
    assert.equal(frames.pending.size, 0, 'pausing should cancel the scheduled frame');
    pause.dispatch('click');
    assert.equal(frames.pending.size, 1, 'resuming should restart the animation');
    cleanup();
    assert.equal(frames.pending.size, 0, 'cleanup should leave no animation frame pending');
    assert.ok(frames.cancelled.length >= 2, 'pause and cleanup should cancel outstanding frames');
  });
});

test('mountSimulation honors the system reduced-motion preference', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { matchMedia: (query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }) };
  try {
    withFakeAnimationFrame((frames) => {
      const container = new FakeSimulationContainer();
      const cleanup = mountSimulation(container, 'wave');
      assert.ok(container.classList.contains('reduced-motion'));
      assert.equal(frames.requests, 0, 'system reduced motion should prevent scheduling animation');
      cleanup();
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('wave animation follows app-level reduced-motion toggles and disconnects its observer', () => {
  const previousObserver = globalThis.MutationObserver;
  class FakeMutationObserver {
    static instance;
    constructor(callback) { this.callback = callback; this.disconnected = false; FakeMutationObserver.instance = this; }
    observe() {}
    disconnect() { this.disconnected = true; }
    trigger() { this.callback([], this); }
  }
  globalThis.MutationObserver = FakeMutationObserver;
  try {
    withFakeAnimationFrame((frames) => {
      const appClasses = new Set();
      const appRoot = {
        parentElement: null,
        classList: {
          add: (name) => appClasses.add(name),
          remove: (name) => appClasses.delete(name),
          contains: (name) => appClasses.has(name),
          toggle: (name, force = !appClasses.has(name)) => {
            if (force) appClasses.add(name);
            else appClasses.delete(name);
            return force;
          },
        },
      };
      const container = new FakeSimulationContainer();
      container.parentElement = appRoot;
      const cleanup = mountSimulation(container, 'wave');
      const observer = FakeMutationObserver.instance;
      assert.equal(frames.pending.size, 1);
      appRoot.classList.add('reduced-motion');
      observer.trigger();
      assert.equal(frames.pending.size, 0, 'app motion toggle should cancel the wave loop');
      appRoot.classList.remove('reduced-motion');
      observer.trigger();
      assert.equal(frames.pending.size, 1, 'restoring app motion should resume the wave loop');
      cleanup();
      assert.equal(frames.pending.size, 0);
      assert.equal(observer.disconnected, true, 'cleanup should disconnect app motion observation');
    });
  } finally {
    if (previousObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = previousObserver;
  }
});

test('pendulum display uses simulated angle and constant length scale', () => {
  withFakeAnimationFrame((frames) => {
    const container = new FakeSimulationContainer();
    const cleanup = mountSimulation(container, 'pendulum');
    const visual = container.querySelector('[data-role="visual"]');
    assert.match(visual.innerHTML, /data-pendulum-bob/);
    const initial = visual.innerHTML;
    frames.step(0); frames.step(500);
    assert.notEqual(visual.innerHTML, initial);
    assert.match(container.querySelector('[data-role="result"]').textContent, /t = 0\.5 s/);
    cleanup();
  });
});

test('wave visual keeps fixed metre and millimetre axes as amplitude changes', () => {
  const container = new FakeSimulationContainer(); const cleanup = mountSimulation(container, 'wave');
  const visual = container.querySelector('[data-role="visual"]');
  assert.match(visual.innerHTML, /x：0—6 m/);
  assert.match(visual.innerHTML, /y：−11—11 mm/);
  const control = container.controls.find((item) => item.dataset.param === 'amplitude');
  control.value = '0.005'; control.dispatch('input');
  assert.match(container.querySelector('[data-role="result"]').textContent, /5 mm/);
  assert.match(container.querySelector('[data-role="validation"]').textContent, /重置为 0 s/);
  const period = container.controls.find((item) => item.dataset.param === 'period');
  assert.ok(period, 'period should be adjustable');
  period.value = '1'; period.dispatch('input');
  assert.match(container.querySelector('[data-role="result"]').textContent, /T = 1 s，u = 1\.6 m\/s/);
  cleanup();
});

test('Maxwell overlay and screen-scale slit markers expose physical comparisons', () => {
  const maxwell = new FakeSimulationContainer(); const closeMaxwell = mountSimulation(maxwell, 'maxwell');
  assert.match(maxwell.querySelector('[data-role="visual"]').innerHTML, /300 K 参考/);
  assert.match(maxwell.querySelector('[data-role="visual"]').innerHTML, /5000 m\/s/);
  assert.match(maxwell.querySelector('[data-role="visual"]').innerHTML, /<text[^>]*>窗口外/);
  closeMaxwell();
  const interference = new FakeSimulationContainer(); const closeInterference = mountSimulation(interference, 'interference');
  assert.match(interference.querySelector('[data-role="visual"]').innerHTML, /−30—30 mm/);
  assert.match(interference.querySelector('[data-role="visual"]').innerHTML, /data-slit="left"/);
  assert.match(interference.querySelector('[data-role="visual"]').innerHTML, /data-slit="right"/);
  const screenSamples = (interference.querySelector('[data-role="visual"]').innerHTML.match(/x1="215"/g) ?? []).length;
  assert.ok(screenSamples >= 1201, 'screen sampling should resolve the shortest 0.38 mm fringe spacing');
  closeInterference();
});

test('Carnot plot uses calculated segments and equal reservoirs remove enclosed area', () => {
  const container = new FakeSimulationContainer(); const cleanup = mountSimulation(container, 'carnot');
  const visual = container.querySelector('[data-role="visual"]');
  assert.match(visual.innerHTML, /data-cycle-segment="0"/);
  assert.match(container.querySelector('[data-role="result"]').textContent, /W =/);
  const hot = container.controls.find((item) => item.dataset.param === 'hotK');
  hot.value = '300'; hot.dispatch('input');
  assert.match(container.querySelector('[data-role="result"]').textContent, /W = 0 J/);
  cleanup();
});

test('Carnot state markers preserve ideal gas coordinates when temperatures coincide', () => {
  const container = new FakeSimulationContainer();
  const cleanup = mountSimulation(container, 'carnot');
  const hot = container.controls.find((item) => item.dataset.param === 'hotK');
  hot.value = '300'; hot.dispatch('input');
  const markup = container.querySelector('[data-role="visual"]').innerHTML;
  const markers = [...markup.matchAll(/<circle\b([^>]*data-cycle-state[^>]*)>/g)].map(([, attributes]) => attributesFrom(attributes));
  assert.equal(markers.length, 4);
  const expected = [[178.57, 44.55], [307.14, 117.27], [307.14, 117.27], [178.57, 44.55]];
  markers.forEach((marker, index) => {
    closeTo(Number(marker.cx), expected[index][0], 0.01);
    closeTo(Number(marker.cy), expected[index][1], 0.01);
  });
  const curves = [...markup.matchAll(/<path\b([^>]*data-cycle-segment[^>]*)>/g)].map(([, attributes]) => attributesFrom(attributes));
  assert.equal(curves.filter((curve) => curve['marker-end']).length, 2);
  cleanup();
});

test('photoelectric and relativity show energy and same-frame clock comparisons', () => {
  const photo = new FakeSimulationContainer(); const closePhoto = mountSimulation(photo, 'photoelectric');
  assert.match(photo.querySelector('[data-role="visual"]').innerHTML, /Kₘₐₓ/);
  assert.doesNotMatch(photo.querySelector('[data-role="visual"]').innerHTML, /photoelectron/);
  closePhoto();
  const relativity = new FakeSimulationContainer(); const closeRelativity = mountSimulation(relativity, 'relativity');
  assert.match(relativity.querySelector('[data-role="result"]').textContent, /τ\/t/);
  assert.match(relativity.querySelector('[data-role="visual"]').innerHTML, /实验室时钟/);
  closeRelativity();
  const particles = new FakeSimulationContainer(); const closeParticles = mountSimulation(particles, 'particles');
  assert.doesNotMatch(particles.markup, /data-action="pause"/);
  closeParticles();
});
