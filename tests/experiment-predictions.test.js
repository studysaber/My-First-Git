import test from 'node:test';
import assert from 'node:assert/strict';
import { getPrediction, gradePrediction } from '../dist/assets/experiment-predictions.js';

test('all eight physical demonstrations begin with a parameter prediction', () => {
  for (const id of ['pendulum', 'wave', 'interference', 'maxwell', 'carnot', 'relativity', 'photoelectric', 'particles']) {
    const prediction = getPrediction(id);
    assert.ok(prediction?.prompt && prediction.options.length >= 2 && prediction.explanation, id);
    assert.equal(prediction.options.some((option) => option.id === prediction.answer), true, id);
  }
});

test('prediction feedback checks a choice without creating assessment evidence', () => {
  assert.equal(gradePrediction('pendulum', 'period-double').correct, true);
  assert.equal(gradePrediction('pendulum', 'period-quadruple').correct, false);
  assert.match(gradePrediction('pendulum', 'period-double').feedback, /T∝√ℓ/);
});
